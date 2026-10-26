from concurrent.futures import ThreadPoolExecutor
from contextvars import copy_context
from datetime import timezone
from io import BytesIO
import json
from types import SimpleNamespace
from unittest.mock import Mock

from botocore.exceptions import ClientError
import pytest
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.providers.llm.bedrock_client import BedrockChatClient
from app.providers.llm import bedrock_image
from app.providers.llm.metering import metering_scope, pricing_configuration, record_provider_usage


MODEL = "metered-model"
REGION = "us-east-1"
USAGE = {"inputTokens": 1000, "outputTokens": 100, "cacheReadInputTokens": 2000, "cacheWriteInputTokens": 500}
RATES = {"inputPerMillionUsd": 3, "outputPerMillionUsd": 15,
         "cacheReadPerMillionUsd": 0.3, "cacheWritePerMillionUsd": 3.75,
         "imagePerUnitUsd": 0.04, "currency": "USD", "version": "test-v1",
         "source": "configured-test-fixture", "region": REGION}


@pytest.fixture(autouse=True)
def pricing(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider_pricing_json", json.dumps({MODEL: RATES}))


def record(**kwargs):
    return record_provider_usage(kind="text", model_id=MODEL, region=REGION,
                                 status="success", usage=USAGE, **kwargs)


def runtime(response=None):
    fake = Mock()
    fake.meta.region_name = REGION
    fake.converse.return_value = response or {
        "output": {"message": {"content": [{"text": "private response"}]}},
        "usage": USAGE, "ResponseMetadata": {"RequestId": "provider-id"},
    }
    return fake


def call(fake):
    return BedrockChatClient(fake, MODEL).chat.completions.create(
        messages=[{"role": "user", "content": "private prompt"}])


def test_decimal_cache_cost_snapshot_and_privacy(db, monkeypatch):
    with metering_scope(db, "workspace", "user", "generate", "correlation"):
        response = call(runtime())
    event = db.ai_provider_usage.find_one()
    assert response.usage == USAGE
    assert event["estimated_cost_usd"] == pytest.approx(0.006975)
    assert event["pricing_status"] == "priced"
    assert event["input_tokens"] == 1000
    assert event["cache_read_tokens"] == 2000
    assert event["cache_write_tokens"] == 500
    assert event["workspace_id"] == "workspace"
    assert event["user_id"] == "user"
    assert event["request_id"] == "correlation"
    assert event["provider_request_id"] == "provider-id"
    assert event["provider"] == "bedrock"
    assert event["created_at"] is not None
    assert "private" not in str(event)
    assert "messages" not in event and "content" not in event
    snapshot = event["pricing_snapshot"]
    assert snapshot["configured"] == RATES
    monkeypatch.setattr(settings, "ai_provider_pricing_json", "{}")
    assert db.ai_provider_usage.find_one()["pricing_snapshot"] == snapshot
    assert db.plans_ai_usage.count_documents({}) == 0


@pytest.mark.parametrize("usage,rates,expected", [
    (USAGE, {}, "missing_rate"),
    (None, RATES, "missing_usage"),
    ({"inputTokens": 1}, RATES, "missing_usage"),
    (USAGE, {"inputPerMillionUsd": 3, "outputPerMillionUsd": 15}, "unknown"),
    ({**USAGE, "cacheReadInputTokens": -1}, RATES, "unknown"),
    ({**USAGE, "cacheReadInputTokens": None}, RATES, "unknown"),
    ({**USAGE, "cacheWriteInputTokens": "500"}, RATES, "unknown"),
    (USAGE, {**RATES, "region": "wrong-region"}, "missing_rate"),
])
def test_missing_and_ambiguous_costs(db, monkeypatch, usage, rates, expected):
    monkeypatch.setattr(settings, "ai_provider_pricing_json", json.dumps({MODEL: rates}))
    with metering_scope(db, "w", None, "generate"):
        event = record_provider_usage(kind="text", model_id=MODEL, region=REGION,
                                      status="success", usage=usage)
    assert event["estimated_cost_usd"] is None
    assert event["pricing_status"] == expected


def test_explicit_alias_only_and_region_guard(db, monkeypatch):
    alias = "us." + MODEL
    config = {MODEL: RATES}
    monkeypatch.setattr(settings, "ai_provider_pricing_json", json.dumps(config))
    with metering_scope(db, "w", "u", "generate"):
        event = record_provider_usage(kind="text", model_id=alias, region=REGION, status="success", usage=USAGE)
        assert event["pricing_status"] == "missing_rate"
        config[alias] = {"aliasOf": MODEL, "region": REGION}
        monkeypatch.setattr(settings, "ai_provider_pricing_json", json.dumps(config))
        event = record_provider_usage(kind="text", model_id=alias, region=REGION, status="success", usage=USAGE)
        assert event["pricing_status"] == "priced"
        assert event["pricing_snapshot"]["resolved_rates"] == RATES
        event = record_provider_usage(kind="text", model_id=alias, region="other", status="success", usage=USAGE)
        assert event["pricing_status"] == "missing_rate"
    assert pricing_configuration()[0]["model_id"] == MODEL


@pytest.mark.parametrize("value", [-1, "NaN", "Infinity", "-Infinity", True, "1e400", "bad"])
def test_invalid_rates_rejected(value):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, AI_PROVIDER_PRICING_JSON=json.dumps({MODEL: {"inputPerMillionUsd": value}}))


