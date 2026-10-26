from copy import deepcopy
from datetime import timedelta
from unittest.mock import Mock

import pytest

from app.core.config import settings
from app.core.mongo_utils import utcnow
from app.social.service import SocialMediaService


@pytest.fixture()
def status_endpoint(client, db, monkeypatch):
    from app.social import media
    from app.social.ai import creative, generator

    registration = client.post(
        f"{settings.api_v1_prefix}/auth/register",
        json={"email": "creative-status@example.com", "password": "s3cret-pass"},
    )
    assert registration.status_code == 201, registration.text
    registration = registration.json()
    workspace_id = registration["workspace"]["id"]
    headers = {"Authorization": f"Bearer {registration['access_token']}"}
    url = f"{settings.api_v1_prefix}/workspaces/{workspace_id}/social/generate-creative-set/status"
    guards = []
    for target, name in (
        (SocialMediaService, "generate_creative_set"),
        (SocialMediaService, "render_brand_creative_variants"),
        (creative, "generate_post_image"),
        (generator, "generate_platform_content"),
        (media, "upload_social_image_bytes"),
    ):
        guard = Mock(side_effect=AssertionError("Status must not generate or upload"))
        monkeypatch.setattr(target, name, guard)
        guards.append(guard)
    refresh = Mock(side_effect=lambda key: f"https://cdn.test/{key}?fresh=1")
    monkeypatch.setattr(media, "refresh_blob_url", refresh)
    item = {
        "slideId": "slide-1", "platform": "instagram", "imageUrl": "https://expired.test/image",
        "assetId": "asset-1", "blobKey": f"social/{workspace_id}/image.jpg",
        "width": 1080, "height": 1350, "mimeType": "image/jpeg",
    }
    row = {
        "id": "creative-set-1", "workspace_id": workspace_id, "request_id": "request-1",
        "status": "completed", "slides": [{"id": "slide-1"}], "platforms": ["instagram"],
        "items": [item], "errors": [], "warnings": ["Review before scheduling"],
        "updated_at": utcnow(), "bases": {"slide-1": {"blobKey": "private-base"}},
        "recipe": {"private": "not public"}, "claim": "private-claim",
    }
    db.social_creative_sets.insert_one(deepcopy(row))
    yield client, db, url, headers, row, refresh
    for guard in guards:
        guard.assert_not_called()


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer invalid-token"}])
def test_status_requires_authentication(status_endpoint, headers):
    client, _, url, _, _, refresh = status_endpoint
    response = client.get(url, headers=headers, params={"requestId": "request-1"})
    assert response.status_code == 401
    refresh.assert_not_called()


def test_status_rejects_foreign_workspace_access(status_endpoint):
    client, db, url, headers, row, refresh = status_endpoint
    db.workspace_members.delete_many({"workspace_id": row["workspace_id"]})
    response = client.get(url, headers=headers, params={"requestId": "request-1"})
    assert response.status_code == 403
    refresh.assert_not_called()


def test_status_allows_workspace_viewer(status_endpoint):
    client, db, url, headers, row, _ = status_endpoint
    db.workspaces.update_one({"id": row["workspace_id"]}, {"$set": {"owner_user_id": "another-owner"}})
    db.workspace_members.update_many({"workspace_id": row["workspace_id"]}, {"$set": {"social_level": "viewer"}})
    response = client.get(url, headers=headers, params={"requestId": "request-1"})
    assert response.status_code == 200, response.text
    assert response.json()["creativeSetId"] == row["id"]


@pytest.mark.parametrize("request_id", ["unknown-request", "foreign-request"])
def test_status_does_not_disclose_foreign_or_missing_request(status_endpoint, request_id):
    client, db, url, headers, row, refresh = status_endpoint
    db.social_creative_sets.insert_one({**row, "id": "foreign-set", "workspace_id": "foreign-workspace", "request_id": "foreign-request"})
    response = client.get(url, headers=headers, params={"requestId": request_id})
    assert response.status_code == 404
    assert response.json() == {"detail": "Creative set not found"}
    refresh.assert_not_called()


def test_status_same_request_id_is_workspace_scoped(status_endpoint):
    client, db, url, headers, row, _ = status_endpoint
    db.social_creative_sets.insert_one({**row, "id": "foreign-set", "workspace_id": "foreign-workspace"})
    response = client.get(url, headers=headers, params={"requestId": row["request_id"]})
    assert response.status_code == 200, response.text
    assert response.json()["creativeSetId"] == row["id"]


