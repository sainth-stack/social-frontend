from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import pytest

from app.social.publishers.base import BasePublisher, PublishResult
from app.social.tasks import publish, retry, scheduler


@pytest.fixture
def task_db(db, monkeypatch):
    for module in (publish, retry, scheduler):
        monkeypatch.setattr(module, "get_database", lambda: db)
    monkeypatch.setattr(publish, "decrypt", lambda value: "token")
    monkeypatch.setattr(retry, "decrypt", lambda value: "token")
    monkeypatch.setattr("app.social.audit.write_social_audit", lambda *args, **kwargs: None)
    monkeypatch.setattr(retry.retry_failed_post, "apply_async", Mock())
    monkeypatch.setattr(publish.publish_post, "delay", Mock())
    monkeypatch.setattr("app.social.media.refresh_blob_url", lambda key: f"https://fresh.test/{key}")
    monkeypatch.setattr("app.social.media.ensure_public_image_url", lambda workspace, url: f"https://legacy.test/{workspace}")
    db["social_posts"].insert_one({
        "id": "post", "workspace_id": "workspace", "status": "scheduled", "format": "carousel",
        "image_url": "https://wrong.test/global-cover.jpg", "slides": [{"id": "slide-1"}, {"id": "slide-2"}],
        "scheduled_at": datetime.now(timezone.utc) - timedelta(minutes=1),
    })
    for platform in ("facebook", "instagram", "linkedin"):
        db["social_accounts"].insert_one({
            "id": platform, "platform_account_id": platform + "-account", "is_active": True, "access_token_enc": "encrypted",
        })
        media = []
        for number in (1, 2):
            asset_id = f"{platform}-{number}"
            key = f"social/workspace/{asset_id}.jpg"
            db["social_media_assets"].insert_one({"id": asset_id, "workspace_id": "workspace", "media_type": "image", "blob_key": key})
            media.append({"assetId": asset_id, "blobKey": key, "url": f"https://expired.test/{asset_id}", "slideId": f"slide-{number}", "width": 1080, "height": 1350, "mimeType": "image/jpeg"})
        db["social_post_platforms"].insert_one({
            "id": platform, "post_id": "post", "platform": platform, "social_account_id": platform,
            "caption": f"{platform} intro", "hashtags": [], "status": "pending", "media": media,
        })
    return db


def only_platform(db, platform="facebook"):
    db["social_post_platforms"].delete_many({"id": {"$ne": platform}})
    return db["social_post_platforms"].find_one({"id": platform})


def install_publishers(monkeypatch, **kwargs):
    publisher = Mock()
    publisher.publish = Mock(**kwargs) if kwargs else Mock(return_value=PublishResult(success=True, platform_post_id="remote"))
    monkeypatch.setattr(publish, "get_publisher", lambda platform: publisher)
    monkeypatch.setattr(retry, "get_publisher", lambda platform: publisher)
    return publisher


def test_publish_refreshes_every_platform_asset_in_order(task_db, monkeypatch):
    publisher = install_publishers(monkeypatch)
    refreshed = []
    monkeypatch.setattr("app.social.media.refresh_blob_url", lambda key: refreshed.append(key) or f"https://fresh.test/{key}")
    publish.publish_post.run("post")
    assert publisher.publish.call_count == 3
    for call, platform in zip(publisher.publish.call_args_list, ("facebook", "instagram", "linkedin")):
        assert call.kwargs["image_url"] is None
        assert call.kwargs["image_urls"] == [f"https://fresh.test/social/workspace/{platform}-{number}.jpg" for number in (1, 2)]
        assert call.kwargs["caption"] == f"{platform} intro"
        assert call.kwargs["access_token"] == "token"
    assert len(refreshed) == 6
    assert task_db["social_post_platforms"].count_documents({"status": "published"}) == 3
    assert task_db["social_post_platforms"].count_documents({"publish_claim": {"$exists": True}}) == 0


def test_retry_uses_failed_row_media_not_global_scalar(task_db, monkeypatch):
    task_db["social_post_platforms"].update_one({"id": "instagram"}, {"$set": {"status": "failed", "error_code": "RATE_LIMITED"}})
    publisher = install_publishers(monkeypatch)
    result = retry.retry_failed_post.run("instagram")
    assert result["ok"]
    assert publisher.publish.call_args.kwargs["image_urls"] == [f"https://fresh.test/social/workspace/instagram-{number}.jpg" for number in (1, 2)]
    assert publisher.publish.call_args.kwargs["image_url"] is None


