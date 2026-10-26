from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.social.content_plan_runs import ContentPlanRuns
from app.social.planner_schemas import ImageAction, ImageAsset, ImageIntent, ScheduleConfirm, ScheduleRetry
from app.social.planner_slots import digest, preview_slots
from tests.test_planner_runs import approve, create, generated, image_result, selection, setup, text_only


def test_explicit_selected_slot_exclusion_does_not_substitute_a_date(db, setup):
    from app.social.planner_schemas import RunCreate

    payload = selection(platforms=["facebook", "instagram"])
    db.social_accounts.update_one({"id": "instagram"}, {"$set": {"is_active": False}})
    preview = preview_slots(db, setup[0], payload)
    run = ContentPlanRuns(db).create(setup[0], setup[1], RunCreate(**payload.model_dump(),
        requestId="exclude", prompt="A campaign about useful brand tips", previewToken=preview.previewToken,
        excludedSlotIds=[preview.slots[1].slotId]))
    service = ContentPlanRuns(db)
    service.generate(run.id)
    final = service.get(setup[0], run.id)
    assert [item.generationState for item in final.items] == ["created", "excluded"]
    assert {item.slot.date for item in final.items} == set(payload.dates)
    assert db.social_posts.count_documents({}) == 1


def test_retry_generates_only_selected_pending_slots(db, setup):
    service = ContentPlanRuns(db)
    run = create(db, setup, selection(platforms=["facebook", "instagram", "linkedin"]))
    service.cancel(setup[0], setup[1], run.id)
    service.retry(setup[0], setup[1], run.id, [run.items[1].id])
    service.generate(run.id)
    result = service.get(setup[0], run.id)
    assert [item.generationState for item in result.items] == ["pending", "created", "pending"]
    assert setup[2].call_count == 1


def test_complete_post_checkpoint_repair_does_not_create_another_post_or_charge_text(db, setup, monkeypatch):
    service = ContentPlanRuns(db)
    run = create(db, setup)
    original = service.persist_draft
    def persist_then_interrupt(*args):
        original(*args)
        raise RuntimeError("Process died after post persistence")
    monkeypatch.setattr(service, "persist_draft", persist_then_interrupt)
    service.generate(run.id)
    assert db.social_posts.count_documents({}) == 1
    saved = db.social_posts.find_one()
    assert saved["planner_text_first"] and saved["planner_run_id"] == run.id
    db.social_post_platforms.delete_many({"post_id": saved["id"]})
    monkeypatch.setattr(service, "persist_draft", original)
    service.retry(setup[0], setup[1], run.id, [run.items[0].id])
    service.generate(run.id)
    assert service.get(setup[0], run.id).items[0].generationState == "created"
    assert db.social_post_platforms.count_documents({}) == 1
    assert db.social_posts.count_documents({}) == 1
    assert setup[2].call_count == 1


def test_recovered_worker_cannot_attach_a_late_uncheckpointed_result(db, setup):
    service = ContentPlanRuns(db)
    run = create(db, setup)
    def late_result(**kw):
        db.social_content_plan_runs.update_one({"id": run.id}, {"$set": {"lease_until": datetime.now(timezone.utc) - timedelta(minutes=1)}})
        service.recover()
        return {kw["platforms"][0]: {"caption": "A result from an expired worker"}}
    setup[2].side_effect = late_result
    service.generate(run.id)
    result = service.get(setup[0], run.id)
    assert result.items[0].generationState == "uncertain"
    assert db.social_posts.count_documents({}) == 0


def test_cancelled_dead_worker_recovery_keeps_cancelled_and_fences_unknown_attempt(db, setup):
    run = create(db, setup)
    db.social_content_plan_runs.update_one({"id": run.id}, {"$set": {"status": "cancelled", "cancelled": True,
        "claim": "dead", "lease_until": datetime.now(timezone.utc) - timedelta(minutes=1)}})
    db.social_content_plan_items.update_one({"id": run.items[0].id}, {"$set": {"state": "generating", "claim": "dead-item"}})
    service = ContentPlanRuns(db)
    service.recover()
    result = service.get(setup[0], run.id)
    assert result.status == "cancelled" and result.cancelled
    assert result.items[0].generationState == "uncertain"


