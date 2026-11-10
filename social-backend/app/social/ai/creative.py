from __future__ import annotations

import colorsys
import contextvars
import logging
from concurrent.futures import ThreadPoolExecutor
from math import gcd
import re
from dataclasses import dataclass, field, replace
from typing import Any, Callable, Optional, Sequence

from fastapi import HTTPException

from app.core.config import settings
from app.social.ai.caption_sanitize import normalize_generated_text as clean_generated_text
from app.social.ai.compositor import OverlayCopy, compose_creative, load_logo, parse_hex
from app.social.ai.image_generator import generate_post_image
from app.social.ai.image_judge import pick_best_image
from app.social.ai.image_quality import ImageReliabilityError, validate_image_bytes
from app.social.ai.image_progress import report_image_stage
from app.social.ai.visual_prompt import compact_context
from app.social.ai.visual_skills import VisualSkill, select_visual_skill, strip_platform_labels

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

CONCEPT_TYPES = ("product", "food", "people", "place", "event", "educational", "data", "quote", "abstract")
_PHOTO_CONCEPTS = frozenset({"product", "food", "people", "place", "event"})

_MEDIUM = {
    "product": "premium commercial product photography on a styled surface, controlled softbox lighting, crisp material detail",
    "food": "editorial food photography, natural window light, appetizing texture, shallow depth of field",
    "people": "authentic lifestyle documentary photography, candid natural moment, 50mm lens, shallow depth of field",
    "place": "architectural and environmental photography, wide establishing view, natural golden-hour light",
    "event": "vibrant event photography capturing the real atmosphere, engaged attendees, natural venue lighting",
    "educational": "clean editorial illustration built on one clear visual metaphor, flat shapes, generous negative space",
    "data": "minimal conceptual editorial illustration of the idea using bold simple shapes and one symbolic object",
    "quote": "atmospheric fine-art background with soft textured light and a calm low-detail center",
    "abstract": "conceptual editorial still life built around one symbolic object, refined studio lighting",
}

_CONCEPT_KEYWORDS = (
    ("food", r"bakery|bread|sourdough|caf[eé]|coffee|restaurant|recipe|menu|dish|chef|kitchen|food|meal|dessert|cake|pizza|catering|brunch"),
    ("event", r"\bevent|webinar|conference|summit|workshop|meetup|grand opening|festival|expo\b|exhibition|launch party"),
    ("place", r"real estate|property|apartment|villa|hotel|resort|travel|destination|interior|showroom|venue|storefront|clinic|\bgym\b"),
    ("product", r"product|collection|device|gadget|bottle|packaging|skincare|cosmetic|shoe|apparel|fashion|jewel|furniture|launch"),
    ("data", r"\d+\s?%|percent|statistic|survey|benchmark|growth rate|\broi\b|revenue|report"),
    ("educational", r"how to|\btips?\b|guide|\bsteps?\b|checklist|mistakes|lessons?\b|explained|framework|myth|ways to|best practices"),
    ("quote", r"\bquote\b|motivation|inspiration|mindset"),
    # People last: match only when content is genuinely about people, not just mentions a tool/platform
    ("people", r"\bteam\b|founder|customer|client|hiring|community|employee|coach|patient|student|runner|athlete|family|retailer|\bpeople\b"),
)

_CHANNEL_MOOD = {
    "linkedin": "credible, professional and editorial",
    "instagram": "visually striking with rich texture and color",
    "facebook": "warm, approachable and human",
    "pinterest": "aspirational and richly detailed",
    "threads": "authentic and conversational",
    "twitter": "bold and instantly readable at small size",
    "x": "bold and instantly readable at small size",
}

_CLEAN_FINISH = "Plain unbranded surfaces, high detail, professional finish"
_NEGATION_START_RE = re.compile(r"^\s*(?:no|not|without|never|avoid|avoiding|don'?t|do not|zero|free of)\b\s*", re.I)
_NEGATION_TAIL_RE = re.compile(r"\s+(?:with no|without|but no|and no|free of|devoid of)\s+(.+)$", re.I)

_BASE_NEGATIVE = (
    "text, letters, words, typography, caption, watermark, logo, signature, "
    "word art, word cloud, letter shapes embedded in objects, typography integrated into shapes, "
    "text silhouette, labels in image, numbers, "
    "blurry, low quality, jpeg artifacts, "
    "distorted, deformed, malformed hands, extra fingers, duplicated objects, cropped subject"
)
_PHOTO_NEGATIVE = "cartoon, clip art, 3d render, plastic skin, oversaturated"
_ILLUSTRATION_NEGATIVE = (
    "photorealistic photo, cluttered background, busy collage, "
    "network diagram, node graph, constellation map, scatter plot, data visualization, "
    "line graph, flowchart, technical diagram, connection lines, abstract geometry pattern"
)
_CLICHES = (
    ("corporate handshake", "handshake"), ("floating laptop mockup", "laptop"), ("floating phone mockup", "phone"),
    ("gradient blobs", "gradient"), ("decorative orbs", "orb"), ("generic stock photo", "stock"), ("robot", "robot"), ("rocket", "rocket"),
)
_ILLUSTRATED_RE = re.compile(r"illustrat|vector|flat design|cartoon|3d|watercolou?r|drawing|sketch|anime|painting|line art|linocut|collage", re.I)

