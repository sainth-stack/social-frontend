from io import BytesIO
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from PIL import Image

from app.social.creative_sets import _reserve
from app.social.media import SocialBlobUpload
from app.social.schemas import GenerateCreativeSetRequest
from app.social.service import SocialMediaService


def _image(mime="PNG"):
    output = BytesIO()
    Image.new("RGB", (32, 32), "blue").save(output, format=mime)
    return output.getvalue()


@pytest.fixture()
def creative_sets(db, monkeypatch):
    import app.providers.storage.factory as storage
    import app.social.media as media
    import app.social.limits as limits

    service = SocialMediaService(db)
    workspace = {"id": "workspace", "owner_user_id": "user", "plan": "starter"}
    blobs = {}
    uploads = []

    def upload(workspace_id, data, *, content_type):
        key = f"social/{workspace_id}/{len(uploads)}.{'png' if content_type == 'image/png' else 'jpg'}"
        blobs[key] = data
        uploads.append(key)
        return SocialBlobUpload(f"https://cdn.test/{key}", key, content_type, len(data))

    monkeypatch.setattr(media, "upload_social_image_bytes", upload)
    monkeypatch.setattr(media, "refresh_blob_url", lambda key: f"https://cdn.test/{key}?fresh=1")
    monkeypatch.setattr(storage, "get_storage_provider", lambda: SimpleNamespace(download_bytes=lambda key: blobs[key]))
    monkeypatch.setattr(limits, "get_limits", lambda *args: SimpleNamespace(limits=SimpleNamespace(ai_images_per_month=10)))
    calls = []

    def render(workspace, topic, style, spec, platforms, **kwargs):
        calls.append({"topic": topic, "platforms": platforms, **kwargs})
        if kwargs["base_image"] is None:
            kwargs["on_base_ready"](_image())
        return {platform: SimpleNamespace(image=_image("JPEG"), width=1080, height=1080 if platform == "linkedin" else 1350, warnings=[]) for platform in platforms}

    renderer = Mock(side_effect=render)
    monkeypatch.setattr(service, "render_brand_creative_variants", renderer)
    payload = GenerateCreativeSetRequest(topic="Explain the complete campaign brief", brief="Full context " * 500, format="carousel", platforms=["instagram", "facebook", "linkedin"], requestId="request-1", includeLogo=False, slides=[{"id": f"slide-{i}", "headline": f"Heading {i}", "body": "Useful copy", "imagePrompt": f"Visual {i}"} for i in range(3)])
    return service, workspace, payload, renderer, calls, uploads, blobs


def _generate(fixture, payload=None):
    service, workspace, default, *_ = fixture
    return service.generate_creative_set(workspace, {"id": "user"}, payload or default)


def test_three_bases_nine_exports_three_usage_units(creative_sets):
    service, _, payload, renderer, calls, uploads, _ = creative_sets
    result = _generate(creative_sets)
    assert result.status == "completed"
    assert len(result.items) == 9
    assert renderer.call_count == 3
    assert len(uploads) == 12
    assert service.db["plans_ai_usage"].count_documents({"kind": "image"}) == 3
    assert len(service.db["social_creative_sets"].find_one()["bases"]) == 3
    assert all(payload.brief in call["topic"] for call in calls)
    assert [(item.slideId, item.platform.value) for item in result.items] == [(f"slide-{index}", platform) for index in range(3) for platform in ("instagram", "facebook", "linkedin")]
    assert all(item.imageUrl.endswith("fresh=1") for item in result.items)
    assert service.db["social_creative_quota"].find_one()["reserved"] == 0


def test_idempotent_replay_does_no_paid_or_upload_work(creative_sets):
    service, _, _, renderer, _, uploads, _ = creative_sets
    first = _generate(creative_sets)
    count = len(uploads)
    second = _generate(creative_sets)
    assert second == first
    assert renderer.call_count == 3
    assert len(uploads) == count
    assert service.db["plans_ai_usage"].count_documents({}) == 3


def test_same_request_id_cannot_change_brief(creative_sets):
    _generate(creative_sets)
    changed = creative_sets[2].model_copy(update={"topic": "Different creative brief"})
    with pytest.raises(HTTPException) as exc:
        _generate(creative_sets, changed)
    assert exc.value.status_code == 409


def test_atomic_claim_does_not_duplicate_active_set(creative_sets):
    service, _, _, renderer, *_ = creative_sets
    first = _generate(creative_sets)
    service.db["social_creative_sets"].update_one({"id": first.creativeSetId}, {"$set": {"status": "processing"}})
    replay = _generate(creative_sets)
    assert replay.status == "processing"
    assert renderer.call_count == 3


def test_reentrant_request_observes_claim_without_duplicate_generation(creative_sets):
    _, _, _, renderer, *_ = creative_sets
    original = renderer.side_effect
    observed = []

    def render(*args, **kwargs):
        observed.append(_generate(creative_sets))
        return original(*args, **kwargs)

    renderer.side_effect = render
    result = _generate(creative_sets)
    assert result.status == "completed"
    assert renderer.call_count == 3
    assert all(response.status == "processing" for response in observed)


