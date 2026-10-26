from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.providers.llm.model_selection import ModelSelection, current_models, selected_models
from app.social.content_plan_runs import ContentPlanRuns
from app.social.planner_schemas import CopyEdit, ImageAction, ImageAsset, ScheduleConfirm
from app.social.schemas import UpdateSocialPostRequest
from tests.test_planner_runs import approve, create, generated, image_result, selection, setup, text_only


def scheduled(db, setup):
    service, run = generated(db, setup)
    item = approve(service, setup, run)
    item = text_only(service, setup, run, item)
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    service.confirm_schedule(setup[0], setup[1], run.id,
        ScheduleConfirm(requestId="schedule", previewId=preview.previewId, confirm=True))
    return service, run, item, db.social_posts.find_one({"id": item.postId})


def test_copy_edit_does_not_report_an_obsolete_visual_as_ready(db, setup):
    service, run = generated(db, setup, selection(platforms=["instagram"]))
    item = approve(service, setup, run)
    setup[5].side_effect = None
    setup[5].return_value = image_result()
    service.image(setup[0], setup[1], run.id, item.id, ImageAction(expectedRevision=item.revision, requestId="image"))
    edited = service.edit_copy(setup[0], setup[1], run.id, item.id,
        CopyEdit(expectedRevision=item.revision, caption="A different message requiring new artwork"))
    assert edited.visualState == "stale"
    assert not edited.post.imageUrl and not edited.copyApproved and not edited.canSchedule


