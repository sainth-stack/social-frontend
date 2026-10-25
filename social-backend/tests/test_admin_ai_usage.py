from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import mongomock.aggregate
import mongomock.filtering
import pytest
from bson.decimal128 import Decimal128

from app.admin import ai_usage
from app.core.config import settings
from app.core.security import create_access_token


API = f"{settings.api_v1_prefix}/admin/ai-usage"
NOW = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
USER = str(uuid.UUID(int=1))
WORKSPACE = str(uuid.UUID(int=2))
PARAMS = {"startDate": "2026-10-23", "endDate": "2026-10-24"}


@pytest.fixture(autouse=True)
def union_support(monkeypatch):
    compare = mongomock.filtering.bson_compare

    def decimal_compare(operation, left, right, can_compare_types=True):
        left = left.to_decimal() if isinstance(left, Decimal128) else left
        right = right.to_decimal() if isinstance(right, Decimal128) else right
        return compare(operation, left, right, can_compare_types)

    def union(collection, database, options):
        other = mongomock.aggregate.process_pipeline(database[options["coll"]].find(), database, options["pipeline"], None)
        return list(collection) + list(other)

    monkeypatch.setitem(mongomock.aggregate._PIPELINE_HANDLERS, "$unionWith", union)
    monkeypatch.setattr(mongomock.filtering, "bson_compare", decimal_compare)


@pytest.fixture()
def headers(db):
    db["users"].insert_one({"id": USER, "email": "admin@example.com", "full_name": "Admin [Ops]", "is_active": True, "is_platform_admin": True})
    db["workspaces"].insert_one({"id": WORKSPACE, "name": "Main Team", "owner_user_id": USER})
    return {"Authorization": f"Bearer {create_access_token(subject=USER)}"}


def event(db, **values):
    document = {
        "id": str(uuid.uuid4()),
        "created_at": NOW, "workspace_id": WORKSPACE, "user_id": USER,
        "kind": "text", "model_id": "test.model", "region": "us-east-1", "status": "success",
        "quantity": 1, "input_tokens": 100, "output_tokens": 50, "cache_read_tokens": 20,
        "cache_write_tokens": 10, "estimated_cost_usd": 0.1, "pricing_status": "priced",
        **values,
    }
    db["ai_provider_usage"].insert_one(document)


def quota(db, **values):
    db["plans_ai_usage"].insert_one({"id": str(uuid.uuid4()), "created_at": NOW, "workspace_id": WORKSPACE, "user_id": USER,
                                    "kind": "text", "quantity": 1, **values})