def test_partial_export_retry_reuses_base_and_preserves_successes(creative_sets, monkeypatch):
    import app.social.media as media

    service, _, _, renderer, calls, *_ = creative_sets
    original = media.upload_social_image_bytes
    failed = False

    def upload(workspace_id, data, *, content_type):
        nonlocal failed
        if content_type == "image/jpeg" and not failed:
            failed = True
            raise RuntimeError("Upload temporarily failed")
        return original(workspace_id, data, content_type=content_type)

    monkeypatch.setattr(media, "upload_social_image_bytes", upload)
    partial = _generate(creative_sets)
    assert partial.status == "partial"
    assert len(partial.items) == 8
    assert len(partial.errors) == 1
    retained = {(item.slideId, item.platform): item.assetId for item in partial.items}
    result = _generate(creative_sets)
    assert result.status == "completed"
    assert renderer.call_count == 4
    assert calls[-1]["base_image"] == _image()
    assert calls[-1]["platforms"] == ["instagram"]
    assert service.db["plans_ai_usage"].count_documents({}) == 3
    assert all(item.assetId == retained[(item.slideId, item.platform)] for item in result.items if (item.slideId, item.platform) in retained)


def test_composition_failure_keeps_saved_base_without_second_charge(creative_sets):
    service, _, _, renderer, calls, *_ = creative_sets
    original = renderer.side_effect
    failed = False

    def render(*args, **kwargs):
        nonlocal failed
        if not failed:
            failed = True
            kwargs["on_base_ready"](_image())
            raise RuntimeError("Layout overflow")
        return original(*args, **kwargs)

    renderer.side_effect = render
    result = _generate(creative_sets)
    assert result.status == "partial"
    assert service.db["plans_ai_usage"].count_documents({}) == 3
    retry = _generate(creative_sets)
    assert retry.status == "completed"
    assert calls[-1]["base_image"] == _image()
    assert service.db["plans_ai_usage"].count_documents({}) == 3


def test_failed_base_releases_unused_reservations(creative_sets):
    service, _, _, renderer, *_ = creative_sets
    renderer.side_effect = RuntimeError("Image generation failed")
    result = _generate(creative_sets)
    assert result.status == "failed"
    assert len(result.errors) == 9
    assert not result.items
    assert service.db["plans_ai_usage"].count_documents({}) == 0
    assert service.db["social_creative_quota"].find_one()["reserved"] == 0


def test_quota_reserves_full_set_before_model_calls(creative_sets, monkeypatch):
    import app.social.limits as limits

    service, _, _, renderer, *_ = creative_sets
    monkeypatch.setattr(limits, "get_limits", lambda *args: SimpleNamespace(limits=SimpleNamespace(ai_images_per_month=2)))
    with pytest.raises(HTTPException) as exc:
        _generate(creative_sets)
    assert exc.value.status_code == 402
    renderer.assert_not_called()
    assert service.db["social_creative_sets"].find_one()["status"] == "failed"
    assert service.db["social_creative_quota"].find_one()["reserved"] == 0


def test_concurrent_reservations_cannot_exceed_remaining_quota(creative_sets):
    service, workspace, *_ = creative_sets
    key = _reserve(service.db, workspace, 8)
    with pytest.raises(HTTPException) as exc:
        _reserve(service.db, workspace, 3)
    assert exc.value.status_code == 402
    assert service.db["social_creative_quota"].find_one({"_id": key})["reserved"] == 8


def test_same_request_id_is_workspace_scoped(creative_sets):
    service, workspace, payload, renderer, *_ = creative_sets
    first = _generate(creative_sets)
    second = service.generate_creative_set({**workspace, "id": "other-workspace"}, {"id": "user"}, payload)
    assert first.creativeSetId != second.creativeSetId
    assert renderer.call_count == 6
    assert all(item.blobKey.startswith("social/other-workspace/") for item in second.items)


def test_brand_snapshot_survives_retry(creative_sets):
    service, workspace, _, renderer, calls, *_ = creative_sets
    service.db["social_brand_voices"].insert_one({"workspace_id": workspace["id"], "brand_name": "Original", "tones": ["Friendly"], "emoji_usage": "sometimes"})
    renderer.side_effect = RuntimeError("Transient base failure")
    _generate(creative_sets)
    service.db["social_brand_voices"].update_one({"workspace_id": workspace["id"]}, {"$set": {"brand_name": "Changed"}})
    renderer.side_effect = lambda *args, **kwargs: calls.append(kwargs) or {}
    _generate(creative_sets)
    assert all(call["brand"]["brand_name"] == "Original" for call in calls)


@pytest.mark.parametrize("change", [{"platforms": ["x"]}, {"platforms": ["instagram", "x"]}, {"mode": "edit"}, {"slides": [{"id": "only"}]}, {"format": "post"}])
def test_invalid_creative_requests_fail_before_model(creative_sets, change):
    service, _, payload, renderer, *_ = creative_sets
    request = GenerateCreativeSetRequest(**{**payload.model_dump(mode="json"), **change})
    with pytest.raises(HTTPException) as exc:
        _generate(creative_sets, request)
    assert exc.value.status_code == 400
    renderer.assert_not_called()
    assert service.db["social_creative_sets"].count_documents({}) == 0


