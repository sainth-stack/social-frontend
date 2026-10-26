from copy import deepcopy
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.social.content_plan_runs import ContentPlanRuns
from app.social.planner_schemas import (
    CopyEdit, ImageAction, ImageIntent, PlannerSelection, RunCreate, ScheduleConfirm,
    SlotEdit, TextRegenerate,
)
from app.social.planner_slots import local_instant, preview_slots
from app.social.schemas import GenerateCreativeSetResponse, CreativeSetItem
from app.social.service import SocialMediaService


@pytest.fixture()
def setup(db, monkeypatch, fake_redis):
    workspace = {"id": "ws", "name": "Brand", "plan": "growth", "owner_user_id": "owner"}
    user = {"id": "owner"}
    db.workspaces.insert_one(deepcopy(workspace))
    db.users.insert_one({"id": "owner", "email": "owner@example.test"})
    db.social_settings.insert_one({"workspace_id": "ws", "timezone": "UTC"})
    for platform in ("facebook", "instagram", "linkedin"):
        db.social_accounts.insert_one({"id": platform, "workspace_id": "ws", "platform": platform,
            "platform_account_id": platform, "is_active": True})
    from app.social import limits
    from app.social.ai import generator
    from app.social.tasks.planner_runs import generate_planner_run
    from app.social.tasks.publish import publish_post

    for name in ("enforce_posts_limit", "enforce_ai_text_limit", "enforce_ai_image_limit"):
        monkeypatch.setattr(limits, name, lambda *args: None)
    generate = Mock(side_effect=lambda **kw: {kw["platforms"][0]: {"caption": "Useful advice for your brand", "hashtags": ["brand"]}})
    monkeypatch.setattr(generator, "generate_platform_content", generate)
    monkeypatch.setattr("app.social.service.generate_platform_content", generate)
    enqueue = Mock()
    publish = Mock()
    monkeypatch.setattr(generate_planner_run, "apply_async", enqueue)
    monkeypatch.setattr(publish_post, "apply_async", publish)
    image = Mock(side_effect=AssertionError("No implicit image calls"))
    monkeypatch.setattr(SocialMediaService, "generate_creative_set", image)
    return workspace, user, generate, enqueue, publish, image


def selection(**kwargs):
    return PlannerSelection(timezone="UTC", dates=[(datetime.now(timezone.utc) + timedelta(days=10)).date().isoformat()],
        platforms=kwargs.pop("platforms", ["facebook"]), postingTime="12:00", **kwargs)


def create(db, setup, payload=None, request_id="create"):
    service = ContentPlanRuns(db)
    workspace, user = setup[:2]
    payload = payload or selection()
    preview = preview_slots(db, workspace, payload)
    return service.create(workspace, user, RunCreate(**payload.model_dump(), requestId=request_id,
        previewToken=preview.previewToken, prompt="Useful advice for a brand campaign"))


def generated(db, setup, payload=None):
    run = create(db, setup, payload)
    service = ContentPlanRuns(db)
    service.generate(run.id)
    return service, service.get(setup[0], run.id)


def approve(service, setup, run):
    return service.approve_copy(setup[0], setup[1], run.id, run.items[0].id, run.items[0].revision)


def text_only(service, setup, run, item):
    return service.image_intent(setup[0], setup[1], run.id, item.id,
        ImageIntent(expectedRevision=item.revision, intent="text_only"))


@pytest.mark.parametrize("day,clock,offset,error", [
    ("2027-03-14", "02:30", None, "nonexistent"),
    ("2027-11-07", "01:30", None, "ambiguous"),
    ("2027-11-07", "01:30", 0, "invalid_utc_offset"),
    ("2027-02-30", "10:00", None, "invalid_date"),
])
def test_dst_validation(day, clock, offset, error):
    with pytest.raises(HTTPException) as exc:
        local_instant(day, clock, "America/New_York", offset)
    assert error in str(exc.value.detail)


def test_dst_fold_offsets_and_exact_day():
    first = local_instant("2027-11-07", "01:30", "America/New_York", -240)
    second = local_instant("2027-11-07", "01:30", "America/New_York", -300)
    assert second - first == timedelta(hours=1)
    assert local_instant("2027-01-02", "00:05", "Asia/Kolkata").isoformat() == "2027-01-01T18:35:00+00:00"


