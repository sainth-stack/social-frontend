from __future__ import annotations

import hashlib
import json
import logging
from datetime import timedelta, timezone
from threading import Event, Thread

from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.mongo_utils import new_id, utcnow
from app.social.models import SocialImageSource, SocialMediaAssetType, SocialPermission
from app.social.schemas import GenerateCreativeSetRequest, GenerateCreativeSetResponse

logger = logging.getLogger(__name__)
LEASE_SECONDS = 900
HEARTBEAT_SECONDS = 30


class _ClaimLost(RuntimeError):
    pass


def _claim_filter(key: str, token: str) -> dict:
    return {"_id": key, "claim": token, "status": "processing", "lease_until": {"$gt": utcnow()}}


def _release_hold(db, token: str) -> None:
    field = f"holds.{token}"
    quota = db["social_creative_quota"]
    row = quota.find_one({field: {"$exists": True}})
    if row:
        amount = row["holds"][token]
        quota.update_one({"_id": row["_id"], field: amount}, {"$inc": {"reserved": -amount}, "$unset": {field: ""}})


def get_creative_set_status(service, workspace: dict, user: dict, *, creative_set_id: str | None = None, request_id: str | None = None) -> GenerateCreativeSetResponse:
    from app.social.permissions import require_permission

    require_permission(service.db, workspace, user, SocialPermission.VIEWER)
    if bool(creative_set_id) == bool(request_id):
        raise HTTPException(status_code=400, detail="Supply exactly one creative_set_id or request_id")
    query = {"workspace_id": workspace["id"]}
    query.update({"id": creative_set_id} if creative_set_id else {"request_id": request_id})
    row = service.db["social_creative_sets"].find_one(query)
    if not row:
        raise HTTPException(status_code=404, detail="Creative set not found")
    if row["status"] == "processing" and _lease_expired(row):
        row = {**row, "status": "partial" if row.get("items") else "failed", "errors": [*(row.get("errors") or []),
            {"code": "CREATIVE_LEASE_EXPIRED", "stage": "claim", "message": "Processing lease expired; retry the original requestId to recover saved artwork"}]}
    return _response(row)


def _lease_expired(row: dict) -> bool:
    until = row.get("lease_until")
    if until is not None:
        return until.replace(tzinfo=timezone.utc) <= utcnow()
    return row.get("updated_at", utcnow()).replace(tzinfo=timezone.utc) <= utcnow() - timedelta(seconds=LEASE_SECONDS)


def _reserve(db, workspace: dict, quantity: int, *, token: str | None = None) -> str | None:
    if not quantity:
        return None
    from app.plans.catalog import is_unlimited
    from app.plans.service import count_ai_usage_this_month
    from app.social.limits import get_limits

    plan = get_limits(db, workspace)
    limit = plan.limits.ai_images_per_month
    if is_unlimited(limit):
        return None
    key = f"{workspace['id']}:{utcnow():%Y-%m}"
    collection = db["social_creative_quota"]
    collection.update_one({"_id": key}, {"$setOnInsert": {"reserved": 0, "committed": 0}}, upsert=True)
    collection.update_one({"_id": key}, {"$max": {"committed": count_ai_usage_this_month(db, workspace["id"], "image")}})
    update = {"$inc": {"reserved": quantity}}
    if token:
        update["$set"] = {f"holds.{token}": quantity}
    claimed = collection.find_one_and_update(
        {"_id": key, "$expr": {"$lte": [{"$add": ["$committed", "$reserved", quantity]}, limit]}},
        update,
        return_document=ReturnDocument.AFTER,
    )
    if not claimed:
        raise HTTPException(status_code=402, detail={"code": "PLAN_LIMIT_AI_IMAGE", "message": "Not enough remaining image generations for this creative set", "limit": limit})
    return key


def _response(row: dict) -> GenerateCreativeSetResponse:
    from app.social.media import refresh_blob_url

    items = []
    errors = list(row.get("errors") or [])
    for item in row.get("items") or []:
        try:
            items.append({**item, "imageUrl": refresh_blob_url(item["blobKey"])})
        except Exception:
            errors.append({"slideId": item["slideId"], "platform": item["platform"], "code": "CREATIVE_URL_FAILED", "stage": "url", "message": "Image URL could not be refreshed; reload status"})
    order = {(slide["id"], platform): index for index, (slide, platform) in enumerate((s, p) for s in row["slides"] for p in row["platforms"])}
    items.sort(key=lambda item: order[(item["slideId"], item["platform"])])
    return GenerateCreativeSetResponse(
        creativeSetId=row["id"], status="partial" if errors and row["status"] == "completed" else row["status"], items=items,
        errors=errors, warnings=row.get("warnings") or [],
    )


