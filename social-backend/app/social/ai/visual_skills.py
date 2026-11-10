from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional, Tuple


@dataclass(frozen=True)
class VisualSkill:
    name: str
    concept_type: str
    medium: str
    subject_guide: str
    trigger_pattern: str = ""
    industry_pattern: str = ""
    avoid_extra: Tuple[str, ...] = field(default_factory=tuple)

    def matches(self, text: str) -> bool:
        return bool(self.trigger_pattern and text) and bool(re.search(self.trigger_pattern, text, re.I))

    def matches_industry(self, industry: str) -> bool:
        return bool(self.industry_pattern and industry) and bool(re.search(self.industry_pattern, industry, re.I))


_GENERIC_PROPS = ("generic stock props", "random stationery", "unrelated seedling")

HIRING_TEAM = VisualSkill(
    name="hiring_team",
    concept_type="people",
    medium="candid documentary photography, natural window light, authentic workplace, shallow depth of field",
    subject_guide="Show real people from this business doing the work that the post is about, in their actual workplace.",
    trigger_pattern=(
        r"\bwe(?:'re| are) hiring\b|\bnow hiring\b|\bjoin (?:our|the) team\b|\bopen (?:role|position)s?\b|"
        r"\bjob opening\b|\bwelcome .{1,40} to the team\b|\bteam (?:offsite|spotlight|outing)\b|\bmeet the team\b"
    ),
    avoid_extra=("staged stock handshake", "forced smiles"),
)

CUSTOMER_STORY = VisualSkill(
    name="customer_story",
    concept_type="people",
    medium="warm documentary portrait photography, natural light, real environment, genuine expression",
    subject_guide="Show the customer experiencing the result the post describes, in the real setting where it happens.",
    trigger_pattern=(
        r"\b(?:client|customer) (?:story|spotlight|success|win)\b|\bcase study\b|\btestimonial\b|\breview from\b"
    ),
)

EVENT_INVITE = VisualSkill(
    name="event_invite",
    concept_type="event",
    medium="atmospheric event photography, warm venue lighting, engaged attendees, depth and energy",
    subject_guide=(
        "Show the atmosphere of this specific event: the venue, the speaker or host in action, or engaged attendees. "
        "For online sessions show a presenter in a warm studio setup."
    ),
    trigger_pattern=(
        r"\bwebinar\b|\bconference\b|\bsummit\b|\bworkshop\b|\bmeetup\b|\bgrand opening\b|\bfestival\b|\bexpo\b|"
        r"\bexhibition\b|\blaunch party\b|\bjoin us (?:on|at|this|for)\b|\bregister now\b|\brsvp\b|\blive session\b"
    ),
    industry_pattern=r"\bevents?\b|\bwedding|\bconference",
)

FOOD_DRINK = VisualSkill(
    name="food_drink",
    concept_type="food",
    medium="editorial food photography, natural side light, appetising texture, styled table, shallow depth of field",
    subject_guide="Make the actual dish or drink the hero, freshly prepared and appetising, in the venue's own setting.",
    trigger_pattern=(
        r"\bbakery\b|\bbread\b|\bsourdough\b|\bcroissants?\b|\bpastr(?:y|ies)\b|\bcakes?\b|\bcaf[eé]\b|\bcoffee\b|"
        r"\brestaurant\b|\brecipe\b|\bmenu\b|\bdish(?:es)?\b|\bchef\b|\bmeals?\b|\bdesserts?\b|\bpizza\b|\bcatering\b|"
        r"\bbrunch\b|\bcocktails?\b|\bbiryani\b|\bburgers?\b|\bsmoothies?\b|\bfreshly baked\b"
    ),
    industry_pattern=r"food|restaurant|caf[eé]|bakery|catering|beverage|kitchen|cloud kitchen|coffee",
    avoid_extra=("plastic looking food", "messy table"),
)

PROPERTY_SPACE = VisualSkill(
    name="property_space",
    concept_type="place",
    medium="architectural and interior photography, golden hour or bright natural light, wide lens, true-to-life colour",
    subject_guide="Show the actual property, room or space the post is about as an inviting place to be.",
    trigger_pattern=(
        r"\bvillas?\b|\bapartments?\b|\b\d\s?bhk\b|\bproperty\b|\breal estate\b|\binterior design\b|\bhome tour\b|"
        r"\blisting\b|\bplots?\b|\bresort\b|\bhotel\b|\bstaycation\b|\bpenthouse\b|\bshowroom\b|\bnew home\b"
    ),
    industry_pattern=r"real estate|property|interior|architect|hotel|hospitality|resort|travel|construction",
    avoid_extra=("distorted architecture", "warped lines"),
)