_INSTRUCTION_RE = re.compile(
    r"^(?:(?:tone|content type|brand|industry|tagline(?:\s*/\s*positioning)?|target audience|format|platform|words to (?:prefer|avoid|use))\s*:|"
    r"use all approved|visual art direction|content plan\b|write for\b|must be clearly different|do not invent|preferred cta|no watermarks|"
    r"choose a specific visual|single strong focal|approved (?:post )?caption|premium \w+ marketing visual|today'?s (?:creative )?angle|creative angle)",
    re.I,
)
_LABEL_RE = re.compile(r"^(?:original brief|campaign context|campaign brief(?: \(source of truth\))?|brief|topic|subject)\s*:\s*", re.I)

FALLBACK_WARNING = "AI art direction was unavailable, so this image used a simplified prompt from your brief. Regenerate for a more tailored concept."


def _is_campaign_hero(spec: CreativeSpec) -> bool:
    return (spec.visual_treatment or "campaign_hero") == "campaign_hero"


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
    visual_treatment: str = "campaign_hero"
    slide_prompt: str = ""
    series_style: str = ""
    concept_override: Optional[dict] = None
    brand_lockup: bool = False
    product_scene: bool = False
    product_asset_id: Optional[str] = None


@dataclass
class VisualConcept:
    concept_type: str = "abstract"
    subject: str = ""
    setting: str = ""
    medium: str = ""
    composition: str = ""
    lighting: str = ""
    palette: str = ""
    mood: str = ""
    avoid: list[str] = field(default_factory=list)
    source: str = "llm"


@dataclass
class CreativeResult:
    image: bytes
    width: int
    height: int
    copy: OverlayCopy = field(default_factory=OverlayCopy)
    prompt: str = ""
    logo_applied: bool = False
    negative_prompt: str = ""
    concept: Optional[VisualConcept] = None
    warnings: list[str] = field(default_factory=list)


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


def _orientation(spec: CreativeSpec) -> tuple[str, str]:
    width, height = target_size(spec.format, spec.platform)
    divisor = gcd(width, height)
    orientation = "portrait" if height > width else "landscape" if width > height else "square"
    return f"{width // divisor}:{height // divisor}", orientation


def _placement(spec: CreativeSpec) -> str:
    if _wants_copy(spec):
        return "focal subject in the upper two-thirds with calm open space in the lower third"
    if spec.platform is None:
        return "focal subject centred with generous breathing room on every side"
    return "full-bleed composition with the focal subject inside the central safe area"


def _frame(spec: CreativeSpec) -> str:
    ratio, orientation = _orientation(spec)
    return f"{ratio} {orientation} {spec.format} for {spec.platform or 'several social channels'}, {_placement(spec)}"


def _composition_hint(spec: CreativeSpec) -> str:
    return f"{_orientation(spec)[1]} composition, {_placement(spec)}"


def split_negations(text: Optional[str]) -> tuple[str, list[str]]:
    keep: list[str] = []
    dropped: list[str] = []
    for clause in re.split(r"[,;.]\s*|\s+-\s+", text or ""):
        clause = " ".join(clause.split())
        if not clause:
            continue
        if _NEGATION_START_RE.match(clause):
            rest = _NEGATION_START_RE.sub("", clause).strip()
            if rest:
                dropped.append(rest)
            continue
        tail = _NEGATION_TAIL_RE.search(clause)
        if tail:
            dropped.append(tail.group(1).strip())
            clause = clause[: tail.start()].strip()
        if clause:
            keep.append(clause)
    return ", ".join(keep), [item[:60] for item in dropped if item]


def positive_concept(concept: VisualConcept) -> VisualConcept:
    avoid = list(concept.avoid)
    updates: dict[str, str] = {}
    for key in ("subject", "setting", "medium", "composition", "lighting", "palette", "mood"):
        value = getattr(concept, key)
        if not value or not re.search(r"\b(?:no|not|without|never|avoid|free of|devoid of)\b", value, re.I):
            continue
        kept, dropped = split_negations(value)
        updates[key] = kept if kept or key != "subject" else value
        avoid.extend(dropped)
    return replace(concept, **updates, avoid=list(dict.fromkeys(a for a in avoid if a))[:10])


def _is_illustrated(concept: VisualConcept, style: Optional[str] = None) -> bool:
    art = f"{concept.medium} {style or ''}"
    if _ILLUSTRATED_RE.search(art):
        return True
    if re.search(r"photo", art, re.I):
        return False
    return concept.concept_type not in _PHOTO_CONCEPTS


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
    if brand.get("visual_style"):
        lines.append(f"Brand image style: {_clean(brand['visual_style'], 400)}")
    return lines


