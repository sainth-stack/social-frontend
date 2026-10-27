from __future__ import annotations

import colorsys
import logging
from math import gcd
import re
from dataclasses import dataclass, field, replace
from typing import Any, Callable, Optional, Sequence

from fastapi import HTTPException

from app.social.ai.caption_sanitize import normalize_generated_text as clean_generated_text
from app.social.ai.compositor import OverlayCopy, compose_creative, load_logo, parse_hex
from app.social.ai.image_generator import generate_post_image
from app.social.ai.image_quality import ImageReliabilityError, validate_image_bytes
from app.social.ai.image_progress import report_image_stage
from app.social.ai.visual_prompt import compact_context

logger = logging.getLogger(__name__)

FORMATS = ("post", "banner", "story", "carousel", "quote", "product")

_SIZES: dict[str, dict[str, tuple[int, int]]] = {
    "post": {"instagram": (1080, 1350), "facebook": (1080, 1350), "linkedin": (1200, 1200), "twitter": (1600, 900), "x": (1600, 900), "pinterest": (1000, 1500), "threads": (1080, 1350)},
    "banner": {"linkedin": (1200, 627), "facebook": (1200, 630), "twitter": (1600, 900), "x": (1600, 900), "youtube": (1280, 720)},
    "story": {},
    "carousel": {"instagram": (1080, 1350), "facebook": (1080, 1350), "linkedin": (1080, 1080)},
    "quote": {},
    "product": {"instagram": (1080, 1350), "facebook": (1080, 1350), "linkedin": (1200, 1200), "twitter": (1600, 900), "x": (1600, 900), "pinterest": (1000, 1500)},
}
_DEFAULT_SIZES = {
    "post": (1080, 1080),
    "banner": (1200, 628),
    "story": (1080, 1920),
    "carousel": (1080, 1350),
    "quote": (1080, 1080),
    "product": (1080, 1080),
}

_COMPOSITION = {
    "post": "Hero subject in the upper two-thirds, calm uncluttered lower third with soft tonal gradient for headline space.",
    "banner": "Wide cinematic composition, main subject on the right third, clean open negative space on the left half.",
    "story": "Vertical full-bleed composition, subject centered in the middle, clean top and bottom areas free of detail.",
    "carousel": "Editorial magazine composition, subject in the upper area, calm lower third, consistent series look.",
    "quote": "Abstract atmospheric background, soft textures, gentle depth of field, no people facing camera, minimal detail in the center.",
    "product": "Studio product hero shot on a styled surface, soft shadows, premium commercial lighting, subject centered with breathing room below.",
}

_DEFAULT_STYLE = "purposeful editorial visual design, a clear subject, restrained palette, refined lighting or graphic shading, crisp detail; choose illustration, diagrammatic art, product still life or photography to suit the brief"

_BUSINESS_DIRECTION = (
    "Make the approved message understandable through one concrete visual idea, not a collage of unrelated symbols. "
    "For educational or thought-leadership posts, use an editorial concept or a simple visual metaphor tied to the actual insight. "
    "For launches, show the supplied product category or benefit without fabricating a product interface. "
    "For founder or team stories, use an illustrative scene unless real reference photography is supplied; "
    "do not impersonate the founder, a customer or an employee. "
    "For case studies, never invent charts, customer identities, testimonials, badges or performance evidence. "
    "Avoid generic corporate handshakes, floating dashboards, decorative robots and rockets unless explicitly requested. "
    "Use deliberate hierarchy, believable materials and lighting, clean edges, and adequate breathing room; "
    "avoid clutter, malformed anatomy, duplicated objects and clipped focal subjects."
)

_CHANNEL_DIRECTION = {
    "linkedin": "LinkedIn: credible editorial business communication, a restrained professional treatment, one useful insight visible at feed size; not a loud stock advertisement.",
    "instagram": "Instagram: visually immediate storytelling with a strong subject, intentional texture or lighting and a cohesive palette; prioritize the supplied business and audience over generic lifestyle imagery.",
    "facebook": "Facebook: approachable, specific community or product storytelling with one clear focal point and natural visual detail; avoid clickbait treatments.",
}


