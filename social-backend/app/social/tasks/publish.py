"""Celery task: publish a social post to connected platforms."""

from __future__ import annotations

import logging
import hashlib
import json
from uuid import uuid4
from datetime import datetime, timedelta, timezone

from pymongo import ReturnDocument

from app.core.database import get_database
from app.core.encryption import decrypt
from app.core.mongo_utils import utcnow
from app.social.models import (
    SocialPlatform,
    SocialPlatformPostStatus,
    SocialPostStatus,
)
from app.social.publishers.base import (
    MAX_RETRIES,
    BasePublisher,
    PublishResult,
    ambiguous_publish,
    get_publisher,
    is_retryable_error,
)
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)

PUBLISHABLE = {
    SocialPlatform.FACEBOOK,
    SocialPlatform.INSTAGRAM,
    SocialPlatform.LINKEDIN,
    SocialPlatform.X,
}


def resolve_platform_media(db, post: dict, pp: dict) -> dict:
    from app.social.media import ensure_public_image_url, refresh_blob_url, relative_storage_key

    fmt = post.get("format") or "single"
    if fmt == "thread":
        raise ValueError("Threads are copy-only and cannot be scheduled or published")
    media = pp.get("media") or []
    if fmt == "carousel":
        slides = [slide.get("id") for slide in post.get("slides") or []]
        if pp.get("platform") not in ("instagram", "facebook", "linkedin"):
            raise ValueError("Carousel publishing is not supported for this platform")
        if not 2 <= len(media) <= 8 or len(media) != len(slides):
            raise ValueError("Carousel requires 2–8 complete platform images; no cover-image fallback")
        if len(set(slides)) != len(slides) or not all(slides) or [item.get("slideId") for item in media] != slides:
            raise ValueError("Carousel media must match stable slide IDs in order")
        sizes = {(item.get("width"), item.get("height")) for item in media if item.get("width") and item.get("height")}
        if len(sizes) > 1:
            raise ValueError("Carousel image dimensions must match")
    elif len(media) > 1:
        raise ValueError("Multiple images require carousel format")
    if not media:
        image_url = post.get("image_url")
        return {"image_url": ensure_public_image_url(post["workspace_id"], image_url) if image_url else None}
    urls = []
    for item in media:
        workspace_id = str(post["workspace_id"])
        key = item.get("blobKey") or relative_storage_key(item.get("url"))
        query = {"workspace_id": workspace_id, "is_deleted": {"$ne": True}}
        if item.get("assetId"):
            query["id"] = item["assetId"]
        elif key:
            query["blob_key"] = key
        else:
            raise ValueError("Platform media must reference an owned image asset")
        asset = db["social_media_assets"].find_one(query)
        if not asset or asset.get("media_type") != "image":
            raise ValueError("Platform image asset not found in this workspace")
        asset_key = asset.get("blob_key")
        if not asset_key or not asset_key.startswith(f"social/{workspace_id}/") or key and key != asset_key:
            raise ValueError("Platform image storage ownership mismatch")
        if (item.get("mimeType") or "image/").split("/", 1)[0] != "image":
            raise ValueError("Platform media must be images")
        url = refresh_blob_url(asset_key)
        if not url:
            raise ValueError("Could not refresh platform image URL")
        urls.append(url)
    return {"image_url": urls[0] if len(urls) == 1 else None, "image_urls": urls}


def claim_platform(db, pp: dict) -> dict | None:
    state = pp.get("publish_state") or {}
    known_id = pp.get("platform_post_id") or state.get("platform_post_id")
    if known_id:
        db["social_post_platforms"].update_one(
            {"id": pp["id"]},
            {"$set": {"status": "published", "platform_post_id": known_id, "published_at": pp.get("published_at") or utcnow(), "next_retry_at": None, "error_code": None, "error_message": None}, "$unset": {"publish_claim": "", "publish_claimed_at": ""}},
        )
        return None
    if state.get("submission_started") or state.get("reconciliation_required") or pp.get("error_code") == "AMBIGUOUS_PUBLISH":
        db["social_post_platforms"].update_one(
            {"id": pp["id"], "status": {"$nin": ["published", "skipped", "publishing"]}},
            {"$set": {"status": "failed", "error_code": "AMBIGUOUS_PUBLISH", "error_message": "Provider state must be reconciled before retrying", "next_retry_at": None, "publish_state.reconciliation_required": True}},
        )
        return None
    return db["social_post_platforms"].find_one_and_update(
        {"id": pp["id"], "status": {"$nin": ["published", "skipped", "publishing"]}, "publish_claim": {"$exists": False}, "publish_state.submission_started": {"$ne": True}, "publish_state.reconciliation_required": {"$ne": True}, "error_code": {"$ne": "AMBIGUOUS_PUBLISH"}},
        {"$set": {"status": "publishing", "publish_claim": uuid4().hex, "publish_claimed_at": utcnow(), "next_retry_at": None}},
        return_document=ReturnDocument.AFTER,
    )