def test_creative_set_route_contract(client, creative_sets, monkeypatch):
    from app.core.config import settings

    _, _, payload, renderer, *_ = creative_sets
    registration = client.post(f"{settings.api_v1_prefix}/auth/register", json={"email": "creative-set@example.com", "password": "s3cret-pass"}).json()
    headers = {"Authorization": f"Bearer {registration['access_token']}"}
    workspace_id = registration["workspace"]["id"]
    monkeypatch.setattr(SocialMediaService, "render_brand_creative_variants", lambda self, *args, **kwargs: renderer(*args, **kwargs))
    response = client.post(f"{settings.api_v1_prefix}/workspaces/{workspace_id}/social/generate-creative-set", headers=headers, json=payload.model_dump(mode="json"))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "completed"
    assert len(body["items"]) == 9
    assert set(body) == {"creativeSetId", "status", "items", "errors", "warnings"}
    assert all({"slideId", "platform", "imageUrl", "assetId", "blobKey", "width", "height", "mimeType"} == set(item) for item in body["items"])


@pytest.mark.parametrize("include,policy,use_brand,expected", [
    (False, "sometimes", True, "Heading"),
    (True, "sometimes", True, "Heading 🌱"),
    (True, "never", False, "Heading"),
])
def test_creative_set_route_uses_real_renderer_and_complete_slide_copy(client, creative_sets, monkeypatch, include, policy, use_brand, expected):
    from app.core.config import settings
    from app.social.ai import creative

    service, _, payload, *_ = creative_sets
    registration = client.post(f"{settings.api_v1_prefix}/auth/register", json={"email": "real-creative@example.com", "password": "s3cret-pass"}).json()
    workspace_id = registration["workspace"]["id"]
    service.db["social_brand_voices"].insert_one({"workspace_id": workspace_id, "emoji_usage": policy})
    image = Mock(return_value={"imageB64": _image()})
    monkeypatch.setattr(creative, "generate_post_image", image)
    original = creative.compose_creative
    copies = []
    body = ("Verify rollback readiness before expanding production traffic. " * 10)[:360]

    def compose(raw, **kwargs):
        row = service.db["social_creative_sets"].find_one({"workspace_id": workspace_id})
        slide_id = f"slide-{(len(copies) // 3)}"
        assert slide_id in row["bases"]
        assert service.db["plans_ai_usage"].count_documents({"workspace_id": workspace_id}) == len(row["bases"])
        copies.append(kwargs["copy"])
        return original(raw, **kwargs)

    monkeypatch.setattr(creative, "compose_creative", compose)
    request = {**payload.model_dump(mode="json"), "autoCopy": False, "textOverlay": True, "includeEmojis": include, "useBrand": use_brand,
               "slides": [{**slide.model_dump(), "headline": "Heading 🌱", "body": body} for slide in payload.slides]}
    response = client.post(f"{settings.api_v1_prefix}/workspaces/{workspace_id}/social/generate-creative-set",
                           headers={"Authorization": f"Bearer {registration['access_token']}"}, json=request)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["status"] == "completed", result["errors"]
    assert len(copies) == len(result["items"]) == 9
    assert image.call_count == 3
    assert all(copy.headline == expected and copy.subtext == body for copy in copies)
    for item in result["items"]:
        asset = service.db["social_media_assets"].find_one({"id": item["assetId"]})
        assert asset["workspace_id"] == workspace_id
        with Image.open(BytesIO(creative_sets[-1][item["blobKey"]])) as decoded:
            assert decoded.format == "JPEG"
            assert decoded.size == ((1080, 1080) if item["platform"] == "linkedin" else (1080, 1350))


def test_real_renderer_composition_retry_reuses_durable_base(creative_sets, monkeypatch):
    from app.social.ai import creative

    service, _, payload, *_ = creative_sets
    monkeypatch.setattr(service, "render_brand_creative_variants", SocialMediaService.render_brand_creative_variants.__get__(service))
    image = Mock(return_value={"imageB64": _image()})
    monkeypatch.setattr(creative, "generate_post_image", image)
    original = creative.compose_creative
    compose = Mock(side_effect=RuntimeError("Temporary composition failure"))
    monkeypatch.setattr(creative, "compose_creative", compose)
    request = payload.model_copy(update={"autoCopy": False, "platforms": payload.platforms[:1], "slides": payload.slides[:2]})
    first = _generate(creative_sets, request)
    assert first.status == "failed"
    assert image.call_count == 2
    assert len(service.db["social_creative_sets"].find_one()["bases"]) == 2
    assert service.db["plans_ai_usage"].count_documents({}) == 2
    compose.side_effect = original
    retry = _generate(creative_sets, request)
    assert retry.status == "completed"
    assert image.call_count == 2
    assert service.db["plans_ai_usage"].count_documents({}) == 2
    assert all(call.kwargs["copy"] is None for call in compose.call_args_list)