@dataclass
class CreativeSpec:
    format: str = "post"
    platform: Optional[str] = None
    headline: str = ""
    subtext: str = ""
    cta: str = ""
    text_overlay: bool = False
    auto_copy: bool = True
    include_logo: bool = True
    logo_id: Optional[str] = None
    logo_position: str = "top-right"
    use_brand: bool = True
    caption: str = ""
    slide_index: Optional[int] = None
    slide_count: Optional[int] = None
    include_emojis: bool = False
    render_recipe: Optional[dict] = None
    art_direction: bool = False


@dataclass
class CreativeResult:
    image: bytes
    width: int
    height: int
    copy: OverlayCopy = field(default_factory=OverlayCopy)
    prompt: str = ""
    logo_applied: bool = False


def target_size(fmt: str, platform: Optional[str]) -> tuple[int, int]:
    fmt = fmt if fmt in FORMATS else "post"
    key = (platform or "").lower()
    return _SIZES.get(fmt, {}).get(key) or _DEFAULT_SIZES[fmt]


def generation_size(width: int, height: int) -> str:
    scale = 1280 / max(width, height)
    w = max(512, int(round(width * scale / 16)) * 16)
    h = max(512, int(round(height * scale / 16)) * 16)
    return f"{w}x{h}"


def describe_color(value: Optional[str]) -> Optional[str]:
    if not value or not re.fullmatch(r"#?[0-9a-fA-F]{6}", value.strip()):
        return None
    r, g, b = parse_hex(value, (0, 0, 0))
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if s < 0.12:
        if l < 0.18:
            return "near-black"
        if l > 0.88:
            return "off-white"
        return "charcoal grey" if l < 0.45 else "soft grey"
    hue = h * 360
    names = (
        (15, "red"), (40, "orange"), (65, "amber yellow"), (90, "lime"), (150, "green"),
        (185, "teal"), (210, "sky blue"), (245, "blue"), (275, "indigo"), (300, "violet"),
        (335, "magenta"), (360, "red"),
    )
    name = next(n for limit, n in names if hue <= limit)
    if l < 0.3:
        tone = "deep"
    elif l > 0.72:
        tone = "pastel"
    elif s > 0.65:
        tone = "vibrant"
    else:
        tone = "muted"
    return f"{tone} {name}"


def _clean(text: Optional[str], limit: Optional[int] = None) -> str:
    value = " ".join((text or "").split())
    return value[:limit]


def _sanitize_copy(copy: OverlayCopy, spec: CreativeSpec, brand: dict) -> OverlayCopy:
    allowed = spec.include_emojis and str(brand.get("emoji_usage") or "").strip().casefold() != "never"
    return OverlayCopy(**{
        key: clean_generated_text(getattr(copy, key), include_emojis=allowed)
        for key in ("headline", "subtext", "cta")
    })


def _composition(spec: CreativeSpec) -> str:
    width, height = target_size(spec.format, spec.platform)
    divisor = gcd(width, height)
    orientation = "portrait" if height > width else "landscape" if width > height else "square"
    frame = (
        f"Compose for {spec.platform or 'social media'} {spec.format}, "
        f"{width}x{height}, {width // divisor}:{height // divisor} {orientation} frame. "
        "Keep the main subject legible at mobile feed size. "
    )
    if spec.text_overlay or spec.format == "quote":
        return frame + _COMPOSITION.get(spec.format, _COMPOSITION["post"])
    return frame + "Use the full frame for the visual; no reserved headline area or text panel."


