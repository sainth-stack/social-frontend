import base64
import json
from io import BytesIO
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from PIL import Image, ImageDraw

from app.providers.llm import bedrock_image
from app.providers.llm.metering import metering_scope
from app.social.ai import creative, image_generator
from app.social.ai.compositor import OverlayCopy, compose_creative, decode_image
from app.social.ai.creative import CreativeSpec
from app.social.ai.image_quality import ImageReliabilityError, validate_image_bytes


def encoded(image, fmt="PNG", **kwargs):
    output = BytesIO()
    image.save(output, format=fmt, **kwargs)
    return output.getvalue()


def textured(mode="RGB", dark=False):
    image = Image.new(mode, (128, 128), 1 if mode == "L" else (1, 1, 1) if dark else (40, 90, 160))
    draw = ImageDraw.Draw(image)
    for index in range(0, 128, 4):
        value = index % 12 if dark else 60 + index
        draw.rectangle((index, 0, index + 1, 127), fill=value if mode == "L" else (value, value, value))
    return image


@pytest.mark.parametrize("mode,color,code", [
    ("RGB", (0, 0, 0), "IMAGE_NEAR_BLACK"),
    ("RGBA", (0, 0, 0, 255), "IMAGE_NEAR_BLACK"),
    ("RGBA", (255, 90, 50, 0), "IMAGE_FULLY_TRANSPARENT"),
    ("L", 0, "IMAGE_NEAR_BLACK"),
    ("RGB", (255, 255, 255), "IMAGE_UNIFORM"),
])
@pytest.mark.parametrize("stage", ["base", "export"])
def test_unusable_pixels_have_safe_stage_specific_codes(mode, color, code, stage):
    with pytest.raises(ImageReliabilityError) as failure:
        validate_image_bytes(encoded(Image.new(mode, (128, 128), color)), stage=stage)
    assert failure.value.code == code
    assert failure.value.stage == stage


@pytest.mark.parametrize("mode", ["RGB", "L"])
@pytest.mark.parametrize("dark", [True, False])
def test_dark_textured_artwork_is_not_rejected(mode, dark):
    summary = validate_image_bytes(encoded(textured(mode, dark)), stage="base")
    assert summary["width"] == summary["height"] == 128
    assert summary["luminanceDeviation"] > 0.6


def test_dark_colour_texture_with_constant_luminance_is_not_blank():
    image = Image.new("RGB", (128, 128), (4, 0, 0))
    ImageDraw.Draw(image).rectangle((32, 32, 96, 96), fill=(0, 0, 11))
    validate_image_bytes(encoded(image), stage="base")


def test_small_real_details_are_not_lost_to_coarse_quality_sampling():
    image = Image.new("RGB", (1024, 1024), "black")
    image.putpixel((512, 512), (255, 255, 255))
    validate_image_bytes(encoded(image), stage="base")


def test_palette_transparency_and_alpha_shaped_black_artwork():
    palette = Image.new("P", (128, 128), 0)
    palette.putpalette([0, 0, 0] * 256)
    with pytest.raises(ImageReliabilityError, match="fully transparent"):
        validate_image_bytes(encoded(palette, transparency=0), stage="base")
    shape = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    ImageDraw.Draw(shape).ellipse((20, 20, 100, 100), fill=(0, 0, 0, 255))
    validate_image_bytes(encoded(shape), stage="base")
    output = decode_image(compose_creative(encoded(shape), width=128, height=128))
    assert min(output.getpixel((0, 0))[:3]) > 245
    assert max(output.getpixel((64, 64))[:3]) < 5


def test_palette_cmyk_and_exif_artwork_decode_safely():
    validate_image_bytes(encoded(textured().convert("P")), stage="base")
    raw = textured().resize((128, 64)).convert("CMYK")
    exif = Image.Exif()
    exif[274] = 6
    data = encoded(raw, "JPEG", exif=exif)
    assert decode_image(data).size == (64, 128)
    validate_image_bytes(data, stage="base")


@pytest.mark.parametrize("raw", [b"broken", b"", b"\x89PNG\r\n\x1a\n"])
def test_corrupt_bytes_are_safe_decode_failures(raw):
    with pytest.raises(ImageReliabilityError) as failure:
        validate_image_bytes(raw, stage="base")
    assert failure.value.code == "IMAGE_DECODE_FAILED"


def test_default_aspect_padding_is_white_but_explicit_dark_brand_is_preserved():
    raw = encoded(textured().resize((128, 64)))
    neutral = decode_image(compose_creative(raw, width=128, height=128))
    branded = decode_image(compose_creative(raw, width=128, height=128, primary_color="#112233"))
    assert min(neutral.getpixel((64, 4))[:3]) > 245
    assert all(abs(actual - expected) < 5 for actual, expected in zip(branded.getpixel((64, 4))[:3], (17, 34, 51)))


