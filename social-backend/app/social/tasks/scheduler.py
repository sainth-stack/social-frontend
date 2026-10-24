"""Celery beat: enqueue due scheduled social posts."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.core.database import get_database
from app.social.models import SocialPlatformPostStatus, SocialPostStatus
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.social.tasks.scheduler.enqueue_due_social_posts",
    queue="social_publish",
)
def enqueue_due_social_posts() -> dict:
    """Find scheduled posts past their ETA and enqueue publish_post."""
    from app.social.tasks.publish import publish_post

    db = get_database()
    enqueued = 0
    recovered = 0
    now = datetime.now(timezone.utc)
    due = list(
        db["social_posts"].find(
            {
                "status": SocialPostStatus.SCHEDULED.value,
                "scheduled_at": {"$ne": None, "$lte": now},
            }
        )
    )
    for post in due:
        if post.get("format") == "thread":
            db["social_posts"].update_one({"id": post["id"], "status": "scheduled"}, {"$set": {"status": "failed", "updated_at": now}})
            db["social_post_platforms"].update_many(
                {"post_id": post["id"], "status": {"$ne": "published"}},
                {"$set": {"status": "failed", "error_code": "INVALID_CONTENT", "error_message": "Threads are copy-only", "next_retry_at": None}},
            )
            continue
        claimed = db["social_posts"].update_one(
            {"id": post["id"], "status": "scheduled", "$or": [{"publish_enqueued_at": {"$exists": False}}, {"publish_enqueued_at": {"$lte": now - timedelta(minutes=15)}}]},
            {"$set": {"publish_enqueued_at": now}},
        )
        if not claimed.modified_count:
            continue
        try:
            publish_post.delay(str(post["id"]))
        except Exception:
            db["social_posts"].update_one({"id": post["id"], "publish_enqueued_at": now}, {"$unset": {"publish_enqueued_at": ""}})
            logger.warning("Could not enqueue social post %s", post["id"])
            continue
        enqueued += 1
        logger.info("Enqueued due social post %s", post["id"])

    stale_cutoff = now - timedelta(minutes=2)
    stuck = list(
        db["social_posts"].find({"status": SocialPostStatus.PUBLISHING.value})
    )
    for post in stuck:
        updated = post.get("updated_at")
        if updated is None:
            continue
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=timezone.utc)
        if updated > stale_cutoff:
            continue
        platforms = list(db["social_post_platforms"].find({"post_id": post["id"]}))
        if not platforms:
            continue
        for pp in platforms:
            if pp.get("status") != "publishing":
                continue
            started = pp.get("publish_claimed_at") or updated
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            if started > now - timedelta(minutes=15):
                continue
            from app.social.tasks.publish import claim_platform

            if pp.get("platform_post_id") or (pp.get("publish_state") or {}).get("platform_post_id"):
                claim_platform(db, pp)
            else:
                db["social_post_platforms"].update_one(
                    {"id": pp["id"], "status": "publishing", "publish_claim": pp.get("publish_claim")},
                    {"$set": {"status": "failed", "error_code": "AMBIGUOUS_PUBLISH", "error_message": "Publish worker claim expired; reconcile provider state before retrying", "next_retry_at": None, "publish_state.reconciliation_required": True}, "$unset": {"publish_claim": "", "publish_claimed_at": ""}},
                )
        platforms = list(db["social_post_platforms"].find({"post_id": post["id"]}))
        if any(
            pp.get("status") == SocialPlatformPostStatus.PUBLISHING.value for pp in platforms
        ):
            continue
        if any(pp.get("error_code") == "AMBIGUOUS_PUBLISH" for pp in platforms):
            status = "published" if any(pp.get("status") == "published" for pp in platforms) else "failed"
            db["social_posts"].update_one({"id": post["id"]}, {"$set": {"status": status, "updated_at": now}})
            continue
        if all(
            pp.get("status")
            in (
                SocialPlatformPostStatus.PUBLISHED.value,
                SocialPlatformPostStatus.SKIPPED.value,
            )
            for pp in platforms
        ):
            db["social_posts"].update_one({"id": post["id"]}, {"$set": {"status": "published" if any(pp.get("status") == "published" for pp in platforms) else "failed", "updated_at": now}})
            continue
        publish_post.delay(str(post["id"]))
        recovered += 1
        logger.info("Re-enqueued stuck publishing post %s", post["id"])

    return {"enqueued": enqueued, "recovered": recovered}
