import json
from unittest.mock import Mock

import pytest

from app.providers.llm import factory
from app.social.ai import generator
from app.social.schemas import GeneratePostRequest
from app.social.service import SocialMediaService


def model_output():
    return {
        "caption": "Review the release checklist before deployment.",
        "hashtags": ["Release"],
        "firstComment": "**Review readiness together.** 🚀",
        "first_comment": "Unexpected alternate comment",
        "slides": [
            {"headline": f"Review release step {i}",
             "body": f"Check deployment stage {i} before continuing.",
             "imagePrompt": f"Diagram of deployment stage {i}.",
             "firstComment": "Never put comments on slides"}
            for i in range(1, 4)
        ],
        "question": "Which stage needs attention?",
        "options": ["Planning", "Checks", "Deploy", "Review"],
        "tweets": [{"text": "Plan release checks."}, {"text": "Review readiness."}],
    }


@pytest.fixture
def completion(monkeypatch):
    client = Mock()
    client.chat.completions.create.side_effect = AssertionError("Unexpected provider call")
    monkeypatch.setattr(factory, "get_llm_client", lambda: client)
    monkeypatch.setattr(factory, "get_llm_model", lambda: "test-model")
    complete = Mock(return_value=json.dumps(model_output()))
    monkeypatch.setattr(generator, "_complete_json", complete)
    return complete


@pytest.mark.parametrize("fmt", ["single", "carousel", "poll"])
@pytest.mark.parametrize("enabled", [False, True])
@pytest.mark.parametrize("key", ["firstComment", "first_comment"])
def test_generators_enforce_comment_toggle_in_same_completion(completion, fmt, enabled, key):
    output = model_output()
    comment = output["firstComment"]
    output.pop("firstComment")
    output.pop("first_comment")
    output[key] = comment
    completion.return_value = json.dumps(output)
    kwargs = dict(topic="Release checklist.", tone="Professional", audience=None,
                  brand_voice=None, include_comment=enabled)
    if fmt == "single":
        result = generator.generate_platform_content(**kwargs, cta=None,
            platforms=["linkedin"], include_hashtags=True, length_hint="short")["linkedin"]
    else:
        if fmt == "carousel":
            kwargs["cta"] = None
        result = getattr(generator, f"generate_{fmt}_content")(**kwargs)
    assert result["firstComment"] == ("Review readiness together." if enabled else "")
    assert "first_comment" not in result
    assert all("firstComment" not in slide for slide in result.get("slides", []))
    assert completion.call_count == 1
    prompt = completion.call_args.kwargs["user_prompt"]
    assert ("one short supporting comment" in prompt) is enabled
    assert ("do not generate a first comment" in prompt) is not enabled
    assert "firstComment" in completion.call_args.kwargs["system_prompt"] or fmt == "single"


def test_thread_discards_unsolicited_comment(completion):
    result = generator.generate_thread_content(topic="Release checklist.", tone="Professional",
        audience=None, cta=None, brand_voice=None)
    assert result["firstComment"] == ""
    assert "first_comment" not in result
    assert completion.call_count == 1
    assert "copy-only; do not generate a first comment" in completion.call_args.kwargs["system_prompt"]


@pytest.mark.parametrize("fmt", ["single", "carousel", "poll"])
def test_enabled_missing_model_comment_stays_empty_without_extra_completion(completion, fmt):
    output = model_output()
    output.pop("firstComment")
    output.pop("first_comment")
    completion.return_value = json.dumps(output)
    kwargs = dict(topic="Release checklist.", tone="Professional", audience=None,
                  brand_voice=None, include_comment=True)
    if fmt == "single":
        result = generator.generate_platform_content(**kwargs, cta=None,
            platforms=["linkedin"], include_hashtags=True, length_hint="short")["linkedin"]
    else:
        if fmt == "carousel":
            kwargs["cta"] = None
        result = getattr(generator, f"generate_{fmt}_content")(**kwargs)
    assert result["firstComment"] == ""
    assert completion.call_count == 1


@pytest.mark.parametrize("default", [None, False, True])
@pytest.mark.parametrize("override", [None, False, True])
@pytest.mark.parametrize("fmt", ["single", "carousel", "poll", "thread"])
def test_studio_resolves_workspace_default_and_explicit_override(db, monkeypatch, fmt, default, override):
    workspace = {"id": "ws", "plan": "growth"}
    if default is not None:
        db.social_settings.insert_one({"workspace_id": "ws", "auto_first_comment": default})
    expected = override if override is not None else bool(default)
    from app.social import limits

    monkeypatch.setattr(limits, "enforce_ai_text_limit", lambda *args: None)
    output = model_output()
    output["firstComment"] = "Supporting comment"
    fake = Mock(return_value={"linkedin": output} if fmt == "single" else output)
    name = "platform" if fmt == "single" else fmt
    monkeypatch.setattr(generator, f"generate_{name}_content", fake)
    service = SocialMediaService(db)
    resolve = Mock(wraps=service.resolve_include_comment)
    monkeypatch.setattr(service, "resolve_include_comment", resolve)
    kwargs = {"includeComment": override} if override is not None else {}
    request = GeneratePostRequest(topic="Release checklist.", platforms=["linkedin"], format=fmt, **kwargs)
    result = service.generate_post(workspace, request)
    resolve.assert_called_once_with(workspace, override)
    if fmt == "thread":
        assert "include_comment" not in fake.call_args.kwargs
        assert result.firstComment == ""
    else:
        assert fake.call_args.kwargs["include_comment"] is expected
        comment = result.platforms["linkedin"].firstComment if fmt == "single" else result.firstComment
        assert comment == ("Supporting comment" if expected else "")
    assert request.includeComment is override
    assert fake.call_count == 1
    assert db.plans_ai_usage.count_documents({"workspace_id": "ws", "kind": "text"}) == 1
    assert db.social_settings.count_documents({}) == int(default is not None)


def test_explicit_override_does_not_read_workspace_default(db, monkeypatch):
    read = Mock(side_effect=AssertionError("Explicit preference must not read settings"))
    monkeypatch.setattr(db.social_settings, "find_one", read)
    service = SocialMediaService(db)
    assert service.resolve_include_comment({"id": "ws"}, False) is False
    assert service.resolve_include_comment({"id": "ws"}, True) is True
    read.assert_not_called()