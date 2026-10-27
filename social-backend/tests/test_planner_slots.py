from copy import deepcopy
from datetime import datetime, timedelta, timezone

import pytest

from app.social.content_plan import _occupied_plan_dates
from app.social.content_plan_runs import ContentPlanRuns
from app.social.planner_schemas import PlannerSelection
from app.social.planner_slots import preview_slots, slot_settings
from app.social.polish import DEFAULT_POSTING_TIMES


NOW = datetime(2028, 1, 3, 8, tzinfo=timezone.utc)
DAY = "2028-01-03"
INSTANT = NOW.replace(hour=12)


@pytest.fixture()
def workspace(db):
    workspace = {"id": "ws", "plan": "growth"}
    db.social_settings.insert_one({"workspace_id": "ws", "timezone": "UTC"})
    for account, platform in (("facebook", "facebook"), ("facebook-other", "facebook"), ("instagram", "instagram")):
        db.social_accounts.insert_one({"id": account, "workspace_id": "ws", "platform": platform,
            "platform_account_id": account, "is_active": True})
    return workspace


def selection(**changes):
    return PlannerSelection.model_validate({"timezone": "UTC", "dates": [DAY], "platforms": ["facebook"],
        "accountIds": {"facebook": "facebook"}, "postingTime": "12:00", **changes})


def insert_post(db, status, *, instant=INSTANT, account="facebook", platform="facebook", workspace_id="ws"):
    db.social_posts.insert_one({"id": "existing", "workspace_id": workspace_id, "status": status, "scheduled_at": instant})
    db.social_post_platforms.insert_one({"post_id": "existing", "social_account_id": account, "platform": platform})


@pytest.mark.parametrize("status", ["draft", "published", "failed", "archived"])
def test_unscheduled_post_proposed_instant_does_not_block_preview(db, workspace, status):
    insert_post(db, status)
    slot = preview_slots(db, workspace, selection(), now=NOW).slots[0]
    assert slot.proposedAt == INSTANT.isoformat()
    assert slot.reasons == []
    if status != "archived":
        assert _occupied_plan_dates(db, "ws", "UTC") == {DAY}


@pytest.mark.parametrize("status", ["scheduled", "publishing"])
@pytest.mark.parametrize("difference", ["time", "account", "platform", "workspace"])
def test_scheduled_post_only_blocks_same_account_and_instant(db, workspace, status, difference):
    insert_post(db, status,
        instant=INSTANT + timedelta(minutes=1) if difference == "time" else INSTANT,
        account="facebook-other" if difference == "account" else "instagram" if difference == "platform" else "facebook",
        platform="instagram" if difference == "platform" else "facebook",
        workspace_id="other" if difference == "workspace" else "ws")
    assert preview_slots(db, workspace, selection(), now=NOW).slots[0].reasons == []


@pytest.mark.parametrize("status", ["scheduled", "publishing"])
def test_scheduled_same_account_instant_blocks_only_its_slot(db, workspace, status):
    insert_post(db, status)
    preview = preview_slots(db, workspace, selection(platforms=["facebook", "instagram"],
        accountIds={"facebook": "facebook", "instagram": "instagram"}), now=NOW)
    assert preview.slots[0].reasons == []
    assert preview.slots[0].warnings[0].postId == "existing"
    assert preview.slots[0].acknowledgmentRequired
    assert preview.slots[1].reasons == []
    assert preview.slots[1].warnings == []


@pytest.mark.parametrize("stored", ["missing", None, {}, "explicit"])
@pytest.mark.parametrize("weekday", range(7))
def test_empty_settings_use_unchanged_defaults_for_every_weekday(db, workspace, stored, weekday):
    defaults = {"mon": ["09:00", "18:00"], "tue": ["09:00", "18:00"], "wed": ["09:00", "18:00"],
        "thu": ["09:00", "18:00"], "fri": ["09:00", "18:00"], "sat": ["10:00"], "sun": ["10:00"]}
    assert DEFAULT_POSTING_TIMES == defaults
    if stored != "missing":
        db.social_settings.update_one({"workspace_id": "ws"}, {"$set": {
            "default_posting_times": deepcopy(defaults) if stored == "explicit" else stored}})
    before = db.social_settings.find_one({"workspace_id": "ws"})
    day = (NOW + timedelta(days=weekday)).date().isoformat()
    slot = preview_slots(db, workspace, selection(dates=[day], postingTime=None), now=NOW).slots[0]
    expected = "09:00" if weekday < 5 else "10:00"
    assert slot_settings(db, workspace)["defaultPostingTimes"] == defaults
    assert slot.time == expected
    assert slot.proposedAt == f"{day}T{expected}:00+00:00"
    assert slot.reasons == []
    assert db.social_settings.find_one({"workspace_id": "ws"}) == before


