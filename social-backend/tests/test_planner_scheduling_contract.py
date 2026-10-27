from copy import deepcopy
from datetime import datetime, timedelta, timezone

import mongomock
import pytest
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from app.core.database import _ensure_indexes
from app.core.planner_slot_migration import LOOKUP_INDEX, LOOKUP_KEYS, POST_INDEX, migrate
from app.social.planner_schemas import ConflictAcknowledgment, RunCreate, ScheduleConfirm, SlotEdit
from app.social.planner_slots import annotate_warnings, digest, preview_slots
from tests.test_planner_runs import approve, create, generated, selection, setup, text_only


def conflict(db, slot, post_id="existing", status="scheduled", **extra):
    db.social_posts.insert_one({"id": post_id, "workspace_id": "ws", "status": status,
        "scheduled_at": datetime.fromisoformat(slot.proposedAt), "title": "Existing campaign", **extra})
    db.social_post_platforms.insert_one({"id": f"platform-{post_id}", "post_id": post_id, "social_account_id": slot.accountId,
        "platform": slot.platform, "caption": "An existing caption"})


def ack(slot):
    return ConflictAcknowledgment(slotId=slot.slotId, warningFingerprint=slot.warningFingerprint)


def confirm(service, setup, run, preview, request="schedule", acknowledgments=()):
    return service.confirm_schedule(setup[0], setup[1], run.id, ScheduleConfirm(requestId=request,
        previewId=preview.previewId, confirm=True, conflictAcknowledgments=list(acknowledgments)))


def ready(db, setup):
    service, run = generated(db, setup)
    item = approve(service, setup, run)
    item = text_only(service, setup, run, item)
    return service, run, item


def test_create_requires_current_ack_and_token_does_not_depend_on_ack(db, setup):
    payload = selection()
    slot = preview_slots(db, setup[0], payload).slots[0]
    conflict(db, slot)
    preview = preview_slots(db, setup[0], payload)
    request = RunCreate(**payload.model_dump(), requestId="consent", previewToken=preview.previewToken,
        prompt="A campaign about our business")
    from app.social.content_plan_runs import ContentPlanRuns

    service = ContentPlanRuns(db)
    with pytest.raises(HTTPException) as exc:
        service.create(setup[0], setup[1], request)
    assert exc.value.detail["code"] == "conflict_acknowledgment_required"
    request.conflictAcknowledgments = [ack(preview.slots[0])]
    assert preview_slots(db, setup[0], request).previewToken == preview.previewToken
    run = service.create(setup[0], setup[1], request)
    assert service.create(setup[0], setup[1], request).id == run.id
    service.generate(run.id)
    assert service.get(setup[0], run.id).items[0].generationState == "created"
    stored = db.social_content_plan_runs.find_one({"id": run.id})
    assert stored["conflict_acknowledgment"]["actor"] == "owner"
    setup[4].assert_not_called()


def test_final_requires_fresh_consent_and_preserves_distinct_post_reservations(db, setup):
    service, run, item = ready(db, setup)
    conflict(db, item.slot)
    db.social_planner_slots.insert_one({"workspace_id": "ws", "post_id": "existing",
        "account_id": item.slot.accountId, "scheduled_at": datetime.fromisoformat(item.proposedAt)})
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    outcome = preview.items[0]
    assert outcome.outcome == "ready" and outcome.acknowledgmentRequired
    blocked = confirm(service, setup, run, preview, "no-consent")
    assert blocked.items[0].reasons == ["conflict_acknowledgment_required"]
    assert db.social_posts.find_one({"id": item.postId})["status"] == "draft"
    result = confirm(service, setup, run, preview, "consent", [ack(outcome)])
    assert result.items[0].outcome == "scheduled"
    assert confirm(service, setup, run, preview, "consent").model_dump() == result.model_dump()
    assert db.social_planner_slots.count_documents({}) == 2
    post = db.social_posts.find_one({"id": item.postId})
    assert post["planner_conflict_acknowledgment"]["actor"] == "owner"
    assert post["planner_conflict_acknowledgment"]["slot"]["warningFingerprint"] == outcome.warningFingerprint
    assert db.social_posts.find_one({"id": "existing"})["status"] == "scheduled"
    assert setup[4].call_count == 1