def test_error_retry_filtered_and_duplicate_provider_ids_are_distinct(db):
    fake = runtime()
    fake.converse.side_effect = ClientError(
        {"Error": {"Code": "ThrottlingException", "Message": "private error"},
         "ResponseMetadata": {"RequestId": "provider-id"}}, "Converse")
    with metering_scope(db, "w", "u", "generate", "retry-chain"):
        with pytest.raises(RuntimeError):
            call(fake)
        fake.converse.side_effect = None
        call(fake)
        fake.converse.return_value["stopReason"] = "content_filtered"
        call(fake)
    events = list(db.ai_provider_usage.find())
    assert [event["status"] for event in events] == ["error", "success", "filtered"]
    assert len({event["id"] for event in events}) == 3
    assert {event["request_id"] for event in events} == {"retry-chain"}
    assert events[0]["pricing_status"] == events[2]["pricing_status"] == "unknown"
    assert events[0]["estimated_cost_usd"] is events[2]["estimated_cost_usd"] is None
    assert "private error" not in str(events)


def test_records_before_text_parse_failure(db):
    fake = runtime({"usage": USAGE, "output": {"message": {"content": ["bad"]}}})
    fake.converse.return_value["output"] = "invalid"
    with metering_scope(db, "w", "u", "generate"):
        with pytest.raises(AttributeError):
            call(fake)
    assert db.ai_provider_usage.find_one()["pricing_status"] == "priced"


@pytest.mark.parametrize("payload,status,quantity,cost", [
    ({"images": ["YWJj", "ZGVm"]}, "success", 2, 0.08),
    ({"images": [], "finish_reasons": ["CONTENT_FILTERED"]}, "filtered", 0, None),
    ({"images": []}, "error", 0, None),
    ({"images": ["YWJj"], "finish_reasons": ["CONTENT_FILTERED"]}, "filtered", 1, None),
])
def test_images_actual_returned_count(db, monkeypatch, payload, status, quantity, cost):
    fake = runtime()
    fake.invoke_model.return_value = {"body": BytesIO(json.dumps(payload).encode()),
                                    "ResponseMetadata": {"RequestId": "image-id"}}
    monkeypatch.setattr(bedrock_image, "get_bedrock_runtime_client", lambda **kw: fake)
    monkeypatch.setattr(bedrock_image, "image_region", lambda model: REGION)
    with metering_scope(db, "w", "u", "image"):
        if status == "success":
            assert len(bedrock_image._invoke_raw({"prompt": "private"}, model_id=MODEL)) == 2
        else:
            with pytest.raises(RuntimeError):
                bedrock_image._invoke_raw({}, model_id=MODEL)
    event = db.ai_provider_usage.find_one()
    assert event["quantity"] == quantity
    assert event["estimated_cost_usd"] == cost
    assert event["status"] == status
    assert event["provider_request_id"] == "image-id"


