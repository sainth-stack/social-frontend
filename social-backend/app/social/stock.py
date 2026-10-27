from __future__ import annotations

import hashlib
import threading
import time
from collections import OrderedDict
from typing import Literal
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.social.models import SocialPermission
from app.social.permissions import require_permission
from app.social.schemas import (
    StockImportRequest, StockMediaItem, StockProviderOut, StockProvidersOut,
    StockProvenance, StockSearchOut,
)
from app.social.upload_safety import MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, normalize_image, validate_video


CACHE_TTL_SECONDS = 300
CACHE_MAX_ENTRIES = 256
_cache: OrderedDict[tuple, tuple[float, StockSearchOut]] = OrderedDict()
_cache_lock = threading.Lock()
_LICENSE = "https://www.pexels.com/license/"


def _client() -> httpx.Client:
    return httpx.Client(timeout=httpx.Timeout(30, connect=5), follow_redirects=False, trust_env=False)


def _error(code: str, message: str, status: int = 502) -> HTTPException:
    return HTTPException(status, {"error": code, "message": message})


def _key() -> str:
    key = settings.pexels_api_key.strip()
    if not key:
        raise _error("stock_unavailable", "Pexels is not configured", 503)
    return key


def providers() -> StockProvidersOut:
    available = bool(settings.pexels_api_key.strip())
    return StockProvidersOut(items=[StockProviderOut(
        available=available, reason=None if available else "Pexels is not configured",
    )])


def _https_url(value: str, hosts: set[str]) -> str:
    try:
        parsed = urlsplit(value)
        if (parsed.scheme != "https" or parsed.hostname not in hosts or parsed.username is not None
                or parsed.password is not None or parsed.port not in (None, 443)
                or parsed.fragment or "\\" in value or any(ord(char) < 33 for char in value)):
            raise ValueError("Unsafe provider URL")
    except (ValueError, TypeError) as exc:
        raise _error("stock_invalid_media", "Pexels returned an unsupported media URL") from exc
    return value


def _cdn_url(value: str, media_type: str) -> str:
    return _https_url(value, {"images.pexels.com"} if media_type == "image" else {"videos.pexels.com"})


def _read_response(response: httpx.Response, limit: int) -> bytes:
    length = response.headers.get("content-length")
    if length:
        try:
            if int(length) < 0:
                raise ValueError("Negative length")
            if int(length) > limit:
                raise HTTPException(413, "Media exceeds the import size limit")
        except ValueError as exc:
            raise _error("stock_invalid_media", "Invalid provider response length") from exc
    data = bytearray()
    for chunk in response.iter_bytes(chunk_size=64 * 1024):
        data.extend(chunk)
        if len(data) > limit:
            raise HTTPException(413, "Media exceeds the import size limit")
    return bytes(data)


def _check_response(response: httpx.Response) -> None:
    if response.status_code == 429:
        raise _error("stock_rate_limited", "Pexels rate limit reached; try again later", 429)
    if response.status_code in (401, 403):
        raise _error("stock_unavailable", "Pexels credentials are unavailable or rejected", 503)
    if response.status_code == 404:
        raise _error("stock_not_found", "Pexels asset not found", 404)
    if response.status_code != 200:
        raise _error("stock_provider_error", "Pexels request failed; redirects are not accepted")


def _api(path: str, params: dict | None = None) -> dict:
    key = _key()
    try:
        with _client() as client:
            with client.stream("GET", "https://api.pexels.com" + path,
                               params=params, headers={"Authorization": key, "Accept": "application/json"}) as response:
                _check_response(response)
                raw = _read_response(response, 2 * 1024 * 1024)
        import json

        result = json.loads(raw)
        if not isinstance(result, dict):
            raise ValueError("Invalid payload")
        return result
    except httpx.TimeoutException as exc:
        raise _error("stock_timeout", "Pexels request timed out", 504) from exc
    except httpx.HTTPError as exc:
        raise _error("stock_provider_error", "Could not reach Pexels") from exc
    except (ValueError, TypeError) as exc:
        raise _error("stock_provider_error", "Invalid Pexels response") from exc