@pytest.mark.parametrize("change", ["added", "caption", "status", "removed"])
def test_warning_snapshot_changes_force_new_schedule_preview(db, setup, change):
    service, run, item = ready(db, setup)
    conflict(db, item.slot)
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    if change == "added":
        conflict(db, item.slot, "another")
    elif change == "caption":
        db.social_post_platforms.update_one({"post_id": "existing"}, {"$set": {"caption": "Changed caption"}})
    else:
        db.social_posts.update_one({"id": "existing"}, {"$set": {"status": "publishing" if change == "status" else "draft"}})
    result = confirm(service, setup, run, preview, acknowledgments=[ack(preview.items[0])])
    assert result.items[0].reasons == ["conflict_snapshot_changed_preview_again"]
    assert db.social_posts.find_one({"id": item.postId})["status"] == "draft"
    setup[4].assert_not_called()


def test_new_conflict_after_clean_preview_is_not_silently_authorized(db, setup):
    service, run, item = ready(db, setup)
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    conflict(db, item.slot)
    result = confirm(service, setup, run, preview)
    assert result.items[0].reasons == ["conflict_snapshot_changed_preview_again"]
    assert result.items[0].warnings[0].postId == "existing"
    assert result.items[0].acknowledgmentRequired


def test_edit_warning_ack_is_bound_to_exact_slot_and_never_grants_final_consent(db, setup):
    service, run, item = ready(db, setup)
    target = item.slot.model_copy(update={"time": "13:00", "proposedAt": item.proposedAt.replace("T12:", "T13:")})
    conflict(db, target)
    payload = SlotEdit(date=target.date, time=target.time, timezone=target.timezone)
    with pytest.raises(HTTPException) as exc:
        service.edit_slot(setup[0], setup[1], run.id, item.id, payload)
    assert exc.value.detail["code"] == "conflict_acknowledgment_required"
    annotated = annotate_warnings(db, setup[0], target, post_id=item.postId)
    payload.conflictAcknowledgments = [ack(annotated)]
    edited = service.edit_slot(setup[0], setup[1], run.id, item.id, payload)
    assert edited.copyApproved and edited.revision == item.revision
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    assert confirm(service, setup, run, preview).items[0].reasons == ["conflict_acknowledgment_required"]
    other = target.model_copy(update={"proposedAt": item.proposedAt})
    conflict(db, other, "second")
    payload.time = "12:00"
    with pytest.raises(HTTPException):
        service.edit_slot(setup[0], setup[1], run.id, item.id, payload)


def test_slot_confirmation_lock_is_not_bypassable_by_ack(db, setup):
    service, run, item = ready(db, setup)
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    stored = service.item(setup[0], run.id, item.id)
    with service.schedule_lock(setup[0], stored):
        result = confirm(service, setup, run, preview)
    assert result.items[0].outcome == "blocked"
    assert "in progress" in result.items[0].reasons[0]
    setup[4].assert_not_called()


def test_two_clean_previews_serialize_new_conflict_then_allow_acknowledged_second_post(db, setup):
    service, first_run, first_item = ready(db, setup)
    second_run = create(db, setup, request_id="second-run")
    service.generate(second_run.id)
    second_run = service.get(setup[0], second_run.id)
    second_item = approve(service, setup, second_run)
    second_item = text_only(service, setup, second_run, second_item)
    first = service.schedule_preview(setup[0], setup[1], first_run.id, [first_item.id])
    second = service.schedule_preview(setup[0], setup[1], second_run.id, [second_item.id])
    assert confirm(service, setup, first_run, first).items[0].outcome == "scheduled"
    blocked = confirm(service, setup, second_run, second)
    assert blocked.items[0].reasons == ["conflict_snapshot_changed_preview_again"]
    second = service.schedule_preview(setup[0], setup[1], second_run.id, [second_item.id])
    assert confirm(service, setup, second_run, second, "new-confirm", [ack(second.items[0])]).items[0].outcome == "scheduled"
    assert db.social_planner_slots.count_documents({}) == 2
    assert db.social_posts.count_documents({"status": "scheduled"}) == 2
    assert setup[4].call_count == 2


def test_run_create_hash_remains_compatible_with_legacy_empty_ack_payload(db, setup):
    run = create(db, setup)
    payload = selection()
    preview = preview_slots(db, setup[0], payload)
    request = RunCreate(**payload.model_dump(), requestId="create", previewToken=preview.previewToken,
        prompt="Useful advice for a brand campaign")
    legacy_hash = digest(request.model_dump(exclude={"previewToken", "conflictAcknowledgments", "includeComment"}))
    assert db.social_content_plan_runs.find_one({"id": run.id})["request_hash"] == legacy_hash
    from app.social.content_plan_runs import ContentPlanRuns

    assert ContentPlanRuns(db).create(setup[0], setup[1], request).id == run.id


