from __future__ import annotations

import logging
from io import BytesIO
from typing import Optional, Sequence

from PIL import Image, ImageFilter, ImageStat

from app.core.config import settings

logger = logging.getLogger(__name__)

_VISION_MARKERS = ("anthropic.claude", "amazon.nova-pro", "amazon.nova-lite", "amazon.nova-premier")
_FALLBACK_VISION = "anthropic.claude-haiku-4-5-20251001-v1:0"


def _thumbnail(data: bytes, edge: int = 512) -> bytes:
    image = Image.open(BytesIO(data)).convert("RGB")
    image.thumbnail((edge, edge))
    out = BytesIO()
    image.save(out, format="JPEG", quality=82)
    return out.getvalue()


def heuristic_score(data: bytes) -> float:
    image = Image.open(BytesIO(data)).convert("L")
    image.thumbnail((384, 384))
    contrast = ImageStat.Stat(image).stddev[0] / 64
    edges = ImageStat.Stat(image.filter(ImageFilter.FIND_EDGES)).mean[0] / 24
    return min(contrast, 1.5) + min(edges, 1.5)


def _vision_model() -> str:
    explicit = (settings.bedrock_vision_model_id or "").strip()
    if explicit:
        return explicit
    from app.providers.llm.factory import get_llm_model

    text_model = get_llm_model() or ""
    if any(marker in text_model for marker in _VISION_MARKERS):
        return text_model
    from app.providers.llm.model_selection import CuratedModel

    return CuratedModel(_FALLBACK_VISION, "", "", ("us", "eu", "au", "jp", "in", "global"), True).candidates()[0]


def _vision_scores(candidates: Sequence[bytes], brief: str) -> Optional[list[float]]:
    from app.providers.llm.factory import _get_llm_client
    from app.social.ai.generator import _message_text, _parse_json_content

    model = _vision_model()
    content: list[dict] = [{"text": (
        "You are a senior art director choosing the best image for a social media post.\n"
        f"Post brief: {brief[:1200]}\n"
        f"Score each of the {len(candidates)} images from 0 to 10 on relevance to the brief, "
        "visual quality and composition, and absence of artifacts (malformed hands, warped objects, gibberish text). "
        'Reply with JSON only: {"scores":[{"relevance":0,"quality":0,"clean":0,"hasText":false}]} in image order.'
    )}]
    for index, data in enumerate(candidates):
        content.append({"text": f"Image {index + 1}:"})
        content.append({"image": {"format": "jpeg", "source": {"bytes": _thumbnail(data)}}})
    client = _get_llm_client(model, settings.resolved_bedrock_region)
    response = client.chat.completions.create(
        model=model, messages=[{"role": "user", "content": content}], max_completion_tokens=400,
    )
    data = _parse_json_content(_message_text(response.choices[0].message))
    rows = data.get("scores") if isinstance(data, dict) else None
    if not isinstance(rows, list) or len(rows) != len(candidates):
        return None
    scores: list[float] = []
    for row in rows:
        if not isinstance(row, dict):
            return None
        value = (
            0.5 * float(row.get("relevance") or 0)
            + 0.3 * float(row.get("quality") or 0)
            + 0.2 * float(row.get("clean") or 0)
            - (3.0 if row.get("hasText") else 0.0)
        )
        scores.append(value)
    return scores


def pick_best_image(candidates: Sequence[bytes], *, brief: str) -> int:
    if len(candidates) <= 1:
        return 0
    scores: Optional[list[float]] = None
    try:
        scores = _vision_scores(candidates, brief)
    except Exception as exc:
        logger.warning("Vision judge unavailable type=%s: %s", type(exc).__name__, exc)
    method = "vision"
    if not scores:
        method = "heuristic"
        scores = []
        for data in candidates:
            try:
                scores.append(heuristic_score(data))
            except Exception:
                scores.append(-1.0)
    best = max(range(len(candidates)), key=lambda i: scores[i])
    logger.info("Image judge method=%s scores=%s best=%d", method, [round(s, 2) for s in scores], best)
    return best


def describe_style(data: bytes) -> str:
    from app.providers.llm.factory import _get_llm_client
    from app.social.ai.caption_sanitize import normalize_generated_text
    from app.social.ai.generator import _message_text

    model = _vision_model()
    content = [
        {"text": (
            "Describe the visual style of this brand image so an image generator can reproduce the look for new social posts. "
            "Write one paragraph of 25-60 words covering medium (photo, illustration, 3D), lighting, colour grading, "
            "composition habits, textures and mood. Describe only the style, never the specific objects, people, words or logos. "
            "Reply with the paragraph only."
        )},
        {"image": {"format": "jpeg", "source": {"bytes": _thumbnail(data, 768)}}},
    ]
    client = _get_llm_client(model, settings.resolved_bedrock_region)
    response = client.chat.completions.create(model=model, messages=[{"role": "user", "content": content}], max_completion_tokens=300)
    text = " ".join(normalize_generated_text(_message_text(response.choices[0].message), include_emojis=False).split())
    if len(text) < 20:
        raise ValueError("Vision model returned no style description")
    return text[:600]
