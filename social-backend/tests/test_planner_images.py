from datetime import timedelta
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.providers.llm.model_selection import ModelSelection, current_models, selected_models
from app.social.ai import creative
from app.social.ai.compositor import OverlayCopy
from app.social.ai.image_progress import report_image_stage
from app.social.content_plan_runs import now
from app.social.planner_images import execute, recover, start
from app.social.planner_schemas import CopyEdit, ImageAction, ImageAsset
from app.social.schemas import GenerateCreativeSetResponse
from app.social.service import SocialMediaService
from app.social.tasks.planner_runs import generate_planner_image
from tests.test_creative_sets import _image, creative_sets
from tests.test_planner_runs import approve, generated, image_result, selection, setup


real_generate = SocialMediaService.generate_creative_set


@pytest.fixture()
def images(db, setup, monkeypatch):
    enqueue = Mock()
    monkeypatch.setattr(generate_planner_image, "apply_async", enqueue)
    service, run = generated(db, setup, selection(platforms=["instagram"]))
    item = approve(service, setup, run)
    payload = ImageAction(expectedRevision=item.revision, requestId="image-request")
    return service, run, item, payload, enqueue


def begin(images, setup, payload=None):
    service, run, item, default, _ = images
    return start(service, *setup[:2], run.id, item.id, payload or default)


def work(images):
    service, _, _, _, enqueue = images
    execute(service, *enqueue.call_args.kwargs["args"])


def test_immediate_queue_and_lost_response_replay(images, setup, db):
    item = begin(images, setup)
    assert item.visualState == "processing" and item.imageStage == "queued"
    assert item.imageRequestId == "image-request" and item.imageOperationId
    assert item.imageUpdatedAt and not item.imageError and not item.imageRetryable
    assert begin(images, setup).imageOperationId == item.imageOperationId
    assert images[4].call_count == 1
    assert images[4].call_args.kwargs["queue"] == "social_maintenance"
    setup[5].assert_not_called()
    operation = db.social_planner_operations.find_one({"id": item.imageOperationId})
    assert operation["payload"]["expectedRevision"] == item.revision
    assert operation["created_by"] == "owner" and operation["state"] == "queued"
    assert images[0].get(setup[0], images[1].id).items[0].visualState == "processing"


def test_worker_redelivery_and_reentrant_replay_do_not_repeat_artwork(images, setup):
    item = begin(images, setup)
    observed = []

    def generate(*args):
        observed.append(begin(images, setup))
        work(images)
        for stage in ("concept", "generate", "format", "save"):
            report_image_stage(stage)
            observed.append(images[0].get(setup[0], images[1].id).items[0])
        return image_result()

    setup[5].side_effect = generate
    work(images)
    work(images)
    result = begin(images, setup)
    assert result.visualState == "ready" and result.imageStage == "ready"
    assert result.imageOperationId == item.imageOperationId and result.canSchedule
    assert [row.imageStage for row in observed] == ["queued", "concept", "generate", "format", "save"]
    assert setup[5].call_count == 1 and images[4].call_count == 1


@pytest.mark.parametrize("change", [{"expectedRevision": "other"}, {"imageDirection": "Use dark ink"}, {"mode": "regenerate"}])
def test_original_request_is_fenced(images, setup, change):
    begin(images, setup)
    with pytest.raises(HTTPException) as error:
        begin(images, setup, images[3].model_copy(update=change))
    assert error.value.status_code == 409
    assert images[4].call_count == 1
    setup[5].assert_not_called()


@pytest.mark.parametrize("change", ["copy", "intent", "cancel", "permission"])
def test_worker_rechecks_saved_revision_intent_cancellation_permission(images, setup, db, change):
    service, run, item, _, _ = images
    begin(images, setup)
    if change == "copy":
        service.edit_copy(*setup[:2], run.id, item.id, CopyEdit(expectedRevision=item.revision, caption="An edited approved message"))
    elif change == "intent":
        db.social_posts.update_one({"id": item.postId}, {"$set": {"planner_visual_pending": False}})
    elif change == "cancel":
        service.cancel(*setup[:2], run.id)
    else:
        db.workspaces.update_one({"id": "ws"}, {"$set": {"is_active": False}})
    work(images)
    result = service.get(setup[0], run.id).items[0]
    assert result.imageStage == "failed" and result.imageError["stage"] == "prepare"
    assert not result.imageRetryable and not result.post.imageUrl
    setup[5].assert_not_called()


