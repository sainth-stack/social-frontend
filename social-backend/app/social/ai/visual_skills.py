"""Visual Skills — content-category image generation strategies.

Each VisualSkill is a named creative strategy matched to a category of social
media post.  When a skill fires it locks the LLM into a specific concept type
and medium so the LLM cannot default to a generic "stock-photo person in an
office".  The LLM still fills in specifics (subject, setting, palette,
composition) — the skill just prevents the wrong category from being chosen.

Skill selection is intentional two-tier:
  1. Fast keyword regex (synchronous, zero latency) — covers ≥90 % of posts.
  2. For posts that match nothing: return None → art_direct() picks freely.

Skill order matters — first match wins.  Stronger/narrower signals are placed
before broader catch-alls.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional, Tuple


@dataclass(frozen=True)
class VisualSkill:
    """A content-category creative strategy for image art-direction."""

    # Human-readable identifier shown in logs and warnings
    name: str
    # Locked concept type — LLM MUST use this; overrides its free choice
    concept_type: str
    # Full medium description that replaces the _MEDIUM[concept_type] default
    medium_override: str
    # Injected into the system prompt as LLM subject-generation guidance
    subject_guide: str
    # Regex pattern used for keyword fast-path matching (case-insensitive)
    trigger_pattern: str = ""
    # Extra avoid terms appended to the negative prompt
    avoid_extra: Tuple[str, ...] = field(default_factory=tuple)
    # Optional style suffix appended to the Bedrock prompt
    style_hint: str = ""

    def matches(self, text: str) -> bool:
        """Return True if the trigger pattern fires on ``text``."""
        if not self.trigger_pattern:
            return False
        return bool(re.search(self.trigger_pattern, text, re.I))


# ── Skill definitions ─────────────────────────────────────────────────────────
#
# Naming convention: skills are capitalised nouns describing the post category.
# Each skill is imported by name in tests so keep them at module level.

VOICE_AMPLIFIER = VisualSkill(
    name="VoiceAmplifier",
    concept_type="abstract",
    medium_override=(
        "clean editorial illustration built around a single strong metaphor — "
        "pure geometric sound waves, concentric arcs, or expanding circles — "
        "on a minimal white or light background; flat geometric shapes only; "
        "2-3 solid brand colours; generous negative space; "
        "absolutely no megaphone or loudspeaker shape"
    ),
    subject_guide=(
        "Derive the single key VALUE METAPHOR from the caption's central promise using PURE GEOMETRY. "
        "Use abstract shapes only — no objects that embed text or trigger word-art: "
        "(e.g. 'voice not reaching people' → concentric sound-wave arcs expanding outward; "
        "'content attracts businesses' → streams of dots or lines converging toward small square icons; "
        "'earned credibility' → a single radiating light ring expanding from a central point). "
        "The subject must represent WHAT THE PRODUCT OR IDEA DOES, never who uses it. "
        "Do NOT use a megaphone, loudspeaker, or any object that contains or suggests text. "
        "Do NOT depict a person at a desk, a presenter, a founder portrait, "
        "or any generic professional figure."
    ),
    avoid_extra=(
        "megaphone",
        "loudspeaker",
        "word art",
        "word cloud",
        "letter shapes in illustration",
        "text embedded in shapes",
        "typography in objects",
        "person in office",
        "man in blazer",
        "stock photo professional",
    ),
    style_hint="flat editorial illustration, pure geometric shapes, brand colour palette, white or light grey background, zero text elements",
    trigger_pattern=(
        r"content marketing|thought leadership|earned (voice|media|attention)|"
        r"build(s|ing)? credibility|your (voice|expertise|authority)|"
        r"expertise into content|attract(s|ing)? business(es)?|"
        r"voice.*reach|reach.*audience|professional.*presence|"
        r"without.*paid ads|cold outreach|b2b\s*saa?s|saas.*marketing|"
        r"inbound.*content|content.*inbound|organic reach|brand.*awareness|"
        r"establish.*authority|position.*brand|content.*strategy"
    ),
)

FOUNDER_STORY = VisualSkill(
    name="FounderStory",
    concept_type="people",
    medium_override=(
        "authentic candid documentary photography: a genuine real-world moment that "
        "embodies the turning point or insight in the caption; "
        "warm natural light, environmental context that reflects the story's setting; "
        "genuine expression — NOT a posed corporate portrait, NOT an office headshot"
    ),
    subject_guide=(
        "The subject is a generic stand-in for the post author. "
        "The scene must reflect the SPECIFIC moment, challenge, or emotion described in the caption "
        "(e.g. 'I almost quit after six months' → a person looking pensively at a screen late at night; "
        "'we closed our first enterprise deal' → a quiet celebratory exhale at a desk; "
        "'the lesson I wish I learned earlier' → a person writing in a notebook at a window). "
        "No generic smiling-at-camera poses; no conference rooms; "
        "the scene must be earned by the caption's story."
    ),
    avoid_extra=(
        "corporate headshot",
        "posed portrait",
        "looking at camera smiling",
        "generic office backdrop",
        "stock photo professional",
        "conference room",
    ),
    trigger_pattern=(
        r"\bI (built|started|quit|learned|failed|almost|realised|realized|"
        r"decided|launched|discovered|nearly|struggled)\b|"
        r"\bmy (startup|journey|story|co-?founder|first client|first sale)\b|"
        r"\bwe (started|built|launched|closed|failed|grew|almost|lost)\b|"
        r"\d+ year[s]? ago\b|two years ago|six months ago|"
        r"when I was|what I (learned|wish I knew|discovered)|"
        r"the hardest (part|lesson|year)|looking back"
    ),
)

DATA_INSIGHT = VisualSkill(
    name="DataInsight",
    concept_type="data",
    medium_override=(
        "minimal conceptual editorial illustration: ONE bold geometric shape or visual metaphor "
        "communicates the scale or direction of the key finding; "
        "no charts, no numbers, no text elements; "
        "brand colour on a clean light background; "
        "flat vector style with strong clean lines"
    ),
    subject_guide=(
        "Translate the key statistic or finding into a single visual metaphor — "
        "a rising form for growth, a gap or split for contrast, converging shapes for improvement. "
        "The number itself must NOT appear in the image; only its visual story. "
        "e.g. '83% of marketers report ROI uplift' → an upward-rising bar of light with "
        "a single highlighted segment representing the majority."
    ),
    avoid_extra=(
        "bar chart",
        "pie chart",
        "spreadsheet",
        "numbers in image",
        "dashboard screenshot",
        "text labels",
        "axis labels",
        "word art",
        "typography in shapes",
        "letter shapes",
    ),
    trigger_pattern=(
        r"\d+\s*%|\d+x\s*(more|faster|better|growth|return)|\bROI\b|"
        r"\bstatistic[s]?\b|\bsurvey (found|shows?|report)\b|\bbenchmark\b|"
        r"\bgrowth rate\b|\brevenue\b.{0,40}\bgrew\b|\bpercent\b|"
        r"\breport (found|shows?|reveals?)\b|\bdata (shows?|suggests?|reveals?)\b|"
        r"according to (our|the|a) (study|report|survey|data)"
    ),
)

PRODUCT_HERO = VisualSkill(
    name="ProductHero",
    concept_type="product",
    medium_override=(
        "premium commercial still-life photography: the product or its core capability "
        "shown as a clean physical artefact on a minimal styled surface; "
        "controlled soft-box lighting; crisp material detail; "
        "restrained background — NOT a floating mockup, NOT a UI screenshot"
    ),
    subject_guide=(
        "Represent the product's core value as a tangible object or physical metaphor. "
        "If it is a software product, translate its key capability into a physical scene "
        "(e.g. 'one-click reports' → a single elegant button on a clean surface; "
        "'automated scheduling' → a beautifully arranged calendar with one highlighted block). "
        "Avoid: floating device frames, generic laptop/phone mockups, UI screenshots."
    ),
    avoid_extra=(
        "floating laptop mockup",
        "floating phone mockup",
        "UI screenshot",
        "generic device frame",
        "stock photo device",
        "dashboard screenshot",
    ),
    trigger_pattern=(
        r"\bnew feature\b|\bjust shipped\b|\bnow (live|available)\b|"
        r"\bintegration (with|for)\b|\buse case\b|"
        r"\bproduct (update|launch|release|announcement)\b|"
        r"\bwe[']?ve? (built|shipped|released|launched|added)\b|"
        r"\bintroducing\b|\bannouncing\b.{0,60}\b(feature|update|tool)\b|"
        r"\brelease (note[s]?|update)\b|\bv\d+\.\d+\b"
    ),
)

HOW_TO_GUIDE = VisualSkill(
    name="HowToGuide",
    concept_type="educational",
    medium_override=(
        "clean editorial illustration: one clear before→after or problem→solution metaphor "
        "built with flat geometric shapes; a single focal object represents the transformation; "
        "generous negative space; 2 accent colours on a white or very light background"
    ),
    subject_guide=(
        "Illustrate the core TRANSFORMATION the reader experiences by following this guide — "
        "not the steps themselves, only the outcome. "
        "e.g. 'how to write better LinkedIn posts' → a tangled line smoothing into a single clear arrow; "
        "'5 ways to grow your audience' → a small seed shape expanding into a branching form; "
        "'common hiring mistakes' → an X shape transforming into a check mark. "
        "Keep it abstract and symbolic — no numbered steps, no text labels."
    ),
    avoid_extra=(
        "numbered steps",
        "list layout",
        "text labels in image",
        "flowchart",
        "cluttered diagram",
        "step-by-step visual",
        "word art",
        "letter shapes",
        "text embedded in illustration",
    ),
    trigger_pattern=(
        r"\bhow to\b|\bsteps? to\b|\bguide (to|for|on)\b|\bframework (for|to)\b|"
        r"\btips? (for|to|on|about)\b|\bcheckli[s]t\b|"
        r"\bcommon mistakes?\b|\blessons? (from|I learned|learned)\b|"
        r"\bways? to\b|\bbest practices?\b|\bexplained\b|"
        r"\bbreakdown of\b|\bhere[']?s? how\b|\bsecrets? (to|of|behind)\b"
    ),
)

COMMUNITY_PULSE = VisualSkill(
    name="CommunityPulse",
    concept_type="people",
    medium_override=(
        "authentic candid documentary photography: two or more people in genuine interaction — "
        "a real conversation, collaboration, or shared moment of energy; "
        "warm natural light; informal or semi-professional environment that feels real; "
        "NOT a posed group photo, NOT a corporate team headshot"
    ),
    subject_guide=(
        "Show a specific genuine human interaction that reflects the community, team, "
        "or relationship energy described in the caption. "
        "e.g. 'we are hiring' → two people in a focused engaged working conversation; "
        "'client success story' → a collaborative moment between two professionals looking at shared work; "
        "'growing our team' → a welcoming informal onboarding scene. "
        "The interaction must feel real and unposed; no forced smiles or conference-table setups."
    ),
    avoid_extra=(
        "posed group headshot",
        "corporate team photo",
        "forced smiles",
        "conference room table",
        "stock photo meeting",
        "business handshake",
    ),
    trigger_pattern=(
        r"\b(we[']?re|we are) hiring\b|\bjoin (our|the) team\b|"
        r"\b(team|squad|crew) (update|announcement|spotlight|moment)\b|"
        r"\bclient (story|success|win|result)\b|"
        r"\bcustomer (story|spotlight|win|success)\b|"
        r"\bcommunity (update|event|milestone|shout-?out)\b|"
        r"\bgrowing (our|the) team\b|\bnew (team member|hire|addition)\b"
    ),
)

INSPIRATION_QUOTE = VisualSkill(
    name="InspirationQuote",
    concept_type="quote",
    medium_override=(
        "atmospheric fine-art background: soft bokeh, subtle light leak, or calm "
        "textured wash; colour palette that evokes the emotional tone of the quote; "
        "absolutely no competing subjects — the image exists purely to elevate text"
    ),
    subject_guide=(
        "The entire image is a background layer for text overlay. "
        "Use light, colour wash, and soft texture as the visual language. "
        "No objects, no people, no literal interpretation of the quote's words. "
        "Colour temperature should match the emotional tone: "
        "warm amber for resilience/gratitude, cool blue for strategy/clarity, "
        "soft white for calm/wisdom."
    ),
    avoid_extra=(
        "busy background",
        "literal subject",
        "person",
        "objects",
        "distraction from text area",
        "sharp foreground subject",
    ),
    trigger_pattern=(
        r"\b(the )?(truth|key|secret|real lesson|hard truth|reality) (is|about)\b|"
        r"\b(always|never|remember|don[']?t forget)\b.{0,80}\b(that|this|you|yourself)\b|"
        r"\bquote\b|\bmindset\b|\binspir[ae]|"
        r"\bwhat (success|failure|growth|resilience) (looks like|taught me|really means)\b|"
        r"simple (truth|reminder)|words (to live|I live) by"
    ),
)


# ── Master skill list ─────────────────────────────────────────────────────────
#
# ORDER MATTERS — first match wins.
# Narrow / explicit signals come first; broad catch-alls come last.
#
# HOW_TO_GUIDE before DATA_INSIGHT: "how to get 10x results" is a guide,
# not a data story — the explicit how-to signal wins over a stray number.

VISUAL_SKILLS: tuple[VisualSkill, ...] = (
    PRODUCT_HERO,         # explicit product launch/feature signals — very narrow
    FOUNDER_STORY,        # first-person narrative ("I built", "we launched")
    COMMUNITY_PULSE,      # team / hiring / client signals
    HOW_TO_GUIDE,         # how-to / framework / checklist — before DataInsight
    DATA_INSIGHT,         # numeric/statistical signals — loses to explicit how-to
    INSPIRATION_QUOTE,    # quote / mindset / inspiration
    VOICE_AMPLIFIER,      # broadest catch-all for SaaS / marketing value props — last
)


def select_visual_skill(caption: str, topic: str = "") -> Optional[VisualSkill]:
    """Return the best-matched VisualSkill for this post, or None.

    Matching is keyword-only (synchronous, zero latency).
    Returns None when no skill fires — art_direct() then picks the concept freely.

    Args:
        caption: Cleaned post caption (platform labels already stripped).
        topic:   User's original brief / campaign context.
    """
    combined = f"{caption} {topic}"
    for skill in VISUAL_SKILLS:
        if skill.matches(combined):
            return skill
    return None


# ── Utility ───────────────────────────────────────────────────────────────────

_PLATFORM_LABEL_RE = re.compile(
    r"^(linkedin|facebook|instagram|twitter|x|threads|pinterest)\s*:\s*\n+",
    re.I | re.M,
)


def strip_platform_labels(caption: str) -> str:
    """Remove channel-routing prefixes injected by the frontend.

    The AI Studio and planner inject labels like ``'linkedin:\\n'`` so the
    backend knows which caption belongs to which platform.  Before the caption
    reaches the image LLM these labels must be stripped — they are routing
    metadata, not content.

    Examples::

        'linkedin:\\nMost businesses struggle...' → 'Most businesses struggle...'
        'facebook:\\nBuilding a business...'      → 'Building a business...'

    When a caption contains sections for multiple platforms each section label
    is removed but the content of all sections is preserved (the image LLM
    should see all approved captions as one rich content source).
    """
    return _PLATFORM_LABEL_RE.sub("", caption or "").strip()