CARE_WELLNESS = VisualSkill(
    name="care_wellness",
    concept_type="people",
    medium="clean bright lifestyle photography in a modern care setting, soft natural light, calm reassuring mood",
    subject_guide=(
        "Show the experience or outcome for the client: a confident smile, a calm treatment room, "
        "a caring professional moment."
    ),
    trigger_pattern=(
        r"\bclinic\b|\bdental\b|\bdentist\b|\bteeth\b|\bsmile makeover\b|\bdoctor\b|\bskin ?care\b|\bderma\w*\b|"
        r"\bsalon\b|\bspa\b|\bphysio\w*\b|\btherapy\b|\bwellness\b|\bhair ?cut\b|\bfacial\b|\bpatients?\b"
    ),
    industry_pattern=r"health|clinic|dental|medical|wellness|beauty|salon|spa|physio|pharma|hospital",
    avoid_extra=("needles", "blood", "clinical gore", "surgical close up"),
)

FITNESS_ACTIVE = VisualSkill(
    name="fitness_active",
    concept_type="people",
    medium="dynamic sports photography, natural or dramatic gym light, motion and energy, authentic effort",
    subject_guide="Show real people training or moving in the setting the post describes, mid-action and energetic.",
    trigger_pattern=(
        r"\bgym\b|\bworkouts?\b|\bboot ?camp\b|\bfitness\b|\byoga\b|\bmarathon\b|\bcrossfit\b|\bpilates\b|"
        r"\bstrength training\b|\bpersonal train\w*\b|\bathletes?\b|\brunning club\b|\bhiit\b"
    ),
    industry_pattern=r"fitness|gym|sport|yoga|athlet|martial",
)

PRODUCT_LAUNCH = VisualSkill(
    name="product_launch",
    concept_type="product",
    medium="premium commercial product photography, styled surface, controlled soft light, crisp material detail",
    subject_guide=(
        "Make the actual product the hero. For software or services, show the tangible real-world outcome "
        "it creates for a customer instead of a device or screen."
    ),
    trigger_pattern=(
        r"\bnew feature\b|\bjust (?:shipped|launched|dropped)\b|\bintroducing\b|\bproduct (?:launch|update|release)\b|"
        r"\bnew (?:collection|range|arrivals?|flavou?r|product|menu item)\b|\bback in stock\b|\brestock\w*\b|"
        r"\bnow (?:live|available) (?:on|in|at|for)\b"
    ),
    industry_pattern=r"retail|e-?commerce|fashion|jewel|furniture|cosmetic|apparel|consumer goods|d2c",
    avoid_extra=("floating laptop mockup", "ui screenshot", "generic device frame"),
)

OFFER_PROMO = VisualSkill(
    name="offer_promo",
    concept_type="product",
    medium="vibrant commercial still life, celebratory styling, clean bright light, rich colour",
    subject_guide=(
        "Show what the customer actually gets from the offer, the product or service experience, "
        "in an inviting celebratory scene."
    ),
    trigger_pattern=(
        r"\b\d+\s?% off\b|\bflat \d+|\bsale\b|\bdiscount\w*\b|\bspecial offer\b|\bdeals?\b|\bcoupon\b|"
        r"\bfree shipping\b|\blimited time\b|\bbuy one\b|\bblack friday\b|\bdiwali offer\b|\bfestive offer\b"
    ),
)

FOUNDER_STORY = VisualSkill(
    name="founder_story",
    concept_type="people",
    medium="cinematic documentary photography, natural light, authentic environment, quiet emotional moment",
    subject_guide="Show a real moment from the journey described: the place, the work or the turning point.",
    trigger_pattern=(
        r"\bI (?:built|started|quit|learned|learnt|failed|almost|realised|realized|decided|launched|nearly|struggled)\b|"
        r"\bmy (?:startup|journey|story|co-?founder|first (?:client|customer|sale|hire))\b|\blooking back\b|"
        r"\bthe hardest (?:part|lesson|year)\b|\b\d+ years? ago\b"
    ),
)

HOW_TO_GUIDE = VisualSkill(
    name="how_to_guide",
    concept_type="educational",
    medium="clean editorial photography of a real-world scene, soft directional light, clear single focal point",
    subject_guide=(
        "Depict the real-world situation the advice improves, or the finished result of following it, "
        "using objects and places specific to this topic and industry."
    ),
    trigger_pattern=(
        r"\bhow to\b|\bstep[- ]by[- ]step\b|\b\d+\s+(?:\w+\s+){0,3}(?:tips|ways|steps|mistakes|lessons|rules|habits|ideas)\b|"
        r"\bchecklist\b|\bguide (?:to|for)\b|\bbest practices\b|\bcommon mistakes\b|\bmistakes to avoid\b"
    ),
    avoid_extra=_GENERIC_PROPS,
)