def test_preview_range_caps_duplicates_and_strict_zone(db, setup):
    ws = setup[0]
    request = PlannerSelection(timezone="UTC", startDate="2028-02-27", endDate="2028-03-02", platforms=["facebook"], postingTime="23:59")
    preview = preview_slots(db, ws, request)
    assert [slot.date for slot in preview.slots] == ["2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01", "2028-03-02"]
    assert preview.selectedDateCount == 5
    for changes in ({"endDate": "2028-04-01"}, {"timezone": "Invalid/Zone"}):
        with pytest.raises(HTTPException):
            preview_slots(db, ws, request.model_copy(update=changes))
    with pytest.raises(HTTPException):
        preview_slots(db, ws, selection().model_copy(update={"dates": ["2028-01-01", "2028-01-01"]}))


def test_disabled_blackout_past_and_occupied_are_visible(db, setup):
    payload = selection(platforms=["facebook", "instagram"])
    day = payload.dates[0]
    db.social_settings.update_one({"workspace_id": "ws"}, {"$set": {"default_posting_times": {"mon": []}, "blackout_dates": [day]}})
    preview = preview_slots(db, setup[0], payload)
    assert all("blackout_date" in slot.reasons for slot in preview.slots)
    with pytest.raises(HTTPException):
        create(db, setup, payload)
    db.social_settings.update_one({"workspace_id": "ws"}, {"$set": {"blackout_dates": []}})
    no_override = payload.model_copy(update={"postingTime": None})
    preview = preview_slots(db, setup[0], no_override)
    assert all("posting_day_disabled" in slot.reasons for slot in preview.slots)


def test_run_create_worker_redelivery_idempotent_and_approval_zero_paid_calls(db, setup):
    service, run = generated(db, setup, selection(platforms=["facebook", "instagram", "linkedin"]))
    assert run.status == "completed"
    assert len(run.items) == 3
    assert all(item.generationState == "created" and item.post.status.value == "draft" for item in run.items)
    assert setup[2].call_count == 3
    again = create(db, setup, selection(platforms=["facebook", "instagram", "linkedin"]))
    assert again.id == run.id
    service.generate(run.id)
    assert setup[2].call_count == 3
    assert db.social_posts.count_documents({}) == 3
    item = approve(service, setup, run)
    assert item.copyApproved and not item.canSchedule
    assert item.imageIntent == "optional"
    setup[4].assert_not_called()
    setup[5].assert_not_called()
    assert service.get(setup[0], run.id).items[0].copyApproved
    assert service.list(setup[0]).total == 1
    with pytest.raises(HTTPException) as exc:
        service.get({"id": "foreign"}, run.id)
    assert exc.value.status_code == 404


@pytest.mark.parametrize("platform", ["facebook", "linkedin"])
@pytest.mark.parametrize("choice", ["text_only", "image"])
def test_optional_planner_requires_explicit_choice_before_ready_or_scheduling(db, setup, platform, choice):
    service, run = generated(db, setup, selection(platforms=[platform]))
    item = approve(service, setup, run)
    reason = "Choose text only or generate a current planner image before publishing"
    assert item.copyApproved and item.imageIntent == "optional" and not item.canSchedule
    assert reason in item.reasons
    assert not service.get(setup[0], run.id).items[0].canSchedule
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    assert preview.items[0].outcome == "blocked" and reason in preview.items[0].reasons
    blocked = service.confirm_schedule(setup[0], setup[1], run.id,
        ScheduleConfirm(requestId="blocked", previewId=preview.previewId, confirm=True))
    assert blocked.items[0].outcome == "blocked"
    assert db.social_posts.find_one({"id": item.postId})["status"] == "draft"
    setup[4].assert_not_called()
    setup[5].assert_not_called()
    if choice == "text_only":
        item = text_only(service, setup, run, item)
        assert item.imageIntent == "text_only" and not item.post.imageUrl
        setup[5].assert_not_called()
    else:
        result = image_result().model_dump(mode="json")
        result["items"][0]["platform"] = platform
        setup[5].side_effect = None
        setup[5].return_value = GenerateCreativeSetResponse.model_validate(result)
        item = service.image(setup[0], setup[1], run.id, item.id,
            ImageAction(expectedRevision=item.revision, requestId="image"))
        assert item.visualState == "ready" and item.visualRevision == item.revision
    assert item.canSchedule and service.get(setup[0], run.id).items[0].canSchedule
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    assert preview.items[0].outcome == "ready"
    scheduled = service.confirm_schedule(setup[0], setup[1], run.id,
        ScheduleConfirm(requestId="resolved", previewId=preview.previewId, confirm=True))
    assert scheduled.items[0].outcome == "scheduled"
    assert setup[4].call_count == 1