def generate_creative_set(service, workspace: dict, user: dict, payload: GenerateCreativeSetRequest) -> GenerateCreativeSetResponse:
    from app.providers.storage.factory import get_storage_provider
    from app.social.ai.creative import CreativeSpec
    from app.social.media import upload_social_image_bytes
    from app.social.permissions import require_permission

    require_permission(service.db, workspace, user, SocialPermission.EDITOR)
    if payload.mode != "create":
        raise HTTPException(status_code=400, detail="Creative sets support create mode only")
    platforms = list(dict.fromkeys(platform.value for platform in payload.platforms))
    if "x" in platforms:
        raise HTTPException(status_code=400, detail="X image exports are not supported for publishing")
    slides = [slide.model_dump() for slide in payload.slides] if payload.slides else [{"id": "single", "headline": payload.headline or "", "body": payload.subtext or "", "imagePrompt": ""}]
    ids = [slide["id"] for slide in slides]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=400, detail="Creative slides require unique IDs")
    if payload.format == "carousel" and not 2 <= len(slides) <= 8:
        raise HTTPException(status_code=400, detail="Carousel creative sets require 2–8 slides")
    if len(slides) > 1 and payload.format not in (None, "carousel"):
        raise HTTPException(status_code=400, detail="Multiple creative slides require carousel format")
    encoded = json.dumps(payload.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    fingerprint = hashlib.sha256(encoded.encode()).hexdigest()
    key = hashlib.sha256(f"{workspace['id']}:{payload.requestId}".encode()).hexdigest()
    sets = service.db["social_creative_sets"]
    row = sets.find_one({"_id": key})
    if not row:
        brand = service._brand_voice_dict(workspace["id"])
        logo_key = None
        if payload.includeLogo and payload.logoId:
            _, logo = service._find_logo(workspace["id"], payload.logoId)
            logo_key = logo["key"]
        settings = service.db["social_settings"].find_one({"workspace_id": workspace["id"]}) or {}
        row = {
            "_id": key, "id": new_id(), "workspace_id": workspace["id"], "created_by": user["id"],
            "request_id": payload.requestId, "fingerprint": fingerprint,
            "request": payload.model_dump(mode="json"), "brand": brand, "logo_key": logo_key,
            "style": payload.style or settings.get("image_generation_style"),
            "slides": slides, "platforms": platforms, "bases": {}, "items": [],
            "errors": [], "warnings": [], "status": "pending", "created_at": utcnow(), "updated_at": utcnow(),
        }
        try:
            sets.insert_one(row)
        except DuplicateKeyError:
            row = sets.find_one({"_id": key})
    if row["fingerprint"] != fingerprint:
        raise HTTPException(status_code=409, detail="requestId is already bound to a different creative brief")
    if row["status"] == "completed" or (row["status"] == "processing" and not _lease_expired(row)):
        return _response(row)
    token = new_id()
    old_token = row.get("claim")
    recovering = row["status"] == "processing"
    now = utcnow()
    row = sets.find_one_and_update(
        {"_id": key, "claim": old_token, "updated_at": row["updated_at"], "$or": [{"status": {"$in": ["pending", "partial", "failed"]}},
            {"status": "processing", "lease_until": {"$lte": now}},
            {"status": "processing", "lease_until": {"$exists": False}, "updated_at": {"$lte": now - timedelta(seconds=LEASE_SECONDS)}}]},
        {"$set": {"status": "processing", "claim": token, "updated_at": now, "lease_until": now + timedelta(seconds=LEASE_SECONDS)}},
        return_document=ReturnDocument.AFTER,
    )
    if not row:
        return _response(sets.find_one({"_id": key}))
    if old_token:
        _release_hold(service.db, old_token)
    row.setdefault("attempts", {})
    row.setdefault("recipes", {})
    if recovering:
        for slide in row["slides"]:
            if slide["id"] not in row["bases"]:
                row["attempts"].setdefault(slide["id"], {"state": "unknown", "code": "CREATIVE_PROVIDER_UNCERTAIN"})
    completed = {(item["slideId"], item["platform"]) for item in row["items"]}
    missing_bases = sum(1 for slide in row["slides"] if slide["id"] not in row["bases"] and slide["id"] not in row["attempts"] and any((slide["id"], platform) not in completed for platform in platforms))
    reservation = None
    errors = []
    warnings = list(row.get("warnings") or [])
    stopped = Event()
    lost = Event()

    def guard() -> None:
        if lost.is_set() or not sets.find_one(_claim_filter(key, token), {"_id": 1}):
            raise _ClaimLost("Creative processing claim was replaced or expired")

    def heartbeat() -> None:
        while not stopped.wait(HEARTBEAT_SECONDS):
            try:
                result = sets.update_one(_claim_filter(key, token), {"$set": {"lease_until": utcnow() + timedelta(seconds=LEASE_SECONDS)}})
                if not result.matched_count:
                    lost.set()
                    return
            except Exception:
                lost.set()
                return

    def persist() -> None:
        guard()
        try:
            result = sets.update_one(_claim_filter(key, token), {"$set": {"bases": row["bases"], "items": row["items"], "attempts": row["attempts"], "recipes": row["recipes"], "warnings": warnings, "updated_at": utcnow()}})
        except Exception as exc:
            raise _ClaimLost("Creative checkpoint outcome is uncertain; recover from saved status") from exc
        if not result.matched_count:
            raise _ClaimLost("Creative checkpoint could not be persisted")

    def record_base_usage(slide_id: str) -> None:
        guard()
        service.db["plans_ai_usage"].update_one(
            {"_id": f"creative-base:{key}:{slide_id}"},
            {"$setOnInsert": {"id": new_id(), "workspace_id": str(workspace["id"]), "user_id": str(row["created_by"]), "kind": "image", "quantity": 1, "metadata_json": None, "created_at": utcnow()}}, upsert=True,
        )

    worker = Thread(target=heartbeat, daemon=True)
    worker.start()

    try:
        persist()
        for saved_slide in row["bases"]:
            record_base_usage(saved_slide)
        reservation = _reserve(service.db, workspace, missing_bases, token=token)
        guard()
        brand = row["brand"]
        logo = None
        if payload.includeLogo:
            logo = service._load_logo_bytes(workspace["id"], brand.get("logo_url"), key=row.get("logo_key"))
        for index, slide in enumerate(row["slides"], 1):
            slide_id = slide["id"]
            missing = [platform for platform in platforms if (slide_id, platform) not in completed]
            if not missing:
                continue
            stage = "base_download"
            try:
                guard()
                base = row["bases"].get(slide_id)
                if not base and slide_id in row["attempts"]:
                    errors.extend({"slideId": slide_id, "platform": platform, "code": row["attempts"][slide_id].get("code", "CREATIVE_PROVIDER_UNCERTAIN"), "stage": "base",
                        "message": "Prior artwork attempt has no reusable base; inspect the failure and use a new requestId only to explicitly generate new artwork"} for platform in missing)
                    continue
                base_bytes = get_storage_provider().download_bytes(base["blobKey"]) if base else None

                def save_base(image: bytes) -> None:
                    nonlocal stage
                    from app.social.ai.image_quality import validate_image_bytes

                    guard()
                    if slide_id in row["bases"]:
                        return
                    validate_image_bytes(image, stage="base")
                    stage = "base_upload"
                    upload = upload_social_image_bytes(workspace["id"], image, content_type="image/png")
                    guard()
                    asset = service._record_media_asset(
                        workspace, user, media_type=SocialMediaAssetType.IMAGE, source=SocialImageSource.AI_GENERATED,
                        blob_key=upload.blob_key, blob_url=upload.url, mime_type=upload.content_type,
                        file_size_bytes=upload.file_size, prompt=payload.brief or payload.topic,
                    )
                    row["bases"][slide_id] = {"assetId": str(asset["id"]), "blobKey": upload.blob_key}
                    persist()
                    if reservation:
                        service.db["social_creative_quota"].update_one({"_id": reservation, f"holds.{token}": {"$gt": 0}}, {"$inc": {"reserved": -1, "committed": 1, f"holds.{token}": -1}})
                    record_base_usage(slide_id)
                    stage = "compose"

                def save_recipe(recipe: dict) -> None:
                    row["recipes"][slide_id] = recipe
                    persist()

                save_base.on_recipe_ready = save_recipe

                spec = CreativeSpec(
                    format=payload.format or ("carousel" if len(slides) > 1 else "post"),
                    headline=slide.get("headline") or payload.headline or "",
                    subtext=slide.get("body") or payload.subtext or "", cta=payload.cta or "",
                    text_overlay=payload.textOverlay, auto_copy=payload.autoCopy,
                    include_emojis=payload.includeEmojis,
                    include_logo=payload.includeLogo, logo_id=payload.logoId,
                    logo_position=payload.logoPosition, use_brand=payload.useBrand,
                    caption=payload.caption or "", slide_index=index, slide_count=len(slides),
                    render_recipe=row["recipes"].get(slide_id),
                )
                topic = "\n\n".join(dict.fromkeys(value for value in (payload.topic, payload.brief, slide.get("imagePrompt")) if value))
                stage = "compose" if base else "provider"
                if not base:
                    row["attempts"][slide_id] = {"state": "started", "code": "CREATIVE_PROVIDER_UNCERTAIN"}
                    persist()
                variants = service.render_brand_creative_variants(
                    workspace, topic, row["style"], spec, missing,
                    brand=brand, logo_bytes=logo, base_image=base_bytes, on_base_ready=save_base,
                )
                if slide_id not in row["bases"]:
                    raise RuntimeError("Creative renderer did not persist reusable base artwork")
                for platform in missing:
                    stage = "export_validation"
                    try:
                        from app.social.ai.image_quality import validate_image_bytes

                        guard()
                        creative = variants[platform]
                        validate_image_bytes(creative.image, stage="export")
                        stage = "export_upload"
                        upload = upload_social_image_bytes(workspace["id"], creative.image, content_type="image/jpeg")
                        guard()
                        asset = service._record_media_asset(
                            workspace, user, media_type=SocialMediaAssetType.IMAGE, source=SocialImageSource.AI_GENERATED,
                            blob_key=upload.blob_key, blob_url=upload.url, mime_type=upload.content_type,
                            file_size_bytes=upload.file_size, prompt=payload.brief or payload.topic,
                        )
                        row["items"].append({"slideId": slide_id, "platform": platform, "imageUrl": upload.url,
                            "assetId": str(asset["id"]), "blobKey": upload.blob_key,
                            "width": creative.width, "height": creative.height, "mimeType": upload.content_type})
                        completed.add((slide_id, platform))
                        warnings.extend(str(warning) for warning in getattr(creative, "warnings", []) if str(warning) not in warnings)
                        persist()
                    except _ClaimLost:
                        raise
                    except Exception as exc:
                        error = _safe_error(exc, stage)
                        logger.warning("Creative export failed set=%s slide=%s platform=%s stage=%s code=%s", row["id"], slide_id, platform, error["stage"], error["code"])
                        errors.append({"slideId": slide_id, "platform": platform, **error, "message": "Export failed; retry this requestId to reuse saved artwork"})
            except _ClaimLost:
                raise
            except Exception as exc:
                error = _safe_error(exc, stage)
                logger.warning("Creative rendering failed set=%s slide=%s stage=%s code=%s", row["id"], slide_id, error["stage"], error["code"])
                if slide_id not in row["bases"] and slide_id in row["attempts"]:
                    row["attempts"][slide_id] = {"state": "failed", "code": error["code"]}
                    persist()
                errors.extend({"slideId": slide_id, "platform": platform, **error, "message": "Rendering failed; retry this requestId to reuse saved artwork. Without a saved base, new artwork requires a new requestId"} for platform in missing)
        row["status"] = "completed" if len(completed) == len(slides) * len(platforms) else "partial" if row["items"] else "failed"
        row["errors"] = errors
        guard()
        sets.update_one(_claim_filter(key, token), {"$set": {"status": row["status"], "errors": errors, "updated_at": utcnow()}, "$unset": {"claim": "", "lease_until": ""}})
    except _ClaimLost:
        return _response(sets.find_one({"_id": key}))
    except Exception:
        sets.update_one(_claim_filter(key, token), {"$set": {"status": "partial" if row["items"] else "failed", "updated_at": utcnow()}, "$unset": {"claim": "", "lease_until": ""}})
        raise
    finally:
        stopped.set()
        worker.join(timeout=1)
        _release_hold(service.db, token)
    return _response(sets.find_one({"_id": key}))


def _safe_error(exc: Exception, stage: str) -> dict[str, str]:
    code = getattr(exc, "code", None)
    detail = getattr(exc, "detail", None)
    if isinstance(detail, dict):
        code = detail.get("code") or code
        stage = detail.get("stage") or stage
    return {"code": code or {"provider": "CREATIVE_PROVIDER_FAILED", "compose": "CREATIVE_COMPOSE_FAILED", "base_download": "CREATIVE_BASE_DOWNLOAD_FAILED",
        "base_upload": "CREATIVE_BASE_UPLOAD_FAILED", "export_validation": "CREATIVE_EXPORT_INVALID", "export_upload": "CREATIVE_EXPORT_UPLOAD_FAILED"}.get(stage, "CREATIVE_RENDER_FAILED"),
        "stage": getattr(exc, "stage", stage)}