def test_image_malformed_body_and_transport_error(db, monkeypatch):
    fake = runtime()
    monkeypatch.setattr(bedrock_image, "get_bedrock_runtime_client", lambda **kw: fake)
    monkeypatch.setattr(bedrock_image, "image_region", lambda model: REGION)
    with metering_scope(db, "w", "u", "image"):
        fake.invoke_model.return_value = {"body": BytesIO(b"not JSON")}
        with pytest.raises(ValueError):
            bedrock_image._invoke_raw({}, model_id=MODEL)
        fake.invoke_model.side_effect = OSError("transport failure")
        with pytest.raises(OSError):
            bedrock_image._invoke_raw({}, model_id=MODEL)
    assert db.ai_provider_usage.count_documents({"status": "error", "pricing_status": "unknown"}) == 2


def test_image_usage_survives_downstream_decode_failure(db, monkeypatch):
    fake = runtime()
    fake.invoke_model.return_value = {"body": BytesIO(json.dumps({"images": ["a"]}).encode())}
    monkeypatch.setattr(bedrock_image, "get_bedrock_runtime_client", lambda **kw: fake)
    monkeypatch.setattr(bedrock_image, "image_region", lambda model: REGION)
    monkeypatch.setattr(bedrock_image, "_resolved_image_model_id", lambda: MODEL)
    with metering_scope(db, "w", "u", "image"):
        with pytest.raises(bedrock_image.ImageProviderError):
            bedrock_image.generate_text_to_image(prompt="private")
    assert db.ai_provider_usage.find_one()["estimated_cost_usd"] == 0.04


def test_zero_configured_rates_are_priced_and_utc(db, monkeypatch):
    monkeypatch.setattr(settings, "ai_provider_pricing_json", json.dumps({MODEL: {
        "inputPerMillionUsd": 0, "outputPerMillionUsd": 0}}))
    with metering_scope(db, "w", None, "generate"):
        event = record_provider_usage(kind="text", model_id=MODEL, region=REGION, status="success",
                                      usage={"inputTokens": 10, "outputTokens": 2})
    assert event["created_at"].tzinfo == timezone.utc
    assert event["estimated_cost_usd"] == 0
    assert event["pricing_status"] == "priced"


def test_bedrock_runtime_disables_unobservable_sdk_retries(monkeypatch):
    import boto3
    from app.providers.llm.bedrock_client import get_bedrock_runtime_client

    factory = Mock()
    monkeypatch.setattr(boto3, "client", factory)
    monkeypatch.setattr(settings, "bedrock_aws_access_key_id", "fake-key")
    monkeypatch.setattr(settings, "bedrock_aws_secret_access_key", "fake-secret")
    get_bedrock_runtime_client.cache_clear()
    try:
        get_bedrock_runtime_client(region_name=REGION)
        assert factory.call_args.kwargs["config"].retries["total_max_attempts"] == 1
    finally:
        get_bedrock_runtime_client.cache_clear()


def test_nested_scope_restoration_and_thread_isolation(db, caplog):
    with metering_scope(db, "outer", "one", "generate", "outer-request"):
        with metering_scope(db, "inner", "two", "image"):
            record()
        with ThreadPoolExecutor(max_workers=4) as pool:
            events = [pool.submit(copy_context().run, record) for _ in range(12)]
            assert all(future.result()["workspace_id"] == "outer" for future in events)
        record()
    assert record() is None
    assert "missing scope" in caplog.text
    assert db.ai_provider_usage.count_documents({"workspace_id": "outer", "user_id": "one"}) == 13
    assert db.ai_provider_usage.count_documents({"workspace_id": "inner", "user_id": "two"}) == 1


