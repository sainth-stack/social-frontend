from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.database import Database

from app.core.mongo_utils import new_id, utcnow
from app.marketing.schemas import (
    ContactListOut,
    ContactOut,
    ContactReceivedOut,
    ContactRequest,
    ContactStatus,
    EventRequest,
    MarketingAnalyticsOut,
    MarketingDailyOut,
)


def create_contact(db: Database, payload: ContactRequest) -> ContactReceivedOut:
    contact_id = new_id()
    if not payload.website:
        now = utcnow()
        db["marketing_contacts"].insert_one(
            {
                "id": contact_id,
                "name": payload.name,
                "email": str(payload.email).lower(),
                "company": payload.company or None,
                "message": payload.message,
                "status": "new",
                "created_at": now,
                "updated_at": now,
            }
        )
    return ContactReceivedOut(id=contact_id)


def record_event(db: Database, payload: EventRequest) -> None:
    field = {
        "page_view": "page_views",
        "signup_click": "signup_clicks",
        "contact_click": "contact_clicks",
    }[payload.event]
    counters = {"page_views": 0, "signup_clicks": 0, "contact_clicks": 0}
    counters[field] = 1
    db["marketing_daily"].update_one(
        {"date": utcnow().date().isoformat()},
        {"$inc": counters},
        upsert=True,
    )


def _contact_out(doc: dict) -> ContactOut:
    data = {key: doc[key] for key in ContactOut.model_fields}
    for key in ("created_at", "updated_at"):
        if data[key].tzinfo is None:
            data[key] = data[key].replace(tzinfo=timezone.utc)
    return ContactOut(**data)


def list_contacts(
    db: Database,
    *,
    search: str | None,
    status_filter: ContactStatus | None,
    page: int,
    page_size: int,
) -> ContactListOut:
    query: dict = {}
    if search and search.strip():
        pattern = re.escape(search.strip())
        query["$or"] = [
            {field: {"$regex": pattern, "$options": "i"}}
            for field in ("name", "email", "company", "message")
        ]
    if status_filter is not None:
        query["status"] = status_filter
    total = db["marketing_contacts"].count_documents(query)
    rows = (
        db["marketing_contacts"]
        .find(query)
        .sort([("created_at", -1), ("id", 1)])
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    return ContactListOut(
        items=[_contact_out(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, (total + page_size - 1) // page_size),
    )


def update_contact_status(
    db: Database, contact_id: uuid.UUID, contact_status: ContactStatus
) -> ContactOut:
    doc = db["marketing_contacts"].find_one_and_update(
        {"id": str(contact_id)},
        {"$set": {"status": contact_status, "updated_at": utcnow()}},
        return_document=ReturnDocument.AFTER,
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return _contact_out(doc)


def marketing_analytics(db: Database) -> MarketingAnalyticsOut:
    today = utcnow().date()
    start = today - timedelta(days=29)
    since = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc)
    until = datetime.combine(today + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    events = {
        row["date"]: row
        for row in db["marketing_daily"].find(
            {"date": {"$gte": start.isoformat(), "$lte": today.isoformat()}}
        )
    }
    contacts = {
        row["_id"]: row["count"]
        for row in db["marketing_contacts"].aggregate(
            [
                {"$match": {"created_at": {"$gte": since, "$lt": until}}},
                {"$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                    "count": {"$sum": 1},
                }},
            ]
        )
    }
    statuses = {
        row["_id"]: row["count"]
        for row in db["marketing_contacts"].aggregate(
            [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
        )
    }
    daily = []
    for offset in range(30):
        day = start + timedelta(days=offset)
        row = events.get(day.isoformat(), {})
        daily.append(MarketingDailyOut(
            date=day,
            page_views=row.get("page_views", 0),
            signup_clicks=row.get("signup_clicks", 0),
            contact_clicks=row.get("contact_clicks", 0),
            contacts=contacts.get(day.isoformat(), 0),
        ))
    return MarketingAnalyticsOut(
        page_views_30d=sum(row.page_views for row in daily),
        signup_clicks_30d=sum(row.signup_clicks for row in daily),
        contact_clicks_30d=sum(row.contact_clicks for row in daily),
        contacts_30d=sum(row.contacts for row in daily),
        new_contacts=statuses.get("new", 0),
        in_progress_contacts=statuses.get("in_progress", 0),
        resolved_contacts=statuses.get("resolved", 0),
        daily=daily,
    )