def _brand_lines(brand: dict) -> list[str]:
    lines: list[str] = []
    if brand.get("brand_name"):
        lines.append(f"Brand: {_clean(brand['brand_name'], 80)}")
    if brand.get("industry"):
        lines.append(f"Industry: {_clean(brand['industry'], 80)}")
    if brand.get("tagline"):
        lines.append(f"About: {_clean(brand['tagline'], 200)}")
    if brand.get("target_audience"):
        lines.append(f"Audience: {_clean(brand['target_audience'], 160)}")
    if brand.get("tones"):
        lines.append(f"Voice: {_clean(', '.join(brand['tones'][:3]), 120)}")
    if brand.get("words_to_use"):
        lines.append(f"Offer/keywords: {_clean(', '.join(brand['words_to_use'][:8]), 240)}")
    return lines


def _palette_phrase(brand: dict) -> str:
    colors = [c for c in (describe_color(brand.get("primary_color")), describe_color(brand.get("accent_color"))) if c]
    if not colors:
        return ""
    return f"Color palette harmonized with brand colors: {' and '.join(colors)} accents."


def build_visual_prompt(subject: str, spec: CreativeSpec, brand: dict, style: Optional[str]) -> str:
    brand = brand if spec.use_brand else {}
    parts = [
        "Absolutely no text, letters, numbers, logos, watermarks or UI elements.",
        "Brief and caption are primary: preserve their subject and constraints without inventing claims, products, offers or assets. "
        "Brand guides tone and palette only.",
        _composition(spec),
        f"Subject: {compact_context(subject, 2200)}.",
    ]
    if spec.caption:
        parts.append(f"Approved post caption (context only, not text to render): {compact_context(spec.caption, 2200)}")
    parts.append(_BUSINESS_DIRECTION)
    parts.append(_CHANNEL_DIRECTION.get(spec.platform or "", "Keep one central focal subject inside the middle 70% of the frame so square and portrait platform exports preserve the meaning."))
    parts.extend(_brand_lines(brand))
    parts.append(f"Style: {compact_context(style, 700) if style else _DEFAULT_STYLE}.")
    if spec.format == "carousel":
        parts.append("Maintain the supplied series palette, medium, subject treatment and lighting across slides; vary only this slide's subject. Keep essential visual content in the central safe region for square and portrait exports.")
    palette = _palette_phrase(brand)
    if palette:
        parts.append(palette)
    return " ".join(p for p in parts if p)


def _fallback_copy(topic: str, spec: CreativeSpec, brand: dict) -> OverlayCopy:
    source = spec.headline or topic
    first = re.split(r"(?<=[.!?])\s+|\n", source.strip(), maxsplit=1)[0]
    words = re.sub(r"[#@]\S+", "", first).split()
    headline = spec.headline or " ".join(words).rstrip(",;:-")
    cta = spec.cta or ((brand.get("cta_phrases") or [""])[0] if spec.format in ("banner", "product") else "")
    subtext = spec.subtext
    if spec.format == "quote" and not subtext and brand.get("brand_name"):
        subtext = f"— {brand['brand_name']}"
    return _sanitize_copy(OverlayCopy(headline=headline, subtext=subtext, cta=cta), spec, brand)


