from __future__ import annotations

import json
import threading
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from PIL import Image, ImageDraw

from app.core.config import settings
from app.providers.llm import bedrock_image
from app.providers.llm.model_selection import image_region
from app.social.ai import creative, image_judge
from app.social.ai.compositor import OverlayCopy
from app.social.ai.creative import (
    CreativeSpec,
    VisualConcept,
    build_negative_prompt,
    candidate_count,
    compile_image_prompt,
    explore_concepts,
    render_creative,
)
from app.social.ai.product_scene import product_cutout
from app.social.ai.visual_skills import select_visual_skill
from tests.test_creative import _png, fake_storage  # noqa: F401

API = settings.api_v1_prefix


def _encode(image: Image.Image) -> bytes:
    out = BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


def _textured(color) -> bytes:
    image = Image.new("RGB", (1024, 1024), color)
    ImageDraw.Draw(image).rectangle((256, 256, 640, 640), fill=(240, 240, 240))
    return _encode(image)


@pytest.mark.parametrize("text,industry,name", [
    ("Fresh sourdough loaves every morning", "", "food_drink"),
    ("Grand opening of our sourdough bakery this Saturday", "", "food_drink"),
    ("Join our 6am boot camp at the gym", "", "fitness_active"),
    ("Lakeside villa now open for weekend stays", "", "property_space"),
    ("20% off teeth whitening at our dental clinic", "", "care_wellness"),
    ("5 GST mistakes small businesses make", "", "how_to_guide"),
    ("Thoughts on our week", "Bakery", "food_drink"),
])
def test_visual_skill_routing(text, industry, name):
    assert select_visual_skill(text, industry=industry).name == name


def test_quote_format_and_unmatched_text():
    assert select_visual_skill("Anything", post_format="quote").name == "inspiration_quote"
    assert select_visual_skill("Thoughts on our week") is None


def test_prompt_is_positive_and_negations_move_to_negative_prompt():
    concept = VisualConcept(
        concept_type="food", subject="Fresh croissants on a marble counter, no people",
        medium="editorial food photography without props",
    )
    style = "warm film look, no text"
    prompt = compile_image_prompt(concept, CreativeSpec(platform="instagram"), {}, style)
    negative = build_negative_prompt(concept, style)
    assert prompt.startswith("Fresh croissants on a marble counter")
    assert "no people" not in prompt and "without" not in prompt and "no text" not in prompt
    assert "warm film look" in prompt
    assert "people" in negative and "props" in negative


def test_photo_concepts_keep_natural_colour_and_illustrations_use_brand_palette():
    brand = {"primary_color": "#0f766e", "accent_color": "#f59e0b"}
    photo = compile_image_prompt(VisualConcept(concept_type="food", subject="Bread", medium="food photography"), CreativeSpec(), brand, None)
    flat = compile_image_prompt(VisualConcept(concept_type="educational", subject="Bread", medium="flat vector illustration"), CreativeSpec(), brand, None)
    assert "Palette" not in photo and "teal" not in photo
    assert "Palette" in flat and "teal" in flat


def test_candidate_count_respects_setting_and_carousel(monkeypatch):
    monkeypatch.setattr(settings, "image_candidates", 3)
    assert candidate_count(CreativeSpec()) == 3
    assert candidate_count(CreativeSpec(format="carousel")) == 1
    monkeypatch.setattr(settings, "image_candidates", 9)
    assert candidate_count(CreativeSpec()) == 4


def test_multiple_candidates_are_judged_and_best_is_used(monkeypatch):
    monkeypatch.setattr(settings, "image_candidates", 3)
    pool = [_png(color=(40, 90, 160)), _textured((200, 30, 30)), _textured((30, 200, 30))]
    lock = threading.Lock()

    def generate(**kwargs):
        with lock:
            return {"imageB64": pool.pop()}

    judged = {}

    def pick(candidates, *, brief):
        judged["brief"] = brief
        judged["candidates"] = list(candidates)
        return judged["candidates"].index(_png(color=(40, 90, 160)))

    concept = VisualConcept(concept_type="food", subject="Baker shaping dough", medium="food photography")
    monkeypatch.setattr(creative, "art_direct", lambda *a, **k: (concept, OverlayCopy()))
    monkeypatch.setattr(creative, "generate_post_image", generate)
    monkeypatch.setattr(creative, "pick_best_image", pick)
    compose = Mock(return_value=b"composed")
    monkeypatch.setattr(creative, "compose_creative", compose)
    render_creative(topic="Bakery", style=None, spec=CreativeSpec(caption="Fresh bread daily"), brand={})
    assert len(judged["candidates"]) == 3
    assert "Fresh bread daily" in judged["brief"] and "Baker shaping dough" in judged["brief"]
    assert compose.call_args.args[0] == _png(color=(40, 90, 160))


