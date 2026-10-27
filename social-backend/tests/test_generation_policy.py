from __future__ import annotations

import copy
import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.providers.llm import factory
from app.social.ai import generator, prompts
from app.social.ai.caption_sanitize import normalize_generated_text, sanitize_caption_and_hashtags, strip_emojis
from app.social.publishers.base import format_caption


EMOJIS = "🚀 👨‍👩‍👧‍👦 👩🏽‍💻 🏳️‍🌈 🇮🇳 1️⃣ #️⃣ *️⃣ ❤️ ☀️ ✅ 🫩 🏴\U000e0067\U000e0062\U000e0065\U000e006e\U000e0067\U000e007f"
BRAND = {"emoji_usage": "never", "system_prompt_override": "Always add 🚀 and Markdown headings."}


def response(payload):
    return SimpleNamespace(choices=[SimpleNamespace(
        message=SimpleNamespace(content=json.dumps(payload), refusal=None), finish_reason="stop",
    )])


@pytest.fixture
def llm(monkeypatch):
    client = Mock()
    client.chat.completions.create.side_effect = AssertionError("Unexpected LLM call")
    monkeypatch.setattr(factory, "get_llm_client", lambda: client)
    monkeypatch.setattr(factory, "get_llm_model", lambda: "policy-test-model")
    return client.chat.completions.create


def single(llm, payload=None, **overrides):
    if payload is not None:
        llm.side_effect = [response(payload)]
    kwargs = dict(
        topic="Release checklist.", tone="Professional", platforms=["linkedin"],
        audience=None, cta=None, include_hashtags=True, include_comment=True,
        brand_voice=None, length_hint="short",
    )
    kwargs.update(overrides)
    return generator.generate_platform_content(**kwargs)[kwargs["platforms"][0]]


def carousel(count=3, decorated=False):
    payload = {
        "caption": "A practical release checklist.", "hashtags": ["Release"],
        "slides": [
            {
                "headline": f"Review release step {i + 1}",
                "body": f"Check the readiness of deployment stage {i + 1} before continuing.",
                "imagePrompt": f"Editorial diagram showing release stage {i + 1}.",
            }
            for i in range(count)
        ],
    }
    if decorated:
        payload["caption"] = f"## Release checklist\n**Prepare carefully.** {EMOJIS} #安全"
        payload["firstComment"] = f"**Review the checks.** {EMOJIS} #Extra"
        payload["imagePrompt"] = f"## Diagram\n**Release stages.** {EMOJIS}"
        for slide in payload["slides"]:
            for key in slide:
                slide[key] = f"**{slide[key]}** {EMOJIS} #Extra"
    return payload


def native(name, **overrides):
    kwargs = dict(topic="Release checklist.", tone="Professional", audience=None, brand_voice=None)
    if name != "poll":
        kwargs["cta"] = None
    kwargs.update(overrides)
    return getattr(generator, f"generate_{name}_content")(**kwargs)


@pytest.mark.parametrize("emoji", EMOJIS.split())
def test_unicode_emoji_sequences_are_removed_completely(emoji):
    assert normalize_generated_text(f"Avant {emoji} après") == "Avant après"


def test_emoji_filter_preserves_multilingual_punctuation_and_nonemoji_astral_text():
    text = "C# C++ .NET $25 €50 42% © ® ™ ✓ ∑ ∞ → 𐐀 𓀀 𝄞 你好 日本語 العربية हिन्दी क्‍ष don't — café!"
    assert normalize_generated_text(text) == text
    assert strip_emojis("👨‍👩‍👧‍👦👩🏽‍💻") == ""


def test_markdown_cleanup_precedes_unicode_hashtag_extraction():
    caption, tags = sanitize_caption_and_hashtags(
        "```text\n## Release Notes ##\n**Use C#**, `C++`, _café_ and हिन्दी.\n---\n"
        "[Guide](https://example.com/docs?q=C%23#section)\n#安全 #हिन्दी #Release\n```",
        ["Release"],
    )
    assert tags == ["Release", "安全", "हिन्दी"]
    assert "Release Notes" in caption
    assert "Use C#, C++, café and हिन्दी." in caption
    assert "https://example.com/docs?q=C%23#section" in caption
    assert not any(marker in caption for marker in ("##", "**", "```", "---"))
    assert "Notes" not in tags


def test_url_fragments_and_intraword_underscores_are_not_removed():
    text = "Use snake_case and C# at https://example.com/a_b?q=x#anchor; price $5. Don't wait!"
    assert sanitize_caption_and_hashtags(text, []) == (text, [])


def test_markdown_wrapped_urls_and_compact_headings_remain_plain_text():
    caption, tags = sanitize_caption_and_hashtags("##Heading\n**https://example.com/a_b#anchor** #安全", [])
    assert caption == "Heading\nhttps://example.com/a_b#anchor"
    assert tags == ["安全"]