@pytest.mark.parametrize("weekday", range(7))
@pytest.mark.parametrize("explicit_time", [False, True])
def test_explicit_empty_weekday_stays_disabled_unless_time_selected(db, workspace, weekday, explicit_time):
    times = deepcopy(DEFAULT_POSTING_TIMES)
    times[list(times)[weekday]] = []
    db.social_settings.update_one({"workspace_id": "ws"}, {"$set": {"default_posting_times": times}})
    day = (NOW + timedelta(days=weekday)).date().isoformat()
    slot = preview_slots(db, workspace, selection(dates=[day], postingTime="12:00" if explicit_time else None), now=NOW).slots[0]
    assert slot_settings(db, workspace)["defaultPostingTimes"] == times
    if explicit_time:
        assert slot.time == "12:00" and slot.reasons == []
    else:
        assert slot.time is None and slot.proposedAt is None
        assert slot.reasons == ["posting_day_disabled", "missing_time"]


@pytest.mark.parametrize("clock", ["07:59", "08:00"])
def test_past_or_current_instant_remains_blocked_with_empty_settings(db, workspace, clock):
    db.social_settings.update_one({"workspace_id": "ws"}, {"$set": {"default_posting_times": {}}})
    slot = preview_slots(db, workspace, selection(postingTime=clock), now=NOW).slots[0]
    assert slot.date == DAY and slot.time == clock
    assert slot.proposedAt == f"{DAY}T{clock}:00+00:00"
    assert slot.reasons == ["past_slot"]


@pytest.mark.parametrize("status,active_lock,retained", [
    (None, False, False), ("archived", False, False), ("draft", False, False),
    ("draft", True, True), ("scheduled", False, True), ("publishing", False, True),
    ("published", False, True), ("failed", False, True),
])
def test_reservations_block_preview_until_existing_safe_recovery(db, workspace, monkeypatch, status, active_lock, retained):
    monkeypatch.setattr("app.social.content_plan_runs.now", lambda: NOW)
    if status:
        insert_post(db, status)
        db.social_posts.update_one({"id": "existing"}, {"$set": {"planner_visual_lock": "claim",
            "planner_visual_lock_until": NOW + timedelta(minutes=30) if active_lock else NOW - timedelta(minutes=1)}})
    db.social_planner_slots.insert_one({"workspace_id": "ws", "account_id": "facebook", "post_id": "existing",
        "scheduled_at": INSTANT, "created_at": NOW - timedelta(minutes=6)})
    before = list(db.social_planner_slots.find({}))
    assert ("slot_edit_locked" in preview_slots(db, workspace, selection(), now=NOW).slots[0].reasons) == (status == "draft" and active_lock)
    assert list(db.social_planner_slots.find({})) == before
    ContentPlanRuns(db).recover()
    assert db.social_planner_slots.count_documents({}) == int(retained)
    slot = preview_slots(db, workspace, selection(), now=NOW).slots[0]
    assert ("slot_edit_locked" in slot.reasons) == (status == "draft" and active_lock)
    assert bool(slot.warnings) == (status in ("scheduled", "publishing"))


def test_recent_orphan_reservation_is_not_removed_by_preview_or_recovery(db, workspace, monkeypatch):
    monkeypatch.setattr("app.social.content_plan_runs.now", lambda: NOW)
    db.social_planner_slots.insert_one({"workspace_id": "ws", "account_id": "facebook", "post_id": "existing",
        "scheduled_at": INSTANT, "created_at": NOW})
    ContentPlanRuns(db).recover()
    assert preview_slots(db, workspace, selection(), now=NOW).slots[0].reasons == []
    assert db.social_planner_slots.count_documents({}) == 1