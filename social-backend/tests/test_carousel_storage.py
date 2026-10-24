from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.social.schemas import BrandVoiceUpdateRequest, CreateSocialPostRequest, GeneratePostRequest, SchedulePostRequest, UpdateSocialPostRequest
from app.social.service import SocialMediaService


@pytest.fixture()
def storage(db, monkeypatch):
    import app.social.media as media

    monkeypatch.setattr(media, "refresh_blob_url", lambda key: f"https://cdn.test/{key}?fresh=1")
    monkeypatch.setattr(media, "ensure_public_image_url", lambda workspace_id, url: url)
    service = SocialMediaService(db)
    workspace = {"id": "workspace", "owner_user_id": "user", "plan": "starter"}
    for platform in ("instagram", "facebook", "linkedin", "x"):
        db["social_accounts"].insert_one({"id": platform, "workspace_id": workspace["id"], "platform": platform, "is_active": True})
    slides = [{"id": f"slide-{i}", "headline": f"Headline {i}", "body": f"Body {i}", "imagePrompt": f"Visual {i}"} for i in range(3)]
    media_items = []
    for slide in slides:
        asset = {"id": slide["id"], "workspace_id": workspace["id"], "media_type": "image", "blob_key": f"social/workspace/{slide['id']}.jpg", "blob_url": f"https://cdn.test/{slide['id']}.jpg", "is_deleted": False}
        db["social_media_assets"].insert_one(asset)
        media_items.append({"assetId": asset["id"], "blobKey": asset["blob_key"], "url": asset["blob_url"], "slideId": slide["id"], "width": 1080, "height": 1350})
    payload = {"title": "A real carousel", "format": "carousel", "slides": slides, "generationOptions": {"slideCount": 3, "includeEmojis": False}, "platforms": [{"platform": "instagram", "caption": "Intro only", "media": media_items}]}
    return service, workspace, payload


def _create(storage, payload=None):
    service, workspace, default = storage
    result = service.create_post(workspace, {"id": "user"}, CreateSocialPostRequest(**(payload or default)))
    return result, service.db["social_posts"].find_one({"id": result.id})


def test_carousel_roundtrip_update_and_duplicate(storage):
    service, workspace, payload = storage
    result, post = _create(storage)
    assert result.format == post["format"] == "carousel"
    assert [slide.id for slide in result.slides] == [slide["id"] for slide in payload["slides"]]
    assert post["generation_options"] == payload["generationOptions"]
    assert result.platforms[0].caption == "Intro only"
    assert result.platforms[0].media[0].url.endswith("?fresh=1")
    updated = service.update_post(post, workspace, UpdateSocialPostRequest(platforms=[{"platform": "instagram", "caption": "Edited intro"}]))
    assert updated.platforms[0].media == result.platforms[0].media
    assert updated.slides == result.slides
    clone = service.duplicate_post(post, {"id": "user"}, workspace)
    assert clone.format == "carousel"
    assert clone.slides == result.slides
    assert clone.platforms[0].media == result.platforms[0].media


def test_media_can_be_explicitly_cleared_in_draft(storage):
    service, workspace, _ = storage
    _, post = _create(storage)
    result = service.update_post(post, workspace, UpdateSocialPostRequest(platforms=[{"platform": "instagram", "media": []}]))
    assert result.platforms[0].media == []
    assert len(result.slides) == 3


@pytest.mark.parametrize("operation", ["publish", "schedule", "update"])
def test_incomplete_carousel_cannot_publish_or_schedule(storage, monkeypatch, operation):
    service, workspace, payload = storage
    payload["platforms"][0]["media"] = payload["platforms"][0]["media"][:1]
    _, post = _create(storage)
    enqueue = Mock()
    monkeypatch.setattr(service, "_enqueue_publish", enqueue)
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    with pytest.raises(HTTPException, match="2–8 complete"):
        if operation == "publish":
            service.publish_now(post)
        elif operation == "schedule":
            service.schedule_post(post, SchedulePostRequest(scheduledAt=future))
        else:
            service.update_post(post, workspace, UpdateSocialPostRequest(status="scheduled", scheduledAt=future))
    enqueue.assert_not_called()
    assert service.db["social_posts"].find_one({"id": post["id"]})["status"] == "draft"


