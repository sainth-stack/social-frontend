from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Event
from unittest.mock import Mock, patch
from urllib.parse import parse_qs

import httpx
import pytest

from app.social.publishers.base import format_caption
from app.social.publishers.facebook import FacebookPublisher
from app.social.publishers.instagram import InstagramPublisher
from app.social.publishers.linkedin import LinkedInPublisher
from app.social.tasks import publish, retry


@pytest.mark.parametrize("caption,tags,expected", [
    (" \r\nFirst\r\n\r\n\r\nSecond  \r\nThird\rFourth \t", [], "First\n\n\nSecond  \nThird\nFourth"),
    (" Body ", [" tag ", " ##other ", "", "  ", "###", "#   ", "tag"], "Body\n\n#tag #other #tag"),
    (" \r\n ", [" #one ", "two"], "#one #two"),
    ("https://site.test/a#fragment\n\n#authored", ["extra"], "https://site.test/a#fragment\n\n#authored\n\n#extra"),
    ("a\n \n\t\nb", None, "a\n \n\t\nb"),
    (None, [], ""),
])
def test_caption_contract(caption, tags, expected):
    assert format_caption(caption, tags) == expected


@pytest.fixture
def graph(monkeypatch):
    original = httpx.Client

    def install(outcome="success", on_comment=None):
        calls = []

        def handle(request):
            calls.append(request)
            if request.url.path.endswith("/comments"):
                if on_comment:
                    on_comment(request)
                if outcome == "timeout":
                    raise httpx.ReadTimeout("secret-token request body", request=request)
                if outcome == "connect":
                    raise httpx.ConnectError("secret-token", request=request)
                if outcome == "invalid_json":
                    return httpx.Response(200, content=b"secret-token not json")
                if outcome == "missing_id":
                    return httpx.Response(200, json={})
                if outcome == "bad_id":
                    return httpx.Response(200, json={"id": {"access_token": "secret-token"}})
                if outcome == "error":
                    return httpx.Response(200, json={"error": {"code": 10, "message": "secret-token", "error_data": {"token": "secret-token"}}})
                if outcome == "malformed_error":
                    return httpx.Response(200, json={"error": None})
                if outcome == "conflicting":
                    return httpx.Response(200, json={"id": "comment-123", "error": {"code": 10}})
                if isinstance(outcome, int):
                    return httpx.Response(outcome, json={"error": {"code": 190, "message": "secret-token"}})
                return httpx.Response(200, json={"id": "comment-123", "access_token": "secret-token"})
            if request.method == "GET":
                return httpx.Response(200, json={"status_code": "FINISHED", "status": "AVAILABLE"})
            if request.url.path.endswith("/ugcPosts"):
                return httpx.Response(201, json={"id": "remote"})
            if request.url.path.endswith("/posts"):
                return httpx.Response(201, headers={"x-restli-id": "remote"})
            return httpx.Response(200, json={"id": "remote"})

        monkeypatch.setattr(httpx, "Client", lambda **kwargs: original(**kwargs, transport=httpx.MockTransport(handle)))
        return calls

    return install


@pytest.mark.parametrize("publisher_class", [FacebookPublisher, InstagramPublisher])
@pytest.mark.parametrize("multi", [False, True])
@pytest.mark.parametrize("outcome,status", [
    ("success", "succeeded"), (400, "failed"), (401, "failed"), (403, "failed"), (429, "failed"),
    (500, "unknown"), (503, "unknown"), ("timeout", "unknown"), ("connect", "unknown"),
    ("error", "failed"), ("invalid_json", "unknown"), ("missing_id", "unknown"), ("bad_id", "unknown"),
    ("malformed_error", "unknown"), ("conflicting", "unknown"),
])
def test_graph_parent_success_is_independent_of_verified_comment(graph, publisher_class, multi, outcome, status):
    publisher = publisher_class()
    snapshots = []
    publisher.set_publish_context({}, lambda state: snapshots.append(dict(state)))

    def on_comment(request):
        pending = snapshots[-1]
        assert pending["platform_post_id"] == "remote"
        assert pending["submission_started"] is False
        assert pending["first_comment_state"]["status"] == "pending"
        assert pending["first_comment_state"]["attempt_count"] == 1
        assert parse_qs(request.content.decode())["message"] == ["Authored\n\ncomment"]

    calls = graph(outcome, on_comment)
    kwargs = {"image_urls": ["https://images.test/1.jpg", "https://images.test/2.jpg"]} if multi else {"image_url": "https://images.test/1.jpg"}
    result = publisher.publish(platform_account_id="account", access_token="secret-token", caption="Body", hashtags=["tag"], first_comment=" Authored\n\ncomment ", **kwargs)
    assert result.success and result.platform_post_id == "remote"
    state = publisher.publish_state()["first_comment_state"]
    assert result.first_comment_state == state
    assert state["status"] == status
    assert state["attempt_count"] == 1
    assert state["platform_comment_id"] == ("comment-123" if status == "succeeded" else None)
    assert "secret-token" not in repr(snapshots)
    assert len([r for r in calls if r.url.path.endswith("/comments")]) == 1
    if outcome == 429:
        assert state["error_code"] == "RATE_LIMITED" and state["http_status"] == 429
    if outcome == "error":
        assert state["provider_error_code"] == 10