def test_queue_failure_is_terminal_visible_and_explicit_retry_is_fenced(images, setup, db):
    images[4].side_effect = RuntimeError("Private broker connection")
    failed = begin(images, setup)
    assert failed.imageStage == "failed" and failed.visualState == "failed"
    assert failed.imageError["code"] == "IMAGE_QUEUE_UNAVAILABLE" and failed.imageRetryable
    assert "Private" not in str(failed.imageError)
    old_args = images[4].call_args.kwargs["args"]
    images[4].side_effect = None
    queued = begin(images, setup, images[3].model_copy(update={"mode": "retry"}))
    assert queued.imageStage == "queued" and queued.imageOperationId == failed.imageOperationId
    execute(images[0], *old_args)
    setup[5].assert_not_called()
    setup[5].side_effect = None
    setup[5].return_value = image_result()
    work(images)
    assert begin(images, setup).imageStage == "ready"


@pytest.mark.parametrize("state", ["queued", "processing"])
def test_expired_operation_get_and_maintenance_reconcile_no_automatic_paid_replay(images, setup, db, state):
    item = begin(images, setup)
    db.social_planner_operations.update_one({"id": item.imageOperationId}, {"$set": {
        "state": state, "stage": "generate" if state == "processing" else "queued",
        "expires_at": now() - timedelta(seconds=1)}})
    result = images[0].get(setup[0], images[1].id).items[0]
    assert result.visualState == "failed" and result.imageStage == "failed"
    assert result.imageError["code"] == ("IMAGE_QUEUE_EXPIRED" if state == "queued" else "IMAGE_LEASE_EXPIRED")
    assert result.imageRetryable
    recover(images[0])
    work(images)
    assert images[4].call_count == 1
    setup[5].assert_not_called()


def test_expired_worker_cannot_attach_or_overwrite_terminal_status(images, setup, db):
    begin(images, setup)

    def generate(*args):
        operation = db.social_planner_operations.find_one({"request_id": "image-request"})
        db.social_planner_operations.update_one({"id": operation["id"]}, {"$set": {"expires_at": now() - timedelta(seconds=1)}})
        recover(images[0])
        return image_result()

    setup[5].side_effect = generate
    work(images)
    result = images[0].get(setup[0], images[1].id).items[0]
    assert result.imageError["code"] == "IMAGE_LEASE_EXPIRED"
    assert result.visualState == "failed" and not result.post.imageUrl


def test_model_and_direction_are_original_on_retry(images, setup, db):
    payload = images[3].model_copy(update={"imageDirection": "Intentional dark charcoal ink illustration"})
    with selected_models(ModelSelection(text="original-text", image="original-image")):
        begin(images, setup, payload)
    models = []

    def generate(*args):
        models.append(current_models())
        if len(models) == 1:
            raise RuntimeError("Storage interrupted")
        return image_result()

    setup[5].side_effect = generate
    work(images)
    with selected_models(ModelSelection(text="new-text", image="new-image")):
        begin(images, setup, images[3].model_copy(update={"mode": "retry"}))
    work(images)
    assert models == [ModelSelection(text="original-text", image="original-image")] * 2
    request = setup[5].call_args.args[2]
    assert request.style == payload.imageDirection
    assert not request.autoCopy and not request.textOverlay
    assert request.caption == images[2].post.platforms[0].caption


@pytest.mark.parametrize("code,stage,retryable", [("IMAGE_NEAR_BLACK", "base", False), ("IMAGE_DECODE_FAILED", "base", False),
    ("CREATIVE_PROVIDER_UNCERTAIN", "base", False), ("CREATIVE_EXPORT_UPLOAD_FAILED", "export_upload", True)])
def test_quality_and_checkpoint_failures_are_distinguished(images, setup, code, stage, retryable):
    begin(images, setup)
    setup[5].side_effect = None
    setup[5].return_value = GenerateCreativeSetResponse(creativeSetId="failed-set", status="failed", items=[],
        errors=[{"code": code, "stage": stage, "message": "Safe pipeline failure"}])
    work(images)
    result = images[0].get(setup[0], images[1].id).items[0]
    assert result.imageError["code"] == code and result.imageError["stage"] == stage
    assert result.imageRetryable is retryable and result.copyApproved
    if not retryable:
        with pytest.raises(HTTPException):
            begin(images, setup, images[3].model_copy(update={"mode": "retry"}))
        assert "new artwork" in result.imageError["message"]


def test_new_artwork_requires_explicit_consent_and_no_active_operation(images, setup, db):
    begin(images, setup)
    new = images[3].model_copy(update={"requestId": "new-image", "mode": "regenerate", "creditsConfirmed": True})
    with pytest.raises(HTTPException):
        begin(images, setup, new)
    images[4].side_effect = RuntimeError("queue")
    operation = db.social_planner_operations.find_one({"request_id": "image-request"})
    db.social_planner_operations.update_one({"id": operation["id"]}, {"$set": {"expires_at": now() - timedelta(seconds=1)}})
    recover(images[0])
    with pytest.raises(HTTPException) as exc:
        begin(images, setup, new.model_copy(update={"creditsConfirmed": False}))
    assert exc.value.status_code == 422
    images[4].side_effect = None
    result = begin(images, setup, new)
    assert result.imageOperationId != operation["id"]


