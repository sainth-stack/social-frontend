from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException

from app.social.content_plan import WEEKDAY_KEYS, _plan_cap
from app.social.planner_schemas import PlannerSelection, PlannerSlot, SlotPreview, SlotWarning
from app.social.polish import DEFAULT_POSTING_TIMES


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str, ensure_ascii=False).encode()).hexdigest()


def iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return value.replace(tzinfo=value.tzinfo or timezone.utc).astimezone(timezone.utc).isoformat()


def slot_settings(db, workspace):
    row = db.social_settings.find_one({"workspace_id": workspace["id"]}) or {}
    return {
        "timezone": row.get("timezone") or "Asia/Kolkata",
        "blackoutDates": row.get("blackout_dates") or [],
        "defaultPostingTimes": row.get("default_posting_times") or DEFAULT_POSTING_TIMES,
    }


def local_instant(day: str, clock: str, zone: str, offset: int | None = None) -> datetime:
    try:
        tz = ZoneInfo(zone)
        naive = datetime.fromisoformat(f"{date.fromisoformat(day).isoformat()}T{clock}:00")
        if len(clock) != 5 or naive.date().isoformat() != day:
            raise ValueError()
    except (ValueError, TypeError, ZoneInfoNotFoundError) as exc:
        raise HTTPException(422, "invalid_date_time_or_timezone") from exc
    candidates = {}
    for fold in (0, 1):
        aware = naive.replace(tzinfo=tz, fold=fold)
        instant = aware.astimezone(timezone.utc)
        if instant.astimezone(tz).replace(tzinfo=None) == naive:
            candidates[instant] = int(aware.utcoffset().total_seconds() // 60)
    if not candidates:
        raise HTTPException(422, "nonexistent_local_time")
    if offset is not None:
        candidates = {instant: minutes for instant, minutes in candidates.items() if minutes == offset}
        if not candidates:
            raise HTTPException(422, "invalid_utc_offset")
    if len(candidates) != 1:
        raise HTTPException(422, "ambiguous_local_time_choose_utc_offset")
    return next(iter(candidates))


def selected_dates(payload: PlannerSelection, cap: int) -> list[str]:
    try:
        if payload.dates:
            days = [date.fromisoformat(value) for value in payload.dates]
            if len(set(days)) != len(days):
                raise HTTPException(422, "duplicate_dates")
        else:
            start, end = date.fromisoformat(payload.startDate), date.fromisoformat(payload.endDate)
            if end < start or (end - start).days > 3660:
                raise HTTPException(422, "invalid_date_range")
            days = [start + timedelta(days=index) for index in range((end - start).days + 1)]
        if payload.weekdays is not None:
            days = [day for day in days if day.weekday() in payload.weekdays]
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, "invalid_date") from exc
    if not days or len(days) > cap:
        raise HTTPException(422, f"Select between 1 and {cap} dates")
    return [day.isoformat() for day in sorted(days)]


def slot_reasons(db, workspace, slot: PlannerSlot, *, post_id: str | None = None, now=None) -> list[str]:
    reasons = []
    settings = slot_settings(db, workspace)
    current = now or datetime.now(timezone.utc)
    if slot.date < current.astimezone(ZoneInfo(settings["timezone"])).date().isoformat():
        reasons.append("past_date")
    if slot.timezone != settings.get("timezone", "UTC"):
        reasons.append("workspace_timezone_changed")
    if slot.date in {str(day)[:10] for day in settings.get("blackoutDates", [])}:
        reasons.append("blackout_date")
    if slot.proposedAt is None:
        reasons.append("missing_time")
    elif datetime.fromisoformat(slot.proposedAt) <= current:
        reasons.append("past_slot")
    account = db.social_accounts.find_one({"id": slot.accountId, "workspace_id": workspace["id"], "platform": slot.platform, "is_active": True})
    if not account:
        reasons.append("account_disconnected")
    if slot.proposedAt:
        for reservation in db.social_planner_slots.find({"workspace_id": workspace["id"], "account_id": slot.accountId,
                "scheduled_at": datetime.fromisoformat(slot.proposedAt), "post_id": {"$ne": post_id}}):
            locked = db.social_posts.find_one({"id": reservation["post_id"], "workspace_id": workspace["id"],
                "planner_visual_lock_until": {"$gt": current}})
            if locked:
                reasons.append("slot_edit_locked")
                break
    return reasons