def invoke_publisher(db, post: dict, pp: dict, publisher, token: str, account: dict) -> PublishResult:
    def save(state):
        updated = db["social_post_platforms"].update_one(
            {"id": pp["id"], "publish_claim": pp["publish_claim"]},
            {"$set": {"publish_state": state}},
        )
        if not updated.matched_count:
            raise RuntimeError("Publish claim lost")

    if isinstance(publisher, BasePublisher):
        from app.social.media import relative_storage_key

        state = pp.get("publish_state") or {}
        payload = hashlib.sha256(json.dumps({
            "account": account["platform_account_id"], "format": post.get("format") or "single",
            "caption": pp.get("caption"), "hashtags": pp.get("hashtags"), "first_comment": pp.get("first_comment"),
            "media": [{"assetId": item.get("assetId"), "blobKey": item.get("blobKey") or relative_storage_key(item.get("url")), "slideId": item.get("slideId")} for item in pp.get("media") or []],
        }, sort_keys=True).encode()).hexdigest()
        if state.get("payload") and state["payload"] != payload:
            state = {}
        publisher.set_publish_context(state, save)
        publisher.checkpoint(payload=payload)
    try:
        media_kwargs = resolve_platform_media(db, post, pp)
    except ValueError as exc:
        return PublishResult(success=False, error_code="INVALID_CONTENT", error_message=str(exc))
    except Exception:
        return PublishResult(success=False, error_code="API_ERROR", error_message="Could not refresh platform media", retryable=True)
    try:
        result = publisher.publish(
            platform_account_id=account["platform_account_id"], access_token=token,
            caption=pp.get("caption") or "", hashtags=list(pp.get("hashtags") or []),
            first_comment=pp.get("first_comment"), **media_kwargs,
        )
    except Exception:
        return ambiguous_publish()
    if isinstance(publisher, BasePublisher) and not result.success and publisher.publish_state().get("submission_started"):
        return ambiguous_publish()
    if result.success and not result.platform_post_id:
        return ambiguous_publish()
    return result