def test_preview_change_and_request_id_collision(db, setup):
    payload = selection()
    preview = preview_slots(db, setup[0], payload)
    request = RunCreate(**payload.model_dump(), requestId="key", previewToken=preview.previewToken, prompt="A campaign about our brand")
    service = ContentPlanRuns(db)
    run = service.create(setup[0], setup[1], request)
    with pytest.raises(HTTPException) as exc:
        service.create(setup[0], setup[1], request.model_copy(update={"prompt": "A completely different campaign"}))
    assert exc.value.status_code == 409
    db.social_accounts.update_one({"id": "facebook"}, {"$set": {"is_active": False}})
    with pytest.raises(HTTPException):
        service.create(setup[0], setup[1], request.model_copy(update={"requestId": "other"}))
    assert db.social_content_plan_runs.count_documents({}) == 1


def test_enqueue_uncertainty_and_recovery_without_duplicate_generation(db, setup):
    setup[3].side_effect = RuntimeError("Broker uncertain")
    run = create(db, setup)
    assert run.dispatchState == "uncertain"
    setup[3].side_effect = None
    service = ContentPlanRuns(db)
    service.recover()
    assert service.get(setup[0], run.id).dispatchState == "accepted"
    service.generate(run.id)
    service.generate(run.id)
    assert setup[2].call_count == 1


def test_checkpoint_retry_reuses_generated_text_and_post_id(db, setup, monkeypatch):
    service = ContentPlanRuns(db)
    run = create(db, setup)
    original = service.persist_draft
    fail = Mock(side_effect=RuntimeError("Database interrupted"))
    monkeypatch.setattr(service, "persist_draft", fail)
    service.generate(run.id)
    run = service.get(setup[0], run.id)
    assert run.items[0].generationState == "checkpointed"
    assert setup[2].call_count == 1
    monkeypatch.setattr(service, "persist_draft", original)
    service.retry(setup[0], setup[1], run.id, [run.items[0].id])
    service.generate(run.id)
    assert service.get(setup[0], run.id).items[0].generationState == "created"
    assert setup[2].call_count == 1
    assert db.social_posts.count_documents({}) == 1


def test_unknown_provider_attempt_never_blindly_retried(db, setup):
    setup[2].side_effect = RuntimeError("Provider timed out")
    service, run = generated(db, setup)
    assert run.status == "partial"
    assert run.items[0].generationState == "uncertain"
    with pytest.raises(HTTPException):
        service.retry(setup[0], setup[1], run.id, [run.items[0].id])
    assert setup[2].call_count == 1


def test_cancel_preserves_partial_items_and_retry_only_missing(db, setup):
    run = create(db, setup, selection(platforms=["facebook", "linkedin"]))
    service = ContentPlanRuns(db)
    def generate(**kw):
        service.cancel(setup[0], setup[1], run.id)
        return {kw["platforms"][0]: {"caption": "Saved despite cancellation"}}
    setup[2].side_effect = generate
    service.generate(run.id)
    result = service.get(setup[0], run.id)
    assert result.cancelled
    assert [item.generationState for item in result.items] == ["created", "pending"]
    assert db.social_posts.count_documents({}) == 1


def test_copy_edit_stale_revision_and_regenerate_invalidate_approval(db, setup):
    service, run = generated(db, setup)
    item = approve(service, setup, run)
    edited = service.edit_copy(setup[0], setup[1], run.id, item.id,
        CopyEdit(expectedRevision=item.revision, caption="Changed copy"))
    assert not edited.copyApproved
    assert edited.revision != item.revision
    with pytest.raises(HTTPException):
        service.approve_copy(setup[0], setup[1], run.id, item.id, item.revision)
    regenerated = service.regenerate_text(setup[0], setup[1], run.id, item.id,
        TextRegenerate(expectedRevision=edited.revision, requestId="regen"))
    assert not regenerated.copyApproved
    calls = setup[2].call_count
    service.regenerate_text(setup[0], setup[1], run.id, item.id, TextRegenerate(expectedRevision=edited.revision, requestId="regen"))
    assert setup[2].call_count == calls
    assert db.social_posts.count_documents({}) == 1