def test_partial_candidate_failure_still_renders(monkeypatch):
    monkeypatch.setattr(settings, "image_candidates", 2)
    calls = {"n": 0}
    lock = threading.Lock()

    def generate(**kwargs):
        with lock:
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("provider hiccup")
        return {"imageB64": _png()}

    monkeypatch.setattr(creative, "art_direct", lambda *a, **k: (VisualConcept(subject="Baker"), OverlayCopy()))
    monkeypatch.setattr(creative, "generate_post_image", generate)
    monkeypatch.setattr(creative, "pick_best_image", Mock(side_effect=AssertionError("single survivor needs no judge")))
    monkeypatch.setattr(creative, "compose_creative", Mock(return_value=b"composed"))
    assert render_creative(topic="Bakery", style=None, spec=CreativeSpec(), brand={}).image == b"composed"


def test_heuristic_judge_prefers_detail_when_vision_unavailable(monkeypatch):
    monkeypatch.setattr(image_judge, "_vision_scores", Mock(side_effect=RuntimeError("no vision")))
    flat = _png((512, 512), (128, 128, 128))
    assert image_judge.pick_best_image([flat, _png()], brief="Bakery") == 1


def test_vision_judge_scores_relevance_and_penalises_text(monkeypatch):
    from app.providers.llm import factory

    scores = [
        {"relevance": 8, "quality": 8, "clean": 8, "hasText": False},
        {"relevance": 9, "quality": 9, "clean": 9, "hasText": True},
    ]
    create = Mock(return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({"scores": scores})))]))
    monkeypatch.setattr(settings, "bedrock_vision_model_id", "vision-model")
    monkeypatch.setattr(factory, "_get_llm_client", lambda model, region: SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create))))
    assert image_judge.pick_best_image([_png(), _png((800, 800))], brief="Bakery") == 0
    content = create.call_args.kwargs["messages"][0]["content"]
    assert create.call_args.kwargs["model"] == "vision-model"
    assert sum(1 for block in content if "image" in block) == 2


def test_concept_override_skips_concept_direction(monkeypatch):
    art = Mock(side_effect=AssertionError("override must skip art direction"))
    generate = Mock(return_value={"imageB64": _png()})
    monkeypatch.setattr(creative, "art_direct", art)
    monkeypatch.setattr(creative, "generate_post_image", generate)
    monkeypatch.setattr(creative, "compose_creative", Mock(return_value=b"composed"))
    override = {"conceptType": "food", "subject": "Baker dusting flour over sourdough loaves, no people", "medium": "editorial food photography"}
    result = render_creative(topic="Bakery", style=None, spec=CreativeSpec(concept_override=override), brand={})
    art.assert_not_called()
    prompt = generate.call_args.kwargs["prompt_override"]
    assert prompt.startswith("Baker dusting flour over sourdough loaves") and "no people" not in prompt
    assert "people" in generate.call_args.kwargs["negative_prompt"]
    assert result.concept.source == "user" and result.warnings == []


def test_recent_subjects_reach_art_direction(monkeypatch):
    seen = {}

    def direct(*args, **kwargs):
        seen.update(kwargs)
        return VisualConcept(subject="Baker"), OverlayCopy()

    monkeypatch.setattr(creative, "art_direct", direct)
    monkeypatch.setattr(creative, "generate_post_image", Mock(return_value={"imageB64": _png()}))
    monkeypatch.setattr(creative, "compose_creative", Mock(return_value=b"composed"))
    render_creative(topic="Bakery", style=None, spec=CreativeSpec(), brand={}, recent_subjects=["Croissants on a tray"])
    assert seen["recent_subjects"] == ["Croissants on a tray"]


