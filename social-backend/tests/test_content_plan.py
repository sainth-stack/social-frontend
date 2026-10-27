from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.social.content_plan import ContentPlanService
from app.social.models import SocialPlatform
from app.social.schemas import ContentPlanGenerateRequest
from app.social.service import SocialMediaService


@pytest.fixture()
def planner(db, monkeypatch):
    workspace = {"id": "workspace", "name": "Brand", "plan": "growth", "owner_user_id": "owner"}
    user = {"id": "owner"}
    db.workspaces.insert_one(deepcopy(workspace))
    for platform in ("facebook", "instagram", "linkedin"):
        db.social_accounts.insert_one({"id": platform, "workspace_id": workspace["id"], "platform": platform,
                                       "platform_account_id": platform, "is_active": True})
    from app.social import limits
    from app.social.ai import generator

    monkeypatch.setattr(limits, "enforce_posts_limit", lambda *args: None)
    monkeypatch.setattr(limits, "enforce_ai_text_limit", lambda *args: None)
    monkeypatch.setattr(limits, "enforce_ai_image_limit", lambda *args: None)
    monkeypatch.setattr(generator, "generate_platform_content", lambda **kw: {
        kw["platforms"][0]: {"caption": "Useful launch advice", "hashtags": ["launch"]}})
    render = Mock(side_effect=AssertionError("Initial plans must not generate images"))
    enqueue = Mock(side_effect=AssertionError("Initial plans must not schedule"))
    monkeypatch.setattr(SocialMediaService, "render_brand_creative", render)
    monkeypatch.setattr(SocialMediaService, "_enqueue_publish", enqueue)
    return workspace, user, render, enqueue


def make_plan(db, planner, **kwargs):
    workspace, user, _, _ = planner
    return ContentPlanService(db).generate(workspace, user, ContentPlanGenerateRequest(
        days=1, prompt="A launch campaign with useful advice", skipFilledDays=False, **kwargs))


@pytest.mark.parametrize("default,override,expected", [
    (None, None, False), (True, None, True), (True, False, False), (False, True, True),
])
def test_legacy_plan_first_comment_preference_is_resolved_and_saved(db, planner, monkeypatch, default, override, expected):
    from app.social.ai import generator

    if default is not None:
        db.social_settings.insert_one({"workspace_id": planner[0]["id"], "auto_first_comment": default})
    generate = Mock(side_effect=lambda **kw: {kw["platforms"][0]: {
        "caption": "Useful launch advice", "firstComment": "Supporting comment"}})
    monkeypatch.setattr(generator, "generate_platform_content", generate)
    result = make_plan(db, planner, includeComment=override, platforms=[SocialPlatform.FACEBOOK])
    assert result.draftCount == 1
    assert generate.call_args.kwargs["include_comment"] is expected
    saved = SocialMediaService(db).get_post(db.social_posts.find_one({"id": result.items[0].postId}))
    assert saved.platforms[0].firstComment == ("Supporting comment" if expected else "")
    assert saved.generationOptions["includeComment"] is expected
    assert generate.call_count == 1


@pytest.mark.parametrize("images", [False, True])
def test_initial_plan_is_text_only_even_for_instagram_and_legacy_autoschedule(db, planner, images):
    result = make_plan(db, planner, autoSchedule=True, generateImages=images)
    assert result.draftCount == 3
    assert result.scheduledCount == 0
    assert result.autoScheduled is False
    assert not result.errors
    assert {item.platform for item in result.items} == {SocialPlatform.FACEBOOK, SocialPlatform.INSTAGRAM, SocialPlatform.LINKEDIN}
    assert all(item.status.value == "draft" and not item.imageUrl for item in result.items)
    assert all(post["planner_text_first"] and post["scheduled_at"] for post in db.social_posts.find())
    planner[2].assert_not_called()
    planner[3].assert_not_called()
    assert db.plans_ai_usage.count_documents({"kind": "image"}) == 0
    calendar = SocialMediaService(db).calendar(planner[0], result.items[0].date[:7])
    assert len(calendar.items) == 3