@pytest.mark.parametrize("status", ["draft", "scheduled", "publishing"])
def test_active_reservation_owner_edit_lock_remains_non_bypassable(db, setup, status):
    slot = preview_slots(db, setup[0], selection()).slots[0]
    conflict(db, slot, status=status, planner_visual_lock_until=datetime.now(timezone.utc) + timedelta(minutes=5))
    db.social_planner_slots.insert_one({"workspace_id": "ws", "post_id": "existing", "account_id": slot.accountId,
        "scheduled_at": datetime.fromisoformat(slot.proposedAt)})
    payload = selection()
    preview = preview_slots(db, setup[0], payload)
    if preview.slots[0].warnings:
        payload.conflictAcknowledgments = [ack(preview.slots[0])]
    assert "slot_edit_locked" in preview_slots(db, setup[0], payload).slots[0].reasons
    with pytest.raises(HTTPException):
        create(db, setup, payload)
    setup[2].assert_not_called()


def test_http_warning_create_preview_and_confirm_contract(client, db, setup):
    from app.auth.deps import get_current_user
    from app.main import app
    from app.social.content_plan_runs import ContentPlanRuns

    app.dependency_overrides[get_current_user] = lambda: setup[1]
    db.workspaces.update_one({"id": "ws"}, {"$set": {"is_active": True}})
    db.workspace_members.insert_one({"id": "member-ws", "workspace_id": "ws", "user_id": "owner", "social_level": "admin"})
    base = "/api/v1/workspaces/ws/social/content-plan"
    payload = selection()
    conflict(db, preview_slots(db, setup[0], payload).slots[0])
    preview = client.post(f"{base}/slots/preview", json=payload.model_dump()).json()
    slot = preview["slots"][0]
    assert not slot["reasons"] and slot["acknowledgmentRequired"]
    request = {**payload.model_dump(), "requestId": "http-warning", "previewToken": preview["previewToken"],
        "prompt": "A useful brand campaign"}
    rejected = client.post(f"{base}/runs", json=request)
    assert rejected.status_code == 409 and rejected.json()["detail"]["slot"]["warningFingerprint"] == slot["warningFingerprint"]
    acknowledgments = [{"slotId": slot["slotId"], "warningFingerprint": slot["warningFingerprint"]}]
    created = client.post(f"{base}/runs", json={**request, "conflictAcknowledgments": acknowledgments})
    assert created.status_code == 201
    run_id = created.json()["id"]
    service = ContentPlanRuns(db)
    service.generate(run_id)
    run = service.get(setup[0], run_id)
    item = approve(service, setup, run)
    text_only(service, setup, run, item)
    final = client.post(f"{base}/runs/{run_id}/schedule/preview", json={"itemIds": [item.id],
        "conflictAcknowledgments": acknowledgments})
    assert final.status_code == 200 and not final.json()["items"][0]["acknowledgmentRequired"]
    result = client.post(f"{base}/runs/{run_id}/schedule/confirm", json={"requestId": "http-confirm",
        "previewId": final.json()["previewId"], "confirm": True, "conflictAcknowledgments": acknowledgments})
    assert result.status_code == 200 and result.json()["items"][0]["outcome"] == "scheduled"


@pytest.mark.parametrize("guard", ["past_date", "past_slot", "blackout_date"])
def test_date_and_blackout_guards_cannot_be_bypassed_by_ack(db, setup, monkeypatch, guard):
    service, run, item = ready(db, setup)
    conflict(db, item.slot)
    preview = service.schedule_preview(setup[0], setup[1], run.id, [item.id])
    if guard == "blackout_date":
        db.social_settings.update_one({"workspace_id": "ws"}, {"$set": {"blackout_dates": [item.slot.date]}})
    else:
        instant = datetime.fromisoformat(item.proposedAt) + timedelta(days=1 if guard == "past_date" else 0)
        monkeypatch.setattr("app.social.planner_slots.datetime", type("Clock", (datetime,), {
            "now": classmethod(lambda cls, tz=None: instant)}))
    result = confirm(service, setup, run, preview, acknowledgments=[ack(preview.items[0])])
    assert result.items[0].outcome == "blocked" and guard in result.items[0].reasons
    assert db.social_posts.find_one({"id": item.postId})["status"] == "draft"
    setup[4].assert_not_called()