@pytest.mark.parametrize("task_name", ["publish", "retry"])
def test_legacy_single_keeps_keyword_mock_contract(task_db, monkeypatch, task_name):
    only_platform(task_db)
    task_db["social_posts"].update_one({"id": "post"}, {"$unset": {"format": ""}})
    task_db["social_post_platforms"].update_one({"id": "facebook"}, {"$unset": {"media": ""}, "$set": {"status": "failed", "error_code": "API_ERROR"}})
    calls = []

    def strict_publish(*, platform_account_id, access_token, caption, hashtags, image_url=None, first_comment=None):
        calls.append(image_url)
        return PublishResult(success=True, platform_post_id="legacy")

    publisher = install_publishers(monkeypatch)
    publisher.publish = strict_publish
    if task_name == "publish":
        publish.publish_post.run("post")
    else:
        retry.retry_failed_post.run("facebook")
    assert calls == ["https://legacy.test/workspace"]


@pytest.mark.parametrize("change", ["missing", "short", "order", "foreign", "deleted", "mismatch", "dimensions", "x", "video"])
def test_invalid_carousel_never_falls_back_to_cover(task_db, monkeypatch, change):
    pp = only_platform(task_db)
    if change == "missing":
        pp["media"] = []
    elif change == "short":
        pp["media"] = pp["media"][:1]
    elif change == "order":
        pp["media"].reverse()
    elif change == "foreign":
        task_db["social_media_assets"].update_one({"id": "facebook-1"}, {"$set": {"workspace_id": "other"}})
    elif change == "deleted":
        task_db["social_media_assets"].update_one({"id": "facebook-1"}, {"$set": {"is_deleted": True}})
    elif change == "mismatch":
        pp["media"][0]["blobKey"] = "social/workspace/wrong.jpg"
    elif change == "dimensions":
        pp["media"][0]["width"] = 999
    elif change == "x":
        pp["platform"] = "x"
    elif change == "video":
        pp["media"][0]["mimeType"] = "video/mp4"
    task_db["social_post_platforms"].replace_one({"id": "facebook"}, pp)
    publisher = install_publishers(monkeypatch)
    publish.publish_post.run("post")
    publisher.publish.assert_not_called()
    assert task_db["social_post_platforms"].find_one({"id": "facebook"})["error_code"] == "INVALID_CONTENT"
    retry.retry_failed_post.apply_async.assert_not_called()


def test_asset_id_only_and_storage_url_keys_refresh_all(task_db, monkeypatch):
    pp = only_platform(task_db)
    pp["media"][0].pop("blobKey")
    pp["media"][0]["url"] = "https://bucket.s3.amazonaws.com/social/workspace/facebook-1.jpg?expired=1"
    pp["media"][1].pop("blobKey")
    pp["media"][1].pop("url")
    task_db["social_post_platforms"].replace_one({"id": "facebook"}, pp)
    publisher = install_publishers(monkeypatch)
    publish.publish_post.run("post")
    assert publisher.publish.call_args.kwargs["image_urls"] == [f"https://fresh.test/social/workspace/facebook-{number}.jpg" for number in (1, 2)]


@pytest.mark.parametrize("task_name", ["publish", "retry", "scheduler"])
def test_threads_copy_only_defensively(task_db, monkeypatch, task_name):
    only_platform(task_db)
    task_db["social_posts"].update_one({"id": "post"}, {"$set": {"format": "thread"}})
    publisher = install_publishers(monkeypatch)
    if task_name == "publish":
        result = publish.publish_post.run("post")
        assert result["reason"] == "copy_only_thread"
    elif task_name == "retry":
        result = retry.retry_failed_post.run("facebook")
        assert result["reason"] == "copy_only_thread"
    else:
        assert scheduler.enqueue_due_social_posts.run()["enqueued"] == 0
    publisher.publish.assert_not_called()
    publish.publish_post.delay.assert_not_called()


def test_atomic_claim_allows_one_concurrent_worker(task_db):
    pp = only_platform(task_db)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: publish.claim_platform(task_db, pp), range(16)))
    assert sum(result is not None for result in results) == 1