def test_expired_image_and_text_operations_are_not_shown_as_running_forever(db, setup):
    service, run = generated(db, setup)
    item = run.items[0]
    db.social_content_plan_items.update_one({"id": item.id}, {"$set": {"visual_state": "processing", "text_state": "processing"}})
    db.social_posts.update_one({"id": item.postId}, {"$set": {
        "planner_visual_lock": "dead", "planner_visual_lock_until": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    reloaded = service.get(setup[0], run.id).items[0]
    assert reloaded.visualState == "failed" and reloaded.textState == "uncertain"
    setup[5].assert_not_called()


def test_deleted_owned_media_cannot_be_attached(db, setup):
    service, run = generated(db, setup)
    item = approve(service, setup, run)
    db.social_media_assets.insert_one({"id": "deleted", "workspace_id": "ws", "media_type": "image",
        "mime_type": "image/jpeg", "blob_key": "social/ws/deleted.jpg", "is_deleted": True})
    with pytest.raises(HTTPException) as exc:
        service.attach_image(setup[0], setup[1], run.id, item.id,
            ImageAsset(expectedRevision=item.revision, assetId="deleted"))
    assert exc.value.status_code == 404


def test_generation_carries_selected_models_across_the_queue_boundary(db, setup):
    models = ModelSelection(text="selected-text", image="selected-image")
    with selected_models(models):
        run = create(db, setup)
    observed = []
    def generate(**kw):
        observed.append(current_models())
        return {kw["platforms"][0]: {"caption": "Saved selected model output"}}
    setup[2].side_effect = generate
    ContentPlanRuns(db).generate(run.id)
    assert observed == [models]
    assert current_models() == ModelSelection()


def test_image_retry_keeps_the_exact_creative_request_and_models(db, setup):
    service, run = generated(db, setup, selection(platforms=["instagram"]))
    item = approve(service, setup, run)
    observed = []
    def render(workspace, user, request):
        observed.append((request.model_dump(mode="json"), current_models()))
        if len(observed) == 1:
            raise RuntimeError("Export interrupted after base checkpoint")
        return image_result()
    setup[5].side_effect = render
    payload = ImageAction(expectedRevision=item.revision, requestId="stable")
    with selected_models(ModelSelection(text="text-one", image="image-one")):
        with pytest.raises(HTTPException):
            service.image(setup[0], setup[1], run.id, item.id, payload)
    with selected_models(ModelSelection(text="text-two", image="image-two")):
        service.image(setup[0], setup[1], run.id, item.id, payload.model_copy(update={"mode": "retry"}))
    assert observed[0] == observed[1]
    assert observed[0][0]["caption"] == item.post.platforms[0].caption


def test_expired_generation_cannot_persist_without_recovery_running(db, setup):
    service = ContentPlanRuns(db)
    run = create(db, setup)
    def generate(**kw):
        db.social_content_plan_runs.update_one({"id": run.id}, {"$set": {"lease_until": datetime.now(timezone.utc) - timedelta(seconds=1)}})
        return {kw["platforms"][0]: {"caption": "A late but checkpointable response"}}
    setup[2].side_effect = generate
    service.generate(run.id)
    assert db.social_posts.count_documents({}) == 0
    assert service.get(setup[0], run.id).items[0].generationState == "checkpointed"


def test_generic_return_to_draft_releases_slot_and_fences_old_jobs(db, setup):
    from app.social import router

    service, run, item, post = scheduled(db, setup)
    assert db.social_planner_slots.count_documents({"post_id": item.postId}) == 1
    router.update_post(UpdateSocialPostRequest(status="draft"), post=post, workspace=setup[0], db=db, _=setup[1])
    saved = db.social_posts.find_one({"id": item.postId})
    assert not saved.get("planner_schedule_token") and not saved.get("planner_dispatch_state")
    assert db.social_planner_slots.count_documents({"post_id": item.postId}) == 0


def test_publish_requires_exact_schedule_token_even_for_tokenless_old_deliveries(db, setup, monkeypatch):
    from app.social.tasks import publish

    monkeypatch.setattr(publish, "get_database", lambda: db)
    service, run, item, post = scheduled(db, setup)
    db.social_posts.update_one({"id": item.postId}, {"$set": {"scheduled_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    assert publish.publish_post.run(item.postId)["reason"] == "stale_schedule"
    assert publish.publish_post.run(item.postId, "previous-token")["reason"] == "stale_schedule"
    assert db.social_posts.find_one({"id": item.postId})["status"] == "scheduled"


def test_due_scheduler_includes_current_schedule_token(db, setup, monkeypatch):
    from app.social.tasks import scheduler

    monkeypatch.setattr(scheduler, "get_database", lambda: db)
    service, run, item, post = scheduled(db, setup)
    db.social_posts.update_one({"id": item.postId}, {"$set": {"scheduled_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    from unittest.mock import Mock
    deliver = Mock()
    monkeypatch.setattr("app.social.tasks.publish.publish_post.delay", deliver)
    assert scheduler.enqueue_due_social_posts.run()["enqueued"] == 1
    deliver.assert_called_once_with(item.postId, post["planner_schedule_token"])


@pytest.mark.parametrize("token", [None, "old"])
def test_retry_worker_rejects_a_previous_or_tokenless_schedule(db, setup, monkeypatch, token):
    from app.social.tasks import retry

    monkeypatch.setattr(retry, "get_database", lambda: db)
    service, run, item, post = scheduled(db, setup)
    row = db.social_post_platforms.find_one({"post_id": item.postId})
    db.social_post_platforms.update_one({"id": row["id"]}, {"$set": {"status": "failed", "error_code": "API_ERROR"}})
    db.social_posts.update_one({"id": item.postId}, {"$set": {"status": "failed", "scheduled_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    assert retry.retry_failed_post.run(row["id"], token)["reason"] == "stale_schedule"
    assert db.social_post_platforms.find_one({"id": row["id"]})["status"] == "failed"


def test_retry_claim_cannot_overwrite_a_concurrent_cancellation(db, setup, monkeypatch):
    from app.social.tasks import retry

    monkeypatch.setattr(retry, "get_database", lambda: db)
    service, run, item, post = scheduled(db, setup)
    row = db.social_post_platforms.find_one({"post_id": item.postId})
    db.social_post_platforms.update_one({"id": row["id"]}, {"$set": {"status": "failed", "error_code": "API_ERROR"}})
    db.social_posts.update_one({"id": item.postId}, {"$set": {"status": "failed", "scheduled_at": datetime.now(timezone.utc) - timedelta(seconds=1)}})
    db.social_accounts.update_one({"id": "facebook"}, {"$set": {"access_token_enc": "not-used"}})
    original = db.social_accounts.find_one
    def cancel_before_claim(*args, **kwargs):
        db.social_posts.update_one({"id": item.postId}, {"$set": {"status": "draft"}, "$unset": {"planner_schedule_token": ""}})
        return original(*args, **kwargs)
    monkeypatch.setattr(db.social_accounts, "find_one", cancel_before_claim)
    assert retry.retry_failed_post.run(row["id"], post["planner_schedule_token"])["reason"] == "post_changed_or_busy"
    assert db.social_posts.find_one({"id": item.postId})["status"] == "draft"
    assert db.social_post_platforms.find_one({"id": row["id"]})["status"] == "failed"


def test_recovery_releases_reservation_with_expired_draft_lock(db, setup):
    service, run = generated(db, setup)
    item = run.items[0]
    expired = datetime.now(timezone.utc) - timedelta(minutes=31)
    db.social_posts.update_one({"id": item.postId}, {"$set": {"planner_visual_lock": "dead", "planner_visual_lock_until": expired}})
    db.social_planner_slots.insert_one({"workspace_id": "ws", "account_id": "facebook", "post_id": item.postId,
        "scheduled_at": datetime.fromisoformat(item.proposedAt), "created_at": expired})
    service.recover()
    assert db.social_planner_slots.count_documents({"post_id": item.postId}) == 0


def test_image_retry_recovers_after_attachment_before_operation_checkpoint(db, setup):
    service, run = generated(db, setup, selection(platforms=["instagram"]))
    item = approve(service, setup, run)
    setup[5].side_effect = None
    setup[5].return_value = image_result()
    payload = ImageAction(expectedRevision=item.revision, requestId="attached")
    ready = service.image(setup[0], setup[1], run.id, item.id, payload)
    db.social_planner_operations.update_one({"id": ready.imageOperationId}, {"$set": {"state": "failed"}})
    recovered = service.image(setup[0], setup[1], run.id, item.id, payload.model_copy(update={"mode": "retry"}))
    assert recovered.visualState == "ready" and recovered.canSchedule


def test_team_admin_approval_remains_separate_from_copy_approval(db, setup, monkeypatch):
    from app.social.polish import SocialPolishService

    monkeypatch.setattr("app.social.polish.enforce_approval_available", lambda *args: None)
    db.social_settings.update_one({"workspace_id": "ws"}, {"$set": {"approval_required": True}})
    service, run = generated(db, setup)
    item = approve(service, setup, run)
    assert item.copyApproved and not item.canSchedule
    item = text_only(service, setup, run, item)
    team = SocialPolishService(db)
    post = team.submit_approval(setup[0], setup[1], db.social_posts.find_one({"id": item.postId}))
    db.workspace_members.insert_one({"workspace_id": "ws", "user_id": "editor", "social_level": "editor"})
    with pytest.raises(HTTPException) as exc:
        team.approve_post(setup[0], {"id": "editor"}, post)
    assert exc.value.status_code == 403
    team.approve_post(setup[0], setup[1], post)
    approved = service.get(setup[0], run.id).items[0]
    assert approved.canSchedule and approved.copyApproved
    changed = service.edit_copy(setup[0], setup[1], run.id, item.id,
        CopyEdit(expectedRevision=item.revision, caption="Changed after team approval"))
    assert not changed.copyApproved and not changed.canSchedule
    assert db.social_posts.find_one({"id": item.postId})["approval_status"] != "approved"


def test_exact_dst_slot_survives_preview_generation_and_schedule(db, setup):
    from app.social.planner_schemas import PlannerSelection, SlotOverride

    db.social_settings.update_one({"workspace_id": "ws"}, {"$set": {"timezone": "America/New_York"}})
    payload = PlannerSelection(timezone="America/New_York", dates=["2027-11-07"], platforms=["facebook"],
        overrides=[SlotOverride(date="2027-11-07", platform="facebook", time="01:30", utcOffsetMinutes=-300)])
    service, run = generated(db, setup, payload)
    item = approve(service, setup, run)
    item = text_only(service, setup, run, item)
    assert item.proposedAt == "2027-11-07T06:30:00+00:00"
    assert item.slot.date == "2027-11-07" and item.slot.time == "01:30"
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    result = service.confirm_schedule(setup[0], setup[1], run.id,
        ScheduleConfirm(requestId="dst", previewId=preview.previewId, confirm=True))
    assert result.items[0].outcome == "scheduled"
    assert setup[4].call_args.kwargs["eta"].isoformat() == "2027-11-07T06:30:00"
    assert service.get(setup[0], run.id).items[0].slot.utcOffsetMinutes == -300


def test_dispatch_retry_returns_missing_and_busy_items_as_blocked(db, setup):
    from app.social.planner_schemas import ScheduleRetry

    service, run = generated(db, setup, selection(platforms=["facebook", "linkedin"]))
    first, second = run.items
    db.social_posts.delete_one({"id": first.postId})
    db.social_posts.update_one({"id": second.postId}, {"$set": {
        "planner_visual_lock": "other", "planner_visual_lock_until": datetime.now(timezone.utc) + timedelta(minutes=1)}})
    payload = ScheduleRetry(requestId="blocked", itemIds=[first.id, second.id])
    result = service.retry_schedule(setup[0], setup[1], run.id, payload)
    assert [item.outcome for item in result.items] == ["blocked", "blocked"]
    assert service.retry_schedule(setup[0], setup[1], run.id, payload) == result
    setup[4].assert_not_called()


def test_dispatch_retry_claim_prevents_concurrent_request_replay(db, setup):
    from app.social.planner_schemas import ScheduleRetry
    from app.social.planner_slots import digest

    service, run = generated(db, setup)
    item = run.items[0]
    db.social_planner_operations.insert_one({"id": digest(["ws", run.id, "retry_schedule", "retry"]),
        "workspace_id": "ws", "item_ids": [item.id], "claim": "other", "lease_until": datetime.now(timezone.utc) + timedelta(minutes=1)})
    with pytest.raises(HTTPException) as exc:
        service.retry_schedule(setup[0], setup[1], run.id, ScheduleRetry(requestId="retry", itemIds=[item.id]))
    assert exc.value.status_code == 409
    setup[4].assert_not_called()