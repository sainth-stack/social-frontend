from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import pytest

from app.admin import service
from app.billing import pricing
from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.plans import service as plans_service

API = f"{settings.api_v1_prefix}/admin"
NOW = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
TARGET = str(uuid.uuid4())


def insert_user(db, **overrides):
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": f"{user_id}@example.com",
        "full_name": "Test User",
        "is_active": True,
        "is_platform_admin": False,
        "created_at": NOW,
        **overrides,
    }
    db["users"].insert_one(dict(user))
    return user


def insert_workspace(db, owner, **overrides):
    workspace = {
        "id": str(uuid.uuid4()),
        "owner_user_id": owner["id"],
        "name": "Test Workspace",
        "plan": "starter",
        "is_active": True,
        "created_at": NOW,
        **overrides,
    }
    db["workspaces"].insert_one(dict(workspace))
    return workspace


def insert_member(db, user, workspace, **overrides):
    db["workspace_members"].insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "workspace_id": workspace["id"],
        "role": "member",
        "social_level": "editor",
        "created_at": NOW,
        **overrides,
    })


def headers_for(user):
    return {"Authorization": f"Bearer {create_access_token(subject=user['id'])}"}


@pytest.fixture()
def admin(db):
    return insert_user(db, is_platform_admin=True, email="admin@example.com")


@pytest.fixture(autouse=True)
def clear_plan_cache():
    plans_service.invalidate_override_cache()
    yield
    plans_service.invalidate_override_cache()


ADMIN_ROUTES = [
    ("GET", "/overview", None),
    ("GET", "/analytics", None),
    ("GET", "/analytics/overview", None),
    ("GET", "/users", None),
    ("POST", "/users", {"email": "created@example.com", "password": "password123"}),
    ("GET", f"/users/{TARGET}", None),
    ("PATCH", f"/users/{TARGET}", {"is_active": False}),
    ("POST", f"/users/{TARGET}/suspend", {"suspended": True}),
    ("POST", f"/users/{TARGET}/plan", {"plan": "enterprise"}),
    ("GET", "/workspaces", None),
    ("PATCH", f"/workspaces/{TARGET}/plan", {"plan": "enterprise"}),
    ("PATCH", f"/workspaces/{TARGET}/status", {"is_active": False}),
    ("GET", "/pricing", None),
    ("PUT", "/pricing/growth", {"limits": {"postsPerMonth": 0}}),
    ("GET", "/plans", None),
    ("PUT", "/plans/growth", {"posts_per_month": 0}),
    ("DELETE", "/plans/growth/override", None),
    ("GET", "/contacts", None),
    ("PATCH", f"/contacts/{TARGET}", {"status": "contacted"}),
    ("GET", "/marketing-analytics", None),
]


@pytest.mark.parametrize("method,path,payload", ADMIN_ROUTES)
@pytest.mark.parametrize("identity,expected", [("anonymous", 401), ("member", 403), ("inactive_admin", 401)])
def test_all_admin_routes_require_active_platform_admin(client, db, method, path, payload, identity, expected):
    headers = {}
    if identity != "anonymous":
        user = insert_user(db, is_active=identity == "member", is_platform_admin=identity == "inactive_admin")
        headers = headers_for(user)
    before = {name: list(db[name].find()) for name in db.list_collection_names()}
    response = client.request(method, API + path, json=payload, headers=headers)
    assert response.status_code == expected, response.text
    assert {name: list(db[name].find()) for name in db.list_collection_names()} == before