def art_direct(topic: str, spec: CreativeSpec, brand: dict, style: Optional[str]) -> tuple[str, OverlayCopy]:
    from app.social.ai.generator import _chat_completion, _get_llm, _message_text, _parse_json_content

    policy_brand = brand
    include_emojis = spec.include_emojis and str(brand.get("emoji_usage") or "").strip().casefold() != "never"
    brand = brand if spec.use_brand else {}
    width, height = target_size(spec.format, spec.platform)
    language = brand.get("primary_language") or "en"
    is_quote = spec.format == "quote"
    wants_copy = spec.text_overlay or is_quote
    headline_rule = (
        "headline: the quote itself, a memorable insight under 22 words, no quotation marks"
        if is_quote
        else "headline: 3-7 punchy words specific to the brief, benefit-led, Title or sentence case"
    )
    slide_line = ""
    if spec.slide_index and spec.slide_count:
        slide_line = f"This is slide {spec.slide_index} of {spec.slide_count} in a carousel; keep a consistent series look."
    system_prompt = (
        "You are the creative director of a top digital agency. Turn a social media brief into a precise "
        "text-to-image prompt. Reply with JSON only: "
        + ('{"visual":"...","headline":"...","subtext":"...","cta":"..."}. ' if wants_copy else '{"visual":"..."}. ')
        + "The original brief and post caption are the primary visual source: preserve the brief's subject and explicit "
        "visual constraints, and reflect the caption's message. Brand context guides tone, audience and palette only. "
        "Do not invent product features, results, statistics, offers, endorsements or brand assets. "
        "visual: 45-90 words describing one clear subject, setting, composition, lighting, lens or medium, mood and palette. "
        "Choose a medium grounded in the brief: editorial illustration or diagrammatic artwork for educational concepts, "
        "product still life for physical products, photography only when appropriate. Preserve any supplied series style and palette. "
        "Never request text, letters, numbers, logos, watermarks, UI or screenshots in the visual. "
        f"{_BUSINESS_DIRECTION} "
        f"{_CHANNEL_DIRECTION.get(spec.platform or '', 'Keep the focal subject within the central safe region for square and portrait exports.')} "
        f"Composition requirement: {_composition(spec)} "
    )
    if wants_copy:
        system_prompt += (
            f"{headline_rule}. subtext: optional supporting line under 14 words or empty. "
            "cta: 1-3 words only when the brief implies an action, else empty. "
            f"Preserve supplied manual copy. No Markdown, hashtags or quotation marks in generated copy. Copy language: {language}. "
            + ("Emojis are allowed sparingly." if include_emojis else "No emojis in generated copy.")
        )
    else:
        system_prompt += "Text overlays are disabled. Return only visual; do not generate headline, subtext or CTA copy."
    user_lines = [
        f"Original brief: {compact_context(topic, 2200)}",
        f"Format: {spec.format} ({width}x{height}) for {spec.platform or 'social media'}",
    ]
    if spec.caption:
        user_lines.append(f"Post caption: {compact_context(spec.caption, 2200)}")
    if wants_copy and spec.headline:
        user_lines.append(f"Preferred headline: {spec.headline}")
    if wants_copy and spec.subtext:
        user_lines.append(f"Supporting line: {spec.subtext}")
    if wants_copy and spec.cta:
        user_lines.append(f"Call to action: {spec.cta}")
    if style:
        user_lines.append(f"Visual style: {compact_context(style, 700)}")
    user_lines.extend(_brand_lines(brand))
    palette = _palette_phrase(brand)
    if palette:
        user_lines.append(palette)
    if slide_line:
        user_lines.append(slide_line)

    client, model = _get_llm()
    response = _chat_completion(
        client,
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "\n".join(user_lines)},
        ],
        max_completion_tokens=1500,
    )
    data: dict[str, Any] = _parse_json_content(_message_text(response.choices[0].message))
    visual = clean_generated_text(str(data.get("visual") or ""), include_emojis=False)
    if not wants_copy:
        return visual, OverlayCopy()
    copy = OverlayCopy(
        headline=(spec.headline or str(data.get("headline") or "")).strip("\"'“”"),
        subtext=spec.subtext or str(data.get("subtext") or ""),
        cta=spec.cta or str(data.get("cta") or ""),
    )
    return visual, _sanitize_copy(copy, spec, policy_brand)


def render_creative(
    *,
    topic: str,
    style: Optional[str],
    spec: CreativeSpec,
    brand: dict,
    logo_bytes: Optional[bytes] = None,
) -> CreativeResult:
    platform = spec.platform or ""
    try:
        return render_creative_variants(
            topic=topic, style=style, spec=spec, platforms=[platform], brand=brand, logo_bytes=logo_bytes,
        )[platform]
    except ImageReliabilityError as exc:
        raise HTTPException(status_code=502, detail={"code": exc.code, "stage": exc.stage, "message": str(exc)}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"code": "IMAGE_COMPOSE_FAILED", "stage": "compose", "message": "Creative layout could not be rendered; shorten overlay copy or change the layout"}) from exc


