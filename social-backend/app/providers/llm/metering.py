from __future__ import annotations

import json
import logging
import math
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, localcontext
from typing import Any, Iterator
from uuid import uuid4

from app.core.config import Settings, settings

logger = logging.getLogger(__name__)
def pricing_configuration() -> list[dict[str, Any]]:
    configuration = json.loads(Settings.validate_provider_pricing(settings.ai_provider_pricing_json))
    return [{**entry, "model_id": model, "currency": "USD"} for model, entry in configuration.items()]


@dataclass(frozen=True)
class _Scope:
    db: Any
    workspace_id: str
    user_id: str | None
    operation: str
    request_id: str


_scope: ContextVar[_Scope | None] = ContextVar("ai_provider_metering", default=None)


@contextmanager
def metering_scope(
    db: Any, workspace_id: str, user_id: str | None, operation: str,
    request_id: str | None = None,
) -> Iterator[None]:
    token = _scope.set(_Scope(db, str(workspace_id), str(user_id) if user_id else None,
                              operation, request_id or str(uuid4())))
    try:
        yield
    finally:
        _scope.reset(token)


def _tokens(usage: dict[str, Any] | None) -> dict[str, int | None]:
    fields = {
        "input_tokens": "inputTokens", "output_tokens": "outputTokens",
        "cache_read_tokens": "cacheReadInputTokens", "cache_write_tokens": "cacheWriteInputTokens",
    }
    result = {}
    for field, key in fields.items():
        value = (usage or {}).get(key)
        result[field] = value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None
    return result


def _price(model_id: str, region: str, kind: str, status: str,
           tokens: dict[str, int | None], quantity: int) -> tuple[float | None, str, dict]:
    configuration = json.loads(Settings.validate_provider_pricing(settings.ai_provider_pricing_json))
    configured = configuration.get(model_id)
    snapshot: dict[str, Any] = {"currency": "USD", "model_id": model_id, "configured": configured}
    rates = configured
    if rates and rates.get("aliasOf"):
        rates = configuration.get(rates["aliasOf"])
        snapshot["resolved_model_id"] = configured["aliasOf"]
        snapshot["resolved_rates"] = rates
    if not rates or any(entry.get("region") not in (None, region) for entry in (configured, rates)):
        return None, "missing_rate", snapshot
    if status != "success":
        return None, "unknown", snapshot
    if kind == "image":
        components = [(quantity, "imagePerUnitUsd")]
        if quantity < 1:
            return None, "missing_usage", snapshot
    else:
        if tokens["input_tokens"] is None or tokens["output_tokens"] is None:
            return None, "missing_usage", snapshot
        components = [(tokens["input_tokens"], "inputPerMillionUsd"),
                      (tokens["output_tokens"], "outputPerMillionUsd")]
        for field, rate in (("cache_read_tokens", "cacheReadPerMillionUsd"),
                            ("cache_write_tokens", "cacheWritePerMillionUsd")):
            if tokens[field]:
                if rate not in rates:
                    return None, "unknown", snapshot
                components.append((tokens[field], rate))
    if any(rate not in rates for _, rate in components):
        return None, "missing_rate", snapshot
    with localcontext() as context:
        context.prec = 50
        cost = sum((Decimal(count) * Decimal(str(rates[rate])) for count, rate in components), Decimal(0))
        if kind == "text":
            cost /= Decimal(1000000)
        numeric = float(cost)
    if not math.isfinite(numeric) or (cost > 0 and numeric == 0):
        return None, "unknown", snapshot
    return numeric, "priced", snapshot


def record_provider_usage(
    *, kind: str, model_id: str, region: str, status: str,
    usage: dict[str, Any] | None = None, quantity: int = 1,
    provider_request_id: str | None = None,
) -> dict[str, Any] | None:
    scope = _scope.get()
    if scope is None:
        logger.error("AI metering missing scope provider=bedrock kind=%s model=%s", kind, model_id)
        return None
    event_id = str(uuid4())
    try:
        if kind not in ("text", "image") or status not in ("success", "error", "filtered"):
            raise ValueError("invalid provider event")
        tokens = _tokens(usage)
        quantity = 1 if kind == "text" else max(0, int(quantity))
        cost, pricing_status, snapshot = _price(model_id, region, kind, status, tokens, quantity)
        if kind == "text" and usage and any(
            key in usage and tokens[field] is None
            for field, key in (("cache_read_tokens", "cacheReadInputTokens"),
                               ("cache_write_tokens", "cacheWriteInputTokens"))
        ):
            cost, pricing_status = None, "unknown"
        if status != "success":
            cost, pricing_status = None, "unknown"
        event = {
            "id": event_id, "created_at": datetime.now(timezone.utc),
            "workspace_id": scope.workspace_id, "user_id": scope.user_id,
            "operation": scope.operation, "request_id": scope.request_id,
            "provider": "bedrock", "kind": kind, "model_id": model_id, "region": region,
            "status": status, **tokens, "quantity": quantity,
            "estimated_cost_usd": cost, "pricing_status": pricing_status,
            "pricing_snapshot": snapshot, "provider_request_id": provider_request_id,
        }
        scope.db["ai_provider_usage"].insert_one(event)
        return event
    except Exception:
        logger.error("AI metering persistence failed event=%s request=%s workspace=%s model=%s",
                     event_id, scope.request_id, scope.workspace_id, model_id, exc_info=False)
        return None