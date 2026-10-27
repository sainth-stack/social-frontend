from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable, Generator
from typing import Any, TypeVar

import certifi
from pymongo import ASCENDING, DESCENDING, IndexModel, MongoClient
from pymongo.database import Database
from pymongo.errors import (
    AutoReconnect,
    ConnectionFailure,
    NetworkTimeout,
    OperationFailure,
    ServerSelectionTimeoutError,
)

from app.core.config import settings
from app.core.db_metrics import CommandMetricsListener

logger = logging.getLogger(__name__)

_client: MongoClient | None = None
_client_lock = threading.Lock()

T = TypeVar("T")

_MONGO_TRANSIENT = (
    AutoReconnect,
    ConnectionFailure,
    NetworkTimeout,
    ServerSelectionTimeoutError,
)


def _mongo_client_kwargs() -> dict[str, Any]:
    return {
        "serverSelectionTimeoutMS": 8000,
        "connectTimeoutMS": 10000,
        "socketTimeoutMS": 20000,
        "retryReads": True,
        "retryWrites": True,
        "maxPoolSize": 50,
        "minPoolSize": 2,
        "tlsCAFile": certifi.where(),
        "event_listeners": [CommandMetricsListener()],
    }


def _get_client() -> MongoClient:
    global _client
    with _client_lock:
        if _client is None:
            _client = MongoClient(settings.mongodb_url, **_mongo_client_kwargs())
        return _client


def get_database() -> Database:
    return _get_client()[settings.mongodb_db_name]


def get_db() -> Generator[Database, None, None]:
    yield get_database()


def mongo_retry_once(
    func: Callable[..., T],
    *args: Any,
    refresh: Callable[[], None] | None = None,
    **kwargs: Any,
) -> T:
    """Retry once on transient Atlas/network errors without closing the shared client."""
    try:
        return func(*args, **kwargs)
    except _MONGO_TRANSIENT as exc:
        logger.warning("MongoDB transient error (%s); retrying once", exc)
        if refresh is not None:
            refresh()
        time.sleep(0.25)
        return func(*args, **kwargs)


def init_db() -> None:
    safe_url = settings.mongodb_url.split("@")[-1] if "@" in settings.mongodb_url else settings.mongodb_url
    print(f"[db] connecting to MongoDB: {safe_url}")
    _get_client().admin.command("ping")
    print("[db] MongoDB connected successfully")
    _ensure_indexes(get_database())


_ID_COLLECTIONS = (
    "users",
    "workspaces",
    "workspace_members",
    "social_accounts",
    "social_posts",
    "social_post_platforms",
    "social_audit_logs",
    "social_templates",
    "social_media_assets",
)