def image_result():
    return GenerateCreativeSetResponse(creativeSetId="creative", status="completed", items=[CreativeSetItem(
        slideId="single", platform="instagram", imageUrl="https://cdn.example.test/image.jpg", assetId="asset",
        blobKey="social/ws/image.jpg", width=1080, height=1350)])


def test_image_requires_approval_reuses_id_and_regenerate_is_explicit(db, setup):
    service, run = generated(db, setup, selection(platforms=["instagram"]))
    item = run.items[0]
    payload = ImageAction(expectedRevision=item.revision, requestId="image-1")
    with pytest.raises(HTTPException):
        service.image(setup[0], setup[1], run.id, item.id, payload)
    setup[5].assert_not_called()
    approve(service, setup, run)
    setup[5].side_effect = None
    setup[5].return_value = image_result()
    result = service.image(setup[0], setup[1], run.id, item.id, payload)
    assert result.visualState == "ready" and result.canSchedule
    stable_id = setup[5].call_args.args[2].requestId
    service.image(setup[0], setup[1], run.id, item.id, payload)
    assert setup[5].call_count == 1
    with pytest.raises(HTTPException):
        service.image(setup[0], setup[1], run.id, item.id, payload.model_copy(update={"mode": "regenerate", "requestId": "image-2"}))
    service.image(setup[0], setup[1], run.id, item.id,
        payload.model_copy(update={"mode": "regenerate", "requestId": "image-2", "creditsConfirmed": True}))
    assert setup[5].call_count == 2
    assert setup[5].call_args.args[2].requestId != stable_id


def test_failed_image_retry_same_creative_id_keeps_approval_and_blocks_optional(db, setup):
    service, run = generated(db, setup)
    item = approve(service, setup, run)
    setup[5].side_effect = RuntimeError("Storage failed")
    payload = ImageAction(expectedRevision=item.revision, requestId="retry-image")
    with pytest.raises(HTTPException):
        service.image(setup[0], setup[1], run.id, item.id, payload)
    failed = service.get(setup[0], run.id).items[0]
    assert failed.copyApproved and not failed.canSchedule and failed.visualState == "failed"
    stable_id = setup[5].call_args.args[2].requestId
    setup[5].side_effect = None
    result = image_result().model_dump(mode="json")
    result["items"][0]["platform"] = "facebook"
    setup[5].return_value = GenerateCreativeSetResponse.model_validate(result)
    service.image(setup[0], setup[1], run.id, item.id, payload.model_copy(update={"mode": "retry"}))
    assert setup[5].call_args.args[2].requestId == stable_id


def test_permissions_team_approval_and_instagram_readiness(db, setup):
    service, run = generated(db, setup, selection(platforms=["instagram"]))
    item = approve(service, setup, run)
    assert not item.canSchedule
    with pytest.raises(HTTPException):
        service.image_intent(setup[0], setup[1], run.id, item.id, ImageIntent(expectedRevision=item.revision, intent="text_only"))
    db.workspace_members.insert_one({"workspace_id": "ws", "user_id": "editor", "social_level": "editor"})
    preview = service.schedule_preview(setup[0], {"id": "editor"}, run.id, [item.id])
    assert preview.items[0].outcome == "blocked"
    with pytest.raises(HTTPException) as exc:
        service.confirm_schedule(setup[0], {"id": "editor"}, run.id, ScheduleConfirm(requestId="schedule", previewId=preview.previewId, confirm=True))
    assert exc.value.status_code == 403
    with pytest.raises(HTTPException) as exc:
        service.approve_copy(setup[0], {"id": "viewer"}, run.id, item.id, item.revision)
    assert exc.value.status_code == 403


def test_schedule_explicit_partial_idempotent_and_dispatch_recovery(db, setup):
    service, run = generated(db, setup, selection(platforms=["facebook", "instagram"]))
    item = approve(service, setup, run)
    item = text_only(service, setup, run, item)
    preview = service.schedule_preview(setup[0], setup[1], run.id, [row.id for row in run.items])
    assert [row.outcome for row in preview.items] == ["ready", "blocked"]
    setup[4].side_effect = RuntimeError("Broker unavailable")
    payload = ScheduleConfirm(requestId="confirm", previewId=preview.previewId, confirm=True)
    result = service.confirm_schedule(setup[0], setup[1], run.id, payload)
    assert [row.outcome for row in result.items] == ["dispatch_pending", "blocked"]
    assert db.social_posts.count_documents({"status": "scheduled"}) == 1
    assert service.confirm_schedule(setup[0], setup[1], run.id, payload) == result
    assert setup[4].call_count == 1
    setup[4].side_effect = None
    service.recover()
    assert service.get(setup[0], run.id).items[0].scheduleState == "accepted"
    assert db.social_posts.count_documents({}) == 2
    latest = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    assert latest.items[0].outcome == "already_scheduled"


