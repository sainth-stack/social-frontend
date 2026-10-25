from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.core.mongo_utils import utcnow
from app.social.schemas import CreateSocialPostRequest, SchedulePostRequest, UpdateSocialPostRequest
from app.social.service import SocialMediaService


def studio(platforms=("linkedin",), *, visual=False, carousel=False):
    now = utcnow()
    rows = [{
        "id": platform, "post_id": "post", "platform": platform,
        "social_account_id": platform + "-account", "caption": "Approved launch copy",
        "hashtags": ["Launch"], "status": "pending", "media": [],
    } for platform in platforms]
    slides = [{"id": f"slide-{i}", "headline": f"Step {i}", "body": "Approved detail", "imagePrompt": "Product photo"} for i in (1, 2)] if carousel else []
    settings = {
        "tone": "Professional", "includeEmojis": False, "includeHashtags": True, "length": "medium",
        "slideCount": 2 if carousel else 3, "variationsWanted": 1, "artDirection": "",
        "cta": "", "visualFormat": "auto", "headlineOnImage": False, "includeLogo": False,
        "logoId": None, "logoPosition": "bottom-right",
    }
    content = {
        **settings, "platforms": [{key: row[key] for key in ("platform", "caption", "hashtags")} for row in rows],
        "slides": deepcopy(slides), "tweets": [], "prompt": "Launch a useful product", "type": "Carousel" if carousel else "Caption",
        "alsoGenerateImage": visual, "brandForbidsEmoji": False, "effectiveLogoId": None, "brandKit": {},
    }
    post = {
        "id": "post", "workspace_id": "workspace", "created_by": "user", "title": "Launch", "status": "draft",
        "ai_prompt": content["prompt"], "format": "carousel" if carousel else "single", "slides": slides, "tweets": [],
        "image_url": None, "image_source": "none", "created_at": now, "updated_at": now,
        "generation_options": {
            **settings, "contentType": content["type"], "visualIntent": visual, "visualsStale": False,
            "copyApproval": {"version": 1, "fingerprint": json.dumps({"version": 1, "content": content}, sort_keys=True, ensure_ascii=False)},
        },
    }
    return post, rows


def seed(db, post, rows):
    db.social_posts.insert_one(deepcopy(post))
    db.social_post_platforms.insert_many(deepcopy(rows))


def run(service, post, operation):
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    if operation == "publish":
        return service.publish_now(post)
    if operation == "schedule":
        return service.schedule_post(post, SchedulePostRequest(scheduledAt=future))
    return service.update_post(post, {"id": "workspace"}, UpdateSocialPostRequest(status="scheduled", scheduledAt=future))


def attach(db, post, rows):
    for row in rows:
        ids = [slide["id"] for slide in post["slides"]] or ["single"]
        for slide_id in ids:
            asset_id = row["platform"] + "-" + slide_id
            key = f"social/workspace/{asset_id}.jpg"
            url = "https://cdn.test/" + asset_id + ".jpg"
            db.social_media_assets.insert_one({"id": asset_id, "workspace_id": "workspace", "media_type": "image", "blob_key": key, "blob_url": url})
            row["media"].append({"assetId": asset_id, "blobKey": key, "url": url, "slideId": slide_id, "width": 1080, "height": 1350})
    post["image_url"] = rows[0]["media"][0]["url"]


@pytest.mark.parametrize("operation", ["publish", "schedule", "update"])
def test_approved_text_only_studio_can_publish_or_schedule(db, monkeypatch, operation):
    post, rows = studio()
    seed(db, post, rows)
    service = SocialMediaService(db)
    queue = Mock()
    monkeypatch.setattr(service, "_enqueue_publish", queue)
    result = run(service, post, operation)
    assert result.platforms[0].caption == "Approved launch copy"
    queue.assert_called_once()


@pytest.mark.parametrize("operation", ["publish", "schedule", "update"])
@pytest.mark.parametrize("change", ["caption", "hashtags", "platform", "slides", "tweets", "prompt", "format", "options", "visual-intent", "missing", "boolean", "malformed", "unknown-version", "empty-copy"])
def test_stale_or_invalid_approval_rejected_without_writes(db, monkeypatch, operation, change):
    post, rows = studio()
    options = post["generation_options"]
    if change == "caption":
        rows[0]["caption"] = "Edited behind approval"
    elif change == "hashtags":
        rows[0]["hashtags"] = ["Different"]
    elif change == "platform":
        rows[0]["platform"] = "facebook"
    elif change == "slides":
        post["slides"] = [{"id": "extra", "headline": "Extra"}]
    elif change == "tweets":
        post["tweets"] = [{"text": "Extra"}]
    elif change == "prompt":
        post["ai_prompt"] = "A changed brief"
    elif change == "format":
        post["format"] = "carousel"
    elif change == "options":
        options["tone"] = "Casual"
    elif change == "visual-intent":
        options["visualIntent"] = True
    elif change == "missing":
        options["copyApproval"] = None
    elif change == "boolean":
        options["copyApproval"] = True
    elif change == "malformed":
        options["copyApproval"]["fingerprint"] = "not-json"
    elif change == "unknown-version":
        options["copyApproval"]["version"] = 2
    else:
        rows[0]["caption"] = ""
    seed(db, post, rows)
    before = list(db.social_posts.find()), list(db.social_post_platforms.find())
    service = SocialMediaService(db)
    queue = Mock()
    monkeypatch.setattr(service, "_enqueue_publish", queue)
    with pytest.raises(HTTPException, match="Copy approval"):
        run(service, post, operation)
    assert (list(db.social_posts.find()), list(db.social_post_platforms.find())) == before
    queue.assert_not_called()