def test_prompt_budget_keeps_caption_brief_brand_style_and_tail_constraints(monkeypatch):
    subject = "Physical bicycle repair workshop. " + "Routine maintenance context. " * 1000 + "Only show real bicycle tools, no robots."
    caption = "Approved message: repair instead of replace. " + "Community reuse context. " * 1000 + "Never show fabricated performance charts."
    style = "Linocut illustration. " + "Handmade textured visual. " * 500 + "Keep the red and cream palette."
    brand = {"brand_name": "Cycle Neighbors", "industry": "Bicycle repair", "target_audience": "Local cyclists",
             "tones": ["Warm " * 1000], "words_to_use": ["Workshop " * 1000], "primary_color": "#ff0000", "accent_color": "#eeeeee"}
    spec = CreativeSpec(caption=caption, format="carousel")
    prompt = creative.build_visual_prompt(subject, spec, brand, style)
    assert len(prompt) < 8800
    for constraint in ("Physical bicycle repair", "repair instead of replace", "Only show real bicycle tools", "no robots",
                       "Never show fabricated performance charts", "Cycle Neighbors", "Bicycle repair", "Local cyclists", "Linocut illustration", "red and cream palette"):
        assert constraint in prompt
    body = bedrock_image._stability_text_to_image_body(prompt=prompt, width=1080, height=1350)
    assert body["prompt"] == prompt
    generate = Mock(return_value={"imageB64": encoded(textured())})
    monkeypatch.setattr(creative, "generate_post_image", generate)
    monkeypatch.setattr(creative, "art_direct", lambda *args: ("Detailed subordinate visual. " * 1000 + "Keep bicycle tools visible.", OverlayCopy()))
    creative.render_creative(topic=subject, style=style, spec=spec, brand=brand)
    sent = generate.call_args.kwargs["prompt_override"]
    assert len(sent) < 10000
    assert "Keep bicycle tools visible" in sent
    assert "Only show real bicycle tools" in sent


@pytest.mark.parametrize("raw,code", [
    (encoded(Image.new("RGB", (128, 128), "black")), "IMAGE_NEAR_BLACK"),
    (encoded(Image.new("RGBA", (128, 128), (0, 0, 0, 0))), "IMAGE_FULLY_TRANSPARENT"),
    (b"broken image", "IMAGE_DECODE_FAILED"),
])
def test_rejected_output_still_records_actual_provider_usage(db, monkeypatch, raw, code):
    runtime = Mock()
    runtime.invoke_model.return_value = {"body": BytesIO(json.dumps({"images": [base64.b64encode(raw).decode()]}).encode()),
                                        "ResponseMetadata": {"RequestId": "paid-attempt"}}
    monkeypatch.setattr(bedrock_image, "get_bedrock_runtime_client", lambda **kwargs: runtime)
    monkeypatch.setattr(bedrock_image, "_resolved_image_model_id", lambda: "stability.stable-image-ultra-v1:1")
    monkeypatch.setattr(image_generator, "image_generation_configured", lambda: True)
    with metering_scope(db, "workspace", "user", "creative", "operation"):
        with pytest.raises(HTTPException) as failure:
            image_generator.generate_post_image(topic="Repair bicycles")
    assert failure.value.detail["code"] == code
    assert failure.value.detail["stage"] == "base"
    runtime.invoke_model.assert_called_once()
    event = db["ai_provider_usage"].find_one()
    assert event["status"] == "success" and event["quantity"] == 1
    assert event["provider_request_id"] == "paid-attempt"
    assert db["plans_ai_usage"].count_documents({}) == 0


def test_filtered_provider_error_is_safe_and_does_not_leak_response(monkeypatch):
    monkeypatch.setattr(image_generator, "image_generation_configured", lambda: True)
    monkeypatch.setattr(image_generator, "generate_text_to_image", Mock(side_effect=bedrock_image.ImageProviderError("IMAGE_PROVIDER_FILTERED", "private provider output")))
    with pytest.raises(HTTPException) as failure:
        image_generator.generate_post_image(topic="Repair bicycles")
    assert failure.value.detail["code"] == "IMAGE_PROVIDER_FILTERED"
    assert "private" not in str(failure.value.detail)


def test_saved_recipe_reuses_exact_overlay_with_no_model_calls(monkeypatch):
    image_model = Mock(return_value={"imageB64": encoded(textured())})
    direction = Mock(return_value=("Bicycle workshop illustration", OverlayCopy("Repair together", "Keep useful bikes moving", "Join us")))
    monkeypatch.setattr(creative, "generate_post_image", image_model)
    monkeypatch.setattr(creative, "art_direct", direction)
    saved = []
    recipes = []
    callback = lambda raw: saved.append(raw)
    callback.on_recipe_ready = recipes.append
    spec = CreativeSpec(text_overlay=True)
    first = creative.render_creative_variants(topic="Repair bicycles", style=None, spec=spec, brand={}, logo_bytes=None,
                                             platforms=["instagram"], on_base_ready=callback)
    second = creative.render_creative_variants(topic="Repair bicycles", style=None, spec=CreativeSpec(text_overlay=True, render_recipe=recipes[0]),
                                              brand={}, logo_bytes=None, platforms=["instagram"], base_image=saved[0])
    assert first["instagram"].image == second["instagram"].image
    direction.assert_called_once()
    image_model.assert_called_once()


def test_single_creative_compatibility_returns_safe_export_quality_error(monkeypatch):
    monkeypatch.setattr(creative, "generate_post_image", lambda **kwargs: {"imageB64": encoded(textured())})
    monkeypatch.setattr(creative, "compose_creative", Mock(side_effect=ImageReliabilityError("IMAGE_NEAR_BLACK", "export", "Image is nearly uniform black")))
    with pytest.raises(HTTPException) as failure:
        creative.render_creative(topic="Repair bicycles", style=None, spec=CreativeSpec(auto_copy=False), brand={})
    assert failure.value.status_code == 502
    assert failure.value.detail["code"] == "IMAGE_NEAR_BLACK"
    assert failure.value.detail["stage"] == "export"