def _palette_phrase(brand: dict) -> str:
    colors = [c for c in (describe_color(brand.get("primary_color")), describe_color(brand.get("accent_color"))) if c]
    if not colors:
        return ""
    return f"Brand colours: {' and '.join(colors)}."


def _brand_palette(brand: dict) -> str:
    colors = [c for c in (describe_color(brand.get("primary_color")), describe_color(brand.get("accent_color"))) if c]
    return f"{' and '.join(colors)} accents" if colors else ""


def _brief_core(text: Optional[str], limit: int = 420) -> str:
    seen: set[str] = set()
    pieces: list[str] = []
    for chunk in re.split(r"\n+|(?<=[.!?])\s+", text or ""):
        chunk = _LABEL_RE.sub("", " ".join(chunk.split())).strip()
        if len(chunk) < 3 or _INSTRUCTION_RE.match(chunk):
            continue
        chunk = " ".join(re.sub(r"(?<!\w)[#@]\w+", "", chunk).split()).strip(" .")
        if chunk and chunk.casefold() not in seen:
            seen.add(chunk.casefold())
            pieces.append(chunk)
    return compact_context(". ".join(pieces), limit)


def classify_concept(text: str) -> str:
    lowered = (text or "").lower()
    for kind, pattern in _CONCEPT_KEYWORDS:
        if re.search(pattern, lowered):
            return kind
    return "abstract"


def _treatment_medium(concept_type: str, spec: CreativeSpec) -> str:
    medium = _MEDIUM.get(concept_type, _MEDIUM["abstract"])
    if not _is_campaign_hero(spec):
        medium += ", restrained minimal styling, generous negative space"
    return medium


def fallback_concept(topic: str, spec: CreativeSpec, brand: dict) -> VisualConcept:
    brand = brand if spec.use_brand else {}
    # Strip platform labels and use the cleaned caption as the primary source.
    clean_cap = strip_platform_labels(spec.caption) if spec.caption else ""
    primary = clean_cap or topic
    pieces = [spec.slide_prompt, spec.headline if spec.slide_index else "", _brief_core(primary, 420)]
    # If primary gave nothing useful and it was the caption, also try the brief
    if not any(p for p in pieces if p and p.strip()) and primary != topic:
        pieces.append(_brief_core(topic, 300))
    subject = compact_context("; ".join(dict.fromkeys(p.strip() for p in pieces if p and p.strip())), 420)
    if not subject:
        subject = compact_context(clean_generated_text(primary or topic or "", include_emojis=False), 300)
    industry = _clean(brand.get("industry"), 80)
    skill = select_visual_skill(primary, topic, industry, spec.format)
    kind = skill.concept_type if skill else classify_concept(f"{subject} {industry}")
    medium = skill.medium if skill else _treatment_medium(kind, spec)
    if skill and not _is_campaign_hero(spec):
        medium += ", restrained minimal styling, generous negative space"
    logger.info("Fallback concept skill=%s kind=%s", skill.name if skill else None, kind)
    return positive_concept(VisualConcept(
        concept_type=kind,
        subject=subject,
        setting=f"authentic real-world {industry} context" if industry else "",
        medium=medium,
        avoid=list(skill.avoid_extra) if skill else [],
        source="fallback",
    ))


def _coerce_concept(value: Any) -> VisualConcept:
    if isinstance(value, VisualConcept):
        if not value.subject.strip():
            raise ValueError("Art direction returned no visual subject")
        return value
    subject = compact_context(clean_generated_text(str(value or ""), include_emojis=False), 600)
    if not subject:
        raise ValueError("Art direction returned no visual subject")
    return VisualConcept(concept_type=classify_concept(subject), subject=subject)


def _palette_for(concept: VisualConcept, brand: dict, style: Optional[str]) -> str:
    if concept.palette:
        return concept.palette
    if _is_illustrated(concept, style) or concept.concept_type in ("abstract", "quote"):
        return _brand_palette(brand)
    return ""


def compile_image_prompt(concept: VisualConcept, spec: CreativeSpec, brand: dict, style: Optional[str]) -> str:
    brand = brand if spec.use_brand else {}
    concept = positive_concept(concept)
    medium = concept.medium or _treatment_medium(concept.concept_type, spec)
    palette = _palette_for(concept, brand, style)
    style_text = split_negations(style)[0] if style else ""
    series_text = split_negations(spec.series_style)[0] if spec.series_style else ""
    parts = [
        compact_context(concept.subject, 360),
        concept.setting and f"Setting: {compact_context(concept.setting, 160)}",
        f"Medium: {compact_context(medium, 200)}",
        style_text and f"Style direction: {compact_context(style_text, 240)}",
        series_text and f"Series look shared by every slide: {compact_context(series_text, 200)}",
        f"Composition: {compact_context(concept.composition, 140) + ', ' if concept.composition else ''}{_composition_hint(spec)}",
        concept.lighting and f"Lighting: {compact_context(concept.lighting, 120)}",
        f"Mood: {compact_context(concept.mood, 100) if concept.mood else _CHANNEL_MOOD.get(spec.platform or '', 'premium, specific and purposeful')}",
        palette and f"Palette: {compact_context(palette, 120)}",
        concept.concept_type in ("people", "event") and "Generic models, not identifiable real people",
        _CLEAN_FINISH,
    ]
    return ". ".join(str(p).strip().rstrip(".") for p in parts if p) + "."