def test_users_filter_before_pagination_and_count_primary_owned_workspaces(client, db, admin):
    expected = []
    for index in range(65):
        user = insert_user(db, id=str(uuid.UUID(int=index + 1)), full_name=f"Person {index}", is_active=index % 7 != 0)
        workspace = insert_workspace(db, user, plan="growth" if index % 2 else "starter")
        insert_member(db, user, workspace, social_level="admin")
        insert_workspace(db, user, plan="enterprise", name="Secondary Only", created_at=NOW + timedelta(days=1))
        if index % 2:
            expected.append(user["id"])
    headers = headers_for(admin)
    pages = [client.get(API + "/users", params={"plan": "growth", "page": page}, headers=headers).json() for page in (1, 2, 3)]
    assert [len(page["items"]) for page in pages] == [20, 12, 0]
    assert all((page["total"], page["totalPages"], page["pageSize"]) == (32, 2, 20) for page in pages)
    assert [row["id"] for page in pages for row in page["items"]] == expected
    assert all(row["socialPermissionLevel"] == "admin" for page in pages for row in page["items"])
    filtered = client.get(API + "/users", params={"plan": "growth", "status": "suspended", "search": "person"}, headers=headers).json()
    assert filtered["total"] == 5
    assert len(filtered["items"]) == 5
    assert all(row["status"] == "suspended" for row in filtered["items"])
    for params in ({"plan": "enterprise"}, {"search": "Secondary Only"}, {"search": "no match"}):
        result = client.get(API + "/users", params=params, headers=headers).json()
        assert result["items"] == []
        assert (result["total"], result["totalPages"]) == (0, 1)


@pytest.mark.parametrize("literal", ["[Ops]", ".*", "a+b", "(", "\\", "^$", "?"])
@pytest.mark.parametrize("field", ["email", "full_name", "workspace"])
def test_user_search_is_literal_and_case_insensitive(client, db, admin, literal, field):
    user = insert_user(db, **({field: f"Match {literal} Here"} if field != "workspace" else {}))
    insert_workspace(db, user, name=f"Match {literal} Here" if field == "workspace" else "Other")
    unrelated = insert_user(db)
    insert_workspace(db, unrelated)
    response = client.get(API + "/users", params={"search": literal.upper()}, headers=headers_for(admin))
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["id"] == user["id"]


def test_user_mapping_and_owned_workspace_semantics(db, monkeypatch):
    user = insert_user(db, full_name=None)
    other = insert_user(db)
    joined = insert_workspace(db, other, name="Joined not owned", plan="enterprise", created_at=NOW - timedelta(days=1))
    insert_member(db, user, joined, social_level="admin")
    row = next(row for row in service.list_admin_users(db).items if str(row.id) == user["id"])
    assert row.name == user["email"]
    assert row.workspace_id is None
    assert (row.workspace_name, row.plan, row.social_permission_level) == ("", "starter", "viewer")
    assert service.list_admin_users(db, plan="starter").total == 0
    owned = insert_workspace(db, user, id=str(uuid.UUID(int=1)), name="Primary owned", plan="growth")
    insert_workspace(db, user, id=str(uuid.UUID(int=2)), name="Tie secondary", plan="starter")
    assert service._get_primary_workspace_for_user(db, user["id"])["id"] == owned["id"]
    monkeypatch.setattr(service, "_get_primary_workspace_for_user", Mock(side_effect=AssertionError("per-user lookup")))
    monkeypatch.setattr(service, "_get_membership", Mock(side_effect=AssertionError("per-user lookup")))
    find = Mock(wraps=db["workspace_members"].find)
    monkeypatch.setattr(db["workspace_members"], "find", find)
    result = service.list_admin_users(db, plan="growth")
    assert result.total == 1
    assert str(result.items[0].workspace_id) == owned["id"]
    assert result.items[0].social_permission_level == "viewer"
    find.assert_called_once()
    assert find.call_args.args[0] == {"$or": [{"user_id": user["id"], "workspace_id": owned["id"]}]}


def test_workspaces_array_lookahead_and_mutation_counts(client, db, admin):
    workspaces = [insert_workspace(db, admin, id=str(uuid.UUID(int=index + 1))) for index in range(43)]
    target = workspaces[0]
    insert_member(db, admin, target)
    insert_member(db, insert_user(db), target)
    headers = headers_for(admin)
    responses = [client.get(API + "/workspaces", params={"limit": 21, "offset": offset}, headers=headers) for offset in (0, 20, 40, 60)]
    assert all(response.status_code == 200 for response in responses)
    pages = [response.json() for response in responses]
    assert [len(page) for page in pages] == [21, 21, 3, 0]
    assert [row["id"] for page in pages[:3] for row in page[:20]] == [w["id"] for w in workspaces]
    assert set(pages[0][0]) == {"id", "name", "plan", "is_active", "owner_email", "member_count", "created_at"}
    assert pages[0][0]["owner_email"] == admin["email"]
    assert pages[0][0]["member_count"] == 2
    assert pages[0][1]["member_count"] == 0
    for suffix, payload in [("plan", {"plan": "enterprise"}), ("status", {"is_active": False})]:
        response = client.patch(f"{API}/workspaces/{target['id']}/{suffix}", json=payload, headers=headers)
        assert response.status_code == 200, response.text
        assert response.json()["member_count"] == 2
        assert response.json()["owner_email"] == admin["email"]
        assert response.json()[next(iter(payload))] == next(iter(payload.values()))


