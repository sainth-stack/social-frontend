from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.social.schemas import SocialPostOut


class PlannerInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SlotOverride(PlannerInput):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    platform: Literal["facebook", "instagram", "linkedin"]
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    accountId: str | None = None
    utcOffsetMinutes: int | None = Field(default=None, ge=-840, le=840)


class PlannerSelection(PlannerInput):
    timezone: str = Field(min_length=1, max_length=100)
    dates: list[str] | None = Field(default=None, min_length=1, max_length=30)
    startDate: str | None = None
    endDate: str | None = None
    weekdays: list[int] | None = Field(default=None, min_length=1, max_length=7)
    platforms: list[Literal["facebook", "instagram", "linkedin"]] = Field(min_length=1, max_length=3)
    accountIds: dict[str, str] = Field(default_factory=dict)
    postingTime: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    overrides: list[SlotOverride] = Field(default_factory=list, max_length=90)

    @model_validator(mode="after")
    def check_selection(self):
        if bool(self.dates) == bool(self.startDate or self.endDate):
            raise ValueError("Choose dates or a complete startDate/endDate range")
        if self.dates is None and not (self.startDate and self.endDate):
            raise ValueError("Both startDate and endDate are required")
        if len(set(self.platforms)) != len(self.platforms):
            raise ValueError("Duplicate platforms are not allowed")
        if self.weekdays is not None and any(day not in range(7) for day in self.weekdays):
            raise ValueError("weekdays use Monday=0 through Sunday=6")
        return self


class PlannerSlot(BaseModel):
    slotId: str
    date: str
    time: str | None = None
    platform: str
    accountId: str | None = None
    proposedAt: str | None = None
    timezone: str
    utcOffsetMinutes: int | None = None
    reasons: list[str] = Field(default_factory=list)


class SlotPreview(BaseModel):
    timezone: str
    selectedDateCount: int
    dateCap: int
    expectedTextUnits: int
    previewToken: str
    slots: list[PlannerSlot]


class RunCreate(PlannerSelection):
    requestId: str = Field(min_length=1, max_length=128)
    previewToken: str
    prompt: str = Field(min_length=10, max_length=8000)
    tone: str | None = Field(default=None, max_length=100)
    excludedSlotIds: list[str] = Field(default_factory=list, max_length=90)


class RevisionInput(PlannerInput):
    expectedRevision: str = Field(min_length=1, max_length=64)


class CopyEdit(RevisionInput):
    caption: str = Field(min_length=1, max_length=10000)
    hashtags: list[str] = Field(default_factory=list, max_length=100)
    firstComment: str = Field(default="", max_length=10000)


class TextRegenerate(RevisionInput):
    requestId: str = Field(min_length=1, max_length=128)


class ImageAction(TextRegenerate):
    mode: Literal["generate", "retry", "regenerate"] = "generate"
    creditsConfirmed: bool = False


class ImageIntent(RevisionInput):
    intent: Literal["text_only", "required"]


class ImageAsset(RevisionInput):
    assetId: str = Field(min_length=1, max_length=128)


class SlotEdit(PlannerInput):
    date: str
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    timezone: str
    utcOffsetMinutes: int | None = Field(default=None, ge=-840, le=840)


class RetryRun(PlannerInput):
    itemIds: list[str] = Field(min_length=1, max_length=90)


class RunItem(BaseModel):
    id: str
    slot: PlannerSlot
    generationState: str
    error: str | None = None
    postId: str
    post: SocialPostOut | None = None
    revision: str | None = None
    copyApproved: bool = False
    approvedRevision: str | None = None
    approvedBy: str | None = None
    approvedAt: str | None = None
    visualState: str = "not_requested"
    visualRevision: str | None = None
    imageOperationId: str | None = None
    imageRequestId: str | None = None
    textState: str = "idle"
    textRequestId: str | None = None
    imageIntent: str = "optional"
    proposedAt: str | None = None
    isScheduled: bool = False
    canSchedule: bool = False
    reasons: list[str] = Field(default_factory=list)
    scheduleState: str | None = None


class PlannerRun(BaseModel):
    id: str
    requestId: str
    status: str
    dispatchState: str
    prompt: str
    timezone: str
    createdAt: str
    createdBy: str
    cancelled: bool
    items: list[RunItem]


class RunList(BaseModel):
    items: list[PlannerRun]
    total: int


class ScheduleSelection(PlannerInput):
    itemIds: list[str] = Field(min_length=1, max_length=90)


class ScheduleRetry(ScheduleSelection):
    requestId: str = Field(min_length=1, max_length=128)


class ScheduleOutcome(BaseModel):
    itemId: str
    postId: str
    revision: str | None = None
    proposedAt: str | None = None
    timezone: str
    platform: str
    accountId: str | None = None
    outcome: Literal["ready", "scheduled", "already_scheduled", "blocked", "dispatch_pending", "failed"]
    reasons: list[str] = Field(default_factory=list)


class SchedulePreview(BaseModel):
    previewId: str
    expiresAt: str
    items: list[ScheduleOutcome]


class ScheduleConfirm(PlannerInput):
    requestId: str = Field(min_length=1, max_length=128)
    previewId: str
    confirm: Literal[True]


class ScheduleResult(BaseModel):
    requestId: str
    items: list[ScheduleOutcome]