def test_database_failure_does_not_break_provider_response(caplog):
    broken = Mock()
    broken.__getitem__ = Mock(return_value=Mock(insert_one=Mock(side_effect=OSError("offline"))))
    with metering_scope(broken, "w", "u", "generate"):
        assert call(runtime()).choices[0].message.content == "private response"
    assert "AI metering persistence failed" in caplog.text


def test_generator_copies_context_for_each_future(db, monkeypatch):
    from app.social.ai import generator
    from app.providers.llm import factory

    monkeypatch.setattr(factory, "get_llm_client", lambda: object())
    monkeypatch.setattr(factory, "get_llm_model", lambda: MODEL)

    def generate_one(**kwargs):
        event = record()
        assert event["user_id"] == "thread-user"
        return kwargs["platform_key"], {"caption": "generated"}

    monkeypatch.setattr(generator, "_generate_one_platform", generate_one)
    with metering_scope(db, "thread-workspace", "thread-user", "generate"):
        result = generator.generate_platform_content(
            topic="topic", tone="Professional", platforms=["facebook", "instagram", "linkedin"],
            audience=None, cta=None, include_hashtags=False, include_comment=False, brand_voice=None)
    assert len(result) == 3
    assert db.ai_provider_usage.count_documents({"workspace_id": "thread-workspace"}) == 3


def test_planner_scope_covers_sync_and_background_entry(db, monkeypatch):
    from app.social.content_plan import ContentPlanService

    def run(self, workspace, user, payload, progress_callback, cancel_check):
        return record()

    monkeypatch.setattr(ContentPlanService, "_run", run)
    event = ContentPlanService(db).generate({"id": "planner-w"}, {"id": "planner-u"}, object())
    assert event["operation"] == "planner"
    assert event["workspace_id"] == "planner-w"
    assert event["user_id"] == "planner-u"


@pytest.mark.parametrize("user", [{"id": "brand-user"}, None])
def test_brand_preview_quota_preserves_known_actor(db, monkeypatch, user):
    from app.social import limits, service

    monkeypatch.setattr(limits, "enforce_ai_text_limit", lambda *args: None)
    monkeypatch.setattr(service.SocialMediaService, "_brand_voice_dict", lambda *args: {})
    monkeypatch.setattr(service, "generate_brand_voice_sample", lambda *args: {
        "platform": "linkedin", "caption": "Brand preview"})
    service.SocialMediaService(db).test_brand_voice({"id": "brand-workspace"}, user=user)
    event = db.plans_ai_usage.find_one()
    assert event["workspace_id"] == "brand-workspace"
    assert event.get("user_id") == (user["id"] if user else None)


@pytest.mark.parametrize("name,operation", [
    ("generate_post", "generate"), ("generate_creative_set", "creative-set"),
    ("test_brand_voice", "brandtest"), ("generate_image", "image"),
    ("regenerate_post_content", "regenerate"),
])
def test_router_enters_scope_inside_endpoint(db, monkeypatch, name, operation):
    import importlib

    router = importlib.import_module("app.social.router")
    monkeypatch.setattr(router.SocialMediaService, name, lambda *args, **kwargs: record())
    kwargs = {"db": db, "workspace": {"id": "route-w"}, "payload": None}
    if name == "regenerate_post_content":
        kwargs.update(current_user={"id": "route-u"}, post={}, payload=SimpleNamespace(
            prompt="test", regenerateImage=True, regenerateCaption=True, tone=None, cta=None))
    else:
        from app.providers.llm.model_selection import ModelSelection

        kwargs.update(user={"id": "route-u"}, models=ModelSelection())
        if name == "generate_image":
            kwargs["payload"] = SimpleNamespace(format=None, topic="topic", style=None, size="1024x1024",
                                                 mode="create", sourceImageUrl=None)
    event = getattr(router, name)(**kwargs)
    assert event["operation"] == operation
    assert event["user_id"] == "route-u"
    assert event["workspace_id"] == "route-w"