def visual_setup(db, planner, monkeypatch):
    result = make_plan(db, planner, platforms=[SocialPlatform.INSTAGRAM])
    post = db.social_posts.find_one({"id": result.items[0].postId})
    row = db.social_post_platforms.find_one({"post_id": post["id"]})
    db.social_post_platforms.update_one({"id": row["id"]}, {"$set": {"caption": "Latest edited approved copy"}})
    render = planner[2]
    render.side_effect = None
    render.return_value = SimpleNamespace(image=b"image")
    from app.social import media

    upload = Mock(return_value=SimpleNamespace(url="https://cdn.test/approved.jpg", blob_key="approved.jpg",
                                             content_type="image/jpeg", file_size=5))
    monkeypatch.setattr(media, "upload_social_image_bytes", upload)
    return post, render, upload


def test_approval_persists_fingerprint_uses_latest_copy_and_retry_reuses_image(db, planner, monkeypatch):
    post, render, _ = visual_setup(db, planner, monkeypatch)
    service = ContentPlanService(db)
    result = service.approve_and_generate_visual(planner[0], planner[1], post, "Latest edited approved copy")
    assert result.status.value == "draft"
    assert result.imageUrl == "https://cdn.test/approved.jpg"
    assert "Latest edited approved copy" in render.call_args.args[1]
    assert render.call_args.args[3].caption == "Latest edited approved copy"
    saved = db.social_posts.find_one({"id": post["id"]})
    assert saved["planner_approved_fingerprint"] == service.copy_fingerprint(saved)
    assert saved["planner_visual_fingerprint"] == saved["planner_approved_fingerprint"]
    assert saved["planner_approved_by"] == "owner"
    service.approve_and_generate_visual(planner[0], planner[1], post, "Latest edited approved copy")
    assert render.call_count == 1


@pytest.mark.parametrize("case", ["stale", "viewer", "foreign", "scheduled", "locked"])
def test_approval_rejects_unsafe_requests_before_paid_attempt(db, planner, monkeypatch, case):
    post, render, _ = visual_setup(db, planner, monkeypatch)
    workspace, user = deepcopy(planner[0]), deepcopy(planner[1])
    caption = "Latest edited approved copy"
    if case == "stale":
        caption = "Old caption"
    if case == "viewer":
        user["id"] = "viewer"
    if case == "foreign":
        workspace["id"] = "foreign"
    if case == "scheduled":
        db.social_posts.update_one({"id": post["id"]}, {"$set": {"status": "scheduled"}})
    if case == "locked":
        db.social_posts.update_one({"id": post["id"]}, {"$set": {"planner_visual_lock_until": datetime.now(timezone.utc) + timedelta(minutes=10)}})
    with pytest.raises(HTTPException) as exc:
        ContentPlanService(db).approve_and_generate_visual(workspace, user, post, caption)
    assert exc.value.status_code in (403, 404, 409)
    render.assert_not_called()


@pytest.mark.parametrize("failure", ["render", "storage"])
def test_visual_failure_is_actionable_keeps_approved_copy_and_allows_retry(db, planner, monkeypatch, failure):
    post, render, upload = visual_setup(db, planner, monkeypatch)
    if failure == "render":
        render.side_effect = RuntimeError("provider unavailable")
    else:
        upload.return_value = None
    service = ContentPlanService(db)
    with pytest.raises(HTTPException) as exc:
        service.approve_and_generate_visual(planner[0], planner[1], post, "Latest edited approved copy")
    assert exc.value.status_code == 502
    assert "Retry" in exc.value.detail
    saved = db.social_posts.find_one({"id": post["id"]})
    assert saved["planner_approved_fingerprint"]
    assert "planner_visual_lock" not in saved
    assert saved["status"] == "draft"
    assert not saved["image_url"]


def test_copy_changed_during_generation_does_not_attach_stale_visual(db, planner, monkeypatch):
    post, render, _ = visual_setup(db, planner, monkeypatch)
    def change_copy(*args):
        db.social_post_platforms.update_one({"post_id": post["id"]}, {"$set": {"caption": "Concurrent edit"}})
        return SimpleNamespace(image=b"image")
    render.side_effect = change_copy
    with pytest.raises(HTTPException) as exc:
        ContentPlanService(db).approve_and_generate_visual(planner[0], planner[1], post, "Latest edited approved copy")
    assert exc.value.status_code == 409
    assert not db.social_posts.find_one({"id": post["id"]})["image_url"]