def test_full_shared_pipeline_retry_reuses_base_recipe_and_quota(images, setup, creative_sets, monkeypatch, db):
    import app.social.media as media

    monkeypatch.setattr(SocialMediaService, "generate_creative_set", real_generate)
    image_model = Mock(return_value={"imageB64": _image()})
    concept = Mock(return_value=("A clear editorial visual", OverlayCopy()))
    monkeypatch.setattr(creative, "generate_post_image", image_model)
    monkeypatch.setattr(creative, "art_direct", concept)
    upload = media.upload_social_image_bytes
    failed = False
    stages = []

    def store(*args, **kwargs):
        nonlocal failed
        stages.append(images[0].get(setup[0], images[1].id).items[0].imageStage)
        if kwargs["content_type"] == "image/jpeg" and not failed:
            failed = True
            raise RuntimeError("Temporary storage failure")
        return upload(*args, **kwargs)

    monkeypatch.setattr(media, "upload_social_image_bytes", store)
    begin(images, setup)
    work(images)
    result = images[0].get(setup[0], images[1].id).items[0]
    assert result.imageError["code"] == "CREATIVE_EXPORT_UPLOAD_FAILED" and result.imageRetryable
    assert db.social_creative_sets.find_one()["recipes"]
    assert db.plans_ai_usage.count_documents({"kind": "image"}) == 1
    begin(images, setup, images[3].model_copy(update={"mode": "retry"}))
    work(images)
    result = images[0].get(setup[0], images[1].id).items[0]
    assert result.visualState == "ready" and result.imageStage == "ready"
    image_model.assert_called_once()
    concept.assert_called_once()
    assert db.plans_ai_usage.count_documents({"kind": "image"}) == 1
    assert db.social_creative_quota.find_one()["reserved"] == 0
    assert stages == ["save", "save", "save"]
    assert "light or neutral" in image_model.call_args.kwargs["style"]
    assert not result.post.platforms[0].caption.startswith("A clear editorial")


def test_http_start_202_and_get_run_status_without_worker(images, setup, client):
    from app.auth.deps import get_current_user
    from app.main import app
    from app.workspaces.deps import require_workspace_access
    from app.providers.llm.model_selection import validate_model_selection

    app.dependency_overrides[get_current_user] = lambda: setup[1]
    app.dependency_overrides[require_workspace_access] = lambda: setup[0]
    app.dependency_overrides[validate_model_selection] = lambda: ModelSelection()
    run, item = images[1:3]
    base = f"/api/v1/workspaces/ws/social/content-plan/runs/{run.id}"
    response = client.post(f"{base}/items/{item.id}/image/start", json=images[3].model_dump())
    assert response.status_code == 202
    assert response.json()["imageStage"] == "queued"
    polled = client.get(base)
    assert polled.status_code == 200 and polled.json()["items"][0]["imageStage"] == "queued"
    assert polled.json()["items"][0]["slot"]["warnings"] == []
    setup[5].assert_not_called()


def test_owned_attachment_supersedes_queued_artwork_without_late_overwrite(images, setup, db, monkeypatch):
    service, run, item = images[:3]
    begin(images, setup)
    monkeypatch.setattr("app.social.media.refresh_blob_url", lambda key: "https://cdn.test/owned.jpg")
    db.social_media_assets.insert_one({"id": "owned", "workspace_id": "ws", "media_type": "image",
        "mime_type": "image/jpeg", "blob_key": "social/ws/owned.jpg", "source": "uploaded"})
    attached = service.attach_image(*setup[:2], run.id, item.id, ImageAsset(expectedRevision=item.revision, assetId="owned"))
    assert attached.visualState == "ready"
    work(images)
    result = service.get(setup[0], run.id).items[0]
    assert result.visualState == "ready" and result.post.imageUrl == "https://cdn.test/owned.jpg"
    setup[5].assert_not_called()


def test_dark_textured_artwork_remains_valid_with_low_visibility_advisory(images, setup, creative_sets, monkeypatch):
    from tests.test_image_reliability import encoded, textured

    monkeypatch.setattr(SocialMediaService, "generate_creative_set", real_generate)
    monkeypatch.setattr(creative, "generate_post_image", lambda **kwargs: {"imageB64": encoded(textured(dark=True))})
    monkeypatch.setattr(creative, "art_direct", lambda *args: ("Intentional dark editorial illustration", OverlayCopy()))
    begin(images, setup, images[3].model_copy(update={"imageDirection": "Dark charcoal illustration"}))
    work(images)
    result = images[0].get(setup[0], images[1].id).items[0]
    assert result.visualState == "ready" and result.imageStage == "ready"
    assert result.imageWarnings == ["Low-visibility artwork: inspect the full-size image before publishing"]