from __future__ import annotations

import io
import warnings

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError


MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_VIDEO_BYTES = 50 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
IMAGE_MIMES = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
VIDEO_MIMES = {"video/mp4", "video/webm"}


async def read_upload(file: UploadFile, limit: int) -> bytes:
    data = bytearray()
    while True:
        chunk = await file.read(min(64 * 1024, limit + 1 - len(data)))
        if not chunk:
            break
        data.extend(chunk)
        if len(data) > limit:
            raise HTTPException(413, "Media exceeds the upload size limit")
    return bytes(data)


def normalize_image(data: bytes, content_type: str) -> bytes:
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image exceeds 8 MiB")
    mime = content_type.split(";", 1)[0].strip().lower()
    if mime not in IMAGE_MIMES:
        raise HTTPException(415, "Only JPEG, PNG, and WebP images are supported")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as probe:
                if probe.format != IMAGE_MIMES[mime] or probe.width * probe.height > MAX_IMAGE_PIXELS:
                    raise ValueError("Invalid image format or dimensions")
                probe.verify()
            with Image.open(io.BytesIO(data)) as image:
                image = ImageOps.exif_transpose(image)
                image.load()
                rgba = image.convert("RGBA")
                clean = Image.new("RGB", rgba.size, "white")
                clean.paste(rgba, mask=rgba.getchannel("A"))
                output = io.BytesIO()
                clean.save(output, format="JPEG", quality=90)
                normalized = output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError,
            Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
        raise HTTPException(400, "Invalid or unsafe image bytes") from exc
    if len(normalized) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Normalized image exceeds 8 MiB")
    return normalized


def validate_video(data: bytes, content_type: str) -> str:
    if len(data) > MAX_VIDEO_BYTES:
        raise HTTPException(413, "Video exceeds 50 MiB")
    mime = content_type.split(";", 1)[0].strip().lower()
    if mime not in VIDEO_MIMES:
        raise HTTPException(415, "Only MP4 and WebM videos are supported")
    if mime == "video/webm":
        valid = data.startswith(b"\x1a\x45\xdf\xa3") and b"webm" in data[:4096]
    else:
        valid = _valid_mp4(data)
    if not valid:
        raise HTTPException(400, "Invalid video container signature")
    return mime


def _valid_mp4(data: bytes) -> bool:
    offset = 0
    boxes = set()
    brands = {b"isom", b"iso2", b"iso3", b"iso4", b"iso5", b"iso6", b"mp41", b"mp42", b"avc1", b"dash", b"M4V "}
    while offset + 8 <= len(data):
        size = int.from_bytes(data[offset:offset + 4], "big")
        kind = data[offset + 4:offset + 8]
        header = 8
        if size == 1:
            if offset + 16 > len(data):
                return False
            size = int.from_bytes(data[offset + 8:offset + 16], "big")
            header = 16
        elif size == 0:
            size = len(data) - offset
        if size < header or offset + size > len(data):
            return False
        if offset == 0:
            if kind != b"ftyp" or size < header + 8:
                return False
            payload = data[offset + header:offset + size]
            if not ({payload[:4]} | {payload[i:i + 4] for i in range(8, len(payload), 4)}) & brands:
                return False
        boxes.add(kind)
        offset += size
    return offset == len(data) and {b"ftyp", b"moov", b"mdat"}.issubset(boxes)