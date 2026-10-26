from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4, uuid5, NAMESPACE_URL

from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.social.content_plan import ContentPlanService, DAY_FOCUS_ANGLES, _plan_cap, build_plan_day_topic
from app.social.models import SocialPermission
from app.social.permissions import require_permission
from app.social.planner_schemas import (
    CopyEdit, ImageAction, PlannerRun, PlannerSlot, RunCreate, RunItem, RunList,
    ScheduleOutcome, SchedulePreview, ScheduleResult,
)
from app.social.planner_slots import digest, iso, local_instant, preview_slots, slot_reasons
from app.social.schemas import CreateSocialPostRequest, GenerateCreativeSetRequest, SocialPostPlatformIn, UpdateSocialPostRequest
from app.social.service import SocialMediaService
from app.providers.llm.model_selection import ModelSelection, current_models, selected_models


def now():
    return datetime.now(timezone.utc)


class ContentPlanRuns:
    def __init__(self, db):
        self.db = db
        self.runs = db.social_content_plan_runs
        self.items = db.social_content_plan_items
        self.operations = db.social_planner_operations
        self.social = SocialMediaService(db)
        self.copy = ContentPlanService(db)

    def require(self, workspace, user, permission=SocialPermission.EDITOR):
        if workspace.get("is_active") is False:
            raise HTTPException(403, "Workspace is suspended")
        require_permission(self.db, workspace, user, permission)

    def load(self, workspace, run_id):
        run = self.runs.find_one({"id": run_id, "workspace_id": workspace["id"]})
        if not run:
            raise HTTPException(404, "Planner run not found")
        return run

    def item(self, workspace, run_id, item_id):
        self.load(workspace, run_id)
        item = self.items.find_one({"id": item_id, "run_id": run_id, "workspace_id": workspace["id"]})
        if not item:
            raise HTTPException(404, "Planner item not found")
        return item

    def post(self, workspace, item):
        post = self.db.social_posts.find_one({"id": item["post_id"], "workspace_id": workspace["id"]})
        if not post:
            raise HTTPException(409, "Planner draft is not available")
        return post

    def revision(self, post, expected):
        revision = self.copy.copy_fingerprint(post)
        if revision != expected:
            raise HTTPException(409, "Copy changed; reload the saved revision")
        return revision

    def ready_reasons(self, workspace, item, post):
        slot = PlannerSlot.model_validate(item["slot"])
        reasons = slot_reasons(self.db, workspace, slot, post_id=post["id"])
        if item["state"] != "created":
            reasons.append("generation_not_complete")
        if post.get("status") not in ("draft", "scheduled"):
            reasons.append("post_not_draft_or_scheduled")
        if post.get("planner_visual_lock_until") and iso(post["planner_visual_lock_until"]) > iso(now()):
            reasons.append("item_busy")
        try:
            rows = list(self.db.social_post_platforms.find({"post_id": post["id"]}))
            if len(rows) != 1 or rows[0].get("social_account_id") != slot.accountId or rows[0].get("platform") != slot.platform:
                reasons.append("slot_account_changed")
            self.social._validate_ready_to_publish_dict(post, rows, persist_accounts=False)
        except HTTPException as exc:
            reasons.append(str(exc.detail))
        return list(dict.fromkeys(reasons))

    def serialize_item(self, workspace, item):
        post = self.db.social_posts.find_one({"id": item["post_id"], "workspace_id": workspace["id"]})
        revision = self.copy.copy_fingerprint(post) if post else None
        approved = bool(post and post.get("planner_approved_fingerprint") == revision)
        visual_revision = post.get("planner_visual_fingerprint") if post else None
        visual_state = item.get("visual_state", "not_requested")
        if post and post.get("image_url") and visual_revision == revision and not post.get("planner_visual_pending"):
            visual_state = "ready"
        elif visual_revision and visual_revision != revision:
            visual_state = "stale"
        elif visual_state == "ready":
            visual_state = "stale"
        active_lock = bool(post and post.get("planner_visual_lock_until") and iso(post["planner_visual_lock_until"]) > iso(now()))
        if visual_state == "processing" and not active_lock:
            visual_state = "failed"
        text_state = item.get("text_state", "idle")
        if text_state == "processing" and not active_lock:
            text_state = "uncertain"
        reasons = self.ready_reasons(workspace, item, post) if post else ["draft_not_created"]
        image_operation = self.operations.find_one({"id": item.get("image_operation_id"), "workspace_id": workspace["id"]}) or {}
        return RunItem(
            id=item["id"], slot=PlannerSlot.model_validate(item["slot"]), generationState=item["state"],
            error=item.get("error"), postId=item["post_id"], post=self.social.get_post(post) if post else None,
            revision=revision, copyApproved=approved, approvedRevision=post.get("planner_approved_fingerprint") if post else None,
            approvedBy=post.get("planner_approved_by") if post else None, approvedAt=iso(post.get("planner_approved_at")) if post else None,
            visualState=visual_state, visualRevision=visual_revision, imageOperationId=item.get("image_operation_id"),
            imageRequestId=image_operation.get("request_id"), textState=text_state, textRequestId=item.get("text_request_id"),
            imageIntent=post.get("planner_image_intent", "required" if item["slot"]["platform"] == "instagram" else "optional") if post else "optional",
            proposedAt=item["slot"].get("proposedAt"), isScheduled=bool(post and post["status"] in ("scheduled", "publishing", "published")),
            canSchedule=not reasons, reasons=reasons, scheduleState=post.get("planner_dispatch_state") if post else None,
        )

    def get(self, workspace, run_id):
        run = self.load(workspace, run_id)
        return PlannerRun(
            id=run["id"], requestId=run["request_id"], status=run["status"], dispatchState=run["dispatch_state"],
            prompt=run["prompt"], timezone=run["timezone"], createdAt=iso(run["created_at"]), createdBy=run["created_by"],
            cancelled=bool(run.get("cancelled")),
            items=[self.serialize_item(workspace, item) for item in self.items.find({"run_id": run_id, "workspace_id": workspace["id"]}).sort("order", 1)],
        )

    def list(self, workspace, limit=20, offset=0):
        scope = {"workspace_id": workspace["id"]}
        rows = self.runs.find(scope).sort("created_at", -1).skip(offset).limit(limit)
        return RunList(total=self.runs.count_documents(scope), items=[self.get(workspace, row["id"]) for row in rows])

    def create(self, workspace, user, payload: RunCreate):
        self.require(workspace, user)
        scope = {"workspace_id": workspace["id"], "request_id": payload.requestId}
        request_hash = digest(payload.model_dump(exclude={"previewToken"}))
        existing = self.runs.find_one(scope)
        if existing:
            if existing["request_hash"] != request_hash:
                raise HTTPException(409, "requestId was used for a different plan")
            self.initialize_items(existing)
            self.dispatch(existing["id"])
            return self.get(workspace, existing["id"])
        preview = preview_slots(self.db, workspace, payload)
        if preview.previewToken != payload.previewToken:
            raise HTTPException(409, "Slot preview changed; review exact slots again")
        excluded = set(payload.excludedSlotIds)
        if not excluded.issubset({slot.slotId for slot in preview.slots}):
            raise HTTPException(422, "Unknown excluded slot")
        selected = [slot for slot in preview.slots if slot.slotId not in excluded]
        if not selected or any(slot.reasons for slot in selected):
            raise HTTPException(409, "Explicitly exclude blocked slots or correct their times/accounts")
        run = {**scope, "id": str(uuid4()), "request_hash": request_hash, "status": "queued", "dispatch_state": "pending",
               "prompt": payload.prompt, "tone": payload.tone, "timezone": payload.timezone, "created_at": now(),
               "created_by": user["id"], "cancelled": False, "slots": [slot.model_dump() for slot in preview.slots],
               "excluded": list(excluded), "brand": self.social._brand_voice_dict(workspace["id"]),
               "models": {"text": current_models().text, "image": current_models().image}}
        try:
            self.runs.insert_one(run)
        except DuplicateKeyError:
            return self.create(workspace, user, payload)
        self.initialize_items(run)
        self.dispatch(run["id"])
        return self.get(workspace, run["id"])

    def initialize_items(self, run):
        for index, slot in enumerate(run["slots"]):
            item_id = str(uuid5(NAMESPACE_URL, f"planner:{run['id']}:{slot['slotId']}"))
            self.items.update_one({"id": item_id}, {"$setOnInsert": {
                "id": item_id, "run_id": run["id"], "workspace_id": run["workspace_id"], "slot_id": slot["slotId"],
                "post_id": str(uuid5(NAMESPACE_URL, f"planner-post:{item_id}")), "order": index, "slot": slot,
                "state": "excluded" if slot["slotId"] in run["excluded"] else "pending",
            }}, upsert=True)

    def dispatch(self, run_id):
        from app.social.tasks.planner_runs import generate_planner_run

        run = self.runs.find_one({"id": run_id, "cancelled": False, "status": "queued"})
        if not run:
            return
        try:
            generate_planner_run.apply_async(args=[run_id], task_id=f"planner:{run_id}", queue="social_maintenance")
            state = "accepted"
        except Exception:
            state = "uncertain"
        self.runs.update_one({"id": run_id, "status": "queued"}, {"$set": {"dispatch_state": state, "dispatch_at": now()}})

    def cancel(self, workspace, user, run_id):
        self.require(workspace, user)
        self.load(workspace, run_id)
        self.runs.update_one({"id": run_id, "workspace_id": workspace["id"]}, {"$set": {"cancelled": True, "status": "cancelled"}})
        return self.get(workspace, run_id)

    def retry(self, workspace, user, run_id, item_ids):
        self.require(workspace, user)
        run = self.load(workspace, run_id)
        if run["status"] == "running" or run.get("claim"):
            raise HTTPException(409, "Generation is still running")
        for item_id in set(item_ids):
            item = self.item(workspace, run_id, item_id)
            if item["state"] not in ("failed", "pending", "checkpointed"):
                raise HTTPException(409, "Only failed, missing or checkpointed slots can retry; uncertain paid attempts require reconciliation")
        self.items.update_many({"run_id": run_id, "id": {"$in": item_ids}, "state": "failed"}, {"$set": {"state": "pending"}, "$unset": {"error": ""}})
        self.runs.update_one({"id": run_id}, {"$set": {"cancelled": False, "status": "queued", "dispatch_state": "pending", "retry_item_ids": list(dict.fromkeys(item_ids))}})
        self.dispatch(run_id)
        return self.get(workspace, run_id)

    def generate(self, run_id):
        token = str(uuid4())
        run = self.runs.find_one_and_update({"id": run_id, "status": "queued", "cancelled": False},
            {"$set": {"status": "running", "claim": token, "lease_until": now() + timedelta(minutes=30)}}, return_document=ReturnDocument.AFTER)
        if not run:
            return
        workspace = self.db.workspaces.find_one({"id": run["workspace_id"]})
        user = self.db.users.find_one({"id": run["created_by"]})
        try:
            if not workspace or not user:
                raise HTTPException(404, "Workspace or creator no longer exists")
            self.require(workspace, user)
            self.initialize_items(run)
            item_scope = {"run_id": run_id, "state": {"$in": ["pending", "checkpointed"]}}
            if run.get("retry_item_ids"):
                item_scope["id"] = {"$in": run["retry_item_ids"]}
            for item in self.items.find(item_scope).sort("order", 1):
                if not self.runs.find_one({"id": run_id, "claim": token, "status": "running", "cancelled": False}):
                    break
                self.runs.update_one({"id": run_id, "claim": token}, {"$set": {"lease_until": now() + timedelta(minutes=30)}})
                self.generate_item(workspace, user, run, item)
            if self.runs.find_one({"id": run_id, "claim": token, "cancelled": False}):
                partial = self.items.count_documents({"run_id": run_id, "state": {"$nin": ["created", "excluded"]}})
                self.runs.update_one({"id": run_id, "claim": token}, {"$set": {"status": "partial" if partial else "completed"}})
        except HTTPException:
            self.runs.update_one({"id": run_id, "claim": token, "cancelled": False}, {"$set": {"status": "failed"}})
        except Exception:
            self.runs.update_one({"id": run_id, "claim": token, "cancelled": False}, {"$set": {"status": "partial"}})
        finally:
            self.runs.update_one({"id": run_id, "claim": token}, {"$unset": {"claim": "", "lease_until": ""}})

    def generate_item(self, workspace, user, run, item):
        from app.plans.service import record_ai_usage
        from app.providers.llm.metering import metering_scope
        from app.social.ai.generator import generate_platform_content
        from app.social.limits import enforce_ai_text_limit, enforce_posts_limit

        token = str(uuid4())
        claim = self.items.find_one_and_update({"id": item["id"], "state": item["state"]},
            {"$set": {"state": "generating", "claim": token, "started_at": now()}}, return_document=ReturnDocument.AFTER)
        if not claim:
            return
        paid_started = False
        try:
            generated = claim.get("generated")
            if not generated:
                enforce_posts_limit(self.db, workspace)
                enforce_ai_text_limit(self.db, workspace)
                slot = PlannerSlot.model_validate(item["slot"])
                if slot_reasons(self.db, workspace, slot):
                    raise HTTPException(409, "Slot is no longer valid; correct before retrying")
                brand = run["brand"]
                topic = build_plan_day_topic(user_prompt=run["prompt"], brand_name=brand.get("brand_name") or workspace.get("name") or "our brand",
                    brand=brand, platform=SocialPostPlatformIn(platform=slot.platform).platform, day_index=item["order"] + 1,
                    total_days=len({entry["date"] for entry in run["slots"]}), audience=brand.get("target_audience"),
                    day_focus=DAY_FOCUS_ANGLES[item["order"] % len(DAY_FOCUS_ANGLES)], tone=run.get("tone") or "Professional", cta=None)
                paid_started = True
                with selected_models(ModelSelection(**run.get("models", {}))), metering_scope(self.db, workspace["id"], user["id"], "planner"):
                    result = generate_platform_content(topic=topic, tone=run.get("tone") or "Professional", platforms=[slot.platform],
                        audience=brand.get("target_audience"), cta=None, include_hashtags=True, include_comment=False, brand_voice=brand, content_series_mode=True)
                generated = result.get(slot.platform) or {}
                record_ai_usage(self.db, workspace["id"], "text", user_id=user["id"])
                if not (generated.get("caption") or "").strip():
                    self.items.update_one({"id": item["id"], "claim": token}, {"$set": {"state": "failed", "error": "empty_caption"}})
                    return
                checkpointed = self.items.update_one({"id": item["id"], "claim": token, "state": "generating"}, {"$set": {"generated": generated, "state": "checkpointed"}})
                if not checkpointed.modified_count:
                    return
            if not self.runs.find_one({"id": run["id"], "claim": run["claim"], "lease_until": {"$gt": now()}}):
                return
            if not self.items.find_one({"id": item["id"], "claim": token, "state": {"$in": ["generating", "checkpointed"]}}):
                return
            self.persist_draft(workspace, user, run, item, generated)
            self.items.update_one({"id": item["id"], "claim": token}, {"$set": {"state": "created"}, "$unset": {"error": ""}})
        except Exception as exc:
            checkpoint = self.items.find_one({"id": item["id"]}).get("generated")
            state = "checkpointed" if checkpoint else "uncertain" if paid_started else "failed"
            error = str(exc.detail) if isinstance(exc, HTTPException) else "Generation interrupted; paid attempt may have occurred. Reconcile before a new attempt." if state == "uncertain" else "Draft persistence failed; retry reuses saved copy."
            self.items.update_one({"id": item["id"], "claim": token}, {"$set": {"state": state, "error": error}})
        finally:
            self.items.update_one({"id": item["id"], "claim": token}, {"$unset": {"claim": ""}})

    def persist_draft(self, workspace, user, run, item, generated):
        slot = item["slot"]
        payload = CreateSocialPostRequest(title=f"Planner: {generated['caption'][:70]}", scheduledAt=slot["proposedAt"], aiPrompt=run["prompt"],
            platforms=[SocialPostPlatformIn(platform=slot["platform"], socialAccountId=slot["accountId"], caption=generated["caption"],
                hashtags=generated.get("hashtags") or [], firstComment=generated.get("firstComment") or generated.get("first_comment") or "")])
        metadata = {
            "planner_text_first": True, "planner_run_id": run["id"], "planner_item_id": item["id"], "planner_timezone": run["timezone"],
            "planner_image_intent": "required" if slot["platform"] == "instagram" else "optional"}
        self.social.create_post(workspace, user, payload, planner_post_id=item["post_id"], planner_metadata=metadata)

    def approve_copy(self, workspace, user, run_id, item_id, expected):
        self.require(workspace, user)
        item = self.item(workspace, run_id, item_id)
        with self.copy.edit_lock(self.post(workspace, item)) as post:
            revision = self.revision(post, expected)
            if post["status"] != "draft":
                raise HTTPException(409, "Only drafts can be approved")
            self.db.social_posts.update_one({"id": post["id"], "planner_visual_lock": post["planner_visual_lock"]}, {"$set": {
                "planner_approved_fingerprint": revision, "planner_approved_by": user["id"], "planner_approved_at": now()}})
        return self.serialize_item(workspace, self.item(workspace, run_id, item_id))

    def edit_copy(self, workspace, user, run_id, item_id, payload: CopyEdit):
        self.require(workspace, user)
        item = self.item(workspace, run_id, item_id)
        with self.copy.edit_lock(self.post(workspace, item)) as post:
            previous = self.revision(post, payload.expectedRevision)
            if post["status"] != "draft":
                raise HTTPException(409, "Only drafts can be edited")
            row = self.db.social_post_platforms.find_one({"post_id": post["id"]})
            self.social.update_post(post, workspace, UpdateSocialPostRequest(platforms=[SocialPostPlatformIn(
                platform=row["platform"], socialAccountId=row["social_account_id"], caption=payload.caption,
                hashtags=payload.hashtags, firstComment=payload.firstComment)]))
            self.copy.invalidate_changed_copy(post, previous)
        return self.serialize_item(workspace, self.item(workspace, run_id, item_id))

    def regenerate_text(self, workspace, user, run_id, item_id, payload):
        self.require(workspace, user)
        item = self.item(workspace, run_id, item_id)
        operation_id = digest([workspace["id"], item_id, "text", payload.requestId])
        old = self.operations.find_one({"id": operation_id})
        if old:
            if old["revision"] != payload.expectedRevision:
                raise HTTPException(409, "requestId revision mismatch")
            if old["state"] != "completed":
                raise HTTPException(409, "Text attempt is uncertain; it will not be automatically repeated")
            return self.serialize_item(workspace, item)
        with self.copy.edit_lock(self.post(workspace, item)) as post:
            previous = self.revision(post, payload.expectedRevision)
            if post["status"] != "draft":
                raise HTTPException(409, "Only drafts can regenerate text")
            try:
                self.operations.insert_one({"id": operation_id, "workspace_id": workspace["id"], "revision": previous, "state": "processing"})
            except DuplicateKeyError as exc:
                raise HTTPException(409, "Text operation already started") from exc
            self.items.update_one({"id": item_id}, {"$set": {"text_state": "processing", "text_request_id": payload.requestId}})
            from app.providers.llm.metering import metering_scope

            try:
                with metering_scope(self.db, workspace["id"], user["id"], "planner"):
                    self.social.regenerate_post_content(post, workspace, user, prompt=self.load(workspace, run_id)["prompt"],
                        regenerate_image=False, regenerate_caption=True, tone=None, cta=None)
                self.copy.invalidate_changed_copy(post, previous)
                self.operations.update_one({"id": operation_id}, {"$set": {"state": "completed"}})
                self.items.update_one({"id": item_id}, {"$set": {"text_state": "completed"}})
            except Exception:
                self.operations.update_one({"id": operation_id}, {"$set": {"state": "uncertain"}})
                self.items.update_one({"id": item_id}, {"$set": {"text_state": "uncertain"}})
                raise HTTPException(502, "Text generation interrupted; saved copy retained. Do not replay an uncertain paid attempt.")
        return self.serialize_item(workspace, self.item(workspace, run_id, item_id))

    def image(self, workspace, user, run_id, item_id, payload: ImageAction):
        self.require(workspace, user)
        item = self.item(workspace, run_id, item_id)
        operation_id = digest([workspace["id"], item_id, "image", payload.requestId])
        with self.copy.edit_lock(self.post(workspace, item)) as post:
            item = self.item(workspace, run_id, item_id)
            self.image_locked(workspace, user, run_id, item, post, operation_id, payload)
        return self.serialize_item(workspace, self.item(workspace, run_id, item_id))

    def image_locked(self, workspace, user, run_id, item, post, operation_id, payload):
        revision = self.revision(post, payload.expectedRevision)
        if post["status"] != "draft" or post.get("planner_approved_fingerprint") != revision:
            raise HTTPException(409, "Approve the current draft revision before generating an image")
        current_id = item.get("image_operation_id")
        operation = self.operations.find_one({"id": operation_id})
        if operation and (operation["revision"] != revision or (payload.mode != "retry" and operation["mode"] != payload.mode)):
            raise HTTPException(409, "Image requestId was used for different content or action")
        if payload.mode == "retry" and current_id != operation_id:
            raise HTTPException(409, "Retry must reuse the current image operation requestId")
        if payload.mode == "regenerate" and not operation and (not payload.creditsConfirmed or current_id == operation_id):
            raise HTTPException(422, "Regenerate requires a new requestId and creditsConfirmed=true")
        if payload.mode == "generate" and current_id and current_id != operation_id:
            raise HTTPException(409, "Use retry for the existing image operation or explicitly regenerate")
        if operation and operation["state"] == "completed":
            return
        if not operation:
            self.operations.insert_one({"id": operation_id, "workspace_id": workspace["id"], "revision": revision,
                "mode": payload.mode, "state": "processing", "request_id": payload.requestId,
                "models": {"text": current_models().text, "image": current_models().image}})
        self.items.update_one({"id": item["id"]}, {"$set": {"image_operation_id": operation_id, "visual_state": "processing"}})
        self.db.social_posts.update_one({"id": post["id"]}, {"$set": {"planner_image_intent": "required", "planner_visual_pending": True}})
        row = self.db.social_post_platforms.find_one({"post_id": post["id"]})
        operation = self.operations.find_one({"id": operation_id})
        if not operation.get("creative_request"):
            request = GenerateCreativeSetRequest(
                topic=self.load(workspace, run_id)["prompt"], brief=self.load(workspace, run_id)["prompt"], caption=row["caption"],
                platforms=[row["platform"]], platform=row["platform"], format="post", autoCopy=False, textOverlay=False,
                requestId=f"planner:{operation_id}")
            self.operations.update_one({"id": operation_id}, {"$set": {"creative_request": request.model_dump(mode="json")}})
        else:
            request = GenerateCreativeSetRequest.model_validate(operation["creative_request"])
        try:
            from app.providers.llm.metering import metering_scope

            with selected_models(ModelSelection(**operation.get("models", {}))), metering_scope(self.db, workspace["id"], user["id"], "planner"):
                result = self.social.generate_creative_set(workspace, user, request)
            if not result.items or result.status != "completed":
                raise HTTPException(502, "Creative set incomplete; retry with the same requestId to reuse saved artwork")
            asset = next((asset for asset in result.items if asset.platform.value == row["platform"]), None)
            if not asset:
                raise HTTPException(502, "Creative set has no matching platform export")
            self.revision(post, revision)
            saved = self.db.social_posts.update_one({"id": post["id"], "status": "draft", "planner_visual_lock": post["planner_visual_lock"], "planner_visual_lock_until": {"$gt": now()}, "planner_approved_fingerprint": revision},
                {"$set": {"image_url": asset.imageUrl, "image_source": "ai_generated", "planner_visual_fingerprint": revision, "planner_visual_pending": False}})
            if not saved.matched_count:
                raise HTTPException(409, "Post changed; generated asset remains in Media")
            self.operations.update_one({"id": operation_id}, {"$set": {"state": "completed", "creative_set_id": result.creativeSetId}})
            self.items.update_one({"id": item["id"]}, {"$set": {"visual_state": "ready"}, "$unset": {"error": ""}})
        except Exception as exc:
            self.operations.update_one({"id": operation_id}, {"$set": {"state": "failed"}})
            self.items.update_one({"id": item["id"]}, {"$set": {"visual_state": "failed", "error": "Image incomplete; retry the same requestId to reuse creative checkpoints"}})
            if isinstance(exc, HTTPException):
                raise
            raise HTTPException(502, "Image generation interrupted; retry the same requestId") from exc

    def attach_image(self, workspace, user, run_id, item_id, payload):
        self.require(workspace, user)
        item = self.item(workspace, run_id, item_id)
        with self.copy.edit_lock(self.post(workspace, item)) as post:
            revision = self.revision(post, payload.expectedRevision)
            if post["status"] != "draft" or post.get("planner_approved_fingerprint") != revision:
                raise HTTPException(409, "Approve the current draft before attaching an image")
            asset = self.db.social_media_assets.find_one({"id": payload.assetId, "workspace_id": workspace["id"], "media_type": "image", "is_deleted": {"$ne": True}})
            if not asset or not (asset.get("mime_type") or "").startswith("image/"):
                raise HTTPException(404, "Owned image asset not found")
            from app.social.media import refresh_blob_url, is_video_media_url

            if not asset.get("blob_key", "").startswith(f"social/{workspace['id']}/") or is_video_media_url(asset["blob_key"]):
                raise HTTPException(422, "Invalid workspace image asset")
            self.db.social_posts.update_one({"id": post["id"], "planner_visual_lock": post["planner_visual_lock"]}, {"$set": {
                "image_url": refresh_blob_url(asset["blob_key"]), "image_source": asset.get("source") or "uploaded",
                "planner_image_intent": "required", "planner_visual_fingerprint": revision, "planner_visual_pending": False}})
            self.items.update_one({"id": item_id}, {"$set": {"visual_state": "ready"}, "$unset": {"error": ""}})
        return self.serialize_item(workspace, self.item(workspace, run_id, item_id))

    def image_intent(self, workspace, user, run_id, item_id, payload):
        self.require(workspace, user)
        item = self.item(workspace, run_id, item_id)
        with self.copy.edit_lock(self.post(workspace, item)) as post:
            self.revision(post, payload.expectedRevision)
            if post["status"] != "draft" or (payload.intent == "text_only" and item["slot"]["platform"] == "instagram"):
                raise HTTPException(409, "Instagram requires an image; only draft image intent can change")
            updates = {"planner_image_intent": payload.intent}
            if payload.intent == "text_only":
                updates.update(image_url=None, image_source="none", planner_visual_pending=False)
            self.db.social_posts.update_one({"id": post["id"]}, {"$set": updates})
        return self.serialize_item(workspace, item)

    def edit_slot(self, workspace, user, run_id, item_id, payload):
        self.require(workspace, user)
        item = self.item(workspace, run_id, item_id)
        post = self.db.social_posts.find_one({"id": item["post_id"], "workspace_id": workspace["id"]})
        slot = PlannerSlot.model_validate(item["slot"])
        instant = local_instant(payload.date, payload.time, payload.timezone, payload.utcOffsetMinutes)
        slot.date, slot.time, slot.timezone, slot.proposedAt = payload.date, payload.time, payload.timezone, iso(instant)
        from zoneinfo import ZoneInfo

        slot.utcOffsetMinutes = int(instant.astimezone(ZoneInfo(payload.timezone)).utcoffset().total_seconds() // 60)
        slot.reasons = slot_reasons(self.db, workspace, slot, post_id=item["post_id"])
        if slot.reasons:
            raise HTTPException(409, slot.reasons)
        dates = {other["slot"]["date"] for other in self.items.find({"run_id": run_id, "id": {"$ne": item_id}, "state": {"$ne": "excluded"}})}
        if len(dates | {slot.date}) > _plan_cap(workspace):
            raise HTTPException(422, "Changing this slot would exceed the plan selected-date cap")
        if post:
            with self.copy.edit_lock(post) as fresh:
                if fresh["status"] != "draft":
                    raise HTTPException(409, "Only draft proposed slots can change")
                self.db.social_posts.update_one({"id": post["id"]}, {"$set": {"scheduled_at": instant, "planner_timezone": slot.timezone}})
                self.items.update_one({"id": item_id}, {"$set": {"slot": slot.model_dump()}})
        else:
            if self.load(workspace, run_id)["status"] in ("queued", "running"):
                raise HTTPException(409, "Wait for generation before changing this slot")
            self.items.update_one({"id": item_id}, {"$set": {"slot": slot.model_dump()}})
        return self.serialize_item(workspace, self.item(workspace, run_id, item_id))

    def schedule_outcome(self, workspace, item):
        dto = self.serialize_item(workspace, item)
        state = "blocked" if dto.reasons else "ready"
        if dto.isScheduled:
            state = "dispatch_pending" if dto.scheduleState != "accepted" else "already_scheduled"
        return ScheduleOutcome(itemId=item["id"], postId=item["post_id"], revision=dto.revision, proposedAt=dto.proposedAt,
            timezone=dto.slot.timezone, platform=dto.slot.platform, accountId=dto.slot.accountId, outcome=state, reasons=dto.reasons if state == "blocked" else [])

    def schedule_preview(self, workspace, user, run_id, item_ids):
        self.require(workspace, user)
        items = [self.item(workspace, run_id, item_id) for item_id in dict.fromkeys(item_ids)]
        outcomes = [self.schedule_outcome(workspace, item) for item in items]
        preview_id = str(uuid4())
        expires = now() + timedelta(minutes=10)
        self.operations.insert_one({"id": preview_id, "workspace_id": workspace["id"], "run_id": run_id, "kind": "schedule_preview",
            "expires_at": expires, "items": [outcome.model_dump() for outcome in outcomes]})
        return SchedulePreview(previewId=preview_id, expiresAt=iso(expires), items=outcomes)

    def confirm_schedule(self, workspace, user, run_id, payload):
        self.require(workspace, user, SocialPermission.PUBLISHER)
        self.load(workspace, run_id)
        operation_id = digest([workspace["id"], run_id, "schedule", payload.requestId])
        operation = self.operations.find_one({"id": operation_id})
        if operation and operation["preview_id"] != payload.previewId:
            raise HTTPException(409, "Scheduling requestId already used with a different preview")
        if operation and operation.get("result"):
            return ScheduleResult.model_validate(operation["result"])
        preview = self.operations.find_one({"id": payload.previewId, "workspace_id": workspace["id"], "run_id": run_id, "kind": "schedule_preview"})
        if not preview or (not operation and iso(preview["expires_at"]) < iso(now())):
            raise HTTPException(409, "Schedule preview expired; review exact slots again")
        if not operation:
            try:
                self.operations.insert_one({"id": operation_id, "workspace_id": workspace["id"], "preview_id": payload.previewId})
            except DuplicateKeyError:
                pass
        token = str(uuid4())
        claimed = self.operations.update_one({"id": operation_id, "result": {"$exists": False}, "$or": [
            {"lease_until": {"$exists": False}}, {"lease_until": {"$lte": now()}}]},
            {"$set": {"claim": token, "lease_until": now() + timedelta(minutes=2)}})
        if not claimed.modified_count:
            latest = self.operations.find_one({"id": operation_id})
            if latest.get("result"):
                return ScheduleResult.model_validate(latest["result"])
            raise HTTPException(409, "Schedule confirmation is processing; reload the run before retrying this requestId")
        outcomes = []
        for expected in preview["items"]:
            renewed = self.operations.update_one({"id": operation_id, "claim": token, "lease_until": {"$gt": now()}}, {"$set": {"lease_until": now() + timedelta(minutes=2)}})
            if not renewed.matched_count:
                raise HTTPException(409, "Schedule confirmation lease expired; reload before retrying this requestId")
            item = self.item(workspace, run_id, expected["itemId"])
            outcome = self.schedule_outcome(workspace, item)
            try:
                with self.copy.edit_lock(self.post(workspace, item)) as post:
                    item = self.item(workspace, run_id, expected["itemId"])
                    if post["status"] in ("scheduled", "publishing", "published"):
                        outcome.outcome = "already_scheduled" if post.get("planner_dispatch_state") == "accepted" else "dispatch_pending"
                    else:
                        if expected["outcome"] == "blocked":
                            raise HTTPException(409, "This item was blocked in the confirmed preview; preview again after fixing it")
                        self.revision(post, expected["revision"])
                        if item["slot"]["proposedAt"] != expected["proposedAt"] or item["slot"]["timezone"] != expected["timezone"]:
                            raise HTTPException(409, "Proposed slot changed; preview again")
                        candidate = {**post}
                        candidate.pop("planner_visual_lock_until", None)
                        reasons = self.ready_reasons(workspace, item, candidate)
                        if reasons:
                            raise HTTPException(409, reasons)
                        instant = datetime.fromisoformat(expected["proposedAt"])
                        try:
                            self.db.social_planner_slots.update_one({"workspace_id": workspace["id"], "account_id": item["slot"]["accountId"],
                                "scheduled_at": instant, "post_id": post["id"]}, {"$setOnInsert": {"created_at": now()}}, upsert=True)
                        except DuplicateKeyError as exc:
                            raise HTTPException(409, "Slot was reserved by another post; choose a different exact time") from exc
                        schedule_token = str(uuid4())
                        changed = self.db.social_posts.update_one({"id": post["id"], "status": "draft", "planner_visual_lock": post["planner_visual_lock"]},
                            {"$set": {"status": "scheduled", "scheduled_at": instant, "planner_schedule_token": schedule_token,
                                "planner_scheduled_revision": expected["revision"], "planner_dispatch_state": "pending", "updated_at": now()}})
                        if not changed.modified_count:
                            self.db.social_planner_slots.delete_many({"post_id": post["id"]})
                            raise HTTPException(409, "Post changed before scheduling")
                        self.db.social_post_platforms.update_many({"post_id": post["id"], "status": {"$ne": "published"}},
                            {"$set": {"status": "pending", "error_code": None, "error_message": None}})
                        outcome.outcome = "scheduled" if self.dispatch_schedule(post["id"]) else "dispatch_pending"
                        outcome.reasons = []
            except HTTPException as exc:
                outcome.outcome = "blocked"
                outcome.reasons = exc.detail if isinstance(exc.detail, list) else [str(exc.detail)]
            except Exception:
                outcome.outcome, outcome.reasons = "failed", ["Scheduling interrupted; reload before retrying"]
            outcomes.append(outcome)
        result = ScheduleResult(requestId=payload.requestId, items=outcomes)
        self.operations.update_one({"id": operation_id, "claim": token}, {"$set": {"result": result.model_dump()}, "$unset": {"claim": "", "lease_until": ""}})
        return result

    def dispatch_schedule(self, post_id):
        from app.social.tasks.publish import publish_post

        post = self.db.social_posts.find_one({"id": post_id, "status": "scheduled"})
        if not post:
            return False
        try:
            publish_post.apply_async(args=[post_id, post["planner_schedule_token"]], eta=post["scheduled_at"], queue="social_publish")
            state = "accepted"
        except Exception:
            state = "uncertain"
        self.db.social_posts.update_one({"id": post_id, "planner_schedule_token": post["planner_schedule_token"]},
            {"$set": {"planner_dispatch_state": state, "planner_dispatch_at": now()}})
        return state == "accepted"

    def retry_schedule(self, workspace, user, run_id, payload):
        self.require(workspace, user, SocialPermission.PUBLISHER)
        self.load(workspace, run_id)
        operation_id = digest([workspace["id"], run_id, "retry_schedule", payload.requestId])
        old = self.operations.find_one({"id": operation_id})
        if old and old["item_ids"] != payload.itemIds:
            raise HTTPException(409, "requestId used for different scheduling items")
        if old and old.get("result"):
            return ScheduleResult.model_validate(old["result"])
        if not old:
            try:
                self.operations.insert_one({"id": operation_id, "workspace_id": workspace["id"], "item_ids": payload.itemIds})
            except DuplicateKeyError:
                return self.retry_schedule(workspace, user, run_id, payload)
        token = str(uuid4())
        claimed = self.operations.update_one({"id": operation_id, "result": {"$exists": False}, "$or": [
            {"lease_until": {"$exists": False}}, {"lease_until": {"$lte": now()}}]},
            {"$set": {"claim": token, "lease_until": now() + timedelta(minutes=2)}})
        if not claimed.modified_count:
            latest = self.operations.find_one({"id": operation_id})
            if latest.get("result"):
                return ScheduleResult.model_validate(latest["result"])
            raise HTTPException(409, "Dispatch retry is processing; reload before retrying this requestId")
        outcomes = []
        for item_id in dict.fromkeys(payload.itemIds):
            renewed = self.operations.update_one({"id": operation_id, "claim": token, "lease_until": {"$gt": now()}},
                {"$set": {"lease_until": now() + timedelta(minutes=2)}})
            if not renewed.matched_count:
                raise HTTPException(409, "Dispatch retry lease expired; reload before retrying this requestId")
            item = self.item(workspace, run_id, item_id)
            outcome = self.schedule_outcome(workspace, item)
            try:
                with self.copy.edit_lock(self.post(workspace, item)) as post:
                    if post["status"] != "scheduled" or not post.get("planner_schedule_token"):
                        outcome.outcome, outcome.reasons = "blocked", ["Only a previously confirmed scheduled item can retry dispatch"]
                    elif post.get("planner_dispatch_state") == "accepted":
                        outcome.outcome, outcome.reasons = "already_scheduled", []
                    else:
                        outcome.outcome = "scheduled" if self.dispatch_schedule(post["id"]) else "dispatch_pending"
                        outcome.reasons = []
            except HTTPException as exc:
                outcome.outcome = "blocked"
                outcome.reasons = exc.detail if isinstance(exc.detail, list) else [str(exc.detail)]
            except Exception:
                outcome.outcome, outcome.reasons = "failed", ["Dispatch retry interrupted; reload before retrying"]
            outcomes.append(outcome)
        result = ScheduleResult(requestId=payload.requestId, items=outcomes)
        self.operations.update_one({"id": operation_id, "claim": token},
            {"$set": {"result": result.model_dump()}, "$unset": {"claim": "", "lease_until": ""}})
        return result

    def recover(self):
        cutoff = now() - timedelta(minutes=30)
        for reservation in self.db.social_planner_slots.find({"created_at": {"$lte": now() - timedelta(minutes=5)}}):
            post = self.db.social_posts.find_one({"id": reservation["post_id"]})
            active_lock = bool(post and post.get("planner_visual_lock_until") and iso(post["planner_visual_lock_until"]) > iso(now()))
            if not post or post.get("status") == "archived" or (post.get("status") == "draft" and not active_lock):
                self.db.social_planner_slots.delete_one({"_id": reservation["_id"]})
        for run in self.runs.find({"status": {"$in": ["running", "cancelled", "recovering"]}, "lease_until": {"$lte": now()}}):
            claimed = self.runs.update_one({"id": run["id"], "status": run["status"], "claim": run.get("claim"), "lease_until": run["lease_until"]}, {"$set": {"status": "recovering"}})
            if not claimed.modified_count and run["status"] != "recovering":
                continue
            for item in self.items.find({"run_id": run["id"], "$or": [{"claim": {"$exists": True}}, {"state": "generating"}]}):
                state = "checkpointed" if item.get("generated") else "uncertain"
                self.items.update_one({"id": item["id"], "state": item["state"], "claim": item.get("claim")}, {"$set": {"state": state, "error": "Worker lease expired; uncertain paid attempts are not automatically replayed"}, "$unset": {"claim": ""}})
            self.runs.update_one({"id": run["id"], "claim": run.get("claim")}, {"$set": {"status": "cancelled" if run.get("cancelled") else "partial"}, "$unset": {"claim": "", "lease_until": ""}})
        for run in self.runs.find({"status": "queued", "cancelled": False, "$or": [{"dispatch_at": {"$exists": False}}, {"dispatch_at": {"$lte": cutoff}}, {"dispatch_state": {"$in": ["pending", "uncertain"]}}]}):
            self.initialize_items(run)
            self.dispatch(run["id"])
        for post in self.db.social_posts.find({"planner_schedule_token": {"$exists": True}, "status": "scheduled", "planner_dispatch_state": {"$ne": "accepted"}}):
            self.dispatch_schedule(post["id"])