def test_duplicate_task_and_already_published_rows_skip_provider(task_db, monkeypatch):
    task_db["social_post_platforms"].update_one({"id": "instagram"}, {"$set": {"status": "published", "platform_post_id": "existing"}})
    publisher = install_publishers(monkeypatch)
    publish.publish_post.run("post")
    publish.publish_post.run("post")
    retry.retry_failed_post.run("facebook")
    assert publisher.publish.call_count == 2
    assert task_db["social_post_platforms"].find_one({"id": "instagram"})["platform_post_id"] == "existing"


def test_reentrant_retry_cannot_duplicate_inflight_request(task_db, monkeypatch):
    only_platform(task_db)
    nested = []

    def submit(**kwargs):
        nested.append(retry.retry_failed_post.run("facebook"))
        return PublishResult(success=True, platform_post_id="remote")

    publisher = install_publishers(monkeypatch, side_effect=submit)
    publish.publish_post.run("post")
    assert publisher.publish.call_count == 1
    assert nested[0]["reason"] == "already_claimed"


class CheckpointPublisher(BasePublisher):
    def __init__(self, callback):
        self.callback = callback

    def publish(self, **kwargs):
        return self.callback(self, kwargs)


def test_ambiguous_submission_block_survives_upstream_error_reset(task_db, monkeypatch):
    only_platform(task_db)

    def submit(publisher, kwargs):
        publisher.checkpoint(facebook_photos=["one", "two"], submission_started=True)
        return PublishResult(success=False, error_code="API_ERROR", retryable=True)

    publisher = CheckpointPublisher(submit)
    monkeypatch.setattr(publish, "get_publisher", lambda _: publisher)
    publish.publish_post.run("post")
    pp = task_db["social_post_platforms"].find_one({"id": "facebook"})
    assert pp["error_code"] == "AMBIGUOUS_PUBLISH"
    assert pp["publish_state"]["reconciliation_required"]
    assert pp["publish_state"]["facebook_photos"] == ["one", "two"]
    retry.retry_failed_post.apply_async.assert_not_called()
    task_db["social_post_platforms"].update_one({"id": "facebook"}, {"$set": {"status": "pending", "error_code": None}})
    assert publish.claim_platform(task_db, task_db["social_post_platforms"].find_one({"id": "facebook"})) is None
    assert retry.retry_failed_post.run("facebook")["reason"] == "non_retryable"


def test_safe_retry_reuses_upload_checkpoint(task_db, monkeypatch):
    only_platform(task_db)
    attempts = []

    def submit(publisher, kwargs):
        attempts.append(publisher.publish_state())
        if len(attempts) == 1:
            publisher.checkpoint(facebook_photos=["one"])
            return PublishResult(success=False, error_code="RATE_LIMITED", retryable=True)
        assert publisher.publish_state()["facebook_photos"] == ["one"]
        publisher.checkpoint(platform_post_id="remote", submission_started=False)
        return PublishResult(success=True, platform_post_id="remote")

    monkeypatch.setattr(publish, "get_publisher", lambda _: CheckpointPublisher(submit))
    monkeypatch.setattr(retry, "get_publisher", lambda _: CheckpointPublisher(submit))
    publish.publish_post.run("post")
    assert retry.retry_failed_post.apply_async.call_count == 1
    assert retry.retry_failed_post.run("facebook")["ok"]
    assert len(attempts) == 2


def test_known_provider_id_reconciles_without_republishing(task_db, monkeypatch):
    only_platform(task_db)
    task_db["social_post_platforms"].update_one({"id": "facebook"}, {"$set": {"status": "failed", "error_code": "AMBIGUOUS_PUBLISH", "publish_state": {"platform_post_id": "known"}}})
    publisher = install_publishers(monkeypatch)
    assert retry.retry_failed_post.run("facebook")["reason"] == "already_published"
    publisher.publish.assert_not_called()
    assert task_db["social_post_platforms"].find_one({"id": "facebook"})["platform_post_id"] == "known"
    assert task_db["social_posts"].find_one({"id": "post"})["status"] == "published"


