from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from pymongo.errors import DuplicateKeyError

from app.admin import service as admin_service
from app.core.config import settings
from app.core.security import create_access_token
from app.marketing import service

API = settings.api_v1_prefix
NOW = datetime(2026, 10, 23, 12, 30, tzinfo=timezone.utc)
CONTACT = {
    "name": "  Ada Lovelace  ",
    "email": "  Ada@Example.com  ",
    "company": "  Analytical Engines  ",
    "message": "  Please arrange a product demonstration.  ",
}


@pytest.fixture()
def admin_headers(db):
    user_id = str(uuid.uuid4())
    db["users"].insert_one({
        "id": user_id,
        "email": "admin@example.com",
        "is_active": True,
        "is_platform_admin": True,
    })
    return {"Authorization": f"Bearer {create_access_token(subject=user_id)}"}


def _insert_contact(db, *, created_at=NOW, status="new", **overrides):
    doc = {
        "id": str(uuid.uuid4()),
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "company": None,
        "message": "Please arrange a demonstration.",
        "status": status,
        "created_at": created_at,
        "updated_at": created_at,
        **overrides,
    }
    db["marketing_contacts"].insert_one(dict(doc))
    return doc


def test_contact_normalizes_and_stores_only_expected_fields(client, db, monkeypatch):
    monkeypatch.setattr(service, "utcnow", lambda: NOW)
    response = client.post(f"{API}/public/contact", json=CONTACT)
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"id", "status"}
    assert uuid.UUID(body["id"])
    assert body["status"] == "received"
    doc = db["marketing_contacts"].find_one({"id": body["id"]}, {"_id": 0})
    assert doc == {
        "id": body["id"],
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "company": "Analytical Engines",
        "message": "Please arrange a product demonstration.",
        "status": "new",
        "created_at": NOW.replace(tzinfo=None),
        "updated_at": NOW.replace(tzinfo=None),
    }


@pytest.mark.parametrize("changes", [
    {"name": " A "},
    {"name": "x" * 101},
    {"name": "   "},
    {"email": "invalid"},
    {"company": "x" * 161},
    {"message": "  short  "},
    {"message": "x" * 5001},
    {"website": "x" * 2049},
    {"visitorId": "not-accepted"},
])
def test_contact_validation(client, db, changes):
    response = client.post(f"{API}/public/contact", json={**CONTACT, **changes})
    assert response.status_code == 422
    assert db["marketing_contacts"].count_documents({}) == 0


@pytest.mark.parametrize("company", [None, "", "   "])
def test_optional_company_and_empty_honeypot(client, db, company):
    response = client.post(
        f"{API}/public/contact", json={**CONTACT, "company": company, "website": "   "}
    )
    assert response.status_code == 200
    assert db["marketing_contacts"].find_one()["company"] is None


def test_contact_company_can_be_omitted(client):
    payload = {key: value for key, value in CONTACT.items() if key != "company"}
    assert client.post(f"{API}/public/contact", json=payload).status_code == 200


def test_honeypot_silently_succeeds_without_any_write(client, db):
    first = client.post(f"{API}/public/contact", json={**CONTACT, "website": "https://spam.test"})
    second = client.post(f"{API}/public/contact", json={**CONTACT, "website": "spam"})
    assert first.status_code == second.status_code == 200
    assert first.json()["status"] == second.json()["status"] == "received"
    assert uuid.UUID(first.json()["id"])
    assert first.json()["id"] != second.json()["id"]
    assert db["marketing_contacts"].count_documents({}) == 0
    assert db["marketing_daily"].count_documents({}) == 0


def test_events_are_aggregated_without_tracking_or_cookies(client, db, monkeypatch):
    monkeypatch.setattr(service, "utcnow", lambda: NOW)
    for event in ("page_view", "page_view", "signup_click", "contact_click"):
        response = client.post(f"{API}/public/events", json={"event": event, "path": "/"})
        assert response.status_code == 200
        assert response.json() == {"status": "received"}
        assert "set-cookie" not in response.headers
    assert list(db["marketing_daily"].find({}, {"_id": 0})) == [{
        "date": "2026-10-23", "page_views": 2, "signup_clicks": 1, "contact_clicks": 1,
    }]
    assert db["marketing_contacts"].count_documents({}) == 0
    monkeypatch.setattr(service, "utcnow", lambda: NOW + timedelta(days=1))
    client.post(f"{API}/public/events", json={"event": "signup_click", "path": "/"})
    assert db["marketing_daily"].find_one({"date": "2026-10-24"}, {"_id": 0}) == {
        "date": "2026-10-24", "page_views": 0, "signup_clicks": 1, "contact_clicks": 0,
    }
    assert db["marketing_daily"].count_documents({}) == 2