@celery_app.task(
    bind=True,
    name="app.social.tasks.publish.publish_post",
    max_retries=0,
    queue="social_publish",
)
def publish_post(self, post_id: str, schedule_token: str | None = None) -> dict:
    """Publish a social post to all platform rows."""
    db = get_database()

    post = db["social_posts"].find_one({"id": str(post_id)})
    if not post:
        logger.warning("publish_post: post %s not found", post_id)
        return {"ok": False, "reason": "not_found"}

    if post.get("status") in (SocialPostStatus.PUBLISHED.value, SocialPostStatus.ARCHIVED.value):
        return {"ok": True, "reason": "already_done"}

    if post.get("planner_text_first"):
        if (post.get("planner_run_id") or schedule_token is not None) and (not schedule_token or post.get("planner_schedule_token") != schedule_token):
            return {"ok": False, "reason": "stale_schedule"}
        scheduled = post.get("scheduled_at")
        if post.get("status") not in ("scheduled", "publishing") or not scheduled:
            return {"ok": False, "reason": "cancelled_schedule"}
        if scheduled.replace(tzinfo=scheduled.tzinfo or timezone.utc) > datetime.now(timezone.utc):
            return {"ok": False, "reason": "not_due"}
        from app.social.service import SocialMediaService
        from app.social.content_plan import ContentPlanService
        from fastapi import HTTPException

        try:
            if post.get("planner_run_id"):
                workspace = db["workspaces"].find_one({"id": post["workspace_id"]})
                if not workspace or workspace.get("is_active") is False:
                    raise HTTPException(403, "Workspace is unavailable")
                if not post.get("planner_scheduled_revision"):
                    raise HTTPException(409, "Planner schedule confirmation is missing")
            if post.get("planner_scheduled_revision") and ContentPlanService(db).copy_fingerprint(post) != post["planner_scheduled_revision"]:
                raise HTTPException(409, "Scheduled copy revision changed")
            SocialMediaService(db)._validate_ready_to_publish_dict(post, list(db["social_post_platforms"].find({"post_id": post_id})), persist_accounts=False)
        except HTTPException:
            db["social_posts"].update_one({"id": post_id, "status": "scheduled", "scheduled_at": post["scheduled_at"]}, {"$set": {"status": "failed", "planner_dispatch_state": "blocked", "updated_at": utcnow()}})
            return {"ok": False, "reason": "planner_not_ready"}

    if post.get("format") == "thread":
        db["social_posts"].update_one({"id": post_id}, {"$set": {"status": "failed", "updated_at": utcnow()}})
        db["social_post_platforms"].update_many(
            {"post_id": post_id, "status": {"$ne": "published"}},
            {"$set": {"status": "failed", "error_code": "INVALID_CONTENT", "error_message": "Threads are copy-only", "next_retry_at": None}},
        )
        return {"ok": False, "reason": "copy_only_thread"}

    if post.get("status") == SocialPostStatus.PUBLISHING.value:
        platforms_snapshot = list(db["social_post_platforms"].find({"post_id": post_id}))
        any_platform_active = any(
            pp.get("status") == SocialPlatformPostStatus.PUBLISHING.value
            for pp in platforms_snapshot
        )
        updated = post.get("updated_at")
        if updated and any_platform_active:
            if updated.tzinfo is None:
                updated = updated.replace(tzinfo=timezone.utc)
            age = datetime.now(timezone.utc) - updated
            if age < timedelta(minutes=15):
                logger.info("publish_post: post %s already publishing", post_id)
                return {"ok": True, "reason": "already_publishing"}

    claim_scope = {"id": post_id}
    if post.get("planner_text_first"):
        claim_scope.update(status=post["status"], scheduled_at=post["scheduled_at"], updated_at=post.get("updated_at"))
        claim_scope["planner_schedule_token"] = post.get("planner_schedule_token")
        claim_scope["$or"] = [{"planner_visual_lock_until": {"$exists": False}}, {"planner_visual_lock_until": {"$lte": utcnow()}}]
    claimed = db["social_posts"].update_one(
        claim_scope, {"$set": {"status": SocialPostStatus.PUBLISHING.value, "updated_at": utcnow()}}
    )
    if post.get("planner_text_first") and not claimed.modified_count:
        return {"ok": False, "reason": "post_changed_or_busy"}
    platforms = list(db["social_post_platforms"].find({"post_id": post_id}))

    now = datetime.now(timezone.utc)
    any_success = False
    any_failure = False

    for pp in platforms:
        # Re-fetch latest status
        pp = db["social_post_platforms"].find_one({"id": pp["id"]})
        if pp.get("status") == SocialPlatformPostStatus.PUBLISHED.value:
            any_success = True
            continue
        if pp.get("platform_post_id") or (pp.get("publish_state") or {}).get("platform_post_id"):
            claim_platform(db, pp)
            any_success = True
            continue
        if pp.get("status") in ("skipped", "publishing"):
            continue

        platform_str = pp.get("platform", "")
        try:
            platform_enum = SocialPlatform(platform_str)
        except ValueError:
            db["social_post_platforms"].update_one(
                {"id": pp["id"]},
                {"$set": {
                    "status": SocialPlatformPostStatus.SKIPPED.value,
                    "error_code": "UNSUPPORTED_PLATFORM",
                    "error_message": f"{platform_str} publishing is not available yet",
                }},
            )
            continue

        if platform_enum not in PUBLISHABLE:
            db["social_post_platforms"].update_one(
                {"id": pp["id"]},
                {"$set": {
                    "status": SocialPlatformPostStatus.SKIPPED.value,
                    "error_code": "UNSUPPORTED_PLATFORM",
                    "error_message": f"{platform_str} publishing is not available yet",
                }},
            )
            continue

        account = db["social_accounts"].find_one({"id": pp.get("social_account_id")})
        if not account or not account.get("is_active") or not account.get("access_token_enc"):
            db["social_post_platforms"].update_one(
                {"id": pp["id"]},
                {"$set": {
                    "status": SocialPlatformPostStatus.FAILED.value,
                    "error_code": "ACCOUNT_NOT_FOUND",
                    "error_message": "No connected account for this platform",
                }},
            )
            any_failure = True
            continue

        token_expires = account.get("token_expires_at")
        if token_expires:
            if token_expires.tzinfo is None:
                token_expires = token_expires.replace(tzinfo=timezone.utc)
            if token_expires <= now:
                db["social_post_platforms"].update_one(
                    {"id": pp["id"]},
                    {"$set": {
                        "status": SocialPlatformPostStatus.FAILED.value,
                        "error_code": "TOKEN_EXPIRED",
                        "error_message": "Account token expired — reconnect the account",
                    }},
                )
                any_failure = True
                continue

        claimed = claim_platform(db, pp)
        if not claimed:
            latest = db["social_post_platforms"].find_one({"id": pp["id"]})
            any_success = any_success or latest.get("status") == "published"
            continue
        pp = claimed
        try:
            token = decrypt(account["access_token_enc"])
            publisher = get_publisher(platform_enum)
            result = invoke_publisher(db, post, pp, publisher, token, account)
        except ValueError as exc:
            result = PublishResult(
                success=False, error_code="UNSUPPORTED_PLATFORM", error_message=str(exc)
            )
        except Exception:
            result = ambiguous_publish()

        if result.success:
            db["social_post_platforms"].update_one(
                {"id": pp["id"]},
                {"$set": {
                    "status": SocialPlatformPostStatus.PUBLISHED.value,
                    "platform_post_id": result.platform_post_id,
                    "published_at": now,
                    "error_code": None,
                    "error_message": None,
                    "next_retry_at": None,
                }, "$unset": {"publish_claim": "", "publish_claimed_at": ""}},
            )
            any_success = True
        else:
            if result.error_code == "AMBIGUOUS_PUBLISH":
                db["social_post_platforms"].update_one({"id": pp["id"]}, {"$set": {"publish_state.reconciliation_required": True}})
            db["social_post_platforms"].update_one(
                {"id": pp["id"]},
                {"$set": {
                    "status": SocialPlatformPostStatus.FAILED.value,
                    "error_code": result.error_code or "API_ERROR",
                    "error_message": result.error_message or "Publish failed",
                    "next_retry_at": None,
                }, "$unset": {"publish_claim": "", "publish_claimed_at": ""}},
            )
            any_failure = True
            pp = db["social_post_platforms"].find_one({"id": pp["id"]})
            if (
                is_retryable_error(pp.get("error_code"), result.retryable)
                and (pp.get("retry_count") or 0) < MAX_RETRIES
            ):
                from app.social.tasks.retry import schedule_platform_retry
                schedule_platform_retry(pp, db)

    active = db["social_post_platforms"].count_documents({"post_id": post_id, "status": "publishing"})
    if active:
        db["social_posts"].update_one({"id": post_id}, {"$set": {"status": "publishing", "updated_at": utcnow()}})
    elif any_success:
        final_status = SocialPostStatus.PUBLISHED.value
        db["social_posts"].update_one(
            {"id": post_id},
            {"$set": {"status": final_status, "published_at": now, "updated_at": utcnow()}},
        )
    elif any_failure:
        db["social_posts"].update_one(
            {"id": post_id},
            {"$set": {"status": SocialPostStatus.FAILED.value, "updated_at": utcnow()}},
        )
    else:
        db["social_posts"].update_one(
            {"id": post_id},
            {"$set": {"status": SocialPostStatus.FAILED.value, "updated_at": utcnow()}},
        )

    post = db["social_posts"].find_one({"id": post_id})

    from app.social.audit import write_social_audit
    write_social_audit(
        db,
        workspace_id=post["workspace_id"],
        action=f"post.{post.get('status')}",
        entity_id=post_id,
        metadata={"post_id": post_id},
    )

    logger.info(
        "publish_post complete post_id=%s status=%s", post_id, post.get("status")
    )
    return {"ok": True, "status": post.get("status")}