@pytest.mark.parametrize("multi", [False, True])
def test_linkedin_persists_unsupported_without_comment_request(graph, multi):
    calls = graph()
    publisher = LinkedInPublisher()
    kwargs = {}
    if multi:
        publisher.set_publish_context({"linkedin_images": ["urn:li:image:one", "urn:li:image:two"]}, lambda _: None)
        kwargs["image_urls"] = ["https://images.test/1.jpg", "https://images.test/2.jpg"]
    result = publisher.publish(platform_account_id="person:account", access_token="secret-token", caption="Body", hashtags=[], first_comment="Requested", **kwargs)
    assert result.success
    assert result.first_comment_state["status"] == "unsupported"
    assert result.first_comment_state["attempt_count"] == 0
    assert not any(r.url.path.endswith("/comments") for r in calls)


@pytest.mark.parametrize("text", [None, "", " \n\t "])
def test_blank_comment_is_not_requested(graph, text):
    calls = graph()
    result = FacebookPublisher().publish(platform_account_id="account", access_token="secret-token", caption="Body", hashtags=[], first_comment=text)
    assert result.success and result.first_comment_state is None
    assert len(calls) == 1


@pytest.fixture
def worker_db(db, monkeypatch):
    monkeypatch.setattr(publish, "get_database", lambda: db)
    monkeypatch.setattr(retry, "get_database", lambda: db)
    monkeypatch.setattr(publish, "decrypt", lambda _: "secret-token")
    monkeypatch.setattr(retry, "decrypt", lambda _: "secret-token")
    monkeypatch.setattr("app.social.audit.write_social_audit", lambda *args, **kwargs: None)
    monkeypatch.setattr(retry.retry_failed_post, "apply_async", Mock())
    db["social_posts"].insert_one({"id": "post", "workspace_id": "workspace", "status": "scheduled"})
    db["social_accounts"].insert_one({"id": "account", "workspace_id": "workspace", "platform": "facebook", "platform_account_id": "page", "is_active": True, "access_token_enc": "encrypted"})
    db["social_post_platforms"].insert_one({"id": "pp", "post_id": "post", "platform": "facebook", "social_account_id": "account", "status": "pending", "caption": "Body", "hashtags": [], "first_comment": "Requested"})
    return db


@pytest.mark.parametrize("outcome,status", [("success", "succeeded"), (429, "failed"), ("timeout", "unknown"), ("invalid_json", "unknown")])
def test_worker_persists_separate_outcome_and_never_automatically_replays(worker_db, graph, outcome, status):
    def on_comment(_):
        row = worker_db["social_post_platforms"].find_one({"id": "pp"})
        assert row["first_comment_state"]["status"] == "pending"
        assert row["platform_post_id"] == "remote"

    calls = graph(outcome, on_comment)
    assert publish.publish_post.run("post")["status"] == "published"
    pp = worker_db["social_post_platforms"].find_one({"id": "pp"})
    assert pp["first_comment_state"] == pp["publish_state"]["first_comment_state"]
    assert pp["first_comment_state"]["status"] == status
    assert pp["status"] == "published" and pp["platform_post_id"] == "remote"
    assert pp["error_code"] is None and pp["next_retry_at"] is None
    assert "secret-token" not in repr(pp)
    publish.publish_post.run("post")
    assert retry.retry_failed_post.run("pp")["reason"] == "already_published"
    retry.retry_failed_post.apply_async.assert_not_called()
    assert len(calls) == 2