@pytest.mark.parametrize("change", ["disconnect", "copy", "time", "team", "blackout", "image_intent"])
def test_confirm_revalidates_every_selected_item(db, setup, change):
    service, run = generated(db, setup)
    item = approve(service, setup, run)
    item = text_only(service, setup, run, item)
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    if change == "disconnect":
        db.social_accounts.update_one({"id": "facebook"}, {"$set": {"is_active": False}})
    if change == "copy":
        db.social_post_platforms.update_one({"post_id": item.postId}, {"$set": {"caption": "Changed after preview"}})
    if change == "time":
        service.edit_slot(setup[0], setup[1], run.id, item.id, SlotEdit(date=item.slot.date, time="13:00", timezone="UTC"))
    if change == "team":
        db.social_settings.update_one({"workspace_id": "ws"}, {"$set": {"approval_required": True}})
    if change == "blackout":
        db.social_settings.update_one({"workspace_id": "ws"}, {"$set": {"blackout_dates": [item.slot.date]}})
    if change == "image_intent":
        db.social_posts.update_one({"id": item.postId}, {"$set": {"planner_image_intent": "optional"}})
    result = service.confirm_schedule(setup[0], setup[1], run.id,
        ScheduleConfirm(requestId="confirm", previewId=preview.previewId, confirm=True))
    assert result.items[0].outcome == "blocked"
    assert db.social_posts.find_one({"id": item.postId})["status"] == "draft"
    setup[4].assert_not_called()


def test_time_only_edit_preserves_copy_approval(db, setup):
    service, run = generated(db, setup)
    item = approve(service, setup, run)
    result = service.edit_slot(setup[0], setup[1], run.id, item.id, SlotEdit(date=item.slot.date, time="13:00", timezone="UTC"))
    assert result.copyApproved and result.revision == item.revision


def test_stale_worker_recovery_marks_unknown_calls_not_retryable(db, setup):
    run = create(db, setup)
    db.social_content_plan_runs.update_one({"id": run.id}, {"$set": {"status": "running", "claim": "dead", "lease_until": datetime.now(timezone.utc) - timedelta(minutes=1)}})
    db.social_content_plan_items.update_one({"id": run.items[0].id}, {"$set": {"state": "generating"}})
    service = ContentPlanRuns(db)
    service.recover()
    recovered = service.get(setup[0], run.id)
    assert recovered.status == "partial" and recovered.items[0].generationState == "uncertain"
    setup[2].assert_not_called()


def test_publish_worker_cancelled_stale_and_early_tasks_do_not_publish(db, setup, monkeypatch):
    from app.social.tasks import publish

    monkeypatch.setattr(publish, "get_database", lambda: db)
    service, run = generated(db, setup)
    item = approve(service, setup, run)
    post_scope = {"id": item.postId}
    assert publish.publish_post.run(item.postId)["reason"] == "stale_schedule"
    db.social_posts.update_one(post_scope, {"$set": {"status": "scheduled", "planner_schedule_token": "new", "planner_scheduled_revision": item.revision}})
    assert publish.publish_post.run(item.postId, "old")["reason"] == "stale_schedule"
    assert publish.publish_post.run(item.postId, "new")["reason"] == "not_due"
    db.social_posts.update_one(post_scope, {"$set": {"scheduled_at": datetime.now(timezone.utc) - timedelta(minutes=1), "planner_approved_fingerprint": "stale"}})
    assert publish.publish_post.run(item.postId, "new")["reason"] == "planner_not_ready"


def test_routes_are_registered_with_typed_contracts():
    from app.main import app

    schema = app.openapi()
    paths = schema["paths"]
    base = "/api/v1/workspaces/{workspace_id}/social/content-plan"
    assert f"{base}/runs" in paths
    assert f"{base}/runs/{{run_id}}/items/{{item_id}}/approve-copy" in paths
    assert "PlannerRun" in schema["components"]["schemas"]