def build_negative_prompt(concept: VisualConcept, style: Optional[str] = None, topic: str = "") -> str:
    concept = positive_concept(concept)
    photographic = not _is_illustrated(concept, style)
    requested = f"{topic} {concept.subject} {style or ''}".lower()
    parts = [_BASE_NEGATIVE, _PHOTO_NEGATIVE if photographic else _ILLUSTRATION_NEGATIVE]
    parts.append(", ".join(term for term, key in _CLICHES if not re.search(rf"(?<!no )(?<!avoid )(?<!without )\b{key}", requested)))
    parts.append(", ".join(concept.avoid[:10]))
    if style:
        parts.append(", ".join(split_negations(style)[1][:4]))
    return ", ".join(p for p in parts if p)[:1200]


def series_signature(concept: VisualConcept, spec: CreativeSpec, brand: dict) -> str:
    concept = positive_concept(concept)
    palette = _palette_for(concept, brand if spec.use_brand else {}, None)
    parts = [concept.medium or _treatment_medium(concept.concept_type, spec), palette and f"palette {palette}", concept.lighting and f"lighting {concept.lighting}"]
    return compact_context("; ".join(p for p in parts if p), 240)


def build_visual_prompt(subject: str, spec: CreativeSpec, brand: dict, style: Optional[str]) -> str:
    return compile_image_prompt(fallback_concept(subject, spec, brand), spec, brand, style)


def _fallback_copy(topic: str, spec: CreativeSpec, brand: dict) -> OverlayCopy:
    source = spec.headline or _brief_core(topic) or topic
    first = re.split(r"(?<=[.!?])\s+|\n", source.strip(), maxsplit=1)[0]
    words = re.sub(r"[#@]\S+", "", first).split()
    headline = spec.headline or " ".join(words).rstrip(",;:-")
    cta = spec.cta or ((brand.get("cta_phrases") or [""])[0] if spec.format in ("banner", "product") else "")
    subtext = spec.subtext
    if spec.format == "quote" and not subtext and brand.get("brand_name"):
        subtext = f"— {brand['brand_name']}"
    return _sanitize_copy(OverlayCopy(headline=headline, subtext=subtext, cta=cta), spec, brand)


def _wants_copy(spec: CreativeSpec) -> bool:
    return spec.text_overlay or spec.format == "quote"


def _requests_copy(spec: CreativeSpec) -> bool:
    return _wants_copy(spec) and (spec.auto_copy or spec.art_direction)


def _concept_from_data(data: dict[str, Any], topic: str) -> VisualConcept:
    def text(key: str, limit: int, alt: str = "") -> str:
        value = data.get(key) or (data.get(alt) if alt else "")
        if not isinstance(value, str):
            value = ", ".join(str(v) for v in value) if isinstance(value, (list, tuple)) else ""
        return compact_context(clean_generated_text(value, include_emojis=False), limit)

    subject = text("subject", 600, "visual")
    if not subject:
        raise ValueError("Art direction returned no visual subject")
    kind = str(data.get("conceptType") or data.get("concept_type") or "").strip().lower()
    if kind not in CONCEPT_TYPES:
        kind = classify_concept(f"{subject} {topic}")
    raw_avoid = data.get("avoid")
    if isinstance(raw_avoid, str):
        raw_avoid = raw_avoid.split(",")
    avoid = [
        compact_context(clean_generated_text(str(item), include_emojis=False), 60)
        for item in (raw_avoid if isinstance(raw_avoid, (list, tuple)) else [])
    ]
    return VisualConcept(
        concept_type=kind,
        subject=subject,
        setting=text("setting", 200),
        medium=text("medium", 240),
        composition=text("composition", 200),
        lighting=text("lighting", 160),
        palette=text("palette", 160),
        mood=text("mood", 120),
        avoid=[item for item in avoid if item][:6],
    )