def test_combined_schedule_update_validates_new_media(storage, monkeypatch):
    service, workspace, payload = storage
    full_media = payload["platforms"][0]["media"]
    payload["platforms"][0]["media"] = []
    _, post = _create(storage)
    enqueue = Mock()
    monkeypatch.setattr(service, "_enqueue_publish", enqueue)
    result = service.update_post(post, workspace, UpdateSocialPostRequest(status="scheduled", scheduledAt=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat(), platforms=[{"platform": "instagram", "caption": "Still intro only", "media": full_media}]))
    assert result.status == "scheduled"
    assert len(result.platforms[0].media) == 3
    enqueue.assert_called_once()


@pytest.mark.parametrize("format,platform,error", [("thread", "x", "copy-only"), ("carousel", "x", "X carousel")])
def test_copy_only_and_unsupported_formats(storage, format, platform, error):
    service, _, payload = storage
    payload.update(format=format, tweets=[{"text": "Tweet one"}, {"text": "Tweet two"}])
    payload["platforms"][0]["platform"] = platform
    _, post = _create(storage)
    with pytest.raises(HTTPException, match=error):
        service.publish_now(post)
    assert post["tweets"][1]["text"] == "Tweet two"


@pytest.mark.parametrize("change", ["foreign", "deleted", "mismatch", "video"])
def test_bad_media_rejected_before_create_or_update(storage, change):
    service, workspace, payload = storage
    result, post = _create(storage)
    before = list(service.db["social_post_platforms"].find())
    if change == "foreign":
        service.db["social_media_assets"].update_one({"id": "slide-0"}, {"$set": {"workspace_id": "other"}})
    elif change == "deleted":
        service.db["social_media_assets"].update_one({"id": "slide-0"}, {"$set": {"is_deleted": True}})
    elif change == "video":
        service.db["social_media_assets"].update_one({"id": "slide-0"}, {"$set": {"media_type": "video"}})
    else:
        payload["platforms"][0]["media"][0]["blobKey"] = "social/other/no.jpg"
    with pytest.raises(HTTPException):
        service.create_post(workspace, {"id": "user"}, CreateSocialPostRequest(**payload))
    with pytest.raises(HTTPException):
        service.update_post(post, workspace, UpdateSocialPostRequest(platforms=payload["platforms"]))
    assert service.db["social_posts"].count_documents({}) == 1
    assert list(service.db["social_post_platforms"].find()) == before
    assert result.id == post["id"]


def test_deleted_asset_is_rechecked_before_publish(storage):
    service, _, _ = storage
    _, post = _create(storage)
    service.db["social_media_assets"].update_one({"id": "slide-0"}, {"$set": {"is_deleted": True}})
    with pytest.raises(HTTPException, match="not found"):
        service.publish_now(post)


@pytest.mark.parametrize("change", ["order", "sizes", "duplicate"])
def test_order_dimensions_and_slide_identity(storage, change):
    service, _, payload = storage
    if change == "order":
        payload["platforms"][0]["media"].reverse()
    elif change == "sizes":
        payload["platforms"][0]["media"][1]["width"] = 1200
    else:
        payload["slides"][1]["id"] = payload["slides"][0]["id"]
        with pytest.raises(HTTPException, match="unique IDs"):
            _create(storage)
        return
    _, post = _create(storage)
    with pytest.raises(HTTPException):
        service.publish_now(post)