def test_explore_concepts_returns_three_positive_distinct_concepts(monkeypatch):
    from app.social.ai import generator

    concepts = [
        {"title": "Morning bake", "conceptType": "food", "subject": "Baker pulling sourdough loaves from a stone oven, no people in background", "medium": "food photography"},
        {"title": "Rising idea", "conceptType": "abstract", "subject": "A single loaf rising like a sunrise over a wheat field"},
        {"title": "Flat lay", "conceptType": "food", "subject": "Overhead flat lay of flour, starter jar and scoring blade on linen"},
    ]
    completion = Mock(return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({"concepts": concepts})))]))
    monkeypatch.setattr(generator, "_get_llm", lambda: (object(), "m"))
    monkeypatch.setattr(generator, "_chat_completion", completion)
    result = explore_concepts("Sourdough bakery opening", CreativeSpec(platform="instagram"), {"industry": "Bakery"}, None, recent_subjects=["Croissants on a tray"])
    assert [item["title"] for item in result] == ["Morning bake", "Rising idea", "Flat lay"]
    assert "no people" not in result[0]["subject"] and any("people" in a for a in result[0]["avoid"])
    system, user = [m["content"] for m in completion.call_args.kwargs["messages"]]
    assert "exactly 3" in system and "Concept 2" in system
    assert "Croissants on a tray" in user and "Bakery" in user


def test_explore_concepts_falls_back_to_brief(monkeypatch):
    from app.social.ai import generator

    monkeypatch.setattr(generator, "_get_llm", Mock(side_effect=RuntimeError("offline")))
    result = explore_concepts("Grand opening of our sourdough bakery", CreativeSpec(), {}, None)
    assert len(result) == 1 and result[0]["title"] == "From your brief"
    assert result[0]["conceptType"] == "food" and result[0]["subject"].startswith("Grand opening")


def _product_photo() -> tuple[bytes, bytes]:
    photo = Image.new("RGB", (400, 400), (250, 250, 250))
    ImageDraw.Draw(photo).rectangle((150, 100, 250, 300), fill=(220, 20, 20))
    cut = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    ImageDraw.Draw(cut).rectangle((150, 100, 250, 300), fill=(220, 20, 20, 255))
    return _encode(photo), _encode(cut)


def test_product_photo_is_cut_out_inpainted_and_pasted_back(monkeypatch):
    photo, cut = _product_photo()
    remove = Mock(return_value=cut)
    seen = {}

    def inpaint(image, *, prompt, negative_prompt=None, grow_mask=3):
        canvas = Image.open(BytesIO(image))
        seen.update(mode=canvas.mode, size=canvas.size, prompt=prompt, alpha=canvas.getchannel("A").getextrema())
        scene = Image.new("RGB", canvas.size, (30, 120, 60))
        ImageDraw.Draw(scene).rectangle((0, 0, canvas.width, canvas.height // 3), fill=(200, 180, 120))
        return _encode(scene)

    direct = Mock(return_value=(VisualConcept(concept_type="product", subject="Speaker on a walnut shelf in a sunlit living room"), OverlayCopy()))
    monkeypatch.setattr(bedrock_image, "remove_background", remove)
    monkeypatch.setattr(bedrock_image, "inpaint", inpaint)
    monkeypatch.setattr(creative, "art_direct", direct)
    monkeypatch.setattr(creative, "generate_post_image", Mock(side_effect=AssertionError("text-to-image must not run")))
    result = render_creative(topic="Our red speaker", style=None, spec=CreativeSpec(platform="instagram"), brand={}, product_image=photo)
    remove.assert_called_once()
    assert direct.call_args.args[1].product_scene is True
    assert seen["mode"] == "RGBA" and seen["alpha"] == (0, 255) and seen["prompt"].startswith("Speaker on a walnut shelf")
    image = Image.open(BytesIO(result.image)).convert("RGB")
    assert image.size == (1080, 1350)
    r, g, b = image.getpixel((540, int(1350 * 0.8) - 40))
    assert r > 170 and g < 90 and b < 90


def test_transparent_product_skips_background_removal_and_empty_cutout_fails(monkeypatch):
    _, cut = _product_photo()
    remove = Mock(return_value=_encode(Image.new("RGBA", (64, 64), (0, 0, 0, 0))))
    monkeypatch.setattr(bedrock_image, "remove_background", remove)
    assert product_cutout(cut).size == (101, 201)
    remove.assert_not_called()
    with pytest.raises(bedrock_image.ImageProviderError) as failure:
        product_cutout(_product_photo()[0])
    assert failure.value.code == "PRODUCT_NOT_FOUND"


def test_image_services_region_and_error_mapping(monkeypatch):
    assert image_region("us.stability.stable-image-inpaint-v1:0") == "us-west-2"
    monkeypatch.setattr(bedrock_image, "_invoke_raw", Mock(side_effect=RuntimeError("AccessDenied")))
    with pytest.raises(bedrock_image.ImageProviderError) as failure:
        bedrock_image.remove_background(b"x")
    assert failure.value.code == "IMAGE_SERVICE_UNAVAILABLE"


def _register(client, email):
    body = client.post(f"{API}/auth/register", json={"email": email, "password": "s3cret-pass"}).json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body["workspace"]["id"]


def test_image_concepts_endpoint_and_visual_style(client, monkeypatch):
    from app.providers.llm import factory
    from app.social.ai import generator

    headers, ws = _register(client, "concepts@example.com")
    base = f"{API}/workspaces/{ws}/social"
    saved = client.put(f"{base}/brand-voice", headers=headers, json={"brandName": "Crumb", "visualStyle": "  warm   film photography  "})
    assert saved.status_code == 200 and saved.json()["visualStyle"] == "warm film photography"
    reply = {"concepts": [{"title": "Morning bake", "conceptType": "food", "subject": "Baker pulling loaves from an oven"}]}
    completion = Mock(return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(reply)))]))
    monkeypatch.setattr(generator, "_get_llm", lambda: (object(), "m"))
    monkeypatch.setattr(generator, "_chat_completion", completion)
    res = client.post(f"{base}/image-concepts", headers=headers, json={"topic": "Sourdough bakery opening", "platform": "instagram"})
    assert res.status_code == 200, res.text
    assert res.json()["concepts"][0]["subject"] == "Baker pulling loaves from an oven"
    assert "warm film photography" in completion.call_args.kwargs["messages"][1]["content"]

    create = Mock(return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="Warm golden-hour film photography with soft grain and earthy tones."))]))
    monkeypatch.setattr(settings, "bedrock_vision_model_id", "vision-model")
    monkeypatch.setattr(factory, "_get_llm_client", lambda model, region: SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create))))
    style = client.post(f"{base}/brand-voice/visual-style", headers=headers, files={"file": ("ref.png", _png(), "image/png")})
    assert style.status_code == 200, style.text
    assert style.json()["visualStyle"].startswith("Warm golden-hour film photography")
    bad = client.post(f"{base}/brand-voice/visual-style", headers=headers, files={"file": ("ref.png", b"not an image", "image/png")})
    assert bad.status_code == 400


