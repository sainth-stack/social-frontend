import json
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from PIL import Image, ImageDraw

from app.social.ai import creative
from app.social.ai.compositor import OverlayCopy, _font, _wrap, compose_creative, decode_image, load_logo
from app.social.ai.creative import CreativeSpec, render_creative_variants


def _png(size=(640, 800), color=(40, 90, 160, 255)):
    out = BytesIO()
    image = Image.new("RGBA", size, color)
    if color == (40, 90, 160, 255):
        ImageDraw.Draw(image).rectangle((size[0] // 4, size[1] // 4, size[0] // 2, size[1] // 2), fill=(60, 120, 180, 255))
    image.save(out, format="PNG")
    return out.getvalue()


@pytest.fixture
def models(monkeypatch):
    image = Mock(return_value={"imageB64": _png()})
    direction = Mock(return_value=("Editorial watercolor with a shared teal palette", OverlayCopy("Grow together", "Make space for neighbors", "Join us")))
    monkeypatch.setattr(creative, "generate_post_image", image)
    monkeypatch.setattr(creative, "art_direct", direction)
    return image, direction


@pytest.mark.parametrize("fmt,linkedin_size", [("post", (1200, 1200)), ("carousel", (1080, 1080))])
def test_one_base_and_one_art_direction_for_all_platforms(models, monkeypatch, fmt, linkedin_size):
    image, direction = models
    events = []
    original = creative.compose_creative

    def compose(raw, **kwargs):
        events.append(("compose", raw))
        return original(raw, **kwargs)

    monkeypatch.setattr(creative, "compose_creative", compose)
    logo = _png((120, 40), (255, 0, 0, 255))
    spec = CreativeSpec(format=fmt, text_overlay=True, platform="facebook", slide_index=1, slide_count=3)
    result = render_creative_variants(
        topic="Neighborhood garden", style="watercolor, shared teal palette", spec=spec,
        platforms=["instagram", "facebook", "linkedin"], brand={}, logo_bytes=logo,
        on_base_ready=lambda raw: events.append(("saved", raw)),
    )
    image.assert_called_once()
    direction.assert_called_once()
    assert [event[0] for event in events] == ["saved", "compose", "compose", "compose"]
    assert all(raw == image.return_value["imageB64"] for _, raw in events)
    assert spec.platform == "facebook"
    assert result["instagram"].image == result["facebook"].image
    for platform, output in result.items():
        expected = linkedin_size if platform == "linkedin" else (1080, 1350)
        with Image.open(BytesIO(output.image)) as decoded:
            decoded.load()
            assert decoded.format == "JPEG" and decoded.mode == "RGB"
            assert decoded.size == expected == (output.width, output.height)
            red = decoded.getpixel((expected[0] - 150, 110))
            assert red[0] > 200 and red[1] < 80
        assert output.logo_applied
        assert output.copy.headline == "Grow together"


def test_saved_byte_base_skips_generation_and_is_deterministic(models):
    image, direction = models
    base = _png()
    callback = Mock()
    kwargs = dict(topic="Garden", style=None, spec=CreativeSpec(auto_copy=False),
                  platforms=["linkedin", "instagram"], brand={}, logo_bytes=None, base_image=base)
    first = render_creative_variants(**kwargs, on_base_ready=callback)
    second = render_creative_variants(**kwargs)
    image.assert_not_called()
    direction.assert_not_called()
    callback.assert_called_once_with(base)
    assert first["linkedin"].image == second["linkedin"].image


def test_saved_base_with_auto_copy_never_calls_either_model(models):
    image, direction = models
    render_creative_variants(topic="Garden", style=None, spec=CreativeSpec(text_overlay=True),
                             platforms=["instagram", "linkedin"], brand={}, logo_bytes=None, base_image=_png())
    image.assert_not_called()
    direction.assert_not_called()


@pytest.mark.parametrize("base", [b"", "https://example.com/base.png", {"imageB64": b"bytes"}, bytearray(b"bytes"), b"broken image"])
def test_reuse_accepts_only_decodable_nonempty_bytes(models, base):
    with pytest.raises(ValueError):
        render_creative_variants(topic="Garden", style=None, spec=CreativeSpec(auto_copy=False),
                                 platforms=["instagram"], brand={}, logo_bytes=None, base_image=base)
    models[0].assert_not_called()


def test_callback_failure_prevents_all_composition(models, monkeypatch):
    compose = Mock()
    monkeypatch.setattr(creative, "compose_creative", compose)
    with pytest.raises(RuntimeError, match="storage offline"):
        render_creative_variants(topic="Garden", style=None, spec=CreativeSpec(), platforms=["instagram"],
                                 brand={}, logo_bytes=None, on_base_ready=Mock(side_effect=RuntimeError("storage offline")))
    compose.assert_not_called()
    models[0].assert_called_once()


@pytest.mark.parametrize("repetitions", [600, 2000])
def test_base_saved_before_overflow_and_retry_never_regenerates(models, repetitions):
    saved = []
    spec = CreativeSpec(auto_copy=False, text_overlay=True, headline="Important", subtext="Essential claim " * repetitions)
    kwargs = dict(topic="Garden", style=None, spec=spec, platforms=["instagram", "linkedin"], brand={}, logo_bytes=None)
    with pytest.raises(ValueError, match="cannot fit"):
        render_creative_variants(**kwargs, on_base_ready=saved.append)
    assert len(saved) == 1
    models[0].reset_mock()
    with pytest.raises(ValueError, match="cannot fit"):
        render_creative_variants(**kwargs, base_image=saved[0])
    models[0].assert_not_called()


@pytest.mark.parametrize("include,brand,expected", [(False, {}, "Grow"), (True, {"emoji_usage": "never"}, "Grow"), (True, {}, "Grow 🌱")])
def test_overlay_policy_sanitizes_model_markdown_and_emojis(models, include, brand, expected):
    models[1].return_value = ("Watercolor", OverlayCopy("## **Grow** 🌱", "**C# café 中文** 👨‍👩‍👧‍👦", "`Join`"))
    result = render_creative_variants(topic="Garden", style=None,
                                     spec=CreativeSpec(text_overlay=True, include_emojis=include),
                                     platforms=["instagram"], brand=brand, logo_bytes=None)["instagram"]
    assert result.copy.headline == expected
    assert result.copy.cta == "Join"
    assert "C# café 中文" in result.copy.subtext
    if not include or brand:
        assert "👨" not in result.copy.subtext and "\u200d" not in result.copy.subtext


def test_manual_multiline_copy_retained_without_character_truncation(models):
    body = "First meaningful detail\nSecond meaningful detail\nThird meaningful detail\nFourth meaningful detail"
    headline = "A considered community garden plan with room for neighbors and a clear path to greener streets"
    result = render_creative_variants(topic="Garden", style=None,
                                     spec=CreativeSpec(auto_copy=False, text_overlay=True, headline=headline, subtext=body),
                                     platforms=["instagram"], brand={}, logo_bytes=None)["instagram"]
    assert result.copy.headline == headline
    assert result.copy.subtext == body
    draw = ImageDraw.Draw(Image.new("RGB", (400, 400)))
    assert _wrap(draw, "First line\nSecond line", _font(20, False), 350) == ["First line", "Second line"]
    token = "中文" * 30
    assert "".join(_wrap(draw, token, _font(20, False), 100)) == token


def test_exif_orientation_and_safe_padding_preserve_full_artwork():
    source = Image.new("RGB", (80, 40), "red")
    exif = Image.Exif()
    exif[274] = 6
    out = BytesIO()
    source.save(out, format="JPEG", exif=exif)
    assert decode_image(out.getvalue()).size == (40, 80)
    logo = load_logo(out.getvalue(), 40, 80)
    assert logo is not None and logo.size == (40, 80)
    artwork = Image.new("RGB", (200, 100), "red")
    ImageDraw.Draw(artwork).rectangle((150, 0, 199, 99), fill="blue")
    out = BytesIO()
    artwork.save(out, format="PNG")
    result = compose_creative(out.getvalue(), width=200, height=200, primary_color="#112233")
    decoded = Image.open(BytesIO(result))
    assert decoded.getpixel((10, 100))[0] > 220
    assert decoded.getpixel((190, 100))[2] > 220
    assert all(abs(a - b) < 5 for a, b in zip(decoded.getpixel((100, 10)), (17, 34, 51)))


@pytest.mark.parametrize("size", [(0, 100), (100, -1), (9000, 100), (8192, 8192)])
def test_output_dimensions_validated(size):
    with pytest.raises(ValueError, match="dimensions"):
        compose_creative(_png(), width=size[0], height=size[1])


def test_empty_platforms_fail_before_model_calls(models):
    with pytest.raises(ValueError, match="platform"):
        render_creative_variants(topic="Garden", style=None, spec=CreativeSpec(), platforms=[], brand={}, logo_bytes=None)
    models[0].assert_not_called()
    models[1].assert_not_called()


def test_carousel_prompt_keeps_shared_context_without_forcing_photography():
    style = "Vector editorial diagrams, shared indigo and amber palette. " * 5
    prompt = creative.build_visual_prompt("Seedling lifecycle", CreativeSpec(format="carousel", slide_index=2, slide_count=3), {}, style)
    assert style.strip() in prompt
    assert "series palette" in prompt and "central safe region" in prompt
    assert "premium commercial photography" not in prompt


def test_art_direct_sanitizes_actual_response_and_retains_brand_policy_without_visual_branding(monkeypatch):
    from app.social.ai import generator

    response = {"visual": "**Editorial illustration** 🌱", "headline": "## **Grow** 🌱", "subtext": "**First detail**\nSecond detail", "cta": "`Join`"}
    completion = Mock(return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(response)))]))
    monkeypatch.setattr(generator, "_get_llm", lambda: (object(), "mock-text-model"))
    monkeypatch.setattr(generator, "_chat_completion", completion)
    style = "Editorial vector diagrams; coordinated teal and orange palette. " * 5
    visual, copy = creative.art_direct(
        "Explain seedling care", CreativeSpec(format="carousel", text_overlay=True, use_brand=False,
                                              include_emojis=True, slide_index=2, slide_count=3),
        {"brand_name": "Hidden Brand", "emoji_usage": "never"}, style,
    )
    messages = completion.call_args.kwargs["messages"]
    system, user = [message["content"] for message in messages]
    assert "No Markdown" in system and "No emojis" in system
    assert "Photorealistic commercial quality unless" not in system
    assert "slide 2 of 3" in user and style.strip() in user
    assert "Hidden Brand" not in user
    assert visual == "Editorial illustration"
    assert copy == OverlayCopy("Grow", "First detail\nSecond detail", "Join")


def test_overlay_disabled_does_not_render_manual_or_directed_copy(models, monkeypatch):
    compose = Mock(return_value=b"composed")
    monkeypatch.setattr(creative, "compose_creative", compose)
    result = render_creative_variants(topic="Garden", style=None,
                                     spec=CreativeSpec(headline="Do not display", subtext="Hidden body", cta="Hidden CTA"),
                                     platforms=["instagram", "linkedin"], brand={}, logo_bytes=b"invalid logo")
    assert all(call.kwargs["copy"] is None and call.kwargs["logo_bytes"] is None for call in compose.call_args_list)
    assert all(item.copy == OverlayCopy() and not item.logo_applied for item in result.values())