@pytest.mark.parametrize("zone,clock,expected_date", [
    ("Pacific/Kiritimati", "2028-01-03T11:00:00+00:00", "2028-01-04"),
    ("America/Los_Angeles", "2028-01-03T01:00:00+00:00", "2028-01-02"),
])
def test_past_dates_are_based_on_workspace_today(db, setup, zone, clock, expected_date):
    current = datetime.fromisoformat(clock)
    db.social_settings.update_one({"workspace_id": "ws"}, {"$set": {"timezone": zone}})
    today = datetime.fromisoformat(expected_date)
    yesterday = (today - timedelta(days=1)).date().isoformat()
    payload = selection().model_copy(update={"timezone": zone, "dates": [yesterday], "postingTime": "23:59"})
    slot = preview_slots(db, setup[0], payload, now=current).slots[0]
    assert "past_date" in slot.reasons
    payload.dates = [expected_date]
    slot = preview_slots(db, setup[0], payload, now=current).slots[0]
    assert "past_date" not in slot.reasons and "past_slot" not in slot.reasons


def test_warning_is_workspace_scoped_safe_and_deduplicates_reservation(db, setup):
    slot = preview_slots(db, setup[0], selection()).slots[0]
    conflict(db, slot)
    db.social_accounts.update_one({"id": slot.accountId}, {"$set": {"display_name": "Brand account"}})
    db.social_post_platforms.update_one({"post_id": "existing"}, {"$set": {"caption": "Long\n" * 100}})
    db.social_planner_slots.insert_one({"workspace_id": "ws", "post_id": "existing", "account_id": slot.accountId,
        "scheduled_at": datetime.fromisoformat(slot.proposedAt)})
    conflict(db, slot, "foreign", workspace_id="other")
    result = annotate_warnings(db, setup[0], slot)
    assert len(result.warnings) == 1
    warning = result.warnings[0]
    assert warning.accountName == "Brand account" and len(warning.excerpt) <= 160
    assert "\n" not in warning.excerpt and warning.scheduledAt == slot.proposedAt
    assert annotate_warnings(db, setup[0], slot, post_id="existing").warnings == []


def legacy_database():
    db = mongomock.MongoClient().migration_test
    db.social_planner_slots.create_index(LOOKUP_KEYS, unique=True, name="custom_legacy_unique")
    db.social_planner_slots.insert_one({"workspace_id": "ws", "post_id": "one", "account_id": "account",
        "scheduled_at": datetime(2028, 1, 3)})
    return db


def test_migration_dry_run_and_explicit_apply_preserve_all_reservations():
    db = legacy_database()
    before = deepcopy(list(db.social_planner_slots.find()))
    indexes = deepcopy(db.social_planner_slots.index_information())
    assert migrate(db)["legacyIndexes"] == ["custom_legacy_unique"]
    assert db.social_planner_slots.index_information() == indexes
    with pytest.raises(ValueError):
        migrate(db, apply=True)
    report = migrate(db, apply=True, writers_stopped=True)
    assert report["removedIndexes"] == ["custom_legacy_unique"] and report["applied"]
    assert list(db.social_planner_slots.find()) == before
    assert db.social_planner_slots.index_information()[POST_INDEX]["unique"]
    assert not db.social_planner_slots.index_information()[LOOKUP_INDEX].get("unique")
    second = {key: value for key, value in before[0].items() if key != "_id"}
    second["post_id"] = "two"
    db.social_planner_slots.insert_one(second)
    with pytest.raises(DuplicateKeyError):
        db.social_planner_slots.insert_one({**second, "scheduled_at": datetime(2028, 1, 4)})
    assert migrate(db, apply=True, writers_stopped=True)["removedIndexes"] == []


@pytest.mark.parametrize("bad", ["missing", "duplicate", "index"])
def test_migration_invalid_data_or_index_aborts_without_changes(bad):
    db = legacy_database()
    if bad == "missing":
        db.social_planner_slots.insert_one({"workspace_id": "other", "account_id": "other"})
    elif bad == "duplicate":
        db.social_planner_slots.insert_one({"workspace_id": "ws", "post_id": "one", "account_id": "other"})
    else:
        db.social_planner_slots.create_index([("wrong", 1)], name=POST_INDEX)
    before = deepcopy(list(db.social_planner_slots.find()))
    indexes = deepcopy(db.social_planner_slots.index_information())
    assert migrate(db)["errors"]
    with pytest.raises(ValueError):
        migrate(db, apply=True, writers_stopped=True)
    assert list(db.social_planner_slots.find()) == before
    assert db.social_planner_slots.index_information() == indexes


def test_index_bootstrap_does_not_migrate_legacy_reservations():
    db = legacy_database()
    indexes = deepcopy(db.social_planner_slots.index_information())
    before = deepcopy(list(db.social_planner_slots.find()))
    _ensure_indexes(db)
    assert db.social_planner_slots.index_information() == indexes
    assert list(db.social_planner_slots.find()) == before