def test_explicit_retry_sends_only_comment_and_stale_tasks_cannot_repeat(worker_db, graph):
    graph(429)
    publish.publish_post.run("post")
    calls = graph()
    assert publish.retry_first_comment.run("pp", 1) == {"ok": True, "status": "succeeded"}
    assert publish.retry_first_comment.run("pp", 1)["reason"] == "not_retryable"
    assert len(calls) == 1 and calls[0].url.path.endswith("/remote/comments")
    pp = worker_db["social_post_platforms"].find_one({"id": "pp"})
    assert pp["first_comment_state"]["attempt_count"] == 2
    assert pp["first_comment_state"] == pp["publish_state"]["first_comment_state"]
    assert pp["status"] == "published" and pp["platform_post_id"] == "remote"
    assert "first_comment_claim" not in pp


def test_explicit_retry_cas_blocks_concurrent_and_duplicate_failed_attempt(worker_db, graph):
    graph(429)
    publish.publish_post.run("post")
    calls = graph(429)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: publish.retry_first_comment.run("pp", 1), range(16)))
    assert sum(r.get("status") == "failed" for r in results) == 1
    assert len(calls) == 1
    assert worker_db["social_post_platforms"].find_one({"id": "pp"})["first_comment_state"]["attempt_count"] == 2


def test_stale_parent_recovery_preserves_successful_comment_retry(worker_db, graph, monkeypatch):
    graph(429)
    publish.publish_post.run("post")
    collection = worker_db["social_post_platforms"]
    collection.update_one({"id": "pp"}, {"$set": {"status": "failed"}})
    original = collection.find_one
    paused = Event()
    resume = Event()

    def find_one(query, *args, **kwargs):
        row = original(query, *args, **kwargs)
        if query == {"id": "pp"} and not paused.is_set():
            assert row["first_comment_state"]["attempt_count"] == 1
            paused.set()
            assert resume.wait(10)
        return row

    monkeypatch.setattr(collection, "find_one", find_one)
    calls = graph()
    with ThreadPoolExecutor(max_workers=1) as pool:
        recovery = pool.submit(retry.retry_failed_post.run, "pp")
        try:
            assert paused.wait(10)
            assert publish.claim_platform(worker_db, original({"id": "pp"})) is None
            assert publish.retry_first_comment.run("pp", 1) == {"ok": True, "status": "succeeded"}
            succeeded = original({"id": "pp"})["first_comment_state"]
            assert succeeded["attempt_count"] == 2
            assert succeeded["platform_comment_id"] == "comment-123"
        finally:
            resume.set()
        assert recovery.result(timeout=10)["reason"] == "already_published"
    assert publish.retry_first_comment.run("pp", 1)["reason"] == "not_retryable"
    row = original({"id": "pp"})
    assert row["first_comment_state"] == row["publish_state"]["first_comment_state"] == succeeded
    assert row["status"] == "published" and row["platform_post_id"] == "remote"
    assert "first_comment_claim" not in row
    assert len(calls) == 1 and calls[0].url.path.endswith("/remote/comments")


@pytest.mark.parametrize("outcome", ["timeout", "invalid_json", "missing_id", 503])
def test_unknown_comment_cannot_be_explicitly_replayed(worker_db, graph, outcome):
    graph(outcome)
    publish.publish_post.run("post")
    calls = graph()
    assert publish.retry_first_comment.run("pp", 1)["reason"] == "not_retryable"
    assert not calls