def art_direct(
    topic: str,
    spec: CreativeSpec,
    brand: dict,
    style: Optional[str],
    *,
    hint_platform: Optional[str] = None,
    recent_subjects: Sequence[str] = (),
) -> tuple[VisualConcept, OverlayCopy]:
    """Generate a VisualConcept via LLM art direction.

    ``hint_platform`` is used when ``spec.platform`` is None (multi-platform
    generation) to still pick the correct channel mood and framing context.
    It must NOT affect image generation dimensions — only the concept/prompt.
    """
    from app.social.ai.generator import _chat_completion, _get_llm, _message_text, _parse_json_content

    policy_brand = brand
    include_emojis = spec.include_emojis and str(brand.get("emoji_usage") or "").strip().casefold() != "never"
    brand = brand if spec.use_brand else {}
    width, height = target_size(spec.format, spec.platform)
    language = brand.get("primary_language") or "en"
    is_quote = spec.format == "quote"
    wants_copy = _requests_copy(spec)
    headline_rule = (
        "headline: the quote itself, a memorable insight under 22 words, no quotation marks"
        if is_quote
        else "headline: 3-7 punchy words specific to the brief, benefit-led, Title or sentence case"
    )
    schema = (
        '{"conceptType":"...","subject":"...","setting":"...","medium":"...","composition":"...",'
        '"lighting":"...","palette":"...","mood":"...","avoid":["..."]'
        + (',"headline":"...","subtext":"...","cta":"..."}' if wants_copy else "}")
    )
    treatment = (
        "Campaign quality: prefer real-world photography for products, food, people, places and events, and editorial illustration for educational or data ideas."
        if _is_campaign_hero(spec)
        else "Minimal treatment: restrained composition, generous negative space and a simple medium."
    )
    medium_guide = "; ".join(f"{kind}: {medium}" for kind, medium in _MEDIUM.items())
    # Use hint_platform for mood/framing label when the spec has no single platform (multi-platform)
    effective_platform = spec.platform or hint_platform or ""

    # Strip channel-routing prefixes ("linkedin:\n", "facebook:\n") injected by the frontend.
    # These are metadata, not content — seeing them biases the LLM toward platform-specific imagery.
    clean_caption = strip_platform_labels(spec.caption) if spec.caption else ""

    skill: Optional[VisualSkill] = select_visual_skill(clean_caption, topic, _clean(brand.get("industry"), 120), spec.format)

    system_prompt = (
        "You are the art director of a top creative agency. Turn one social media brief into ONE concrete, specific image concept "
        f"for a text-to-image model. Reply with JSON only: {schema}. "
        "The approved post caption is the primary visual source: it defines exactly what the image must show. "
        "The campaign brief and brand provide business context, audience and industry. "
        "The image must clearly belong to this specific post and this specific business, never a generic stock template. "
        f"conceptType: one of {', '.join(CONCEPT_TYPES)}. "
        "subject: 15-40 words naming the single focal subject and its action with concrete, industry-specific nouns that a "
        "photographer or illustrator could depict. "
        "setting, composition, lighting, palette and mood: short concrete phrases. "
        f"medium: the medium that best serves this concept. Defaults by conceptType: {medium_guide}. {treatment} "
        "An explicit visual style from the user or the brand image style overrides these defaults. "
        "Write every field as a positive description of what IS in the frame. Put everything to exclude only in avoid. "
        "avoid: up to 6 short noun phrases to keep out of the image, from the brief's constraints and likely failure modes. "
        "Do not invent product interfaces, statistics, charts, customer identities, testimonials, awards, offers or logos. "
        "People must be generic models, never a real named person. "
        "Skip stock clichés such as handshakes, floating laptops or phones, gradient blobs, robots, rockets and lightbulbs unless the brief asks for them; "
        "list them in avoid instead. "
        "Prevent malformed anatomy, duplicated objects and clipped focal subjects. "
        "Photographs keep natural true-to-life colour; use brand colours as the palette only for illustrations, abstract or quote backgrounds, "
        "and otherwise at most as one subtle accent. "
        "The image carries no written words; any headline and logo are added after generation. "
        "A caption that addresses the reader as 'you' does not by itself call for a person; show what the post is about. "
        f"Framing: {_frame(spec)}. Channel mood: {_CHANNEL_MOOD.get(effective_platform, 'premium, specific and purposeful')}. "
    )

    if skill:
        system_prompt += (
            f"Suggested visual strategy '{skill.name}': conceptType '{skill.concept_type}', medium '{skill.medium}'. "
            f"{skill.subject_guide} Follow it unless the caption clearly calls for a different image. "
        )
        if skill.avoid_extra:
            system_prompt += f"Typical items for avoid: {', '.join(skill.avoid_extra)}. "
    if spec.product_scene:
        system_prompt += (
            "The customer's real product photo will be placed in the lower centre of the frame. "
            "conceptType must be 'product'. subject: describe the scene around the product: the surface it stands on, "
            "the setting, props and atmosphere that make it desirable, with the product as the hero. "
        )
    logger.info("Art direction skill=%s", skill.name if skill else None)

    if spec.series_style:
        system_prompt += "Keep the supplied series look exactly and vary only the subject. "
    if wants_copy:
        system_prompt += (
            f"{headline_rule}. subtext: optional supporting line under 14 words or empty. "
            "cta: 1-3 words only when the brief implies an action, else empty. "
            f"Preserve supplied manual copy. No Markdown, hashtags or quotation marks in generated copy. Copy language: {language}. "
            + ("Emojis are allowed sparingly." if include_emojis else "No emojis in generated copy.")
        )
    else:
        system_prompt += "Do not generate headline, subtext or CTA copy."

    # Build user message: cleaned caption FIRST as the primary visual source, brief as context.
    # When no caption is present (e.g. AI Studio initial generation), the brief is the sole source.
    user_lines = []
    if clean_caption:
        user_lines.append(f"Approved post caption (primary visual source): {compact_context(clean_caption, 1600)}")
        user_lines.append(f"Campaign brief (context): {compact_context(topic, 1200)}")
    else:
        user_lines.append(f"Original brief: {compact_context(topic, 2200)}")
    user_lines.append(
        f"Format: {spec.format} ({width}x{height}) for {effective_platform or 'social media'}"
    )
    if spec.slide_prompt:
        user_lines.append(f"This slide's subject: {compact_context(spec.slide_prompt, 400)}")
    if spec.series_style:
        user_lines.append(f"Series look to keep: {spec.series_style}")
    if spec.slide_index and spec.headline and not wants_copy:
        user_lines.append(f"Slide headline (context only): {spec.headline}")
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
    if spec.slide_index and spec.slide_count:
        user_lines.append(f"This is slide {spec.slide_index} of {spec.slide_count} in a carousel.")
    recent = [compact_context(s, 160) for s in recent_subjects if s and s.strip()][:8]
    if recent:
        user_lines.append("Recent images for this brand (choose a clearly different subject and setting): " + " | ".join(recent))

    client, model = _get_llm()
    response = _chat_completion(
        client,
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "\n".join(user_lines)},
        ],
        max_completion_tokens=1200,
    )
    data: dict[str, Any] = _parse_json_content(_message_text(response.choices[0].message))
    concept = positive_concept(_concept_from_data(data, topic))
    logger.info("Art direction concept type=%s subject=%s", concept.concept_type, concept.subject[:160])
    if not wants_copy:
        return concept, OverlayCopy()
    copy = OverlayCopy(
        headline=(spec.headline or str(data.get("headline") or "")).strip("\"'“”"),
        subtext=spec.subtext or str(data.get("subtext") or ""),
        cta=spec.cta or str(data.get("cta") or ""),
    )
    return concept, _sanitize_copy(copy, spec, policy_brand)