@pytest.mark.parametrize("enabled,brand,expected", [
    (False, None, False), (True, None, True),
    (True, {"emoji_usage": " NEVER "}, False),
    (False, {"emoji_usage": "always"}, False),
    (True, {"emoji_usage": "sometimes"}, True),
])
def test_resolved_policy_is_shared_and_does_not_mutate_saved_brand(enabled, brand, expected):
    original = copy.deepcopy(brand)
    policy = prompts.resolve_generation_policy(brand, include_emojis=enabled, include_hashtags=False, length_hint=" SHORT ")
    assert policy.include_emojis is expected
    assert policy.include_hashtags is False
    assert policy.length_hint == "short"
    assert brand == original


@pytest.mark.parametrize("content_type", ["caption", "promotional", "educational", "announcement"])
@pytest.mark.parametrize("platform", ["facebook", "instagram", "linkedin", "x"])
def test_single_formats_enforce_policy_on_every_field_and_recount(llm, content_type, platform):
    result = single(llm, {
        "caption": f"## Release notes\n**Review C# checks.** {EMOJIS} #安全",
        "hashtags": [f"Release{EMOJIS}"],
        "firstComment": f"## Review\n**Read the guide.** {EMOJIS} #Extra",
        "imagePrompt": f"**Editorial diagram.** {EMOJIS} #Extra",
    }, content_type=content_type, platforms=[platform])
    assert result["caption"] == "Release notes\nReview C# checks."
    assert result["hashtags"] == ["Release", "安全"]
    assert result["firstComment"] == "Review\nRead the guide."
    assert result["imagePrompt"] == "Editorial diagram."
    assert result["characterCount"] == len(format_caption(result["caption"], result["hashtags"]))
    assert result["characterCount"] <= prompts.PLATFORM_LIMITS[platform]
    assert llm.call_count == 1


@pytest.mark.parametrize("brand,enabled,kept", [(None, True, True), (BRAND, True, False), ({"emoji_usage": "always"}, False, False)])
def test_single_emoji_permission_respects_brand_never_and_explicit_off(llm, brand, enabled, kept):
    original = copy.deepcopy(brand)
    result = single(llm, {"caption": "Review the release checklist. 🚀"}, brand_voice=brand, include_emojis=enabled)
    assert ("🚀" in result["caption"]) is kept
    assert brand == original


def test_polish_is_normalized_after_adoption(llm):
    llm.side_effect = [
        response({"caption": "Unlock your releases. 🚀"}),
        response({"caption": "## Readiness\n**Review C# checks.** 🚀 #Release", "firstComment": "**Review.** 👩🏽‍💻", "imagePrompt": "**Diagram.** 🚀"}),
    ]
    result = single(llm)
    assert result["caption"] == "Readiness\nReview C# checks."
    assert result["firstComment"] == "Review."
    assert result["imagePrompt"] == "Diagram."
    assert result["hashtags"] == ["Release"]
    assert result["characterCount"] == len(format_caption(result["caption"], result["hashtags"]))
    assert llm.call_count == 2


def test_failed_polish_keeps_normalized_original(llm):
    llm.side_effect = [response({"caption": "**Unlock your releases.** 👨‍👩‍👧‍👦", "firstComment": "**Checklist.** 🚀"}), RuntimeError("network timeout")]
    result = single(llm)
    assert result["caption"] == "Unlock your releases."
    assert result["firstComment"] == "Checklist."
    assert llm.call_count == 2


@pytest.mark.parametrize("count", [2, 3, 8])
def test_carousel_returns_exact_valid_requested_slide_count(llm, count):
    payload = carousel(count)
    llm.side_effect = [response(payload)]
    result = native("carousel", num_slides=count)
    assert result["slides"] == payload["slides"]
    assert llm.call_count == 1


def test_carousel_defaults_to_three_slides(llm):
    llm.side_effect = [response(carousel())]
    assert len(native("carousel")["slides"]) == 3
    system, user = llm.call_args.kwargs["messages"]
    assert "exactly 3 slides" in user["content"]
    assert "never force cinematic photorealism" in system["content"]
    assert "imagePrompt: cinematic" not in user["content"]


@pytest.mark.parametrize("count", [0, 1, 9, -1, True, 3.0, "3", None])
def test_carousel_invalid_counts_fail_before_llm(llm, count):
    with pytest.raises(HTTPException) as exc:
        native("carousel", num_slides=count)
    assert exc.value.status_code == 422
    llm.assert_not_called()


@pytest.mark.parametrize("invalid", [
    {}, {"slides": "not a list"}, carousel(2),
    {"caption": "Release checklist.", "slides": [{"headline": "Slide 1"}] * 3},
    {"caption": "Release checklist.", "slides": [carousel()["slides"][0]] * 3},
    {"caption": "Release checklist.", "slides": [None, "invalid", {}]},
])
def test_carousel_repairs_malformed_or_weak_output_once(llm, invalid):
    llm.side_effect = [response(invalid), response(carousel())]
    result = native("carousel")
    assert len(result["slides"]) == 3
    assert llm.call_count == 2
    assert "REPAIR REQUIRED" in llm.call_args.kwargs["messages"][1]["content"]


