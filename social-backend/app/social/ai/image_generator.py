"""AI image generation via AWS Bedrock (Nova Canvas)."""

from __future__ import annotations

import logging
from typing import Literal, Optional

import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.providers.llm.bedrock_image import (
    DEFAULT_IMAGE_MODEL_ID,
    generate_image_variation,
    generate_text_to_image,
    image_generation_configured,
)
from app.providers.llm.model_selection import current_models, image_region
from app.social.ai.image_quality import ImageReliabilityError, validate_image_bytes
from app.social.ai.visual_prompt import compact_context

logger = logging.getLogger(__name__)

ImageGenerationMode = Literal["create", "edit"]


def _build_create_prompt(topic: str, style: Optional[str]) -> str:
    style_line = style or (
        "purposeful editorial illustration, product still life or natural photography as appropriate to the brief, "
        "restrained palette, clear focal subject, believable materials and refined lighting"
    )
    return (
        "Create a business social visual grounded in the supplied message and explicit visual preferences. "
        f"Subject: {compact_context(topic, 4000)}. Visual style: {compact_context(style_line, 900)}. "
        "One concrete visual idea, legible at mobile feed size, with the main subject inside a safe central crop. "
        "Do not fabricate product interfaces, customer evidence, performance charts or identifiable team members. "
        "Avoid generic corporate stock scenes unless requested. No clipped subjects, duplicated objects or distorted anatomy. "
        "No watermarks, logos, readable text, garbled letters or simulated screenshots."
    )


def _build_edit_prompt(topic: str, style: Optional[str]) -> str:
    return (
        "Refine this social marketing image with a premium commercial finish. "
        f"Change: {compact_context(topic, 4000)}. "
        f"Style: {compact_context(style or 'modern, minimal, professional, high-end lighting', 900)}. "
        "Keep composition brand-safe. No watermarks, no garbled text."
    )


def _download_source_image(url: str) -> bytes:
    try:
        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            resp = client.get(url.strip())
            resp.raise_for_status()
            return resp.content
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not download source image for editing",
        ) from exc


def generate_post_image(
    *,
    topic: str,
    style: Optional[str] = None,
    size: str = "1024x1024",
    mode: ImageGenerationMode = "create",
    source_image_bytes: Optional[bytes] = None,
    prompt_override: Optional[str] = None,
) -> dict[str, str | bytes]:
    if not image_generation_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "AI image generation is not configured. Set BEDROCK_IMAGE_MODEL_ID and "
                "Bedrock credentials, or upload an image instead."
            ),
        )

    if mode == "edit" and not source_image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source image is required to refine an existing image",
        )

    model_id = current_models().image or settings.bedrock_image_model_id or DEFAULT_IMAGE_MODEL_ID
    quality = settings.bedrock_image_quality or "premium"

    try:
        if mode == "edit":
            prompt = _build_edit_prompt(topic, style)
            image_bytes = generate_image_variation(
                prompt=prompt,
                source_image_bytes=source_image_bytes,
                size=size,
                quality=quality,
            )
        else:
            prompt = prompt_override or _build_create_prompt(topic, style)
            image_bytes = generate_text_to_image(
                prompt=prompt,
                size=size,
                quality=quality,
            )
        validate_image_bytes(image_bytes, stage="base")
        return {"imageB64": image_bytes, "source": "ai_generated"}

    except HTTPException:
        raise
    except ImageReliabilityError as exc:
        raise HTTPException(status_code=502, detail={"code": exc.code, "stage": exc.stage, "message": str(exc)}) from exc
    except RuntimeError as exc:
        logger.warning("Bedrock image generation failed model=%s code=%s", model_id, getattr(exc, "code", "IMAGE_PROVIDER_FAILED"))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": getattr(exc, "code", "IMAGE_PROVIDER_FAILED"), "stage": "provider", "message": "Image provider could not return usable artwork; upload an image or explicitly request new artwork"},
        ) from exc
    except Exception as exc:
        logger.warning("Image generation failed model=%s type=%s", model_id, type(exc).__name__)
        action = "refinement" if mode == "edit" else "generation"
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "IMAGE_PROVIDER_FAILED", "stage": "provider", "message": (
                f"Image {action} failed (model={model_id}). Enable the model in Bedrock "
                f"({image_region(model_id)}) or upload an image instead."
            )},
        ) from exc


def generate_post_image_from_url(
    *,
    topic: str,
    style: Optional[str] = None,
    size: str = "1024x1024",
    mode: ImageGenerationMode = "create",
    source_image_url: Optional[str] = None,
) -> dict[str, str | bytes]:
    source_bytes: Optional[bytes] = None
    if mode == "edit" and source_image_url:
        source_bytes = _download_source_image(source_image_url)
    return generate_post_image(
        topic=topic,
        style=style,
        size=size,
        mode=mode,
        source_image_bytes=source_bytes,
    )
