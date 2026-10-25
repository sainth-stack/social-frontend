from __future__ import annotations

import math
import re
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from bson.decimal128 import Decimal128
from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo.database import Database

from app.core.database import get_db
from app.providers.llm.metering import pricing_configuration


UNKNOWN = "__unattributed__"
COUNTS = (
    "textGenerations", "imageGenerations", "providerCalls", "textProviderCalls",
    "imageProviderCalls", "providerQuantity", "inputTokens", "outputTokens",
    "cacheReadTokens", "cacheWriteTokens", "pricedCalls", "unpricedCalls",
    "failedCalls", "filteredCalls", "unattributedCalls", "legacyTextGenerations",
    "legacyImageGenerations",
)
AGGREGATES = (*COUNTS, "estimatedKnownCostUsd")


class UsageMetrics(BaseModel):
    textGenerations: int = 0
    imageGenerations: int = 0
    providerCalls: int = 0
    textProviderCalls: int = 0
    imageProviderCalls: int = 0
    providerQuantity: int = 0
    inputTokens: int = 0
    outputTokens: int = 0
    cacheReadTokens: int = 0
    cacheWriteTokens: int = 0
    pricedCalls: int = 0
    unpricedCalls: int = 0
    failedCalls: int = 0
    filteredCalls: int = 0
    unattributedCalls: int = 0
    legacyTextGenerations: int = 0
    legacyImageGenerations: int = 0
    estimatedKnownCostUsd: float = Field(default=0, ge=0, allow_inf_nan=False)
    totalCostUsd: float | None = Field(default=0, ge=0, allow_inf_nan=False)
    estimatedCostUsd: float | None = Field(default=0, ge=0, allow_inf_nan=False)
    historicalUnknown: bool = False


class UsageItem(UsageMetrics):
    id: str
    name: str
    email: str | None = None
    userId: str | None = None
    workspaceId: str | None = None
    modelId: str | None = None


class UsageDay(UsageMetrics):
    date: str


class AIUsageReport(BaseModel):
    startDate: str
    endDate: str
    currency: Literal["USD"] = "USD"
    costBasis: Literal["configured_estimate"] = "configured_estimate"
    groupBy: Literal["user", "workspace", "model"]
    summary: UsageMetrics
    items: list[UsageItem]
    total: int
    page: int
    pageSize: int
    totalPages: int
    daily: list[UsageDay]
    models: list[UsageItem]
    pricing: list[dict[str, Any]]
    limitations: list[str]