def test_legacy_single_and_thread_restore(storage):
    service, workspace, _ = storage
    result, post = _create(storage, {"imageUrl": "https://cdn.test/legacy.jpg", "platforms": [{"platform": "facebook", "caption": "Legacy"}]})
    for key in ("format", "generation_options", "slides", "tweets"):
        post.pop(key, None)
    result = service.get_post(post)
    assert result.format == "single"
    assert result.imageUrl == "https://cdn.test/legacy.jpg"
    assert result.slides == result.tweets == result.platforms[0].media == []
    service._validate_ready_to_publish_dict(post, list(service.db["social_post_platforms"].find({"post_id": result.id})))
    thread = service.update_post(post, workspace, UpdateSocialPostRequest(format="thread", tweets=[{"text": "Do not flatten"}, {"text": "Second tweet"}]))
    assert [tweet.text for tweet in thread.tweets] == ["Do not flatten", "Second tweet"]


def test_brand_defaults_preserve_saved_explicit_settings(storage):
    service, workspace, _ = storage
    assert service.get_brand_voice(workspace).tones == ["Professional"]
    assert service.get_brand_voice(workspace).emojiUsage == "never"
    service.upsert_brand_voice(workspace, BrandVoiceUpdateRequest(tones=["Friendly"], emojiUsage="often"))
    result = service.upsert_brand_voice(workspace, BrandVoiceUpdateRequest(brandName="New name"))
    assert result.tones == ["Friendly"]
    assert result.emojiUsage == "often"
    assert service._brand_voice_dict(workspace["id"])["emoji_usage"] == "often"


@pytest.mark.parametrize("count", [2, 3, 8])
def test_generation_native_option_forwarding(storage, monkeypatch, count):
    import app.social.ai.generator as generator

    service, _, _ = storage
    carousel = Mock(return_value={"slides": [{"headline": "Heading", "body": "Body"}] * count})
    thread = Mock(return_value={"tweets": [{"text": "Tweet"}]})
    poll = Mock(return_value={"question": "Question?", "options": ["Yes", "No"]})
    monkeypatch.setattr(generator, "generate_carousel_content", carousel)
    monkeypatch.setattr(generator, "generate_thread_content", thread)
    monkeypatch.setattr(generator, "generate_poll_content", poll)
    request = GeneratePostRequest(topic="A detailed brief", platforms=["facebook"], slideCount=count, includeHashtags=False, length="short")
    for format, mock in (("carousel", carousel), ("thread", thread), ("poll", poll)):
        service._generate_post_content(request, format, {})
        assert mock.call_args.kwargs["include_emojis"] is False
        assert mock.call_args.kwargs["include_hashtags"] is False
        assert mock.call_args.kwargs["length_hint"] == "short"
    assert carousel.call_args.kwargs["num_slides"] == count


@pytest.mark.parametrize("count", [1, 9])
def test_invalid_slide_count(count):
    with pytest.raises(ValidationError):
        GeneratePostRequest(topic="A topic", platforms=["facebook"], slideCount=count)


def test_all_platforms_survive_create_and_update(storage):
    service, workspace, payload = storage
    media = payload["platforms"][0]["media"]
    payload["platforms"] = [{"platform": platform, "caption": f"Intro for {platform}", "media": media}
                            for platform in ("instagram", "facebook", "linkedin")]
    result, post = _create(storage)
    assert {pp.platform.value for pp in result.platforms} == {"instagram", "facebook", "linkedin"}
    updated = service.update_post(post, workspace, UpdateSocialPostRequest(platforms=[
        {"platform": platform, "caption": f"Edited {platform}"} for platform in ("linkedin", "facebook", "instagram")
    ]))
    assert len(updated.platforms) == 3
    assert all(len(pp.media) == 3 and pp.caption == f"Edited {pp.platform.value}" for pp in updated.platforms)