def test_image_retry_uses_persisted_request_id_after_reload_and_regenerate_failure(db, setup):
    service, run = generated(db, setup, selection(platforms=["instagram"]))
    item = approve(service, setup, run)
    setup[5].side_effect = None
    setup[5].return_value = image_result()
    original = ImageAction(expectedRevision=item.revision, requestId="first")
    service.image(setup[0], setup[1], run.id, item.id, original)
    setup[5].side_effect = RuntimeError("Storage unavailable")
    with pytest.raises(HTTPException):
        service.image(setup[0], setup[1], run.id, item.id,
            ImageAction(expectedRevision=item.revision, requestId="new", mode="regenerate", creditsConfirmed=True))
    reloaded = ContentPlanRuns(db).get(setup[0], run.id).items[0]
    assert reloaded.visualState == "failed" and reloaded.imageRequestId == "new"
    assert reloaded.post.imageUrl and not reloaded.canSchedule
    request_id = setup[5].call_args.args[2].requestId
    setup[5].side_effect = None
    ContentPlanRuns(db).image(setup[0], setup[1], run.id, item.id,
        ImageAction(expectedRevision=item.revision, requestId=reloaded.imageRequestId, mode="retry"))
    assert setup[5].call_args.args[2].requestId == request_id


def test_own_media_attachment_is_revision_bound_and_has_no_paid_calls(db, setup, monkeypatch):
    service, run = generated(db, setup, selection(platforms=["instagram"]))
    item = approve(service, setup, run)
    db.social_media_assets.insert_one({"id": "owned", "workspace_id": "ws", "media_type": "image", "mime_type": "image/jpeg",
        "blob_key": "social/ws/owned.jpg", "source": "uploaded"})
    monkeypatch.setattr("app.social.media.refresh_blob_url", lambda key: f"https://cdn.example.test/{key}")
    result = service.attach_image(setup[0], setup[1], run.id, item.id, ImageAsset(expectedRevision=item.revision, assetId="owned"))
    assert result.visualState == "ready" and result.canSchedule
    setup[5].assert_not_called()
    db.social_media_assets.update_one({"id": "owned"}, {"$set": {"workspace_id": "other"}})
    with pytest.raises(HTTPException) as exc:
        service.attach_image(setup[0], setup[1], run.id, item.id, ImageAsset(expectedRevision=item.revision, assetId="owned"))
    assert exc.value.status_code == 404


def test_optional_image_failure_can_only_be_bypassed_with_explicit_text_only(db, setup):
    service, run = generated(db, setup)
    item = approve(service, setup, run)
    setup[5].side_effect = RuntimeError("Image failed")
    with pytest.raises(HTTPException):
        service.image(setup[0], setup[1], run.id, item.id, ImageAction(expectedRevision=item.revision, requestId="image"))
    assert not service.get(setup[0], run.id).items[0].canSchedule
    result = service.image_intent(setup[0], setup[1], run.id, item.id, ImageIntent(expectedRevision=item.revision, intent="text_only"))
    assert result.canSchedule and result.copyApproved


def test_schedule_dispatch_retry_does_not_generate_text_images_or_duplicate_posts(db, setup):
    service, run = generated(db, setup)
    item = approve(service, setup, run)
    item = text_only(service, setup, run, item)
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    setup[4].side_effect = RuntimeError("Uncertain broker acknowledgement")
    result = service.confirm_schedule(setup[0], setup[1], run.id, ScheduleConfirm(requestId="schedule", previewId=preview.previewId, confirm=True))
    assert result.items[0].outcome == "dispatch_pending"
    setup[4].side_effect = None
    payload = ScheduleRetry(requestId="retry", itemIds=[item.id])
    retry = service.retry_schedule(setup[0], setup[1], run.id, payload)
    assert retry.items[0].outcome == "scheduled"
    service.retry_schedule(setup[0], setup[1], run.id, payload)
    assert setup[4].call_count == 2
    assert setup[2].call_count == 1
    setup[5].assert_not_called()
    assert db.social_posts.count_documents({}) == 1