_CONCEPT_DIRECTIONS = (
    "a literal, real-world photograph of exactly what the post is about",
    "a striking visual metaphor that makes the post's core idea instantly clear",
    "a different medium, such as a styled flat lay, editorial illustration or cinematic close-up",
)
_PRODUCT_DIRECTIONS = (
    "a premium studio scene with a styled surface and soft controlled light",
    "a real-life lifestyle setting where the product is used",
    "a bold seasonal or campaign scene with rich props and atmosphere",
)


def concept_to_dict(concept: VisualConcept, title: str = "") -> dict[str, Any]:
    return {
        "title": title, "conceptType": concept.concept_type, "subject": concept.subject, "setting": concept.setting,
        "medium": concept.medium, "composition": concept.composition, "lighting": concept.lighting,
        "palette": concept.palette, "mood": concept.mood, "avoid": list(concept.avoid[:8]),
    }


def explore_concepts(
    topic: str,
    spec: CreativeSpec,
    brand: dict,
    style: Optional[str],
    *,
    recent_subjects: Sequence[str] = (),
) -> list[dict[str, Any]]:
    from app.social.ai.generator import _chat_completion, _get_llm, _message_text, _parse_json_content

    brand = brand if spec.use_brand else {}
    style = (style or "").strip() or _clean(brand.get("visual_style"), 400) or None
    clean_caption = strip_platform_labels(spec.caption) if spec.caption else ""
    skill = select_visual_skill(clean_caption, topic, _clean(brand.get("industry"), 120), spec.format)
    directions = _PRODUCT_DIRECTIONS if spec.product_scene else _CONCEPT_DIRECTIONS
    system_prompt = (
        "You are the art director of a top creative agency. Propose exactly 3 clearly different image concepts for one social media post. "
        'Reply with JSON only: {"concepts":[{"title":"2-4 words","conceptType":"...","subject":"...","setting":"...","medium":"...",'
        '"composition":"...","lighting":"...","palette":"...","mood":"...","avoid":["..."]}]}. '
        + " ".join(f"Concept {i}: {d}." for i, d in enumerate(directions, 1))
        + f" conceptType: one of {', '.join(CONCEPT_TYPES)}. "
        "subject: 15-40 words with concrete, industry-specific nouns a photographer or illustrator could depict. "
        "Write every field as a positive description of what IS in the frame; put exclusions only in avoid. "
        "The approved caption is the primary visual source; the image must clearly belong to this business and post. "
        "Do not invent product interfaces, statistics, charts, customer identities, testimonials, awards, offers or logos. "
        "People must be generic models. The image carries no written words. "
        "Photographs keep natural true-to-life colour; brand colours are the palette only for illustrations or abstract scenes. "
        f"Framing: {_frame(spec)}. "
    )
    if skill:
        system_prompt += f"Hint for concept 1: {skill.subject_guide} "
    if spec.product_scene:
        system_prompt += (
            "The customer's real product photo will be placed in the lower centre of the frame. "
            "Each subject describes the scene around the product: surface, setting, props and atmosphere. "
        )
    user_lines = []
    if clean_caption:
        user_lines.append(f"Approved post caption (primary visual source): {compact_context(clean_caption, 1600)}")
        user_lines.append(f"Campaign brief (context): {compact_context(topic, 1200)}")
    else:
        user_lines.append(f"Original brief: {compact_context(topic, 2200)}")
    if style:
        user_lines.append(f"Visual style: {compact_context(style, 700)}")
    user_lines.extend(_brand_lines(brand))
    palette = _palette_phrase(brand)
    if palette:
        user_lines.append(palette)
    recent = [compact_context(s, 160) for s in recent_subjects if s and s.strip()][:8]
    if recent:
        user_lines.append("Recent images for this brand (choose clearly different subjects): " + " | ".join(recent))

    try:
        client, model = _get_llm()
        response = _chat_completion(
            client,
            model=model,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": "\n".join(user_lines)}],
            max_completion_tokens=1800,
        )
        data = _parse_json_content(_message_text(response.choices[0].message))
        raw = data.get("concepts") if isinstance(data, dict) else None
        results: list[dict[str, Any]] = []
        for item in raw if isinstance(raw, list) else []:
            if not isinstance(item, dict):
                continue
            try:
                concept = positive_concept(_concept_from_data(item, topic))
            except ValueError:
                continue
            title = compact_context(clean_generated_text(str(item.get("title") or ""), include_emojis=False), 60)
            results.append(concept_to_dict(concept, title))
        if results:
            return results[:3]
    except Exception as exc:
        logger.warning("Concept exploration failed type=%s: %s", type(exc).__name__, exc)
    return [concept_to_dict(fallback_concept(topic, spec, brand), "From your brief")]


