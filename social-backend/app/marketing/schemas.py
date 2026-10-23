from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel

ContactStatus = Literal["new", "in_progress", "resolved"]
MarketingEvent = Literal["page_view", "signup_click", "contact_click"]


class ContactRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    company: str | None = Field(default=None, max_length=160)
    message: str = Field(min_length=10, max_length=5000)
    website: str | None = Field(default=None, max_length=2048)

    @field_validator("name", "email", "company", "message", "website", mode="before")
    @classmethod
    def strip_fields(cls, value):
        return value.strip() if isinstance(value, str) else value


class ContactReceivedOut(BaseModel):
    id: uuid.UUID
    status: Literal["received"] = "received"


class EventRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: MarketingEvent
    path: Literal["/"]


class EventReceivedOut(BaseModel):
    status: Literal["received"] = "received"


class ContactStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ContactStatus


class CamelOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


class ContactOut(CamelOut):
    id: uuid.UUID
    name: str
    email: str
    company: str | None
    message: str
    status: ContactStatus
    created_at: datetime
    updated_at: datetime


class ContactListOut(CamelOut):
    items: list[ContactOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class MarketingDailyOut(CamelOut):
    date: date
    page_views: int
    signup_clicks: int
    contact_clicks: int
    contacts: int


class MarketingAnalyticsOut(CamelOut):
    page_views_30d: int = Field(alias="pageViews30d")
    signup_clicks_30d: int = Field(alias="signupClicks30d")
    contact_clicks_30d: int = Field(alias="contactClicks30d")
    contacts_30d: int = Field(alias="contacts30d")
    new_contacts: int
    in_progress_contacts: int
    resolved_contacts: int
    daily: list[MarketingDailyOut]