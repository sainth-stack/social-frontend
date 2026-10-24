"""Normalize caption + hashtag separation for publish-ready social copy."""

from __future__ import annotations

import re
import unicodedata

_URL = re.compile(r"(?:https?://|www\.)[^\s<>]+", re.IGNORECASE)
_EMOJI = re.compile(
    r"[0-9#*]\ufe0f?\u20e3|"
    r"[\u00a9\u00ae\u203c\u2049\u2122\u2139\u2194-\u2199\u21a9\u21aa\u2328\u23cf\u23ed-\u23ef\u23f1\u23f2\u23f8-\u23fa\u24c2\u25aa\u25ab\u25b6\u25c0\u25fb\u25fc\u2934\u2935\u3030\u303d\u3297\u3299]\ufe0f|"
    r"[\u231a\u231b\u23e9-\u23ec\u23f0\u23f3\u25fd\u25fe\u2600-\u2604\u260e\u2611\u2614\u2615\u2618\u261d\u2620\u2622\u2623\u2626\u262a\u262e\u262f\u2638-\u263a\u2640\u2642\u2648-\u2653\u265f\u2660\u2663\u2665\u2666\u2668\u267b\u267e\u267f\u2692-\u2697\u2699\u269b\u269c\u26a0\u26a1\u26a7\u26aa\u26ab\u26b0\u26b1\u26bd\u26be\u26c4\u26c5\u26c8\u26ce\u26cf\u26d1\u26d3\u26d4\u26e9\u26ea\u26f0-\u26f5\u26f7-\u26fa\u26fd\u2702\u2705\u2708-\u270d\u270f\u2712\u2714\u2716\u271d\u2721\u2728\u2733\u2734\u2744\u2747\u274c\u274e\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27a1\u27b0\u27bf\u2b05-\u2b07\u2b1b\u2b1c\u2b50\u2b55"
    r"\U0001f004\U0001f0cf\U0001f170\U0001f171\U0001f17e\U0001f17f\U0001f18e\U0001f191-\U0001f19a\U0001f1e6-\U0001f1ff\U0001f201\U0001f202\U0001f21a\U0001f22f\U0001f232-\U0001f23a\U0001f250\U0001f251\U0001f300-\U0001f6ff\U0001f7e0-\U0001f7eb\U0001f7f0\U0001f90c-\U0001f93a\U0001f93c-\U0001f945\U0001f947-\U0001f9ff\U0001fa70-\U0001faff]"
    r"[\ufe0e\ufe0f]?[\U0001f3fb-\U0001f3ff]?(?:[\U000e0020-\U000e007f]+)?"
)


def strip_emojis(text: str) -> str:
    text = re.sub(rf"(?:{_EMOJI.pattern})(?:\u200d(?:{_EMOJI.pattern}))*", "", text)
    text = re.sub(r"[\ufe0e\ufe0f\u20e3\U0001f3fb-\U0001f3ff\U000e0020-\U000e007f]", "", text)
    return re.sub(r"(?<!\S)\u200d+|\u200d+(?!\S)", "", text)


def normalize_generated_text(text: str, *, include_emojis: bool = False) -> str:
    text = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"!?\[([^\]\n]+)\]\(([^\s)]+)\)", r"\1 (\2)", text)
    urls: list[str] = []

    def protect(match: re.Match[str]) -> str:
        url = match.group()
        suffix = ""
        for marker in ("**", "__", "~~", "`", "*", "_"):
            if text[:match.start()].endswith(marker) and url.endswith(marker):
                url, suffix = url[:-len(marker)], marker
                break
        urls.append(url)
        return f"\x00URL{len(urls) - 1}\x00{suffix}"

    text = _URL.sub(protect, text)
    text = re.sub(r"(?m)^\s{0,3}(?:`{3,}|~{3,})[^\n]*$", "", text)
    text = re.sub(r"(?m)^[ \t]{0,3}(?:#{1,6}[ \t]+|#{2,6}(?=[^#\s]))(.+?)(?:[ \t]+#+)?[ \t]*$", r"\1", text)
    text = re.sub(r"(?m)^\s*(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|={3,})\s*$", "", text)
    text = re.sub(r"(?m)^\s{0,3}>[ \t]?", "", text)
    text = re.sub(r"(?m)^\s*[-+*][ \t]+", "", text)
    for marker in ("**", "__", "~~", "`", "*", "_"):
        escaped = re.escape(marker)
        text = re.sub(rf"(?<!\w){escaped}(?=\S)(.+?)(?<=\S){escaped}(?!\w)", r"\1", text)
    for index, url in enumerate(urls):
        text = text.replace(f"\x00URL{index}\x00", url)
    if not include_emojis:
        text = strip_emojis(text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _hashtag_matches(text: str) -> list[tuple[int, int, str]]:
    urls = [(m.start(), m.end()) for m in _URL.finditer(text)]
    matches: list[tuple[int, int, str]] = []
    for match in re.finditer(r"(?<![\w/#&])#", text):
        start = match.end()
        end = start
        while end < len(text) and (text[end] == "_" or unicodedata.category(text[end])[0] in "LNM"):
            end += 1
        tag = text[start:end]
        if tag and any(unicodedata.category(c)[0] == "L" for c in tag) and not any(a <= match.start() < b for a, b in urls):
            matches.append((match.start(), end, tag))
    return matches


def _dedupe_tags(tags: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in tags:
        tag = str(raw).strip().lstrip("#")
        if not tag:
            continue
        key = tag.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(tag)
    return out


def extract_inline_hashtags(caption: str) -> list[str]:
    text = normalize_generated_text(caption, include_emojis=True)
    return [tag for _, _, tag in _hashtag_matches(text)]


def strip_hashtags_from_caption(caption: str) -> str:
    """Remove hashtag-only lines and trailing hashtag blocks from caption body."""
    text = normalize_generated_text(caption, include_emojis=True)
    for start, end, _ in reversed(_hashtag_matches(text)):
        text = text[:start] + text[end:]
    return normalize_generated_text(text, include_emojis=True)


def sanitize_caption_and_hashtags(
    caption: str,
    hashtags: list[str],
    *,
    hashtag_limit: int = 30,
    include_emojis: bool = False,
) -> tuple[str, list[str]]:
    caption = normalize_generated_text(caption, include_emojis=include_emojis)
    inline = extract_inline_hashtags(caption)
    clean_caption = strip_hashtags_from_caption(caption)
    normalized = [normalize_generated_text(tag, include_emojis=include_emojis) for tag in hashtags]
    merged = _dedupe_tags([*normalized, *inline])[:max(0, hashtag_limit)]
    return clean_caption, merged