def test_workspaces_batch_owners_and_counts(db, monkeypatch):
    owner = insert_user(db)
    for index in range(25):
        workspace = insert_workspace(db, owner, name=f"Workspace {index}")
        insert_member(db, owner, workspace)
    users_find = Mock(wraps=db["users"].find)
    members_aggregate = Mock(wraps=db["workspace_members"].aggregate)
    monkeypatch.setattr(db["users"], "find", users_find)
    monkeypatch.setattr(db["workspace_members"], "aggregate", members_aggregate)
    monkeypatch.setattr(db["users"], "find_one", Mock(side_effect=AssertionError("per-owner lookup")))
    monkeypatch.setattr(db["workspace_members"], "count_documents", Mock(side_effect=AssertionError("per-workspace count")))
    rows = service.list_workspaces(db, limit=21)
    assert len(rows) == 21
    assert all(row[1]["email"] == owner["email"] and row[2] == 1 for row in rows)
    users_find.assert_called_once()
    members_aggregate.assert_called_once()
    ids = members_aggregate.call_args.args[0][0]["$match"]["workspace_id"]["$in"]
    assert len(ids) == 21


@pytest.mark.parametrize("literal", ["[Ops]", ".*", "a+b", "(", "\\"])
def test_workspaces_literal_search_and_missing_owner(client, db, admin, literal):
    workspace = insert_workspace(db, {"id": str(uuid.uuid4())}, name=f"Team {literal}")
    insert_workspace(db, admin, name="Other Team")
    response = client.get(API + "/workspaces", params={"search": literal.lower()}, headers=headers_for(admin))
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == workspace["id"]
    assert response.json()[0]["owner_email"] == ""
    assert response.json()[0]["member_count"] == 0


@pytest.mark.parametrize("path,params", [
    ("/workspaces", {"limit": 0}), ("/workspaces", {"limit": -1}),
    ("/workspaces", {"limit": 501}), ("/workspaces", {"offset": -1}),
    ("/users", {"page": 0}), ("/users", {"pageSize": 0}), ("/users", {"pageSize": 201}),
])
def test_pagination_validation(client, admin, path, params):
    assert client.get(API + path, params=params, headers=headers_for(admin)).status_code == 422