def test_canonical_caption_and_hashtags_do_not_require_byte_equal_fingerprint(db):
    post, rows = studio()
    rows[0].update(caption="  **Approved launch copy**\r\n\r\n#Launch ", hashtags=["#Launch", "launch"])
    SocialMediaService(db)._validate_ready_to_publish_dict(post, rows)


@pytest.mark.parametrize("change", ["missing", "stale", "partial"])
def test_visual_intent_requires_completed_current_visuals(db, change):
    post, rows = studio(("linkedin", "facebook"), visual=True)
    if change != "missing":
        attach(db, post, rows)
    if change == "stale":
        post["generation_options"]["visualsStale"] = True
    if change == "partial":
        post["generation_options"]["creativeRequest"] = {"requestId": "request"}
        rows[1]["media"] = []
    with pytest.raises(HTTPException, match="visuals|stale"):
        SocialMediaService(db)._validate_ready_to_publish_dict(post, rows)


@pytest.mark.parametrize("change", [None, "headline", "body", "imagePrompt", "order", "missing-image", "media-order"])
def test_carousel_approval_checks_copy_and_all_ordered_images(db, change):
    post, rows = studio(("instagram", "linkedin"), visual=True, carousel=True)
    attach(db, post, rows)
    if change in ("headline", "body", "imagePrompt"):
        post["slides"][0][change] = "Changed"
    elif change == "order":
        post["slides"].reverse()
    elif change == "missing-image":
        rows[1]["media"].pop()
    elif change == "media-order":
        rows[1]["media"].reverse()
    service = SocialMediaService(db)
    if change:
        with pytest.raises(HTTPException):
            service._validate_ready_to_publish_dict(post, rows)
    else:
        service._validate_ready_to_publish_dict(post, rows)


@pytest.mark.parametrize("change", ["caption", "slides", "media", "options", "erase-options"])
def test_generic_draft_updates_invalidate_and_cannot_remove_workflow(db, monkeypatch, change):
    post, rows = studio()
    monkeypatch.setattr("app.social.media.ensure_public_image_url", lambda workspace, url: url)
    seed(db, post, rows)
    payload = {
        "caption": {"platforms": [{"platform": "linkedin", "caption": "Changed copy", "hashtags": ["Launch"]}]},
        "slides": {"slides": [{"id": "new", "headline": "New slide"}]},
        "media": {"imageUrl": "https://cdn.test/new.jpg"},
        "options": {"generationOptions": {**post["generation_options"], "tone": "Casual"}},
        "erase-options": {"generationOptions": {}},
    }[change]
    service = SocialMediaService(db)
    service.update_post(post, {"id": "workspace"}, UpdateSocialPostRequest(**payload))
    fresh = db.social_posts.find_one({"id": "post"})
    assert fresh["studio_approval_version"] == 1
    assert fresh["generation_options"]["copyApproval"] is None
    monkeypatch.setattr(service, "_enqueue_publish", Mock())
    with pytest.raises(HTTPException, match="Copy approval"):
        run(service, fresh, "schedule")


def test_saving_approved_copy_before_visuals_preserves_approval(db):
    post, rows = studio(visual=True)
    seed(db, post, rows)
    service = SocialMediaService(db)
    result = service.update_post(post, {"id": "workspace"}, UpdateSocialPostRequest(title="Renamed"))
    assert result.generationOptions["copyApproval"] == post["generation_options"]["copyApproval"]
    with pytest.raises(HTTPException, match="visuals are missing"):
        service._validate_ready_to_publish_dict(db.social_posts.find_one({"id": "post"}), rows)


def test_new_draft_sticky_workflow_marker_is_persisted(db, monkeypatch):
    post, rows = studio()
    monkeypatch.setattr("app.social.permissions.require_permission", lambda *args: None)
    monkeypatch.setattr("app.social.limits.enforce_posts_limit", lambda *args: None)
    payload = CreateSocialPostRequest(aiPrompt=post["ai_prompt"], generationOptions={**post["generation_options"], "copyApproval": None}, platforms=[{"platform": "linkedin", "caption": rows[0]["caption"]}])
    result = SocialMediaService(db).create_post({"id": "workspace"}, {"id": "user"}, payload)
    assert db.social_posts.find_one({"id": result.id})["studio_approval_version"] == 1