def get(client, headers, **params):
    response = client.get(API, params={**PARAMS, **params}, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("identity,expected", [("anonymous", 401), ("member", 403), ("inactive", 401)])
def test_authorization(client, db, identity, expected):
    headers = {}
    if identity != "anonymous":
        db["users"].insert_one({"id": USER, "email": "u@example.com", "is_active": identity != "inactive", "is_platform_admin": identity == "inactive"})
        headers = {"Authorization": f"Bearer {create_access_token(subject=USER)}"}
    assert client.get(API, headers=headers).status_code == expected
    assert db["ai_provider_usage"].count_documents({}) == 0


def test_generations_are_not_invocations_or_provider_quantity(client, db, headers):
    event(db)
    event(db, kind="image", quantity=4, input_tokens=None, output_tokens=None, cache_read_tokens=None, cache_write_tokens=None, estimated_cost_usd=0.2)
    event(db, estimated_cost_usd=0.3)
    quota(db, quantity=7)
    quota(db, kind="image", quantity=2)
    quota(db, kind="video", quantity=99)
    report = get(client, headers)
    summary = report["summary"]
    assert (summary["textGenerations"], summary["imageGenerations"]) == (7, 2)
    assert (summary["providerCalls"], summary["textProviderCalls"], summary["imageProviderCalls"], summary["providerQuantity"]) == (3, 2, 1, 6)
    assert [summary[key] for key in ("inputTokens", "outputTokens", "cacheReadTokens", "cacheWriteTokens")] == [200, 100, 40, 20]
    assert summary["estimatedKnownCostUsd"] == summary["totalCostUsd"] == summary["estimatedCostUsd"] == 0.6
    assert not summary["historicalUnknown"]
    assert report["items"][0]["userId"] == USER
    assert len(report["daily"]) == 2 and report["daily"][0]["providerCalls"] == 0
    assert report["daily"][1]["providerCalls"] == 3
    models = {row["id"]: row for row in report["models"]}
    assert models["test.model"]["textGenerations"] == 0
    assert models[ai_usage.UNKNOWN]["textGenerations"] == 7


@pytest.mark.parametrize("pricing_status", ["missing_rate", "missing_usage", "unknown"])
def test_mixed_known_and_unknown_never_reports_complete_zero(client, db, headers, pricing_status):
    event(db)
    event(db, pricing_status=pricing_status, estimated_cost_usd=None)
    event(db, status="error", pricing_status="unknown", estimated_cost_usd=None)
    event(db, status="filtered", pricing_status="unknown", estimated_cost_usd=None)
    summary = get(client, headers)["summary"]
    assert summary["estimatedKnownCostUsd"] == 0.1
    assert summary["estimatedCostUsd"] is None and summary["totalCostUsd"] is None
    assert (summary["pricedCalls"], summary["unpricedCalls"], summary["failedCalls"], summary["filteredCalls"]) == (1, 3, 1, 1)


@pytest.mark.parametrize("with_ledger", [True, False])
def test_legacy_cutoff_does_not_guess_correlations(client, db, headers, with_ledger):
    if with_ledger:
        event(db)
    quota(db, created_at=NOW - timedelta(days=1), quantity=5)
    quota(db, created_at=NOW, kind="image", quantity=3)
    summary = get(client, headers)["summary"]
    assert summary["legacyTextGenerations"] == 5
    assert summary["legacyImageGenerations"] == (0 if with_ledger else 3)
    assert summary["historicalUnknown"]
    assert summary["totalCostUsd"] is None
    assert summary["textGenerations"] == 5


def test_cutoff_is_global_not_reset_by_scope(client, db, headers):
    event(db, created_at=NOW - timedelta(days=10), workspace_id=str(uuid.UUID(int=9)))
    quota(db, created_at=NOW - timedelta(days=1), quantity=12)
    summary = get(client, headers, workspaceId=WORKSPACE)["summary"]
    assert summary["legacyTextGenerations"] == 0
    assert summary["historicalUnknown"]
    assert summary["totalCostUsd"] is None
    assert summary["providerCalls"] == 0


def test_anonymous_and_deleted_never_fabricate_owner(client, db, headers):
    deleted = str(uuid.UUID(int=99))
    event(db, user_id=None)
    event(db, user_id=deleted, workspace_id=deleted)
    quota(db, user_id=None)
    rows = {row["id"]: row for row in get(client, headers)["items"]}
    assert USER not in rows
    assert rows[ai_usage.UNKNOWN]["name"] == "Unattributed"
    assert rows[ai_usage.UNKNOWN]["userId"] is None
    assert rows[ai_usage.UNKNOWN]["unattributedCalls"] == 1
    assert rows[deleted]["name"] == "Deleted user" and rows[deleted]["userId"] == deleted
    workspaces = {row["id"]: row for row in get(client, headers, groupBy="workspace")["items"]}
    assert workspaces[deleted]["name"] == "Deleted workspace"
    assert workspaces[WORKSPACE]["name"] == "Main Team"


def test_utc_inclusive_boundaries(client, db, headers):
    start = datetime(2026, 10, 23, tzinfo=timezone.utc)
    end = datetime(2026, 10, 25, tzinfo=timezone.utc)
    for timestamp in (start - timedelta(microseconds=1), start, end - timedelta(microseconds=1), end):
        event(db, created_at=timestamp)
    report = get(client, headers)
    assert report["summary"]["providerCalls"] == 2
    assert [row["providerCalls"] for row in report["daily"]] == [1, 1]


def test_search_before_pagination_and_summary_scoped_to_search(client, db, headers):
    for index in range(25):
        identifier = str(uuid.UUID(int=100 + index))
        db["users"].insert_one({"id": identifier, "full_name": f"Person [Ops] {index}", "email": f"{index}@example.com"})
        event(db, user_id=identifier)
    event(db)
    event(db, user_id=str(uuid.UUID(int=999)))
    first = get(client, headers, search="[ops]", pageSize=10)
    last = get(client, headers, search="[ops]", pageSize=10, page=3)
    assert (first["total"], first["totalPages"], len(last["items"])) == (26, 3, 6)
    assert first["summary"]["providerCalls"] == last["summary"]["providerCalls"] == 26
    assert first["items"] == sorted(first["items"], key=lambda row: row["id"])
    assert get(client, headers, search=".*")["total"] == 0
    assert get(client, headers, search="ADMIN@EXAMPLE")["total"] == 1
    assert get(client, headers, search=USER)["total"] == 1
    assert get(client, headers, groupBy="workspace", search="main team")["summary"]["providerCalls"] == 27
    assert get(client, headers, groupBy="model", search="test.model")["total"] == 1


def test_filters_and_stable_sort(client, db, headers):
    other_user, other_workspace = str(uuid.UUID(int=44)), str(uuid.UUID(int=45))
    event(db)
    event(db, user_id=other_user, estimated_cost_usd=0.2)
    event(db, user_id=other_user, kind="image", workspace_id=other_workspace)
    quota(db, quantity=4)
    assert get(client, headers, userId=USER)["summary"]["providerCalls"] == 1
    assert get(client, headers, workspaceId=other_workspace)["summary"]["providerCalls"] == 1
    assert get(client, headers, kind="image")["summary"]["textGenerations"] == 0
    assert get(client, headers, userId=USER, workspaceId=other_workspace)["total"] == 0
    assert get(client, headers, sort="count")["items"][0]["id"] == other_user
    assert get(client, headers, sort="cost", order="asc")["items"][0]["id"] == USER
    assert get(client, headers, page=100)["summary"]["providerCalls"] == 3


@pytest.mark.parametrize("params", [
    {"startDate": "bad"}, {"startDate": "2026-02-30"}, {"endDate": "2026-10-01"},
    {"startDate": "2025-01-01", "endDate": "2026-10-24"},
    {"page": 0}, {"pageSize": 101}, {"pageSize": 0}, {"days": 8}, {"groupBy": "kind"},
    {"kind": "video"}, {"workspaceId": "bad"}, {"userId": "bad"}, {"sort": "bad"},
    {"order": "bad"}, {"search": "x" * 201}, {"startDate": "2026-1-01"},
])
def test_invalid_filters_before_aggregation(client, db, headers, monkeypatch, params):
    aggregate = Mock(side_effect=AssertionError("invalid request reached aggregation"))
    monkeypatch.setattr(db["ai_provider_usage"], "aggregate", aggregate)
    response = client.get(API, params={**PARAMS, **params}, headers=headers)
    assert response.status_code == 422, response.text
    aggregate.assert_not_called()


@pytest.mark.parametrize("days", [7, 30, 90])
def test_presets_and_empty_contract(client, headers, days):
    response = client.get(API, params={"days": days}, headers=headers)
    assert response.status_code == 200, response.text
    report = response.json()
    assert len(report["daily"]) == days
    assert report["items"] == [] and report["totalPages"] == 1
    assert report["summary"]["totalCostUsd"] == 0
    assert set(report) == {"startDate", "endDate", "currency", "costBasis", "groupBy", "summary", "items", "total", "page", "pageSize", "totalPages", "daily", "models", "pricing", "limitations"}


def test_pricing_is_current_read_only_and_does_not_reprice(client, db, headers, monkeypatch):
    monkeypatch.setattr(settings, "ai_provider_pricing_json", '{"test.model":{"inputPerMillionUsd":2,"outputPerMillionUsd":3}}')
    event(db, estimated_cost_usd=0.125)
    report = get(client, headers)
    assert report["pricing"] == [{"modelId": "test.model", "currency": "USD", "inputPerMillionUsd": 2, "outputPerMillionUsd": 3}]
    assert report["summary"]["totalCostUsd"] == 0.125
    assert client.post(API, headers=headers, json={}).status_code == 405


def test_partial_dates_and_max_range(client, headers):
    for params in ({"startDate": "2026-10-23"}, {"endDate": "2026-10-24"}):
        assert client.get(API, params=params, headers=headers).status_code == 422
    assert len(get(client, headers, startDate="2025-10-24", endDate="2026-10-24")["daily"]) == 366


@pytest.mark.parametrize("cost", [-1, float("inf"), float("nan"), None])
def test_corrupt_priced_values_are_unknown(client, db, headers, cost):
    event(db, estimated_cost_usd=cost)
    summary = get(client, headers)["summary"]
    assert summary["unpricedCalls"] == 1
    assert summary["totalCostUsd"] is None
    assert summary["estimatedKnownCostUsd"] == 0