def test_publish_known_id_recovers_even_when_account_is_unavailable(task_db, monkeypatch):
    only_platform(task_db)
    task_db["social_accounts"].delete_many({})
    task_db["social_post_platforms"].update_one({"id": "facebook"}, {"$set": {"publish_state": {"platform_post_id": "known"}}})
    publisher = install_publishers(monkeypatch)
    publish.publish_post.run("post")
    publisher.publish.assert_not_called()
    assert task_db["social_post_platforms"].find_one({"id": "facebook"})["status"] == "published"


def test_changed_copy_invalidates_safe_upload_checkpoints(task_db, monkeypatch):
    only_platform(task_db)

    def first(publisher, kwargs):
        publisher.checkpoint(facebook_photos=["old-photo"])
        return PublishResult(success=False, error_code="RATE_LIMITED", retryable=True)

    monkeypatch.setattr(publish, "get_publisher", lambda _: CheckpointPublisher(first))
    publish.publish_post.run("post")
    task_db["social_post_platforms"].update_one({"id": "facebook"}, {"$set": {"caption": "New copy"}})
    states = []

    def second(publisher, kwargs):
        states.append(publisher.publish_state())
        return PublishResult(success=True, platform_post_id="new-post")

    monkeypatch.setattr(retry, "get_publisher", lambda _: CheckpointPublisher(second))
    assert retry.retry_failed_post.run("facebook")["ok"]
    assert "facebook_photos" not in states[0]


def test_lost_claim_prevents_provider_submission(task_db, monkeypatch):
    only_platform(task_db)
    submitted = []

    def submit(publisher, kwargs):
        task_db["social_post_platforms"].update_one({"id": "facebook"}, {"$unset": {"publish_claim": ""}})
        publisher.checkpoint(submission_started=True)
        submitted.append(kwargs)
        return PublishResult(success=True, platform_post_id="never")

    monkeypatch.setattr(publish, "get_publisher", lambda _: CheckpointPublisher(submit))
    publish.publish_post.run("post")
    assert not submitted
    assert task_db["social_post_platforms"].find_one({"id": "facebook"})["error_code"] == "AMBIGUOUS_PUBLISH"


@pytest.mark.parametrize("known", [False, True])
def test_scheduler_expired_claim_requires_reconciliation(task_db, monkeypatch, known):
    only_platform(task_db)
    old = datetime.now(timezone.utc) - timedelta(minutes=20)
    task_db["social_posts"].update_one({"id": "post"}, {"$set": {"status": "publishing", "updated_at": old}})
    task_db["social_post_platforms"].update_one({"id": "facebook"}, {"$set": {
        "status": "publishing", "publish_claim": "old-claim", "publish_claimed_at": old,
        "publish_state": {"platform_post_id": "known"} if known else {"submission_started": True},
    }})
    assert scheduler.enqueue_due_social_posts.run()["recovered"] == 0
    pp = task_db["social_post_platforms"].find_one({"id": "facebook"})
    assert pp["status"] == ("published" if known else "failed")
    if not known:
        assert pp["error_code"] == "AMBIGUOUS_PUBLISH"
    publish.publish_post.delay.assert_not_called()


def test_scheduler_deduplicates_enqueue_and_does_not_steal_active_claim(task_db):
    assert scheduler.enqueue_due_social_posts.run()["enqueued"] == 1
    assert scheduler.enqueue_due_social_posts.run()["enqueued"] == 0
    assert publish.publish_post.delay.call_count == 1
    task_db["social_posts"].update_one({"id": "post"}, {"$set": {"status": "publishing", "updated_at": datetime.now(timezone.utc) - timedelta(minutes=3)}})
    pp = task_db["social_post_platforms"].find_one({"id": "facebook"})
    assert publish.claim_platform(task_db, pp)
    assert scheduler.enqueue_due_social_posts.run()["recovered"] == 0
    assert task_db["social_post_platforms"].find_one({"id": "facebook"})["status"] == "publishing"


def test_refresh_failure_never_publishes_old_or_cover_url(task_db, monkeypatch):
    only_platform(task_db)
    monkeypatch.setattr("app.social.media.refresh_blob_url", Mock(side_effect=RuntimeError("storage unavailable")))
    publisher = install_publishers(monkeypatch)
    publish.publish_post.run("post")
    publisher.publish.assert_not_called()
    assert task_db["social_post_platforms"].find_one({"id": "facebook"})["error_code"] == "API_ERROR"