def _item(row: dict, media_type: Literal["image", "video"]) -> StockMediaItem:
    if not isinstance(row, dict):
        raise ValueError("Invalid media record")
    provider_id = str(row["id"])
    if not provider_id.isascii() or not provider_id.isdigit() or int(provider_id) <= 0:
        raise ValueError("Invalid provider ID")
    page = _https_url(row["url"], {"www.pexels.com", "pexels.com"})
    if media_type == "image":
        creator = row["photographer"]
        creator_url = row["photographer_url"]
        source = row["src"]
        if not isinstance(source, dict):
            raise ValueError("Invalid image sources")
        preview = _cdn_url(source.get("large2x") or source["original"], "image")
        thumbnail = _cdn_url(source.get("medium") or source["original"], "image")
        width, height = int(row["width"]), int(row["height"])
    else:
        if not isinstance(row["user"], dict) or not isinstance(row["video_files"], list):
            raise ValueError("Invalid video metadata")
        creator = row["user"]["name"]
        creator_url = row["user"]["url"]
        files = [file for file in row["video_files"] if isinstance(file, dict) and file.get("file_type") == "video/mp4"
                 and 0 < int(file.get("width") or 0) <= 1920 and 0 < int(file.get("height") or 0) <= 1920]
        if not files:
            raise ValueError("No supported MP4 rendition")
        file = max(files, key=lambda value: int(value["width"]) * int(value["height"]))
        preview = _cdn_url(file["link"], "video")
        thumbnail = _cdn_url(row["image"], "image")
        width, height = int(file["width"]), int(file["height"])
    if width <= 0 or height <= 0 or not isinstance(creator, str) or not creator.strip():
        raise ValueError("Invalid media metadata")
    return StockMediaItem(
        id=provider_id, mediaType=media_type, previewUrl=preview, thumbnailUrl=thumbnail,
        width=width, height=height,
        durationSeconds=max(0, int(row["duration"])) if media_type == "video" else None,
        creatorName=creator[:300], creatorUrl=_https_url(creator_url, {"www.pexels.com", "pexels.com"}),
        providerPageUrl=page, licenseUrl=_LICENSE,
        attributionText=f"{'Photo' if media_type == 'image' else 'Video'} by {creator[:300]} on Pexels",
    )


def search(query: str, media_type: Literal["image", "video"], page: int, page_size: int) -> StockSearchOut:
    key = (hashlib.sha256(_key().encode()).hexdigest(), query.strip().casefold(), media_type, page, page_size)
    now = time.monotonic()
    with _cache_lock:
        for expired in [entry for entry, (expires, _) in _cache.items() if expires <= now]:
            del _cache[expired]
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key][1].model_copy(deep=True)
    body = _api("/v1/search" if media_type == "image" else "/videos/search",
                {"query": query.strip(), "page": page, "per_page": page_size})
    rows = body.get("photos" if media_type == "image" else "videos", [])
    if not isinstance(rows, list):
        raise _error("stock_provider_error", "Invalid Pexels response")
    items = []
    for row in rows[:page_size]:
        try:
            items.append(_item(row, media_type))
        except (KeyError, ValueError, TypeError, HTTPException):
            continue
    total = body.get("total_results")
    has_more = page * page_size < total if isinstance(total, int) else bool(body.get("next_page"))
    result = StockSearchOut(items=items, page=page, pageSize=page_size, hasMore=has_more)
    with _cache_lock:
        _cache[key] = (time.monotonic() + CACHE_TTL_SECONDS, result.model_copy(deep=True))
        _cache.move_to_end(key)
        while len(_cache) > CACHE_MAX_ENTRIES:
            _cache.popitem(last=False)
    return result


def import_asset(db, workspace: dict, user: dict, payload: StockImportRequest):
    from app.social.media import upload_social_image_bytes, upload_social_video_bytes
    from app.social.service import SocialMediaService

    require_permission(db, workspace, user, SocialPermission.EDITOR)
    path = f"/v1/photos/{payload.id}" if payload.mediaType == "image" else f"/videos/videos/{payload.id}"
    body = _api(path)
    try:
        item = _item(body, payload.mediaType)
        if item.id != payload.id:
            raise ValueError("Provider ID mismatch")
    except (KeyError, ValueError, TypeError) as exc:
        raise _error("stock_invalid_media", "Pexels returned invalid media metadata") from exc
    url = _cdn_url(item.previewUrl, payload.mediaType)
    try:
        with _client() as client:
            with client.stream("GET", url, headers={"Accept": "image/jpeg,image/png,image/webp" if payload.mediaType == "image" else "video/mp4"}) as response:
                _check_response(response)
                mime = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
                data = _read_response(response, MAX_IMAGE_BYTES if payload.mediaType == "image" else MAX_VIDEO_BYTES)
    except httpx.TimeoutException as exc:
        raise _error("stock_timeout", "Pexels media download timed out", 504) from exc
    except httpx.HTTPError as exc:
        raise _error("stock_provider_error", "Could not download Pexels media") from exc
    if payload.mediaType == "image":
        data = normalize_image(data, mime)
        upload = upload_social_image_bytes(workspace["id"], data, content_type="image/jpeg")
    else:
        if mime != "video/mp4":
            raise HTTPException(415, "Pexels imports support MP4 video only")
        validate_video(data, mime)
        upload = upload_social_video_bytes(workspace["id"], data, content_type=mime)
    provenance = StockProvenance(
        attributionText=item.attributionText, providerPageUrl=item.providerPageUrl,
        creatorName=item.creatorName, creatorUrl=item.creatorUrl, licenseUrl=item.licenseUrl,
        providerAssetId=item.id,
    )
    service = SocialMediaService(db)
    asset = service._record_media_asset(
        workspace, user, media_type=payload.mediaType, source="uploaded", blob_key=upload.blob_key,
        blob_url=upload.url, mime_type=upload.content_type, file_size_bytes=upload.file_size,
        duration_seconds=item.durationSeconds, provenance=provenance.model_dump(),
    )
    return service._serialize_media_asset(asset, url=upload.url)