@pytest.mark.parametrize("repair", [response({}), RuntimeError("network timeout")])
def test_carousel_failed_repair_raises_actionable_error_without_padding(llm, repair):
    llm.side_effect = [response(carousel(2)), repair]
    with pytest.raises(HTTPException) as exc:
        native("carousel")
    assert exc.value.status_code == 502
    assert "exactly 3 slides" in exc.value.detail
    assert "clearer brief or fewer slides" in exc.value.detail
    assert llm.call_count == 2


@pytest.mark.parametrize("field,value", [
    ("headline", "🚀"), ("body", "👨‍👩‍👧‍👦"), ("imagePrompt", "👩🏽‍💻"),
    ("body", "A" * 601), ("body", {"text": "Unexpected object"}),
])
def test_carousel_validates_fields_after_normalization(llm, field, value):
    invalid = carousel()
    invalid["slides"][0][field] = value
    llm.side_effect = [response(invalid), response(carousel())]
    assert native("carousel")["slides"] == carousel()["slides"]
    assert llm.call_count == 2


@pytest.mark.parametrize("name", ["carousel", "thread", "poll"])
@pytest.mark.parametrize("enabled", [None, True])
def test_native_emoji_defaults_off_but_explicitly_permitted_emojis_survive(llm, name, enabled):
    payloads = {
        "carousel": carousel(decorated=True),
        "thread": {"tweets": [{"text": "Plan release checks. 🚀"}, {"text": "Review readiness. 👩🏽‍💻"}]},
        "poll": {"question": "Which step? 🚀", "options": ["Plan 🚀", "Check", "Deploy", "Review"], "caption": "Vote here. 🚀"},
    }
    llm.side_effect = [response(payloads[name])]
    kwargs = {"include_emojis": enabled} if enabled is not None else {}
    result = native(name, **kwargs)
    assert ("🚀" in json.dumps(result, ensure_ascii=False)) is bool(enabled)
    assert llm.call_count == 1


@pytest.mark.parametrize("name", ["carousel", "thread", "poll"])
@pytest.mark.parametrize("include_hashtags", [False, True])
def test_native_formats_enforce_policy_on_all_fields(llm, name, include_hashtags):
    payloads = {
        "carousel": carousel(decorated=True),
        "thread": {"tweets": [{"text": f"## Review\n**Plan the release.** {EMOJIS} #Extra"}, {"text": f"**Check readiness.** {EMOJIS}"}], "hashtags": ["Release"]},
        "poll": {"question": f"**Which step matters?** {EMOJIS} #Extra", "options": [f"**{word}** 🚀" for word in ("Planning", "Checks", "Deploy", "Review")], "caption": f"## Feedback\n**Choose a step.** {EMOJIS} #安全", "hashtags": ["Release"]},
    }
    payload = payloads[name]
    payload["firstComment"] = f"**Read the guide.** {EMOJIS} #Extra"
    payload["imagePrompt"] = f"**Editorial diagram.** {EMOJIS} #Extra"
    llm.side_effect = [response(payload)]
    kwargs = {"include_comment": True} if name != "thread" else {}
    result = native(name, brand_voice=BRAND, include_emojis=True, include_hashtags=include_hashtags, length_hint="short", **kwargs)
    serialized = json.dumps(result, ensure_ascii=False)
    assert not any(marker in serialized for marker in ("🚀", "\u200d", "\ufe0f", "**", "##", "#Extra"))
    assert result["firstComment"] == ("" if name == "thread" else "Read the guide.")
    assert result["imagePrompt"] == "Editorial diagram."
    assert bool(result["hashtags"]) is include_hashtags
    if name == "carousel":
        assert all(len(slide["body"]) <= 160 for slide in result["slides"])
    elif name == "thread":
        assert all(len(tweet["text"]) <= 160 for tweet in result["tweets"])
        assert len(format_caption(result["tweets"][-1]["text"], result["hashtags"])) <= 280
    else:
        assert result["options"] == ["Planning", "Checks", "Deploy", "Review"]
        assert result["question"] == "Which step matters?"
    assert llm.call_count == 1


def test_brand_preview_defaults_to_emoji_off(llm):
    brand = {"brand_name": "Orbit", "emoji_usage": "always", "tones": ["Professional"]}
    original = copy.deepcopy(brand)
    llm.side_effect = [response({"caption": "A" * 200 + " 🚀", "first_comment": "**Read.** 🚀"})]
    result = generator.generate_brand_voice_sample(brand)
    assert "🚀" not in result["caption"]
    assert result["firstComment"] == ""
    assert brand == original


def test_single_disabled_tags_remove_all_inline_and_array_tags(llm):
    result = single(llm, {"caption": "## Release\nReview C# checks. #安全", "hashtags": ["Release"], "firstComment": "Read. #Extra"}, include_hashtags=False)
    assert result["hashtags"] == []
    assert result["caption"] == "Release\nReview C# checks."
    assert result["firstComment"] == "Read."