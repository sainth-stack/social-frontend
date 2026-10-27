from datetime import timedelta
from uuid import uuid4

from fastapi import HTTPException
from pymongo import ReturnDocument

from app.providers.llm.model_selection import current_models
from app.social.ai.image_progress import image_progress
from app.social.planner_schemas import ImageAction
from app.social.planner_slots import digest, iso


def clock():
    from app.social.content_plan_runs import now

    return now()


def validate_binding(operation, payload, revision):
    direction = (payload.imageDirection or "").strip()
    if operation and (operation["revision"] != revision
            or (payload.mode != "retry" and operation["mode"] != payload.mode)
            or (direction != operation.get("image_direction", "") and (direction or payload.mode != "retry"))):
        raise HTTPException(409, "Image requestId was used for different content or action")


def start(service, workspace, user, run_id, item_id, payload):
    service.require(workspace, user)
    item = service.item(workspace, run_id, item_id)
    operation_id = digest([workspace["id"], item_id, "image", payload.requestId])
    existing = service.operations.find_one({"id": operation_id, "workspace_id": workspace["id"]})
    if existing:
        validate_binding(existing, payload, payload.expectedRevision)
        existing = reconcile(service, existing)
        if existing["state"] in ("queued", "processing", "completed") or (existing["state"] == "failed" and payload.mode != "retry"):
            if item.get("image_operation_id") != operation_id:
                raise HTTPException(409, "Image operation was replaced; reload the current item")
            return service.serialize_item(workspace, item)
    dispatch = False
    with service.copy.edit_lock(service.post(workspace, item)) as post:
        item = service.item(workspace, run_id, item_id)
        revision = service.revision(post, payload.expectedRevision)
        if post["status"] != "draft" or post.get("planner_approved_fingerprint") != revision:
            raise HTTPException(409, "Approve the current draft revision before generating an image")
        operation = service.operations.find_one({"id": operation_id, "workspace_id": workspace["id"]})
        validate_binding(operation, payload, revision)
        current_id = item.get("image_operation_id")
        if payload.mode == "retry" and (not operation or current_id != operation_id):
            raise HTTPException(409, "Retry must reuse the current image operation requestId")
        if current_id and current_id != operation_id:
            current = service.operations.find_one({"id": current_id}) or {}
            if current.get("state") in ("queued", "processing"):
                raise HTTPException(409, "An image operation is already active")
            if payload.mode != "regenerate":
                raise HTTPException(409, "Use retry or explicitly regenerate with a new requestId")
        if not operation:
            if payload.mode == "regenerate" and not payload.creditsConfirmed:
                raise HTTPException(422, "Regenerate requires a new requestId and creditsConfirmed=true")
            operation = {"id": operation_id, "kind": "image", "async": True,
                "workspace_id": workspace["id"], "run_id": run_id, "item_id": item_id,
                "created_by": user["id"], "revision": revision, "mode": payload.mode,
                "request_id": payload.requestId, "image_direction": (payload.imageDirection or "").strip(),
                "models": {"text": current_models().text, "image": current_models().image},
                "payload": payload.model_dump(mode="json"), "created_at": clock(), "state": "pending"}
            service.operations.insert_one(operation)
            dispatch = True
        elif operation["state"] == "pending":
            dispatch = True
        elif payload.mode == "retry" and operation["state"] == "failed":
            if not operation.get("retryable", True):
                raise HTTPException(409, operation.get("error") or "New artwork requires explicit regeneration consent")
            dispatch = True
        if dispatch:
            generation = str(uuid4())
            service.operations.update_one({"id": operation_id}, {"$set": {
                "kind": "image", "async": True, "run_id": run_id, "item_id": item_id, "created_by": operation.get("created_by", user["id"]),
                "payload": operation.get("payload") or payload.model_dump(mode="json"),
                "state": "queued", "stage": "queued", "generation": generation,
                "updated_at": clock(), "expires_at": clock() + timedelta(minutes=5), "retryable": False},
                "$unset": {"error": "", "claim": ""}})
            service.items.update_one({"id": item_id}, {"$set": {"image_operation_id": operation_id, "visual_state": "processing"}})
            service.db.social_posts.update_one({"id": post["id"], "planner_visual_lock": post["planner_visual_lock"]},
                {"$set": {"planner_image_intent": "required", "planner_visual_pending": True}})
    if dispatch:
        from app.social.tasks.planner_runs import generate_planner_image

        try:
            generate_planner_image.apply_async(args=[operation_id, generation],
                task_id=f"planner-image:{operation_id}:{generation}", queue="social_maintenance")
        except Exception:
            fail(service, operation_id, {"state": "queued", "generation": generation}, "IMAGE_QUEUE_UNAVAILABLE", "queued",
                "Image queue unavailable; retry the same requestId. No new artwork was requested.", True)
    return service.serialize_item(workspace, service.item(workspace, run_id, item_id))