def test_pricing_uses_billing_source_and_preserves_usd_contract(client, db, admin, monkeypatch):
    monkeypatch.setattr(settings, "billing_pro_monthly_paise", 54321)
    monkeypatch.setattr(settings, "billing_growth_monthly_paise", 123456)
    headers = headers_for(admin)
    result = client.get(API + "/pricing", headers=headers)
    assert result.status_code == 200, result.text
    plans = {row["id"]: row for row in result.json()}
    assert plans["starter"]["priceMonthlyInr"] == 0
    assert plans["growth"]["priceMonthlyInr"] == 543.21
    assert plans["enterprise"]["priceMonthlyInr"] == 1234.56
    assert [row["id"] for row in result.json() if row["recommended"]] == ["enterprise"]
    assert all(row["limits"]["accounts"] is None for row in result.json())
    db["plan_overrides"].insert_one({"plan_key": "growth", "monthly_price_inr": 654.32, "monthly_price_inr_paise": 1})
    response = client.put(API + "/pricing/growth", json={"priceMonthlyUsd": 17.5, "priceAnnualUsd": 175, "priceMonthlyInr": 1}, headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["priceMonthlyUsd"] == 17.5
    assert response.json()["priceAnnualUsd"] == 175
    assert response.json()["priceMonthlyInr"] == 654.32
    assert pricing.monthly_price_paise(db, "growth") == 65432
    db["plan_overrides"].update_one({"plan_key": "growth"}, {"$unset": {"monthly_price_inr": ""}, "$set": {"monthly_price_inr_paise": 77777}})
    plans = client.get(API + "/pricing", headers=headers).json()
    assert next(row for row in plans if row["id"] == "growth")["priceMonthlyInr"] == 777.77


@pytest.mark.parametrize("value", ["invalid", "NaN", "Infinity", -1, {}])
@pytest.mark.parametrize("field", ["monthly_price_inr", "monthly_price_inr_paise"])
def test_invalid_billing_configuration_is_null_not_usd(client, db, admin, field, value):
    db["plan_overrides"].insert_one({"plan_key": "growth", field: value, "monthly_price_usd": 123})
    response = client.get(API + "/pricing", headers=headers_for(admin))
    assert response.status_code == 200, response.text
    plan = next(row for row in response.json() if row["id"] == "growth")
    assert plan["priceMonthlyInr"] is None
    assert plan["priceMonthlyUsd"] == 123


def test_missing_billing_price_is_null_and_starter_is_free(db, monkeypatch):
    monkeypatch.setattr(pricing, "monthly_price_paise", lambda db, key: None)
    plans = {plan.id: plan for plan in service.list_pricing_plans(db)}
    assert plans["starter"].price_monthly_inr == 0
    assert plans["growth"].price_monthly_inr is None
    assert plans["enterprise"].price_monthly_inr is None


QUOTAS = ["accounts", "postsPerMonth", "aiTextGenerations", "aiImageGenerations", "aiVideoGenerations", "templates"]


@pytest.mark.parametrize("field", QUOTAS)
@pytest.mark.parametrize("value", [-1, 1.5, True, "5"])
def test_pricing_rejects_invalid_quotas(client, db, admin, field, value):
    response = client.put(API + "/pricing/growth", json={"limits": {field: value}}, headers=headers_for(admin))
    assert response.status_code == 422, response.text
    assert db["plan_overrides"].count_documents({}) == 0


@pytest.mark.parametrize("value", [0, 7, None])
def test_pricing_quota_updates_and_unlimited_accounts(client, db, admin, value):
    limits = {field: value for field in QUOTAS}
    limits.update({"brandVoice": False, "approvalWorkflow": True})
    response = client.put(API + "/pricing/growth", json={"limits": limits}, headers=headers_for(admin))
    assert response.status_code == 200, response.text
    actual = response.json()["limits"]
    assert actual == {**limits, "accounts": None}
    effective = plans_service.get_effective_plan(db, "growth")
    assert effective.limits.connected_accounts == -1
    assert effective.limits.posts_per_month == (-1 if value is None else value)
    assert effective.limits.ai_images_per_month == (-1 if value is None else value)
    response = client.put(API + "/pricing/growth", json={"limits": {"templates": 9}}, headers=headers_for(admin))
    assert response.json()["limits"] == {**actual, "templates": 9}


@pytest.mark.parametrize("field", ["priceMonthlyUsd", "priceAnnualUsd"])
@pytest.mark.parametrize("value", [-0.01, "NaN", "Infinity", "-Infinity"])
def test_pricing_rejects_negative_nonfinite_prices(client, db, admin, field, value):
    response = client.put(API + "/pricing/growth", json={field: value}, headers=headers_for(admin))
    assert response.status_code == 422, response.text
    assert db["plan_overrides"].count_documents({}) == 0


@pytest.mark.parametrize("method,suffix,payload", [
    ("POST", "/suspend", {"suspended": True}), ("POST", "/suspend", None),
    ("POST", "/suspend", {}), ("POST", "/suspend", {"suspended": None}),
    ("PATCH", "", {"is_active": False}),
])
def test_self_suspension_is_blocked(client, db, admin, method, suffix, payload):
    response = client.request(method, f"{API}/users/{admin['id']}{suffix}", json=payload, headers=headers_for(admin))
    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "You cannot suspend your own account"
    assert db["users"].find_one({"id": admin["id"]})["is_active"] is True


def test_suspension_reactivation_and_primary_plan_mutation(client, db, admin):
    user = insert_user(db)
    first = insert_workspace(db, user, plan="starter", created_at=NOW - timedelta(days=1))
    second = insert_workspace(db, user, plan="growth")
    headers = headers_for(admin)
    for payload, expected in [({"suspended": True}, "suspended"), ({"suspended": False}, "active"), ({}, "suspended"), (None, "active")]:
        response = client.post(f"{API}/users/{user['id']}/suspend", json=payload, headers=headers)
        assert response.status_code == 200, response.text
        assert response.json()["status"] == expected
    response = client.post(f"{API}/users/{admin['id']}/suspend", json={"suspended": False}, headers=headers)
    assert response.status_code == 200
    response = client.patch(f"{API}/users/{user['id']}", json={"is_active": False}, headers=headers)
    assert response.status_code == 200
    assert response.json()["is_active"] is False
    response = client.post(f"{API}/users/{user['id']}/plan", json={"plan": "enterprise"}, headers=headers)
    assert response.status_code == 200
    assert response.json()["workspaceId"] == first["id"]
    assert response.json()["plan"] == "enterprise"
    assert db["workspaces"].find_one({"id": second["id"]})["plan"] == "growth"


def test_admin_create_user_keeps_response_and_password_security(client, db, admin):
    payload = {"email": "new@example.com", "password": "safe-password", "name": "New User", "workspaceName": "New Team", "plan": "growth"}
    response = client.post(API + "/users", json=payload, headers=headers_for(admin))
    assert response.status_code == 201, response.text
    row = response.json()
    assert (row["workspaceName"], row["plan"], row["socialPermissionLevel"]) == ("New Team", "growth", "admin")
    assert "password" not in row and "password_hash" not in row and "access_token" not in row
    assert verify_password(payload["password"], db["users"].find_one({"id": row["id"]})["password_hash"])
    assert client.post(API + "/users", json=payload, headers=headers_for(admin)).status_code == 409


def test_analytics_uses_active_accounts_and_actual_fixed_thirty_days(client, db, admin):
    now = datetime.now(timezone.utc)
    db["social_accounts"].insert_many([
        {
            "id": str(uuid.uuid4()), "workspace_id": str(uuid.uuid4()),
            "platform_account_id": str(uuid.uuid4()), "platform": platform,
            "is_active": active, "created_at": now - timedelta(days=90),
        }
        for platform, active in [("linkedin", True), ("linkedin", True), ("linkedin", False), ("facebook", False), ("youtube", True)]
    ])
    db["social_posts"].insert_many([
        {"id": str(uuid.uuid4()), "status": status, "published_at": now - timedelta(days=days)}
        for status, days in [("published", 0), ("published", 0), ("published", 29), ("published", 30), ("draft", 0)]
    ])
    response = client.get(API + "/analytics", headers=headers_for(admin))
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["platformMix"] == [{"platform": "linkedin", "count": 2}, {"platform": "youtube", "count": 1}]
    assert len(result["postsOverTime"]) == 30
    assert sum(row["posts"] for row in result["postsOverTime"]) == 3
    assert result["postsOverTime"][-1] == {"date": now.date().isoformat(), "posts": 2}
    assert result["postsOverTime"][0] == {"date": (now.date() - timedelta(days=29)).isoformat(), "posts": 1}


@pytest.mark.parametrize("method,path,payload,expected", [
    ("POST", f"/users/{TARGET}/suspend", {}, 404),
    ("POST", f"/users/{TARGET}/plan", {"plan": "growth"}, 404),
    ("PATCH", f"/workspaces/{TARGET}/plan", {"plan": "growth"}, 404),
    ("PATCH", f"/workspaces/{TARGET}/status", {"is_active": False}, 404),
    ("PUT", "/pricing/unknown", {}, 404),
])
def test_admin_missing_resources(client, admin, method, path, payload, expected):
    assert client.request(method, API + path, json=payload, headers=headers_for(admin)).status_code == expected