@pytest.mark.parametrize("params", [{}, {"requestId": ""}, {"requestId": "x" * 129}, {"request_id": "request-1"}])
def test_status_validates_required_camelcase_request_id(status_endpoint, params):
    client, _, url, headers, _, refresh = status_endpoint
    response = client.get(url, headers=headers, params=params)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["query", "requestId"]
    refresh.assert_not_called()


@pytest.mark.parametrize("request_id", ["x", "x" * 128, "request /+?&=é"])
def test_status_accepts_request_id_boundaries_and_encoded_values(status_endpoint, request_id):
    client, db, url, headers, row, _ = status_endpoint
    db.social_creative_sets.update_one({"id": row["id"]}, {"$set": {"request_id": request_id}})
    response = client.get(url, headers=headers, params={"requestId": request_id})
    assert response.status_code == 200, response.text
    assert response.json()["creativeSetId"] == row["id"]


def test_status_completed_contract_refreshes_urls_without_mutation(status_endpoint):
    client, db, url, headers, row, refresh = status_endpoint
    db.social_creative_quota.insert_one({"_id": "quota", "reserved": 1, "holds": {"private-claim": 1}})
    collections = ("social_creative_sets", "social_creative_quota", "social_media_assets", "plans_ai_usage", "ai_provider_usage")
    before = {name: list(db[name].find()) for name in collections}
    for _ in range(2):
        response = client.get(url, headers=headers, params={"requestId": row["request_id"]})
        assert response.status_code == 200, response.text
        assert response.json() == {
            "creativeSetId": row["id"], "status": "completed",
            "items": [{**row["items"][0], "imageUrl": f"https://cdn.test/{row['items'][0]['blobKey']}?fresh=1"}],
            "errors": [], "warnings": row["warnings"],
        }
    assert refresh.call_count == 2
    assert {name: list(db[name].find()) for name in collections} == before


@pytest.mark.parametrize("state", ["pending", "processing", "partial", "failed"])
def test_status_preserves_persisted_state_and_error_contract(status_endpoint, state):
    client, db, url, headers, row, _ = status_endpoint
    errors = [] if state in ("pending", "processing") else [{"slideId": "slide-1", "platform": "instagram", "code": "CREATIVE_UPLOAD_FAILED", "stage": "upload", "message": "Retry saved artwork"}]
    items = row["items"] if state == "partial" else []
    db.social_creative_sets.update_one({"id": row["id"]}, {"$set": {
        "status": state, "items": items, "errors": errors, "lease_until": utcnow() + timedelta(minutes=5),
    }})
    response = client.get(url, headers=headers, params={"requestId": row["request_id"]})
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"creativeSetId", "status", "items", "errors", "warnings"}
    assert body["status"] == state
    assert body["errors"] == errors
    assert len(body["items"]) == len(items)
    assert body["warnings"] == row["warnings"]


@pytest.mark.parametrize("has_items,expected", [(False, "failed"), (True, "partial")])
def test_status_expired_lease_is_read_only_and_recoverable(status_endpoint, has_items, expected):
    client, db, url, headers, row, _ = status_endpoint
    db.social_creative_sets.update_one({"id": row["id"]}, {"$set": {
        "status": "processing", "items": row["items"] if has_items else [], "lease_until": utcnow() - timedelta(seconds=1),
    }})
    before = db.social_creative_sets.find_one({"id": row["id"]})
    response = client.get(url, headers=headers, params={"requestId": row["request_id"]})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == expected
    assert body["errors"] == [{"code": "CREATIVE_LEASE_EXPIRED", "stage": "claim", "message": "Processing lease expired; retry the original requestId to recover saved artwork"}]
    assert db.social_creative_sets.find_one({"id": row["id"]}) == before


def test_status_url_failure_returns_partial_without_stale_url(status_endpoint):
    client, db, url, headers, row, refresh = status_endpoint
    refresh.side_effect = RuntimeError("Private storage details must not leak")
    before = db.social_creative_sets.find_one({"id": row["id"]})
    response = client.get(url, headers=headers, params={"requestId": row["request_id"]})
    assert response.status_code == 200, response.text
    assert response.json() == {
        "creativeSetId": row["id"], "status": "partial", "items": [], "warnings": row["warnings"],
        "errors": [{"slideId": "slide-1", "platform": "instagram", "code": "CREATIVE_URL_FAILED", "stage": "url", "message": "Image URL could not be refreshed; reload status"}],
    }
    assert db.social_creative_sets.find_one({"id": row["id"]}) == before