def fail(service, operation_id, fence, code, stage, message, retryable):
    result = service.operations.update_one({"id": operation_id, **fence}, {"$set": {
        "state": "failed", "stage": "failed", "error": {"code": code, "stage": stage, "message": message},
        "retryable": retryable, "updated_at": clock()}, "$unset": {"claim": ""}})
    return bool(result.matched_count)


def reconcile(service, operation):
    if operation.get("async") and operation.get("state") in ("queued", "processing") and iso(operation["expires_at"]) <= iso(clock()):
        queued = operation["state"] == "queued"
        fail(service, operation["id"], {"state": operation["state"], "generation": operation["generation"],
            "expires_at": operation["expires_at"]}, "IMAGE_QUEUE_EXPIRED" if queued else "IMAGE_LEASE_EXPIRED",
            operation.get("stage", "queued"),
            "Image operation expired; retry the same requestId to inspect saved checkpoints. Uncertain provider attempts are not repeated.", True)
        return service.operations.find_one({"id": operation["id"]})
    return operation


def recover(service):
    for operation in service.operations.find({"kind": "image", "async": True, "state": {"$in": ["queued", "processing"]}, "expires_at": {"$lte": clock()}}):
        reconcile(service, operation)


def execute(service, operation_id, generation):
    token = str(uuid4())
    operation = service.operations.find_one_and_update({"id": operation_id, "async": True, "generation": generation,
        "state": "queued", "expires_at": {"$gt": clock()}}, {"$set": {"state": "processing", "claim": token,
        "updated_at": clock(), "expires_at": clock() + timedelta(minutes=30)}}, return_document=ReturnDocument.AFTER)
    if not operation:
        return
    fence = {"state": "processing", "claim": token, "generation": generation}

    def progress(stage):
        saved = service.operations.update_one({"id": operation_id, **fence, "expires_at": {"$gt": clock()}},
            {"$set": {"stage": stage, "updated_at": clock(), "expires_at": clock() + timedelta(minutes=30)}})
        if not saved.matched_count:
            raise HTTPException(409, {"code": "IMAGE_CLAIM_LOST", "stage": stage,
                "message": "Image operation expired or was replaced; saved artwork remains in Media"})

    try:
        workspace = service.db.workspaces.find_one({"id": operation["workspace_id"]})
        user = service.db.users.find_one({"id": operation["created_by"]})
        if not workspace or not user:
            raise HTTPException(404, "Workspace or creator no longer exists")
        service.require(workspace, user)
        if service.load(workspace, operation["run_id"]).get("cancelled"):
            raise HTTPException(409, "Planner run was cancelled")
        item = service.item(workspace, operation["run_id"], operation["item_id"])
        if item.get("image_operation_id") != operation_id:
            raise HTTPException(409, "Image operation was replaced")
        with service.copy.edit_lock(service.post(workspace, item)) as post:
            if not post.get("planner_visual_pending") or post.get("planner_image_intent") != "required":
                raise HTTPException(409, "Image intent or attachment changed; reload before generating")
            with image_progress(progress, art_direction=True):
                service.image_locked(workspace, user, operation["run_id"], item, post, operation_id,
                    ImageAction.model_validate(operation["payload"]))
    except Exception as exc:
        detail = exc.detail if isinstance(exc, HTTPException) and isinstance(exc.detail, dict) else {}
        busy = isinstance(exc, HTTPException) and exc.status_code == 409 and isinstance(exc.detail, str) and exc.detail.startswith("This post is being updated")
        message = exc.detail if isinstance(exc, HTTPException) and isinstance(exc.detail, str) else "Image operation could not complete; reload the item before retrying"
        fail(service, operation_id, fence, detail.get("code", "IMAGE_ITEM_BUSY" if busy else "IMAGE_PRECONDITION_FAILED"),
            detail.get("stage", "prepare"), detail.get("message", message), busy)