@pytest.mark.parametrize("payload", [
    {"event": "purchase", "path": "/"},
    {"event": "page_view", "path": "/contact"},
    {"event": "page_view", "path": "/?email=ada@example.com"},
    {"event": "page_view", "path": ""},
    {"event": "page_view"},
    {"event": "page_view", "path": "/", "email": "ada@example.com"},
    {"event": "page_view", "path": "/", "visitorId": "123"},
])
def test_event_validation_rejects_nonlanding_paths_and_identifiers(client, db, payload):
    assert client.post(f"{API}/public/events", json=payload).status_code == 422
    assert db["marketing_daily"].count_documents({}) == 0


@pytest.mark.parametrize("endpoint,payload,limit", [
    ("contact", CONTACT, 5),
    ("events", {"event": "page_view", "path": "/"}, 120),
])
def test_public_rate_limits(client, db, fake_redis, endpoint, payload, limit):
    fake_redis.set(f"rl:marketing_{'contact' if endpoint == 'contact' else 'events'}:testclient", limit)
    response = client.post(f"{API}/public/{endpoint}", json=payload)
    assert response.status_code == 429
    assert db["marketing_contacts"].count_documents({}) == 0
    assert db["marketing_daily"].count_documents({}) == 0


@pytest.mark.parametrize("method,path,payload", [
    ("GET", "/contacts", None),
    ("GET", "/marketing-analytics", None),
    ("PATCH", f"/contacts/{uuid.uuid4()}", {"status": "resolved"}),
])
def test_admin_requires_platform_admin(client, db, method, path, payload):
    url = f"{API}/admin{path}"
    assert client.request(method, url, json=payload).status_code == 401
    user_id = str(uuid.uuid4())
    db["users"].insert_one({"id": user_id, "is_active": True, "is_platform_admin": False})
    headers = {"Authorization": f"Bearer {create_access_token(subject=user_id)}"}
    assert client.request(method, url, headers=headers, json=payload).status_code == 403