@pytest.mark.parametrize("operation", ["create", "update"])
@pytest.mark.parametrize("invalid", ["foreign", "deleted", "duplicate", "account"])
def test_later_invalid_platform_never_leaves_partial_writes(storage, operation, invalid):
    service, workspace, payload = storage
    _, post = _create(storage)
    second = {**payload["platforms"][0], "platform": "facebook"}
    if invalid in ("foreign", "deleted"):
        service.db["social_media_assets"].insert_one({"id": "bad", "workspace_id": "other" if invalid == "foreign" else workspace["id"],
                                                   "media_type": "image", "blob_key": "social/workspace/bad.jpg", "is_deleted": invalid == "deleted"})
        second["media"] = [{"assetId": "bad", "slideId": "slide-0"}]
    elif invalid == "duplicate":
        second["platform"] = "instagram"
    else:
        second["socialAccountId"] = "linkedin"
    platforms_before = list(service.db["social_post_platforms"].find())
    posts_before = list(service.db["social_posts"].find())
    data = {**payload, "platforms": [payload["platforms"][0], second]}
    with pytest.raises(HTTPException):
        if operation == "create":
            service.create_post(workspace, {"id": "user"}, CreateSocialPostRequest(**data))
        else:
            service.update_post(post, workspace, UpdateSocialPostRequest(**data))
    assert list(service.db["social_post_platforms"].find()) == platforms_before
    assert list(service.db["social_posts"].find()) == posts_before


@pytest.mark.parametrize("operation", ["publish", "schedule", "update"])
def test_stale_visuals_cannot_publish_or_schedule(storage, monkeypatch, operation):
    service, workspace, payload = storage
    payload["generationOptions"]["visualsStale"] = True
    _, post = _create(storage)
    enqueue = Mock()
    monkeypatch.setattr(service, "_enqueue_publish", enqueue)
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    with pytest.raises(HTTPException, match="stale"):
        if operation == "publish":
            service.publish_now(post)
        elif operation == "schedule":
            service.schedule_post(post, SchedulePostRequest(scheduledAt=future))
        else:
            service.update_post(post, workspace, UpdateSocialPostRequest(status="scheduled", scheduledAt=future))
    enqueue.assert_not_called()
    assert service.db["social_posts"].find_one({"id": post["id"]})["status"] == "draft"


def test_failed_schedule_validation_does_not_resolve_accounts_in_database(storage):
    service, workspace, payload = storage
    payload["platforms"] = [{"platform": "facebook", "caption": "Valid"}, {"platform": "instagram", "caption": "Missing images"}]
    payload["format"] = "single"
    _, post = _create(storage)
    service.db["social_post_platforms"].update_many({}, {"$set": {"social_account_id": None}})
    before = list(service.db["social_post_platforms"].find())
    with pytest.raises(HTTPException, match="require an image"):
        service.update_post(post, workspace, UpdateSocialPostRequest(status="scheduled", scheduledAt=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat()))
    assert list(service.db["social_post_platforms"].find()) == before


def test_explicit_null_clears_legacy_image_when_switching_to_carousel(storage):
    service, workspace, payload = storage
    _, post = _create(storage, {"imageUrl": "https://cdn.test/legacy.jpg", "platforms": [{"platform": "facebook", "caption": "Legacy"}]})
    result = service.update_post(post, workspace, UpdateSocialPostRequest(**{**payload, "imageUrl": None}))
    assert result.imageUrl is None
    assert result.format == "carousel"
    assert len(result.platforms[0].media) == 3


def test_transition_to_scheduled_enqueues_even_with_unchanged_timestamp(storage, monkeypatch):
    service, workspace, _ = storage
    _, post = _create(storage)
    scheduled_at = datetime.now(timezone.utc) + timedelta(days=1)
    service.db["social_posts"].update_one({"id": post["id"]}, {"$set": {"scheduled_at": scheduled_at}})
    post = service.db["social_posts"].find_one({"id": post["id"]})
    enqueue = Mock()
    monkeypatch.setattr(service, "_enqueue_publish", enqueue)
    result = service.update_post(post, workspace, UpdateSocialPostRequest(status="scheduled"))
    assert result.status == "scheduled"
    enqueue.assert_called_once()