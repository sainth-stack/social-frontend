from copy import deepcopy
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import pytest

from app.core.config import settings
from app.social.schemas import SocialPostPlatformOut
from app.social.service import SocialMediaService


STATUSES = ("pending", "succeeded", "failed", "unsupported", "unknown")
UPDATED_AT = datetime(2026, 10, 27, 12, 30, 45)
ATTEMPTED_AT = datetime(2026, 10, 27, 13, 30, 44, tzinfo=timezone(timedelta(hours=1)))


@pytest.fixture(autouse=True)
def block_live_connections(monkeypatch):
    connect = Mock(side_effect=AssertionError("Serialization must not make live calls"))
    monkeypatch.setattr("httpx.HTTPTransport.handle_request", connect)
    monkeypatch.setattr("httpx.AsyncHTTPTransport.handle_async_request", connect)
    yield
    connect.assert_not_called()


@pytest.fixture
def post():
    return {
        "id": "post",
        "workspace_id": "workspace",
        "created_by": "user",
        "title": "Release checklist",
        "status": "published",
        "created_at": UPDATED_AT,
        "updated_at": UPDATED_AT,
    }


@pytest.fixture
def platform():
    return {
        "id": "facebook-row",
        "post_id": "post",
        "platform": "facebook",
        "social_account_id": "account",
        "caption": "Release checklist",
        "hashtags": ["Release"],
        "first_comment": "Supporting comment",
        "character_count": 17,
        "status": "published",
        "platform_post_id": "parent-123",
        "retry_count": 0,
    }


def state_for(status):
    return {
        "status": status,
        "attempt_count": 3,
        "platform_comment_id": "comment-123" if status == "succeeded" else None,
        "error_code": "RATE_LIMITED" if status == "failed" else None,
        "http_status": 429 if status == "failed" else 200,
        "provider_error_code": 4 if status == "failed" else None,
        "updated_at": UPDATED_AT,
        "attempted_at": ATTEMPTED_AT,
        "content_hash": "private-content-hash",
        "access_token": "raw-secret-token",
        "raw_response": {"error": {"message": "raw-secret-token"}},
    }


def expected_state(status):
    return {
        "status": status,
        "attemptCount": 3,
        "platformCommentId": "comment-123" if status == "succeeded" else None,
        "errorCode": "RATE_LIMITED" if status == "failed" else None,
        "httpStatus": 429 if status == "failed" else 200,
        "providerErrorCode": 4 if status == "failed" else None,
        "updatedAt": "2026-10-27T12:30:45+00:00",
        "attemptedAt": "2026-10-27T13:30:44+01:00",
    }


@pytest.mark.parametrize("status", STATUSES)
def test_platform_schema_accepts_all_first_comment_statuses(status):
    payload = {
        "id": "platform",
        "platform": "facebook",
        "caption": "Caption",
        "characterCount": 7,
        "status": "published",
        "retryCount": 0,
        "firstCommentState": {
            **expected_state(status),
            "content_hash": "private-content-hash",
            "raw_response": "raw-secret-token",
        },
    }
    result = SocialPostPlatformOut.model_validate(payload)
    assert result.model_dump(mode="json")["firstCommentState"] == expected_state(status)
    assert "private-content-hash" not in result.model_dump_json()
    assert "raw-secret-token" not in result.model_dump_json()


@pytest.mark.parametrize("status", STATUSES)
@pytest.mark.parametrize("source", ["platform", "publish_state", "both"])
def test_serialize_post_maps_first_comment_state_without_private_fields(db, post, platform, status, source):
    state = state_for(status)
    if source in ("platform", "both"):
        platform["first_comment_state"] = state
    if source in ("publish_state", "both"):
        platform["publish_state"] = {
            "first_comment_state": state_for("failed" if status != "failed" else "unknown")
            if source == "both" else state,
            "access_token": "raw-secret-token",
        }
    before = deepcopy((post, platform))

    result = SocialMediaService(db)._serialize_post(post, [platform])
    serialized = result.model_dump(mode="json")["platforms"][0]

    assert isinstance(result.platforms[0], SocialPostPlatformOut)
    assert serialized["firstCommentState"] == expected_state(status)
    assert serialized["firstComment"] == "Supporting comment"
    assert serialized["status"] == "published"
    assert serialized["platformPostId"] == "parent-123"
    assert serialized["retryCount"] == 0
    assert serialized["errorCode"] is None
    assert "content_hash" not in result.model_dump_json()
    assert "private-content-hash" not in result.model_dump_json()
    assert "raw_response" not in result.model_dump_json()
    assert "raw-secret-token" not in result.model_dump_json()
    assert (post, platform) == before