@pytest.mark.parametrize("change,reason", [("copy", "comment_changed"), ("account", "account_unavailable"), ("expiry", "token_expired"), ("archive", "post_unavailable")])
def test_explicit_retry_preflight_is_fail_closed(worker_db, graph, change, reason):
    graph(429)
    publish.publish_post.run("post")
    if change == "copy":
        worker_db["social_post_platforms"].update_one({"id": "pp"}, {"$set": {"first_comment": "Changed"}})
    elif change == "account":
        worker_db["social_accounts"].update_one({"id": "account"}, {"$set": {"workspace_id": "other"}})
    elif change == "expiry":
        worker_db["social_accounts"].update_one({"id": "account"}, {"$set": {"token_expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}})
    else:
        worker_db["social_posts"].update_one({"id": "post"}, {"$set": {"status": "archived"}})
    calls = graph()
    assert publish.retry_first_comment.run("pp", 1)["reason"] == reason
    assert not calls


def test_crash_leaves_pending_and_parent_id_recovery_never_replays(worker_db, graph):
    def crash(_):
        raise SystemExit("simulated worker death")

    calls = graph(on_comment=crash)
    with pytest.raises(SystemExit):
        publish.publish_post.run("post")
    row = worker_db["social_post_platforms"].find_one({"id": "pp"})
    assert row["platform_post_id"] == "remote"
    assert row["first_comment_state"]["status"] == "pending"
    assert publish.claim_platform(worker_db, row) is None
    assert retry.retry_failed_post.run("pp")["reason"] == "already_published"
    assert publish.retry_first_comment.run("pp", 1)["reason"] == "not_retryable"
    assert len(calls) == 2


def test_lost_final_comment_checkpoint_retains_parent_and_pending(worker_db, graph, monkeypatch):
    collection = worker_db["social_post_platforms"]
    original = collection.update_one

    def update(query, changes, *args, **kwargs):
        state = changes.get("$set", {}).get("first_comment_state")
        if state and state["status"] == "succeeded":
            raise RuntimeError("database unavailable")
        return original(query, changes, *args, **kwargs)

    monkeypatch.setattr(collection, "update_one", update)
    calls = graph()
    assert publish.publish_post.run("post")["status"] == "published"
    row = collection.find_one({"id": "pp"})
    assert row["platform_post_id"] == "remote" and row["first_comment_state"]["status"] == "pending"
    assert publish.retry_first_comment.run("pp", 1)["reason"] == "not_retryable"
    assert len(calls) == 2


def test_legacy_known_parent_without_comment_receipt_is_unknown(worker_db, graph):
    worker_db["social_post_platforms"].update_one({"id": "pp"}, {"$set": {"status": "failed", "publish_state.platform_post_id": "known"}})
    calls = graph()
    assert retry.retry_failed_post.run("pp")["reason"] == "already_published"
    row = worker_db["social_post_platforms"].find_one({"id": "pp"})
    assert row["first_comment_state"]["status"] == "unknown"
    assert row["first_comment_state"] == row["publish_state"]["first_comment_state"]
    assert not calls


@pytest.mark.parametrize("field,value", [
    ("publish_claim", "replacement-claim"),
    ("status", "publishing"),
    ("platform_post_id", "replacement-parent"),
    ("publish_state.platform_post_id", "replacement-parent"),
])
def test_parent_recovery_rereads_when_publication_snapshot_changes(worker_db, graph, monkeypatch, field, value):
    collection = worker_db["social_post_platforms"]
    collection.update_one({"id": "pp"}, {"$set": {"status": "failed", "publish_state.platform_post_id": "known"}})
    snapshot = collection.find_one({"id": "pp"})
    collection.update_one({"id": "pp"}, {"$set": {field: value}})
    current = collection.find_one({"id": "pp"})
    original = collection.find_one
    reads = []

    def find_one(query, *args, **kwargs):
        row = original(query, *args, **kwargs)
        reads.append(row)
        assert row == current
        return row

    calls = graph()
    with monkeypatch.context() as context:
        context.setattr(collection, "find_one", find_one)
        assert publish.claim_platform(worker_db, snapshot) is None
    assert len(reads) == 1
    row = original({"id": "pp"})
    assert row["platform_post_id"] == ("replacement-parent" if "platform_post_id" in field else "known")
    assert row["status"] == "published"
    assert not calls


@pytest.mark.parametrize("field,value", [
    ("first_comment_state", {"status": "succeeded", "attempt_count": 2, "platform_comment_id": "preserved-comment"}),
    ("publish_state.first_comment_state", {"status": "succeeded", "attempt_count": 2, "platform_comment_id": "preserved-comment"}),
    ("first_comment_claim", "active-comment-claim"),
])
def test_legacy_receipt_initialization_is_atomic_and_never_overwrites(worker_db, graph, monkeypatch, field, value):
    collection = worker_db["social_post_platforms"]
    collection.update_one({"id": "pp"}, {"$set": {"status": "failed", "publish_state.platform_post_id": "known"}})
    snapshot = collection.find_one({"id": "pp"})
    original = collection.update_one
    initialized = []

    def update_one(query, changes, *args, **kwargs):
        if "first_comment_state" in changes.get("$set", {}):
            original({"id": "pp"}, {"$set": {field: value}})
            result = original(query, changes, *args, **kwargs)
            initialized.append(result.matched_count)
            return result
        return original(query, changes, *args, **kwargs)

    monkeypatch.setattr(collection, "update_one", update_one)
    calls = graph()
    assert publish.claim_platform(worker_db, snapshot) is None
    assert initialized == [0]
    row = collection.find_one({"id": "pp"})
    assert row["status"] == "published" and row["platform_post_id"] == "known"
    if field == "publish_state.first_comment_state":
        assert row["publish_state"]["first_comment_state"] == value
        assert "first_comment_state" not in row
    else:
        assert row[field] == value
        assert "first_comment_state" not in row["publish_state"]
    assert not calls


@pytest.mark.parametrize("platform", ["facebook", "instagram"])
@pytest.mark.parametrize("multi", [False, True])
def test_worker_graph_media_paths_and_comment_only_retry(worker_db, graph, platform, multi):
    worker_db["social_post_platforms"].update_one({"id": "pp"}, {"$set": {"platform": platform}})
    worker_db["social_accounts"].update_one({"id": "account"}, {"$set": {"platform": platform}})
    slides = [{"id": f"slide-{i}"} for i in range(2 if multi else 1)]
    media = []
    for slide in slides:
        key = f"social/workspace/{slide['id']}.jpg"
        worker_db["social_media_assets"].insert_one({"id": slide["id"], "workspace_id": "workspace", "blob_key": key, "media_type": "image"})
        media.append({"assetId": slide["id"], "blobKey": key, "slideId": slide["id"]})
    worker_db["social_posts"].update_one({"id": "post"}, {"$set": {"format": "carousel" if multi else "single", "slides": slides}})
    worker_db["social_post_platforms"].update_one({"id": "pp"}, {"$set": {"media": media}})
    with patch("app.social.media.refresh_blob_url", side_effect=lambda key: f"https://images.test/{key}"):
        graph(429)
        assert publish.publish_post.run("post")["status"] == "published"
    calls = graph()
    assert publish.retry_first_comment.run("pp", 1)["status"] == "succeeded"
    assert len(calls) == 1 and calls[0].url.path.endswith("/remote/comments")
    assert calls[0].url.host == ("graph.instagram.com" if platform == "instagram" else "graph.facebook.com")


def test_worker_linkedin_requested_comment_remains_unsupported(worker_db, graph):
    worker_db["social_post_platforms"].update_one({"id": "pp"}, {"$set": {"platform": "linkedin"}})
    calls = graph()
    assert publish.publish_post.run("post")["status"] == "published"
    row = worker_db["social_post_platforms"].find_one({"id": "pp"})
    assert row["first_comment_state"]["status"] == "unsupported"
    assert publish.retry_first_comment.run("pp", 0)["reason"] == "not_retryable"
    assert len(calls) == 1


def test_explicit_retry_ambiguous_response_is_never_replayed(worker_db, graph):
    graph(429)
    publish.publish_post.run("post")
    calls = graph("timeout")
    assert publish.retry_first_comment.run("pp", 1) == {"ok": False, "status": "unknown"}
    assert publish.retry_first_comment.run("pp", 2)["reason"] == "not_retryable"
    assert len(calls) == 1


def test_explicit_retry_worker_crash_leaves_pending_without_replay(worker_db, graph):
    graph(429)
    publish.publish_post.run("post")

    def crash(_):
        raise SystemExit("simulated worker death")

    calls = graph(on_comment=crash)
    with pytest.raises(SystemExit):
        publish.retry_first_comment.run("pp", 1)
    row = worker_db["social_post_platforms"].find_one({"id": "pp"})
    assert row["status"] == "published" and row["platform_post_id"] == "remote"
    assert row["first_comment_state"]["status"] == "pending"
    assert row["first_comment_state"]["attempt_count"] == 2
    assert publish.retry_first_comment.run("pp", 2)["reason"] == "not_retryable"
    assert len(calls) == 1


def test_pending_checkpoint_must_succeed_before_comment_http(worker_db, graph, monkeypatch):
    collection = worker_db["social_post_platforms"]
    original = collection.update_one

    def update(query, changes, *args, **kwargs):
        state = changes.get("$set", {}).get("first_comment_state")
        if state and state["status"] == "pending" and state["attempt_count"] == 1:
            raise RuntimeError("database unavailable")
        return original(query, changes, *args, **kwargs)

    monkeypatch.setattr(collection, "update_one", update)
    calls = graph()
    assert publish.publish_post.run("post")["status"] == "published"
    row = collection.find_one({"id": "pp"})
    assert row["first_comment_state"]["status"] == "pending" and row["first_comment_state"]["attempt_count"] == 0
    assert row["platform_post_id"] == "remote"
    assert not any(r.url.path.endswith("/comments") for r in calls)