def test_caption_partial_failure_retains_other_drafts(db, planner, monkeypatch):
    from app.social.ai import generator
    def generate(**kw):
        if kw["platforms"] == ["instagram"]:
            raise RuntimeError("provider down")
        return {kw["platforms"][0]: {"caption": "Useful advice"}}
    monkeypatch.setattr(generator, "generate_platform_content", generate)
    result = make_plan(db, planner)
    assert result.draftCount == 2
    assert len(result.errors) == 1
    assert "instagram" in result.errors[0] and "Retry this day" in result.errors[0]


def test_job_poll_checks_workspace_before_accessing_result(fake_redis):
    from app.social.content_plan_jobs import register_content_plan_job
    from app.social.router import get_content_plan_job
    register_content_plan_job("private-job", "owner-workspace")
    with pytest.raises(HTTPException) as exc:
        get_content_plan_job("private-job", workspace={"id": "other"}, _={"id": "user"})
    assert exc.value.status_code == 403


def test_generic_regeneration_cannot_bypass_planner_approval(db, planner):
    from app.social.router import regenerate_post_content
    from app.social.schemas import RegeneratePostContentRequest
    make_plan(db, planner)
    post = db.social_posts.find_one()
    with pytest.raises(HTTPException) as exc:
        regenerate_post_content(RegeneratePostContentRequest(), post=post, workspace=planner[0], db=db, current_user=planner[1])
    assert exc.value.status_code == 409
    planner[2].assert_not_called()


def test_copy_edit_invalidates_approval_and_detaches_stale_visual(db, planner, monkeypatch):
    from app.social.router import update_post
    from app.social.schemas import UpdateSocialPostRequest, SocialPostPlatformIn
    post, render, _ = visual_setup(db, planner, monkeypatch)
    ContentPlanService(db).approve_and_generate_visual(planner[0], planner[1], post, "Latest edited approved copy")
    updated = update_post(
        UpdateSocialPostRequest(platforms=[SocialPostPlatformIn(platform=SocialPlatform.INSTAGRAM,
            socialAccountId="instagram", caption="A different caption")]),
        post=db.social_posts.find_one({"id": post["id"]}), workspace=planner[0], db=db, _=planner[1],
    )
    assert updated.imageUrl is None
    assert updated.platforms[0].caption == "A different caption"
    saved = db.social_posts.find_one({"id": post["id"]})
    assert "planner_approved_fingerprint" not in saved
    assert "planner_visual_fingerprint" not in saved
    assert render.call_count == 1


def test_edit_lock_prevents_copy_mutation_while_visual_is_claimed(db, planner):
    from app.social.router import update_post
    from app.social.schemas import UpdateSocialPostRequest
    make_plan(db, planner)
    post = db.social_posts.find_one()
    with ContentPlanService(db).edit_lock(post):
        with pytest.raises(HTTPException) as exc:
            update_post(UpdateSocialPostRequest(title="Not allowed"), post=post, workspace=planner[0], db=db, _=planner[1])
        assert exc.value.status_code == 409
    assert db.social_posts.find_one({"id": post["id"]})["title"] != "Not allowed"


def test_visual_route_requires_workspace_access_and_scoped_post(client, db, planner, monkeypatch):
    from app.core.config import settings
    from app.auth.deps import get_current_user
    from app.workspaces.deps import require_workspace_access
    from app.main import app
    post, render, _ = visual_setup(db, planner, monkeypatch)
    app.dependency_overrides[get_current_user] = lambda: planner[1]
    app.dependency_overrides[require_workspace_access] = lambda: {**planner[0], "id": "other"}
    response = client.post(f"{settings.api_v1_prefix}/workspaces/other/social/content-plan/posts/{post['id']}/approve-visual",
                           json={"caption": "Latest edited approved copy"})
    assert response.status_code == 404
    render.assert_not_called()


def test_worker_account_validation_failure_returns_actionable_error(db, monkeypatch, fake_redis):
    from app.social.tasks import content_plan
    from app.core import database
    db.workspaces.insert_one({"id": "empty", "owner_user_id": "owner"})
    db.users.insert_one({"id": "owner"})
    monkeypatch.setattr(content_plan, "get_database", lambda: db)
    monkeypatch.setattr(database, "get_database", lambda: db)
    result = content_plan.generate_content_plan_task.run("empty", "owner", {"prompt": "A useful launch campaign"})
    assert "Connect" in result["error"]