def test_admin_literal_search_pagination_and_status_updates(client, db, admin_headers, monkeypatch):
    oldest = _insert_contact(db, created_at=NOW - timedelta(days=2), name="Literal .* [hello]")
    middle = _insert_contact(db, created_at=NOW - timedelta(days=1), company="Company + extras")
    newest = _insert_contact(db, status="resolved")
    response = client.get(f"{API}/admin/contacts?pageSize=2", headers=admin_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"items", "total", "page", "pageSize", "totalPages"}
    assert (body["total"], body["page"], body["pageSize"], body["totalPages"]) == (3, 1, 2, 2)
    assert [row["id"] for row in body["items"]] == [newest["id"], middle["id"]]
    assert set(body["items"][0]) == {
        "id", "name", "email", "company", "message", "status", "createdAt", "updatedAt",
    }
    second = client.get(f"{API}/admin/contacts?pageSize=2&page=2", headers=admin_headers).json()
    assert [row["id"] for row in second["items"]] == [oldest["id"]]
    for search, expected_id in [(".*", oldest["id"]), ("[HELLO]", oldest["id"]), ("+", middle["id"])]:
        found = client.get(f"{API}/admin/contacts", params={"search": search}, headers=admin_headers).json()
        assert found["total"] == 1
        assert found["items"][0]["id"] == expected_id
    monkeypatch.setattr(service, "utcnow", lambda: NOW + timedelta(hours=1))
    for contact_status in ("in_progress", "resolved", "new"):
        updated = client.patch(
            f"{API}/admin/contacts/{oldest['id']}",
            json={"status": contact_status}, headers=admin_headers,
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["status"] == contact_status
        assert updated.json()["createdAt"].startswith("2026-10-21")
        assert updated.json()["updatedAt"] == "2026-10-23T13:30:00Z"
    filtered = client.get(
        f"{API}/admin/contacts", params={"status": "new", "search": ".*"}, headers=admin_headers,
    ).json()
    assert filtered["total"] == 1
    empty = client.get(f"{API}/admin/contacts?search=missing", headers=admin_headers).json()
    assert empty["items"] == [] and empty["total"] == 0 and empty["totalPages"] == 1


@pytest.mark.parametrize("params", [
    {"search": "x" * 201}, {"status": "invalid"}, {"page": 0},
    {"page": 1_000_001}, {"pageSize": 0}, {"pageSize": 201},
])
def test_admin_list_validation(client, admin_headers, params):
    assert client.get(f"{API}/admin/contacts", params=params, headers=admin_headers).status_code == 422


def test_admin_patch_validation_and_missing_contact(client, db, admin_headers):
    doc = _insert_contact(db)
    url = f"{API}/admin/contacts/{doc['id']}"
    for payload in ({"status": "invalid"}, {}, {"status": "new", "message": "edited"}):
        assert client.patch(url, json=payload, headers=admin_headers).status_code == 422
    assert client.patch(
        f"{API}/admin/contacts/{uuid.uuid4()}", json={"status": "resolved"}, headers=admin_headers,
    ).status_code == 404
    assert client.patch(
        f"{API}/admin/contacts/not-a-uuid", json={"status": "resolved"}, headers=admin_headers,
    ).status_code == 422
    assert db["marketing_contacts"].find_one({"id": doc["id"]})["status"] == "new"


def test_marketing_analytics_utc_window_zero_fill_and_all_time_statuses(client, db, admin_headers, monkeypatch):
    monkeypatch.setattr(service, "utcnow", lambda: NOW)
    start = datetime(2026, 9, 24, tzinfo=timezone.utc)
    _insert_contact(db, created_at=start - timedelta(milliseconds=1), status="resolved")
    _insert_contact(db, created_at=start, status="new")
    _insert_contact(db, created_at=NOW, status="in_progress")
    _insert_contact(db, created_at=NOW, status="resolved")
    _insert_contact(db, created_at=datetime(2026, 10, 24, tzinfo=timezone.utc), status="new")
    db["marketing_daily"].insert_many([
        {"date": "2026-09-23", "page_views": 999, "signup_clicks": 999, "contact_clicks": 999},
        {"date": "2026-09-24", "page_views": 3, "signup_clicks": 2, "contact_clicks": 1},
        {"date": "2026-10-23", "page_views": 7, "signup_clicks": 3, "contact_clicks": 2},
        {"date": "2026-10-24", "page_views": 999, "signup_clicks": 999, "contact_clicks": 999},
    ])
    response = client.get(f"{API}/admin/marketing-analytics", headers=admin_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert {key: value for key, value in body.items() if key != "daily"} == {
        "pageViews30d": 10, "signupClicks30d": 5, "contactClicks30d": 3, "contacts30d": 3,
        "newContacts": 2, "inProgressContacts": 1, "resolvedContacts": 2,
    }
    assert len(body["daily"]) == 30
    assert [row["date"] for row in body["daily"]] == [
        (start + timedelta(days=offset)).date().isoformat() for offset in range(30)
    ]
    assert body["daily"][0] == {
        "date": "2026-09-24", "pageViews": 3, "signupClicks": 2, "contactClicks": 1, "contacts": 1,
    }
    assert body["daily"][-1] == {
        "date": "2026-10-23", "pageViews": 7, "signupClicks": 3, "contactClicks": 2, "contacts": 2,
    }
    assert all(row == {
        "date": row["date"], "pageViews": 0, "signupClicks": 0, "contactClicks": 0, "contacts": 0,
    } for row in body["daily"][1:-1])


def test_empty_marketing_analytics(client, admin_headers):
    response = client.get(f"{API}/admin/marketing-analytics", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body["daily"]) == 30
    assert all(value == 0 for key, value in body.items() if key != "daily")
    assert all(all(value == 0 for key, value in row.items() if key != "date") for row in body["daily"])


def test_marketing_indexes(db):
    indexes = db["marketing_contacts"].index_information()
    assert indexes["id_1"]["unique"]
    assert list(indexes["created_at_-1"]["key"]) == [("created_at", -1)]
    assert list(indexes["status_1_created_at_-1"]["key"]) == [("status", 1), ("created_at", -1)]
    doc = _insert_contact(db)
    with pytest.raises(DuplicateKeyError):
        _insert_contact(db, id=doc["id"])
    db["marketing_daily"].insert_one({"date": "2026-10-23"})
    with pytest.raises(DuplicateKeyError):
        db["marketing_daily"].insert_one({"date": "2026-10-23"})


def test_existing_admin_metrics_count_accounts_and_only_recent_failures(db):
    now = datetime.now(timezone.utc)
    db["social_accounts"].insert_many([
        {"id": str(uuid.uuid4()), "workspace_id": "w1", "platform": "linkedin", "platform_account_id": "one", "is_active": True},
        {"id": str(uuid.uuid4()), "workspace_id": "w1", "platform": "linkedin", "platform_account_id": "two", "is_active": True},
        {"id": str(uuid.uuid4()), "workspace_id": "w1", "platform": "instagram", "platform_account_id": "three", "is_active": True},
        {"id": str(uuid.uuid4()), "workspace_id": "w1", "platform": "instagram", "platform_account_id": "inactive", "is_active": False},
    ])
    db["social_post_platforms"].insert_many([
        {"id": str(uuid.uuid4()), "status": "published", "platform": "facebook"},
        {"id": str(uuid.uuid4()), "status": "failed", "updated_at": now - timedelta(days=1)},
        {"id": str(uuid.uuid4()), "status": "failed", "updated_at": now - timedelta(days=31)},
        {"id": str(uuid.uuid4()), "status": "failed"},
        {"id": str(uuid.uuid4()), "status": "published", "updated_at": now},
    ])
    mix = admin_service.admin_analytics(db).platform_mix
    assert {row.platform: row.count for row in mix} == {"linkedin": 2, "instagram": 1}
    assert admin_service.admin_overview(db).failed_publishes_30d == 1
    assert admin_service.analytics_overview(db).failed_publishes_30d == 1