@pytest.mark.parametrize("empty_state", [None, {}])
def test_serialize_post_falls_back_when_platform_state_is_empty(db, post, platform, empty_state):
    platform["first_comment_state"] = empty_state
    platform["publish_state"] = {"first_comment_state": state_for("succeeded")}
    result = SocialMediaService(db)._serialize_post(post, [platform])
    assert result.model_dump(mode="json")["platforms"][0]["firstCommentState"] == expected_state("succeeded")


@pytest.mark.parametrize("status", STATUSES)
def test_serialize_post_defaults_optional_first_comment_fields(db, post, platform, status):
    platform["first_comment_state"] = {"status": status}
    result = SocialMediaService(db)._serialize_post(post, [platform])
    assert result.model_dump(mode="json")["platforms"][0]["firstCommentState"] == {
        "status": status,
        "attemptCount": 0,
        "platformCommentId": None,
        "errorCode": None,
        "httpStatus": None,
        "providerErrorCode": None,
        "updatedAt": None,
        "attemptedAt": None,
    }


@pytest.mark.parametrize("comment", [None, "", "Supporting legacy comment"])
@pytest.mark.parametrize("publish_state", [None, {}, {"platform_post_id": "parent-123"}])
def test_legacy_post_without_first_comment_receipt_serializes_null(db, post, platform, comment, publish_state):
    platform["first_comment"] = comment
    platform["publish_state"] = publish_state
    result = SocialMediaService(db)._serialize_post(post, [platform])
    serialized = result.model_dump(mode="json")["platforms"][0]
    assert serialized["firstComment"] == comment
    assert serialized["firstCommentState"] is None
    serialized.pop("firstCommentState")
    assert SocialPostPlatformOut.model_validate(serialized).firstCommentState is None


def test_main_app_post_response_serializes_each_platform_and_legacy_null(client, db, post, platform):
    api = settings.api_v1_prefix
    registration = client.post(
        f"{api}/auth/register",
        json={"email": "serialization@example.com", "password": "s3cret-pass"},
    )
    assert registration.status_code == 201, registration.text
    account = registration.json()
    workspace_id = account["workspace"]["id"]
    post["workspace_id"] = workspace_id
    db.social_posts.insert_one(deepcopy(post))
    rows = []
    for index, status in enumerate(STATUSES):
        row = {**platform, "id": status}
        if index % 2:
            row["publish_state"] = {"first_comment_state": state_for(status)}
        else:
            row["first_comment_state"] = state_for(status)
        rows.append(row)
    rows.append({**platform, "id": "legacy", "first_comment": None})
    db.social_post_platforms.insert_many(rows)

    response = client.get(
        f"{api}/workspaces/{workspace_id}/social/posts/{post['id']}",
        headers={"Authorization": f"Bearer {account['access_token']}"},
    )

    assert response.status_code == 200, response.text
    serialized = {row["id"]: row for row in response.json()["platforms"]}
    assert set(serialized) == {*STATUSES, "legacy"}
    for status in STATUSES:
        expected = expected_state(status)
        expected["attemptedAt"] = "2026-10-27T12:30:44+00:00"
        assert serialized[status]["firstCommentState"] == expected
        assert serialized[status]["status"] == "published"
        assert serialized[status]["platformPostId"] == "parent-123"
    assert serialized["legacy"]["firstComment"] is None
    assert serialized["legacy"]["firstCommentState"] is None
    assert "content_hash" not in response.text
    assert "private-content-hash" not in response.text
    assert "raw_response" not in response.text
    assert "raw-secret-token" not in response.text