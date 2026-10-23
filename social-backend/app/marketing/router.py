from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pymongo.database import Database

from app.core.database import get_db
from app.core.rate_limit import enforce_rate_limit
from app.marketing import service
from app.marketing.schemas import (
    ContactReceivedOut,
    ContactRequest,
    EventReceivedOut,
    EventRequest,
)

router = APIRouter(prefix="/public", tags=["marketing"])


@router.post("/contact", response_model=ContactReceivedOut)
def submit_contact(
    payload: ContactRequest, request: Request, db: Database = Depends(get_db)
) -> ContactReceivedOut:
    enforce_rate_limit(request, key_prefix="marketing_contact", limit=5, window_seconds=60)
    return service.create_contact(db, payload)


@router.post("/events", response_model=EventReceivedOut)
def submit_event(
    payload: EventRequest, request: Request, db: Database = Depends(get_db)
) -> EventReceivedOut:
    enforce_rate_limit(request, key_prefix="marketing_events", limit=120, window_seconds=60)
    service.record_event(db, payload)
    return EventReceivedOut()