class UsageFilters:
    def __init__(
        self,
        days: int = Query(default=30),
        startDate: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
        endDate: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
        groupBy: Literal["user", "workspace", "model"] = Query(default="user"),
        search: str | None = Query(default=None, max_length=200),
        kind: Literal["all", "text", "image"] = Query(default="all"),
        workspaceId: UUID | None = Query(default=None),
        userId: UUID | None = Query(default=None),
        page: int = Query(default=1, ge=1, le=1_000_000),
        pageSize: int = Query(default=20, ge=1, le=100),
        sort: Literal["cost", "count"] = Query(default="cost"),
        order: Literal["asc", "desc"] = Query(default="desc"),
    ):
        try:
            if days not in (7, 30, 90):
                raise ValueError("days must be 7, 30 or 90")
            if bool(startDate) != bool(endDate):
                raise ValueError("startDate and endDate must be supplied together")
            self.end = date.fromisoformat(endDate) if endDate else datetime.now(timezone.utc).date()
            self.start = date.fromisoformat(startDate) if startDate else self.end - timedelta(days=days - 1)
            if not 1 <= (self.end - self.start).days + 1 <= 366:
                raise ValueError("Date range must contain 1 to 366 inclusive UTC days")
            self.until = datetime.combine(self.end + timedelta(days=1), time.min, timezone.utc)
        except (ValueError, OverflowError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        self.since = datetime.combine(self.start, time.min, timezone.utc)
        self.group_by, self.search, self.kind = groupBy, search, kind
        self.workspace_id = str(workspaceId) if workspaceId else None
        self.user_id = str(userId) if userId else None
        self.page, self.page_size, self.sort, self.order = page, pageSize, sort, order


def _when(condition: Any, value: Any = 1) -> dict:
    return {"$cond": [condition, value, 0]}


def _projection(filters: UsageFilters, *, quota: bool, first_event: datetime | None) -> dict:
    kind = lambda value: {"$eq": ["$kind", value]}
    quantity = {"$max": [0, {"$ifNull": ["$quantity", 1]}]}
    priced = {"$and": [
        {"$eq": ["$pricing_status", "priced"]},
        {"$eq": ["$status", "success"]},
        {"$isNumber": "$estimated_cost_usd"},
        {"$gte": ["$estimated_cost_usd", 0]},
        {"$lte": ["$estimated_cost_usd", float.fromhex("0x1.fffffffffffffp+1023")]},
    ]}
    legacy = {"$lt": ["$created_at", first_event]} if first_event else True
    group_field = {"user": "$user_id", "workspace": "$workspace_id", "model": "$model_id"}[filters.group_by]
    projection: dict[str, Any] = {
        "_id": 0,
        "groupKey": {"$ifNull": [group_field, UNKNOWN]} if not (quota and filters.group_by == "model") else {"$literal": UNKNOWN},
        "modelKey": {"$literal": UNKNOWN} if quota else {"$ifNull": ["$model_id", UNKNOWN]},
        "day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
    }
    projection.update({key: {"$literal": 0} for key in AGGREGATES})
    if quota:
        for label, value in (("text", "textGenerations"), ("image", "imageGenerations")):
            projection[value] = _when(kind(label), quantity)
            projection["legacy" + value[0].upper() + value[1:]] = _when({"$and": [kind(label), legacy]}, quantity)
    else:
        projection.update({
            "providerCalls": {"$literal": 1},
            "textProviderCalls": _when(kind("text")),
            "imageProviderCalls": _when(kind("image")),
            "providerQuantity": quantity,
            "pricedCalls": _when(priced),
            "unpricedCalls": {"$cond": [priced, 0, 1]},
            "failedCalls": _when({"$eq": ["$status", "error"]}),
            "filteredCalls": _when({"$eq": ["$status", "filtered"]}),
            "unattributedCalls": _when({"$eq": [{"$ifNull": ["$user_id", None]}, None]}),
            "estimatedKnownCostUsd": _when(priced, {"$toDecimal": "$estimated_cost_usd"}),
        })
        for target, field in (("inputTokens", "input_tokens"), ("outputTokens", "output_tokens"),
                              ("cacheReadTokens", "cache_read_tokens"), ("cacheWriteTokens", "cache_write_tokens")):
            projection[target] = {"$max": [0, {"$ifNull": ["$" + field, 0]}]}
    return projection


def _group(key: Any, *, identity: bool = False) -> dict:
    result = {"_id": key, **{field: {"$sum": "$" + field} for field in AGGREGATES}}
    if identity:
        result.update({"name": {"$first": "$name"}, "email": {"$first": "$email"}})
    return {"$group": result}


def _pipeline(filters: UsageFilters, first_event: datetime | None) -> list[dict]:
    match: dict[str, Any] = {
        "created_at": {"$gte": filters.since, "$lt": filters.until},
        "kind": {"$in": ["text", "image"]} if filters.kind == "all" else filters.kind,
    }
    if filters.workspace_id:
        match["workspace_id"] = filters.workspace_id
    if filters.user_id:
        match["user_id"] = filters.user_id
    pipeline = [
        {"$match": match},
        {"$project": _projection(filters, quota=False, first_event=first_event)},
        {"$unionWith": {"coll": "plans_ai_usage", "pipeline": [
            {"$match": match}, {"$project": _projection(filters, quota=True, first_event=first_event)},
        ]}},
        _group({"group": "$groupKey", "day": "$day", "model": "$modelKey"}),
    ]
    if filters.group_by in ("user", "workspace"):
        user = filters.group_by == "user"
        pipeline.extend([
            {"$lookup": {"from": "users" if user else "workspaces", "localField": "_id.group", "foreignField": "id", "as": "identity"}},
            {"$addFields": {
                "name": {"$cond": [{"$eq": ["$_id.group", UNKNOWN]}, "Unattributed", {"$ifNull": [
                    {"$arrayElemAt": ["$identity.full_name" if user else "$identity.name", 0]},
                    {"$ifNull": [{"$arrayElemAt": ["$identity.email", 0]}, "Deleted user" if user else "Deleted workspace"]},
                ]}]},
                "email": {"$ifNull": [{"$arrayElemAt": ["$identity.email", 0]}, None]} if user else None,
            }},
        ])
    else:
        pipeline.append({"$addFields": {"name": {"$cond": [{"$eq": ["$_id.group", UNKNOWN]}, "Unattributed", "$_id.group"]}, "email": None}})
    if filters.search:
        regex = {"$regex": re.escape(filters.search), "$options": "i"}
        pipeline.append({"$match": {"$or": [{field: regex} for field in ("_id.group", "name", "email")]}})
    sort = {"estimatedKnownCostUsd" if filters.sort == "cost" else "providerCalls": 1 if filters.order == "asc" else -1, "_id": 1}
    pipeline.append({"$facet": {
        "summary": [_group(None)],
        "items": [_group("$_id.group", identity=True), {"$sort": sort},
                  {"$skip": (filters.page - 1) * filters.page_size}, {"$limit": filters.page_size}],
        "total": [_group("$_id.group"), {"$count": "value"}],
        "daily": [_group("$_id.day"), {"$sort": {"_id": 1}}],
        "models": [_group("$_id.model"), {"$sort": {"providerCalls": -1, "_id": 1}}],
    }})
    return pipeline


def _metrics(row: dict) -> dict:
    metrics = {key: int(row.get(key, 0)) for key in COUNTS}
    cost = row.get("estimatedKnownCostUsd", 0)
    if isinstance(cost, Decimal128):
        cost = cost.to_decimal()
    known = float(Decimal(str(cost)))
    if not math.isfinite(known) or known < 0:
        raise HTTPException(status_code=422, detail="Stored cost total is outside the supported numeric range")
    historical = (
        metrics["legacyTextGenerations"] > 0 or metrics["legacyImageGenerations"] > 0
        or (metrics["providerCalls"] == 0 and metrics["textGenerations"] + metrics["imageGenerations"] > 0)
    )
    total = None if historical or metrics["unpricedCalls"] else known
    return {**metrics, "estimatedKnownCostUsd": known, "totalCostUsd": total,
            "estimatedCostUsd": total, "historicalUnknown": historical}


def _item(row: dict, group_by: str) -> UsageItem:
    identifier = row["_id"]
    value = None if identifier == UNKNOWN else identifier
    return UsageItem(
        id=identifier, name=row.get("name") or ("Unattributed" if value is None else identifier),
        email=row.get("email"), userId=value if group_by == "user" else None,
        workspaceId=value if group_by == "workspace" else None,
        modelId=value if group_by == "model" else None, **_metrics(row),
    )


def report(db: Database, filters: UsageFilters) -> AIUsageReport:
    first = db["ai_provider_usage"].find_one({"created_at": {"$type": "date"}}, {"created_at": 1}, sort=[("created_at", 1)])
    results = list(db["ai_provider_usage"].aggregate(_pipeline(filters, first["created_at"] if first else None), allowDiskUse=True))
    result = results[0]
    total = result["total"][0]["value"] if result["total"] else 0
    daily = {row["_id"]: row for row in result["daily"]}
    pricing = [{("modelId" if key == "model_id" else key): value for key, value in entry.items()} for entry in pricing_configuration()]
    return AIUsageReport(
        startDate=filters.start.isoformat(), endDate=filters.end.isoformat(), groupBy=filters.group_by,
        summary=UsageMetrics(**_metrics(result["summary"][0] if result["summary"] else {})),
        items=[_item(row, filters.group_by) for row in result["items"]], total=total,
        page=filters.page, pageSize=filters.page_size, totalPages=max(1, (total + filters.page_size - 1) // filters.page_size),
        daily=[UsageDay(date=day.isoformat(), **_metrics(daily.get(day.isoformat(), {})))
               for day in (filters.start + timedelta(days=offset) for offset in range((filters.end - filters.start).days + 1))],
        models=[_item(row, "model") for row in result["models"]], pricing=pricing,
        limitations=[
            "USD costs are configured estimates, not provider invoices; historical snapshots are not repriced using current configuration.",
            "Provider calls count retained actual invocations; generations count successful quota units separately, never one-to-one.",
            "Legacy generations precede the earliest retained global ledger event (all quota rows if no ledger exists); this is a coverage heuristic, not exact unmatched usage.",
            "Retained ledger coverage cannot prove completeness; later quota records cannot be correlated to provider requests or historical models.",
            "Unknown historical cost or unpriced calls make the full estimate null; estimatedKnownCostUsd is only the known subtotal.",
            "Missing actors remain Unattributed; deleted identities retain IDs and are never attributed to workspace owners.",
            "Token totals sum observed fields only; missing token usage is unknown, not proof of zero usage.",
            "Summary, daily and model totals include the group search and all scope filters, before pagination. Cost sorting uses the known subtotal; count sorting uses provider calls.",
        ],
    )


def get_ai_usage(filters: UsageFilters = Depends(), db: Database = Depends(get_db)) -> AIUsageReport:
    return report(db, filters)