def test_generate_image_with_concept_product_and_variety_memory(client, db, monkeypatch, fake_storage):  # noqa: F811
    headers, ws = _register(client, "product@example.com")
    base = f"{API}/workspaces/{ws}/social"
    monkeypatch.setattr("app.social.limits.enforce_ai_image_limit", lambda db, ws: None)
    photo, cut = _product_photo()
    key = f"social/{ws}/product.png"
    fake_storage.objects[key] = photo
    db["social_media_assets"].insert_one({"id": "asset-1", "workspace_id": ws, "media_type": "image", "blob_key": key, "is_deleted": False})
    monkeypatch.setattr(bedrock_image, "remove_background", Mock(return_value=cut))
    prompts = []

    def inpaint(image, *, prompt, negative_prompt=None, grow_mask=3):
        prompts.append(prompt)
        size = Image.open(BytesIO(image)).size
        scene = Image.new("RGB", size, (30, 120, 60))
        ImageDraw.Draw(scene).rectangle((0, 0, size[0], size[1] // 3), fill=(200, 180, 120))
        return _encode(scene)

    monkeypatch.setattr(bedrock_image, "inpaint", inpaint)
    concept = {"conceptType": "product", "subject": "Red speaker on a walnut shelf in a sunlit living room"}
    res = client.post(f"{base}/generate-image", headers=headers, json={
        "topic": "Our red speaker", "format": "post", "platform": "instagram", "includeLogo": False,
        "concept": concept, "productAssetId": "asset-1",
    })
    assert res.status_code == 200, res.text
    assert prompts[0].startswith("Red speaker on a walnut shelf")
    history = db["social_visual_history"].find_one({"workspace_id": ws})
    assert history["subjects"] == ["Red speaker on a walnut shelf in a sunlit living room"]

    missing = client.post(f"{base}/generate-image", headers=headers, json={
        "topic": "Our red speaker", "format": "post", "productAssetId": "nope",
    })
    assert missing.status_code == 400