def render_creative(
    *,
    topic: str,
    style: Optional[str],
    spec: CreativeSpec,
    brand: dict,
    logo_bytes: Optional[bytes] = None,
    recent_subjects: Sequence[str] = (),
    product_image: Optional[bytes] = None,
) -> CreativeResult:
    platform = spec.platform or ""
    try:
        return render_creative_variants(
            topic=topic, style=style, spec=spec, platforms=[platform], brand=brand, logo_bytes=logo_bytes,
            recent_subjects=recent_subjects, product_image=product_image,
        )[platform]
    except ImageReliabilityError as exc:
        raise HTTPException(status_code=502, detail={"code": exc.code, "stage": exc.stage, "message": str(exc)}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"code": "IMAGE_COMPOSE_FAILED", "stage": "compose", "message": "Creative layout could not be rendered; shorten overlay copy or change the layout"}) from exc


def candidate_count(spec: CreativeSpec) -> int:
    if spec.format == "carousel":
        return 1
    return max(1, min(4, int(settings.image_candidates or 1)))


def _generate_candidates(make: Callable[[], bytes], count: int) -> list[bytes]:
    if count <= 1:
        return [make()]
    images: list[bytes] = []
    errors: list[Exception] = []
    with ThreadPoolExecutor(max_workers=count) as pool:
        futures = [pool.submit(contextvars.copy_context().run, make) for _ in range(count)]
        for future in futures:
            try:
                images.append(future.result())
            except Exception as exc:
                errors.append(exc)
    if not images:
        raise errors[0]
    if errors:
        logger.warning("Image candidates partially failed ok=%d failed=%d first=%s", len(images), len(errors), errors[0])
    return images