def slot_warnings(db, workspace, slot: PlannerSlot, *, post_id: str | None = None) -> list[SlotWarning]:
    if not slot.proposedAt or not slot.accountId:
        return []
    instant = datetime.fromisoformat(slot.proposedAt)
    local = instant.astimezone(ZoneInfo(slot.timezone))
    account = db.social_accounts.find_one({"id": slot.accountId, "workspace_id": workspace["id"]}) or {}
    warnings = []
    posts = db.social_posts.find({"workspace_id": workspace["id"], "id": {"$ne": post_id},
        "status": {"$in": ["scheduled", "publishing"]}, "scheduled_at": instant}).sort("id", 1)
    for post in posts:
        row = db.social_post_platforms.find_one({"post_id": post["id"], "social_account_id": slot.accountId})
        if not row:
            continue
        excerpt = " ".join(str(row.get("caption") or post.get("title") or "").split())[:160]
        values = {"postId": post["id"], "accountId": slot.accountId,
            "accountName": account.get("display_name") or account.get("account_name") or account.get("name") or slot.platform,
            "status": post["status"], "scheduledAt": iso(instant), "localDate": local.date().isoformat(),
            "localTime": local.strftime("%H:%M"), "timezone": slot.timezone,
            "utcOffsetMinutes": int(local.utcoffset().total_seconds() // 60), "excerpt": excerpt}
        warnings.append(SlotWarning(**values, fingerprint=digest(values)))
    return warnings


def annotate_warnings(db, workspace, slot, acknowledgments=(), *, post_id=None):
    slot.warnings = slot_warnings(db, workspace, slot, post_id=post_id)
    slot.warningFingerprint = digest({"workspaceId": workspace["id"], "slotId": slot.slotId,
        "date": slot.date, "accountId": slot.accountId, "platform": slot.platform, "proposedAt": slot.proposedAt,
        "timezone": slot.timezone, "warnings": [warning.fingerprint for warning in slot.warnings]}) if slot.warnings else None
    slot.acknowledgmentRequired = bool(slot.warnings) and not any(
        ack.slotId == slot.slotId and ack.warningFingerprint == slot.warningFingerprint for ack in acknowledgments)
    return slot


def require_acknowledgment(slot):
    if slot.acknowledgmentRequired:
        raise HTTPException(409, {"code": "conflict_acknowledgment_required", "slot": slot.model_dump()})


def preview_slots(db, workspace, payload: PlannerSelection, *, now=None) -> SlotPreview:
    settings = slot_settings(db, workspace)
    if payload.timezone != settings.get("timezone", "UTC"):
        raise HTTPException(422, "timezone must match the workspace timezone")
    try:
        tz = ZoneInfo(payload.timezone)
    except (ValueError, ZoneInfoNotFoundError) as exc:
        raise HTTPException(422, "invalid_timezone") from exc
    days = selected_dates(payload, _plan_cap(workspace))
    accounts = list(db.social_accounts.find({"workspace_id": workspace["id"], "is_active": True}).sort([("is_default", -1), ("created_at", 1)]))
    overrides = {(entry.date, entry.platform): entry for entry in payload.overrides}
    if len(overrides) != len(payload.overrides) or any(day not in days or platform not in payload.platforms for day, platform in overrides):
        raise HTTPException(422, "invalid_or_duplicate_slot_override")
    times = settings.get("defaultPostingTimes")
    if times is None:
        times = DEFAULT_POSTING_TIMES
    slots = []
    for day in days:
        for platform in payload.platforms:
            override = overrides.get((day, platform))
            account_id = (override.accountId if override else None) or payload.accountIds.get(platform)
            if account_id is None:
                account_id = next((account["id"] for account in accounts if account["platform"] == platform), None)
            configured = times.get(WEEKDAY_KEYS[date.fromisoformat(day).weekday()], [])
            if isinstance(configured, str):
                configured = [configured]
            clock = override.time if override else payload.postingTime or (configured[0] if configured else None)
            slot = PlannerSlot(slotId=f"{day}:{platform}", date=day, time=clock, platform=platform, accountId=account_id, timezone=payload.timezone)
            if clock:
                try:
                    instant = local_instant(day, clock, payload.timezone, override.utcOffsetMinutes if override else None)
                    slot.proposedAt = instant.isoformat()
                    slot.utcOffsetMinutes = int(instant.astimezone(tz).utcoffset().total_seconds() // 60)
                except HTTPException as exc:
                    slot.reasons.append(str(exc.detail))
            else:
                slot.reasons.append("posting_day_disabled")
            slot.reasons.extend(slot_reasons(db, workspace, slot, now=now))
            annotate_warnings(db, workspace, slot, payload.conflictAcknowledgments)
            slots.append(slot)
    values = [slot.model_dump(exclude={"acknowledgmentRequired"}) for slot in slots]
    return SlotPreview(timezone=payload.timezone, selectedDateCount=len(days), dateCap=_plan_cap(workspace), expectedTextUnits=len(slots), previewToken=digest(values), slots=slots)