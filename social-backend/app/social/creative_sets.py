from __future__ import annotations

import hashlib
import json
import logging

from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.mongo_utils import new_id, utcnow
from app.social.models import SocialImageSource, SocialMediaAssetType, SocialPermission
from app.social.schemas import GenerateCreativeSetRequest, GenerateCreativeSetResponse

logger = logging.getLogger(__name__)


def _reserve(db, workspace: dict, quantity: int) -> str | None:
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
    claimed = collection.find_one_and_update(
        {"_id": key, "$expr": {"$lte": [{"$add": ["$committed", "$reserved", quantity]}, limit]}},
        {"$inc": {"reserved": quantity}},
        return_document=ReturnDocument.AFTER,
    )
    if not claimed:
        raise HTTPException(status_code=402, detail={"code": "PLAN_LIMIT_AI_IMAGE", "message": "Not enough remaining image generations for this creative set", "limit": limit})
    return key


def _response(row: dict) -> GenerateCreativeSetResponse:
    from app.social.media import refresh_blob_url

    items = []
    for item in row.get("items") or []:
        items.append({**item, "imageUrl": refresh_blob_url(item["blobKey"])})
    order = {(slide["id"], platform): index for index, (slide, platform) in enumerate((s, p) for s in row["slides"] for p in row["platforms"])}
    items.sort(key=lambda item: order[(item["slideId"], item["platform"])])
    return GenerateCreativeSetResponse(
        creativeSetId=row["id"], status=row["status"], items=items,
        errors=row.get("errors") or [], warnings=row.get("warnings") or [],
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
    if row["status"] in ("completed", "processing"):
        return _response(row)
    token = new_id()
    row = sets.find_one_and_update(
        {"_id": key, "status": {"$in": ["pending", "partial", "failed"]}},
        {"$set": {"status": "processing", "claim": token, "updated_at": utcnow()}},
        return_document=ReturnDocument.AFTER,
    )
    if not row:
        return _response(sets.find_one({"_id": key}))
    completed = {(item["slideId"], item["platform"]) for item in row["items"]}
    missing_bases = sum(1 for slide in row["slides"] if slide["id"] not in row["bases"] and any((slide["id"], platform) not in completed for platform in platforms))
    reservation = None
    remaining = 0
    errors = []
    warnings = list(row.get("warnings") or [])

    def persist() -> None:
        sets.update_one({"_id": key, "claim": token}, {"$set": {"bases": row["bases"], "items": row["items"], "warnings": warnings, "updated_at": utcnow()}})

    try:
        reservation = _reserve(service.db, workspace, missing_bases)
        remaining = missing_bases
        brand = row["brand"]
        logo = None
        if payload.includeLogo:
            logo = service._load_logo_bytes(workspace["id"], brand.get("logo_url"), key=row.get("logo_key"))
        for index, slide in enumerate(row["slides"], 1):
            slide_id = slide["id"]
            missing = [platform for platform in platforms if (slide_id, platform) not in completed]
            if not missing:
                continue
            try:
                base = row["bases"].get(slide_id)
                base_bytes = get_storage_provider().download_bytes(base["blobKey"]) if base else None

                def save_base(image: bytes) -> None:
                    nonlocal remaining
                    if slide_id in row["bases"]:
                        return
                    upload = upload_social_image_bytes(workspace["id"], image, content_type="image/png")
                    asset = service._record_media_asset(
                        workspace, user, media_type=SocialMediaAssetType.IMAGE, source=SocialImageSource.AI_GENERATED,
                        blob_key=upload.blob_key, blob_url=upload.url, mime_type=upload.content_type,
                        file_size_bytes=upload.file_size, prompt=payload.brief or payload.topic,
                    )
                    row["bases"][slide_id] = {"assetId": str(asset["id"]), "blobKey": upload.blob_key}
                    persist()
                    usage_key = f"creative-base:{key}:{slide_id}"
                    service.db["plans_ai_usage"].update_one(
                        {"_id": usage_key},
                        {"$setOnInsert": {"id": new_id(), "workspace_id": str(workspace["id"]), "user_id": str(user["id"]), "kind": "image", "quantity": 1, "metadata_json": None, "created_at": utcnow()}},
                        upsert=True,
                    )
                    if reservation:
                        service.db["social_creative_quota"].update_one({"_id": reservation}, {"$inc": {"reserved": -1, "committed": 1}})
                    remaining -= 1

                spec = CreativeSpec(
                    format=payload.format or ("carousel" if len(slides) > 1 else "post"),
                    headline=slide.get("headline") or payload.headline or "",
                    subtext=slide.get("body") or payload.subtext or "", cta=payload.cta or "",
                    text_overlay=payload.textOverlay, auto_copy=payload.autoCopy,
                    include_emojis=payload.includeEmojis,
                    include_logo=payload.includeLogo, logo_id=payload.logoId,
                    logo_position=payload.logoPosition, use_brand=payload.useBrand,
                    caption=payload.caption or "", slide_index=index, slide_count=len(slides),
                )
                topic = "\n\n".join(dict.fromkeys(value for value in (payload.topic, payload.brief, slide.get("imagePrompt")) if value))
                variants = service.render_brand_creative_variants(
                    workspace, topic, row["style"], spec, missing,
                    brand=brand, logo_bytes=logo, base_image=base_bytes, on_base_ready=save_base,
                )
                if slide_id not in row["bases"]:
                    raise RuntimeError("Creative renderer did not persist reusable base artwork")
                for platform in missing:
                    try:
                        creative = variants[platform]
                        upload = upload_social_image_bytes(workspace["id"], creative.image, content_type="image/jpeg")
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
                    except Exception:
                        logger.exception("Creative export failed set=%s slide=%s platform=%s", row["id"], slide_id, platform)
                        errors.append({"slideId": slide_id, "platform": platform, "message": "Export failed; retry this requestId to reuse saved artwork"})
            except Exception:
                logger.exception("Creative base or composition failed set=%s slide=%s", row["id"], slide_id)
                errors.extend({"slideId": slide_id, "platform": platform, "message": "Creative rendering failed; retry this requestId"} for platform in missing)
        row["status"] = "completed" if len(completed) == len(slides) * len(platforms) else "partial" if row["items"] else "failed"
        row["errors"] = errors
        sets.update_one({"_id": key, "claim": token}, {"$set": {"status": row["status"], "errors": errors, "updated_at": utcnow()}, "$unset": {"claim": ""}})
    except Exception:
        sets.update_one({"_id": key, "claim": token}, {"$set": {"status": "partial" if row["items"] else "failed", "updated_at": utcnow()}, "$unset": {"claim": ""}})
        raise
    finally:
        if reservation and remaining:
            service.db["social_creative_quota"].update_one({"_id": reservation}, {"$inc": {"reserved": -remaining}})
    return _response(row)