def test_confirmation_in_progress_is_explicit_and_resumes_after_lease_expiry(db, setup):
    service, run = generated(db, setup)
    item = approve(service, setup, run)
    item = text_only(service, setup, run, item)
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    operation_id = digest(["ws", run.id, "schedule", "confirm"])
    db.social_planner_operations.insert_one({"id": operation_id, "workspace_id": "ws", "preview_id": preview.previewId,
        "lease_until": datetime.now(timezone.utc) + timedelta(minutes=1), "claim": "other"})
    payload = ScheduleConfirm(requestId="confirm", previewId=preview.previewId, confirm=True)
    with pytest.raises(HTTPException) as exc:
        service.confirm_schedule(setup[0], setup[1], run.id, payload)
    assert exc.value.status_code == 409
    setup[4].assert_not_called()
    db.social_planner_operations.update_one({"id": operation_id}, {"$set": {"lease_until": datetime.now(timezone.utc) - timedelta(minutes=1)}})
    assert service.confirm_schedule(setup[0], setup[1], run.id, payload).items[0].outcome == "scheduled"


def test_blocked_preview_cannot_silently_become_a_scheduling_selection(db, setup):
    service, run = generated(db, setup)
    item = run.items[0]
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    assert preview.items[0].outcome == "blocked"
    item = approve(service, setup, run)
    item = text_only(service, setup, run, item)
    result = service.confirm_schedule(setup[0], setup[1], run.id, ScheduleConfirm(requestId="confirm", previewId=preview.previewId, confirm=True))
    assert result.items[0].outcome == "blocked"
    setup[4].assert_not_called()


def test_cancel_reschedule_old_task_and_generic_api_bypass_are_blocked(db, setup, monkeypatch):
    from app.social import router
    from app.social.schemas import SchedulePostRequest, UpdateSocialPostRequest
    from app.social.tasks import publish

    monkeypatch.setattr(publish, "get_database", lambda: db)
    service, run = generated(db, setup)
    item = approve(service, setup, run)
    item = text_only(service, setup, run, item)
    post = db.social_posts.find_one({"id": item.postId})
    with pytest.raises(HTTPException):
        router.schedule_post(SchedulePostRequest(scheduledAt=item.proposedAt), post=post, db=db, _=setup[1])
    with pytest.raises(HTTPException):
        router.update_post(UpdateSocialPostRequest(status="scheduled"), post=post, workspace=setup[0], db=db, _=setup[1])
    with pytest.raises(HTTPException):
        router.publish_now(post=post, db=db, _=setup[1])
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    service.confirm_schedule(setup[0], setup[1], run.id, ScheduleConfirm(requestId="schedule", previewId=preview.previewId, confirm=True))
    token = db.social_posts.find_one({"id": item.postId})["planner_schedule_token"]
    router.cancel_schedule(post=db.social_posts.find_one({"id": item.postId}), db=db, _=setup[1])
    assert publish.publish_post.run(item.postId, token)["reason"] == "stale_schedule"
    assert service.get(setup[0], run.id).items[0].proposedAt == item.proposedAt


def test_http_contract_authenticated_workspace_scoping_and_no_legacy_inputs(client, db, setup):
    from app.main import app
    from app.auth.deps import get_current_user

    app.dependency_overrides[get_current_user] = lambda: setup[1]
    db.workspaces.update_one({"id": "ws"}, {"$set": {"is_active": True}})
    db.workspace_members.insert_one({"id": "member-ws", "workspace_id": "ws", "user_id": "owner", "social_level": "admin"})
    base = "/api/v1/workspaces/ws/social/content-plan"
    payload = selection().model_dump()
    preview = client.post(f"{base}/slots/preview", json=payload)
    assert preview.status_code == 200, preview.text
    invalid = client.post(f"{base}/slots/preview", json={**payload, "days": 7})
    assert invalid.status_code == 422
    run = client.post(f"{base}/runs", json={**payload, "requestId": "http", "previewToken": preview.json()["previewToken"], "prompt": "A useful brand campaign"})
    assert run.status_code == 201, run.text
    run_id = run.json()["id"]
    assert client.get(f"{base}/runs/{run_id}").json()["id"] == run_id
    assert client.get(f"{base}/runs").json()["total"] == 1
    db.workspaces.insert_one({"id": "other", "is_active": True, "owner_user_id": "owner"})
    db.workspace_members.insert_one({"id": "member-other", "workspace_id": "other", "user_id": "owner", "social_level": "admin"})
    assert client.get(f"/api/v1/workspaces/other/social/content-plan/runs/{run_id}").status_code == 404
    assert client.get("/api/v1/workspaces/other/social/content-plan/runs").json()["items"] == []