DATA_INSIGHT = VisualSkill(
    name="data_insight",
    concept_type="data",
    medium="minimal conceptual editorial photography, one symbolic real-world scene, clean uncluttered background",
    subject_guide=(
        "Translate the finding into one concrete scene from this industry that makes the insight tangible, "
        "instead of a chart or numbers."
    ),
    trigger_pattern=(
        r"\b\d+(?:\.\d+)?\s?%(?!\s*off)|\bsurvey\b|\bstatistics?\b|\bbenchmark\b|\breport (?:found|shows)\b|"
        r"\bdata (?:shows|suggests)\b|\baccording to (?:a|the|our) (?:study|report|survey)\b"
    ),
    avoid_extra=("charts", "graphs", "dashboards", "numbers"),
)

THOUGHT_LEADERSHIP = VisualSkill(
    name="thought_leadership",
    concept_type="abstract",
    medium="editorial still-life or environmental photography, one meaningful focal object, refined light",
    subject_guide=(
        "Choose a concrete object or scene specific to this post's actual argument and the brand's industry, "
        "different from previous posts."
    ),
    trigger_pattern=(
        # Core explicit phrases
        r"\bthought.?leadership\b|\bpersonal brand\w*\b|\blinkedin (?:content|posts?|presence)\b|"
        # Handle both spaced and hashtag forms (#ContentStrategy, #ContentMarketing)
        r"\bcontent.?(?:marketing|strategy)\b|"
        # Building-authority / visibility framing common in founder-brand posts
        r"\bbuilding (?:authority|credibility|visibility|presence|your brand)\b|"
        r"\bchasing visibility\b|\bearned (?:media|attention|authority)\b|"
        # Founder content / creator economy framing
        r"\bfounder\w*\s+(?:brand|content|authority|visibility|presence)\b|"
        # B2B / LinkedIn organic-growth framing (match hashtag #B2BSaaS too via word-boundary after #)
        r"\bb2b.?(?:saas)?\b|\bcredibility\b|\borganic reach\b|\binbound\b"
    ),
    # Match B2B SaaS, consulting, coaching, agency and creator-economy industries
    industry_pattern=r"\bb2b\b|\bsaas\b|\bconsulting\b|\bcoach(?:ing)?\b|\bagency\b|\bcreator\b|\bmartech\b|\bstartup\b",
    avoid_extra=_GENERIC_PROPS + ("microphone", "chess pieces"),
)

INSPIRATION_QUOTE = VisualSkill(
    name="inspiration_quote",
    concept_type="quote",
    medium="atmospheric fine-art photograph, soft light and texture, calm low-detail centre, depth and mood",
    subject_guide="Create a calm atmospheric scene that matches the feeling of the quote, with open space at the centre.",
    trigger_pattern=r"\bquote of the day\b|\bmonday motivation\b|\bas .{2,40} once said\b",
)

VISUAL_SKILLS: tuple[VisualSkill, ...] = (
    HIRING_TEAM,
    CUSTOMER_STORY,
    FOOD_DRINK,
    EVENT_INVITE,
    PROPERTY_SPACE,
    CARE_WELLNESS,
    FITNESS_ACTIVE,
    PRODUCT_LAUNCH,
    OFFER_PROMO,
    FOUNDER_STORY,
    HOW_TO_GUIDE,
    DATA_INSIGHT,
    THOUGHT_LEADERSHIP,
    INSPIRATION_QUOTE,
)


def select_visual_skill(
    caption: str, topic: str = "", industry: str = "", post_format: str = ""
) -> Optional[VisualSkill]:
    if (post_format or "").lower() == "quote":
        return INSPIRATION_QUOTE
    for text in (caption, topic):
        for skill in VISUAL_SKILLS:
            if skill.matches(text or ""):
                return skill
    for skill in VISUAL_SKILLS:
        if skill.matches_industry(industry or ""):
            return skill
    return None


_PLATFORM_LABEL_RE = re.compile(
    r"^(linkedin|facebook|instagram|twitter|x|threads|pinterest)\s*:\s*\n+",
    re.I | re.M,
)


def strip_platform_labels(caption: str) -> str:
    return _PLATFORM_LABEL_RE.sub("", caption or "").strip()