def render_creative_variants(
    *,
    topic: str,
    style: Optional[str],
    spec: CreativeSpec,
    platforms: Sequence[str],
    brand: dict,
    logo_bytes: Optional[bytes],
    base_image: Optional[bytes] = None,
    on_base_ready: Optional[Callable[[bytes], None]] = None,
) -> dict[str, CreativeResult]:
    platforms = list(dict.fromkeys(platforms))
    if not platforms:
        raise ValueError("At least one export platform is required")
    if base_image is not None and (not isinstance(base_image, bytes) or not base_image):
        raise ValueError("base_image must contain nonempty image bytes")
    fmt = spec.format if spec.format in FORMATS else "post"
    policy_brand = brand
    spec = replace(spec, format=fmt, platform=(platforms[0] or None) if len(platforms) == 1 else None)
    brand = brand if spec.use_brand else {}
    width, height = target_size(fmt, spec.platform)

    visual = ""
    copy = OverlayCopy(headline=spec.headline, subtext=spec.subtext, cta=spec.cta)
    wants_copy = spec.text_overlay or fmt == "quote"
    if spec.render_recipe:
        copy = OverlayCopy(**spec.render_recipe["copy"])
    elif (spec.auto_copy or spec.art_direction) and base_image is None:
        report_image_stage("concept")
        try:
            visual, directed = art_direct(topic, spec, policy_brand, style)
            if wants_copy:
                copy = directed
        except Exception as exc:
            logger.warning("Creative art direction failed, using fallback type=%s", type(exc).__name__)
    if wants_copy and not copy.headline:
        copy = _fallback_copy(topic, spec, brand)
    copy = _sanitize_copy(copy, spec, policy_brand)

    prompt = build_visual_prompt(f"Original brief: {topic}", spec, brand, style)
    if visual:
        prompt += f" Art direction (subordinate to the brief and caption): {compact_context(visual, 1100)}"
    if spec.render_recipe:
        prompt = spec.render_recipe["prompt"]
    recipe_callback = getattr(on_base_ready, "on_recipe_ready", None)
    if recipe_callback is not None:
        recipe_callback({"copy": {key: getattr(copy, key) for key in ("headline", "subtext", "cta")}, "prompt": prompt})

    if base_image is None:
        report_image_stage("generate")
        data = generate_post_image(
            topic=topic,
            style=style,
            size=generation_size(width, height),
            mode="create",
            prompt_override=prompt,
        )
        raw = data.get("imageB64")
        if not isinstance(raw, (bytes, bytearray)) or not raw:
            raise RuntimeError("Image provider returned no bytes")
        base_image = bytes(raw)
    validate_image_bytes(base_image, stage="base")
    if on_base_ready is not None:
        on_base_ready(base_image)

    slide_label = None
    if fmt == "carousel" and spec.slide_index and spec.slide_count:
        slide_label = f"{spec.slide_index}/{spec.slide_count}"

    logo_ok = bool(spec.include_logo and logo_bytes and load_logo(logo_bytes, 64, 64) is not None)
    results: dict[str, CreativeResult] = {}
    report_image_stage("format")
    for platform in platforms:
        width, height = target_size(fmt, platform)
        image = compose_creative(
            base_image,
            width=width,
            height=height,
            layout=fmt,
            copy=copy if wants_copy else None,
            logo_bytes=logo_bytes if logo_ok else None,
            logo_position=spec.logo_position,
            primary_color=brand.get("primary_color"),
            accent_color=brand.get("accent_color"),
            slide_label=slide_label,
        )
        results[platform] = CreativeResult(
            image=image, width=width, height=height,
            copy=copy if wants_copy else OverlayCopy(), prompt=prompt, logo_applied=logo_ok,
        )
    return results