def _index_specs() -> dict[str, list[IndexModel]]:
    def idx(*keys: tuple[str, int], **kwargs: Any) -> IndexModel:
        return IndexModel(list(keys), **kwargs)

    return {
        "users": [
            idx(("email", ASCENDING), unique=True),
            idx(("google_id", ASCENDING), sparse=True),
        ],
        "workspaces": [idx(("owner_user_id", ASCENDING))],
        "workspace_members": [
            idx(("user_id", ASCENDING), ("workspace_id", ASCENDING), unique=True),
            idx(("workspace_id", ASCENDING)),
        ],
        "social_accounts": [
            idx(
                ("workspace_id", ASCENDING),
                ("platform", ASCENDING),
                ("platform_account_id", ASCENDING),
                unique=True,
            ),
            idx(("workspace_id", ASCENDING), ("is_active", ASCENDING)),
        ],
        "social_posts": [
            idx(("workspace_id", ASCENDING), ("status", ASCENDING)),
            idx(("workspace_id", ASCENDING), ("scheduled_at", ASCENDING)),
            idx(("workspace_id", ASCENDING), ("status", ASCENDING), ("scheduled_at", ASCENDING)),
            idx(("workspace_id", ASCENDING), ("created_at", DESCENDING)),
            idx(("workspace_id", ASCENDING), ("updated_at", DESCENDING)),
        ],
        "social_post_platforms": [idx(("post_id", ASCENDING))],
        "social_content_plan_runs": [
            idx(("id", ASCENDING), unique=True),
            idx(("workspace_id", ASCENDING), ("request_id", ASCENDING), unique=True),
            idx(("workspace_id", ASCENDING), ("created_at", DESCENDING)),
            idx(("status", ASCENDING), ("dispatch_at", ASCENDING)),
        ],
        "social_content_plan_items": [
            idx(("id", ASCENDING), unique=True),
            idx(("run_id", ASCENDING), ("slot_id", ASCENDING), unique=True),
            idx(("workspace_id", ASCENDING), ("run_id", ASCENDING)),
        ],
        "social_planner_operations": [
            idx(("id", ASCENDING), unique=True),
            idx(("workspace_id", ASCENDING), ("run_id", ASCENDING)),
        ],
        "social_planner_slots": [
            idx(("workspace_id", ASCENDING), ("post_id", ASCENDING), unique=True, name="planner_workspace_post_unique"),
            idx(("workspace_id", ASCENDING), ("account_id", ASCENDING), ("scheduled_at", ASCENDING), name="planner_account_instant_lookup"),
            idx(("post_id", ASCENDING)),
        ],
        "social_media_assets": [idx(("workspace_id", ASCENDING), ("created_at", DESCENDING))],
        "social_analytics_daily": [
            idx(
                ("workspace_id", ASCENDING),
                ("social_account_id", ASCENDING),
                ("date", ASCENDING),
                unique=True,
            ),
            idx(("workspace_id", ASCENDING), ("date", ASCENDING)),
        ],
        "social_audit_logs": [idx(("workspace_id", ASCENDING), ("created_at", DESCENDING))],
        "social_settings": [idx(("workspace_id", ASCENDING), unique=True)],
        "social_brand_voices": [idx(("workspace_id", ASCENDING), unique=True)],
        "social_templates": [
            idx(("workspace_id", ASCENDING)),
            idx(("workspace_id", ASCENDING), ("is_system", ASCENDING)),
        ],
        "plans_ai_usage": [
            idx(("workspace_id", ASCENDING), ("created_at", DESCENDING)),
            idx(("workspace_id", ASCENDING), ("kind", ASCENDING), ("created_at", DESCENDING)),
        ],
        "ai_provider_usage": [
            idx(("id", ASCENDING), unique=True),
            idx(("created_at", DESCENDING)),
            idx(("user_id", ASCENDING), ("created_at", DESCENDING)),
            idx(("workspace_id", ASCENDING), ("created_at", DESCENDING)),
            idx(("model_id", ASCENDING), ("created_at", DESCENDING)),
            idx(("provider_request_id", ASCENDING), sparse=True),
        ],
        "plan_overrides": [idx(("plan_key", ASCENDING), unique=True)],
        "marketing_contacts": [
            idx(("id", ASCENDING), unique=True),
            idx(("created_at", DESCENDING)),
            idx(("status", ASCENDING), ("created_at", DESCENDING)),
        ],
        "marketing_daily": [idx(("date", ASCENDING), unique=True)],
        "billing_payments": [
            idx(("workspace_id", ASCENDING), ("created_at", DESCENDING)),
            idx(("provider_order_id", ASCENDING), sparse=True),
            idx(("id", ASCENDING), unique=True),
        ],
        "billing_coupons": [idx(("code", ASCENDING), unique=True)],
        "billing_coupon_redemptions": [
            idx(("coupon_id", ASCENDING), ("created_at", DESCENDING)),
            idx(("workspace_id", ASCENDING), ("created_at", DESCENDING)),
        ],
    }


def _ensure_id_index(db: Database, collection: str) -> None:
    try:
        db[collection].create_index([("id", ASCENDING)], unique=True)
    except OperationFailure as exc:
        # Legacy duplicates/missing ids must not leave the hot `id` lookups unindexed.
        logger.warning("Unique id index failed on %s (%s); creating non-unique", collection, exc)
        db[collection].create_index([("id", ASCENDING)], name="id_1_nonunique")


def _ensure_indexes(db: Database) -> None:
    for collection, models in _index_specs().items():
        try:
            if collection == "social_planner_slots":
                legacy = any(spec.get("unique") and set(spec["key"]) == {
                    ("workspace_id", ASCENDING), ("account_id", ASCENDING), ("scheduled_at", ASCENDING)}
                    for spec in db[collection].index_information().values())
                if legacy:
                    logger.warning("Planner slot indexes require explicit app.core.planner_slot_migration with writers stopped; existing indexes retained")
                    continue
            db[collection].create_indexes(models)
        except OperationFailure as exc:
            logger.warning("Index creation failed on %s: %s", collection, exc)
    for collection in _ID_COLLECTIONS:
        try:
            _ensure_id_index(db, collection)
        except OperationFailure as exc:
            logger.warning("Id index creation failed on %s: %s", collection, exc)
    print("[db] MongoDB indexes ensured")