def _concept_from_override(value: dict, topic: str) -> VisualConcept:
    concept = positive_concept(_concept_from_data(value, topic))
    concept.source = "user"
    return concept


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
    recent_subjects: Sequence[str] = (),
    product_image: Optional[bytes] = None,
) -> dict[str, CreativeResult]:
    platforms = list(dict.fromkeys(platforms))
    if not platforms:
        raise ValueError("At least one export platform is required")
    if base_image is not None and (not isinstance(base_image, bytes) or not base_image):
        raise ValueError("base_image must contain nonempty image bytes")
    fmt = spec.format if spec.format in FORMATS else "post"
    policy_brand = brand
    spec = replace(
        spec, format=fmt, platform=(platforms[0] or None) if len(platforms) == 1 else None,
        product_scene=spec.product_scene or product_image is not None,
    )
    hint_platform = platforms[0] or None
    brand = brand if spec.use_brand else {}
    style = (style or "").strip() or _clean(brand.get("visual_style"), 400) or None
    width, height = target_size(fmt, spec.platform)

    concept: Optional[VisualConcept] = None
    warnings: list[str] = []
    copy = OverlayCopy(headline=spec.headline, subtext=spec.subtext, cta=spec.cta)
    wants_copy = _wants_copy(spec)
    if spec.render_recipe:
        copy = OverlayCopy(**spec.render_recipe["copy"])
    elif base_image is None and spec.concept_override:
        concept = _concept_from_override(spec.concept_override, topic)
        if _requests_copy(spec):
            report_image_stage("concept")
            try:
                copy = art_direct(topic, spec, policy_brand, style, hint_platform=hint_platform)[1]
            except Exception as exc:
                logger.warning("Copy direction failed type=%s: %s", type(exc).__name__, exc)
    elif base_image is None:
        report_image_stage("concept")
        _last_art_exc: Optional[Exception] = None
        for _attempt in range(2):
            try:
                raw_concept, directed = art_direct(
                    topic, spec, policy_brand, style, hint_platform=hint_platform, recent_subjects=recent_subjects,
                )
                concept = _coerce_concept(raw_concept)
                if _requests_copy(spec):
                    copy = directed
                _last_art_exc = None
                break
            except Exception as exc:
                _last_art_exc = exc
                logger.warning(
                    "Creative art direction attempt %d/2 failed type=%s: %s",
                    _attempt + 1, type(exc).__name__, exc,
                )
        if _last_art_exc is not None:
            logger.warning("Creative art direction failed after 2 attempts, using fallback")
            warnings.append(FALLBACK_WARNING)
            concept = fallback_concept(topic, spec, policy_brand)
    if wants_copy and not copy.headline:
        copy = _fallback_copy(topic, spec, brand)
    copy = _sanitize_copy(copy, spec, policy_brand)

    prompt = ""
    negative_prompt = None
    if spec.render_recipe:
        prompt = spec.render_recipe["prompt"]
        negative_prompt = spec.render_recipe.get("negativePrompt") or None
    elif concept is not None:
        prompt = compile_image_prompt(concept, spec, brand, style)
        negative_prompt = build_negative_prompt(concept, style, topic)
    else:
        prompt = build_visual_prompt(topic, spec, brand, style)
    recipe_callback = getattr(on_base_ready, "on_recipe_ready", None)
    logger.info(
        "Creative prompt source=%s type=%s chars=%d prompt=%s",
        concept.source if concept else "recipe", concept.concept_type if concept else None, len(prompt), prompt[:400],
    )

    if base_image is None:
        report_image_stage("generate")
        gen_size = generation_size(width, height)
        if product_image is not None:
            from app.social.ai.product_scene import product_cutout, render_product_scene

            cutout = product_cutout(product_image)
            gen_w, gen_h = (int(v) for v in gen_size.split("x"))

            def make() -> bytes:
                data = render_product_scene(cutout, width=gen_w, height=gen_h, prompt=prompt, negative_prompt=negative_prompt)
                validate_image_bytes(data, stage="base")
                return data
        else:
            def make() -> bytes:
                data = generate_post_image(
                    topic=topic,
                    style=style,
                    size=gen_size,
                    mode="create",
                    prompt_override=prompt,
                    negative_prompt=negative_prompt,
                )
                raw = data.get("imageB64")
                if not isinstance(raw, (bytes, bytearray)) or not raw:
                    raise RuntimeError("Image provider returned no bytes")
                validate_image_bytes(bytes(raw), stage="base")
                return bytes(raw)

        candidates = _generate_candidates(make, candidate_count(spec))
        if len(candidates) > 1:
            report_image_stage("review")
            brief = strip_platform_labels(spec.caption) or _brief_core(topic) or topic
            base_image = candidates[pick_best_image(candidates, brief=f"{compact_context(brief, 800)} | Intended image: {prompt[:400]}")]
        else:
            base_image = candidates[0]
        if recipe_callback is not None:
            recipe = {"copy": {key: getattr(copy, key) for key in ("headline", "subtext", "cta")}, "prompt": prompt}
            if negative_prompt:
                recipe["negativePrompt"] = negative_prompt
            if concept is not None:
                recipe["series"] = series_signature(concept, spec, brand)
            recipe_callback(recipe)
    validate_image_bytes(base_image, stage="base")
    if on_base_ready is not None:
        on_base_ready(base_image)

    slide_label = None
    if fmt == "carousel" and spec.slide_index and spec.slide_count:
        slide_label = f"{spec.slide_index}/{spec.slide_count}"

    logo_ok = bool(spec.include_logo and logo_bytes and load_logo(logo_bytes, 64, 64) is not None)
    use_lockup = spec.brand_lockup and _is_campaign_hero(spec) and spec.use_brand and bool(brand.get("brand_name")) and not wants_copy
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
            brand_lockup=use_lockup,
            brand_name=str(brand.get("brand_name") or "").strip() or None,
            brand_tagline=str(brand.get("tagline") or "").strip() or None,
            lockup_logo=logo_ok,
        )
        results[platform] = CreativeResult(
            image=image, width=width, height=height,
            copy=copy if wants_copy else OverlayCopy(), prompt=prompt, logo_applied=logo_ok or use_lockup,
            negative_prompt=negative_prompt or "", concept=concept, warnings=list(warnings),
        )
    return results