def test_scheduled_creation_rejects_unapproved_copy_without_persistence(db, monkeypatch):
    post, rows = studio()
    monkeypatch.setattr("app.social.permissions.require_permission", lambda *args: None)
    monkeypatch.setattr("app.social.limits.enforce_posts_limit", lambda *args: None)
    payload = CreateSocialPostRequest(
        status="scheduled", scheduledAt=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        aiPrompt=post["ai_prompt"], generationOptions=post["generation_options"],
        platforms=[{"platform": "linkedin", "caption": "Unapproved replacement"}],
    )
    with pytest.raises(HTTPException, match="Copy approval"):
        SocialMediaService(db).create_post({"id": "workspace"}, {"id": "user"}, payload)
    assert db.social_posts.count_documents({}) == 0
    assert db.social_post_platforms.count_documents({}) == 0


def test_completed_visual_save_retains_current_copy_approval(db, monkeypatch):
    post, rows = studio(visual=True)
    db.social_accounts.insert_one({"id": "linkedin-account", "workspace_id": "workspace", "platform": "linkedin", "platform_account_id": "company", "is_active": True})
    seed(db, post, rows)
    attach(db, post, rows)
    post["generation_options"]["creativeRequest"] = {"requestId": "completed"}
    monkeypatch.setattr("app.social.media.ensure_public_image_url", lambda workspace, url: url)
    monkeypatch.setattr("app.social.media.refresh_blob_url", lambda key: "https://cdn.test/" + key)
    payload = UpdateSocialPostRequest(
        imageUrl=post["image_url"], generationOptions=post["generation_options"],
        platforms=[{key: row[key] for key in ("platform", "caption", "hashtags", "media")} for row in rows],
    )
    service = SocialMediaService(db)
    result = service.update_post(db.social_posts.find_one({"id": "post"}), {"id": "workspace"}, payload)
    assert result.generationOptions["copyApproval"] == post["generation_options"]["copyApproval"]
    service._validate_ready_to_publish_dict(db.social_posts.find_one({"id": "post"}), list(db.social_post_platforms.find({"post_id": "post"})))


def test_legacy_linkedin_text_only_and_image_posts_need_no_studio_approval(db):
    post, rows = studio()
    post["generation_options"] = {"tone": "Professional"}
    service = SocialMediaService(db)
    service._validate_ready_to_publish_dict(post, rows)
    post["image_url"] = "https://cdn.test/legacy.jpg"
    service._validate_ready_to_publish_dict(post, rows)


def planner(post, rows):
    post.pop("generation_options")
    post["planner_text_first"] = True
    copy = sorted([{key: row.get(key) for key in ("platform", "social_account_id", "caption", "hashtags", "first_comment")} for row in rows], key=lambda row: str(row["platform"]))
    post["planner_approved_fingerprint"] = hashlib.sha256(json.dumps(copy, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return post["planner_approved_fingerprint"]


@pytest.mark.parametrize("operation", ["publish", "schedule", "update"])
@pytest.mark.parametrize("change", ["caption", "missing-approval", "missing-visual", "stale-visual"])
def test_text_first_planner_cannot_bypass_approval_via_generic_paths(db, monkeypatch, operation, change):
    post, rows = studio(("instagram",))
    fingerprint = planner(post, rows)
    post["image_url"] = "https://cdn.test/approved.jpg"
    post["planner_visual_fingerprint"] = fingerprint
    if change == "caption":
        rows[0]["caption"] = "Changed behind approval"
    elif change == "missing-approval":
        post.pop("planner_approved_fingerprint")
    elif change == "missing-visual":
        post["image_url"] = None
    else:
        post["planner_visual_fingerprint"] = "old"
    seed(db, post, rows)
    service = SocialMediaService(db)
    queue = Mock()
    monkeypatch.setattr(service, "_enqueue_publish", queue)
    with pytest.raises(HTTPException, match="planner"):
        run(service, post, operation)
    queue.assert_not_called()


@pytest.mark.parametrize("platform", ["instagram", "linkedin"])
def test_current_planner_approval_publishes_with_instagram_visual(db, platform):
    post, rows = studio((platform,))
    fingerprint = planner(post, rows)
    if platform == "instagram":
        post["planner_visual_fingerprint"] = fingerprint
        post["image_url"] = "https://cdn.test/approved.jpg"
    SocialMediaService(db)._validate_ready_to_publish_dict(post, rows)


def test_scheduled_update_checks_candidate_planner_copy_not_old_database_copy(db, monkeypatch):
    post, rows = studio(("instagram",))
    post["planner_visual_fingerprint"] = planner(post, rows)
    post["image_url"] = "https://cdn.test/approved.jpg"
    post["status"] = "scheduled"
    post["scheduled_at"] = datetime.now(timezone.utc) + timedelta(days=1)
    seed(db, post, rows)
    monkeypatch.setattr("app.social.media.ensure_public_image_url", lambda workspace, url: url)
    with pytest.raises(HTTPException, match="latest planner copy"):
        SocialMediaService(db).update_post(post, {"id": "workspace"}, UpdateSocialPostRequest(platforms=[{"platform": "instagram", "caption": "Unapproved changed copy"}]))
    assert db.social_post_platforms.find_one({"id": "instagram"})["caption"] == "Approved launch copy"