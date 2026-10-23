from __future__ import annotations

import json
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.admin.service import list_pricing_plans
from app.core.config import settings
from app.core.mongo_utils import utcnow
from app.plans.catalog import PLAN_CATALOG, UNLIMITED
from app.plans.service import (
    get_effective_plan,
    invalidate_override_cache,
    to_plan_out,
    upsert_override,
)
from app.social.limits import (
    enforce_ai_text_limit,
    enforce_posts_limit,
    enforce_templates_limit,
)

API = settings.api_v1_prefix


@pytest.fixture(autouse=True)
def clear_plan_cache():
    invalidate_override_cache()
    yield
    invalidate_override_cache()


def _register(client, email="accounts@example.com"):
    response = client.post(
        f"{API}/auth/register",
        json={"email": email, "password": "s3cret-pass"},
    )
    assert response.status_code == 201, response.text
    session = response.json()
    return session["workspace"]["id"], {
        "Authorization": f"Bearer {session['access_token']}"
    }


@pytest.mark.parametrize("plan_key", PLAN_CATALOG)
@pytest.mark.parametrize("legacy_cap", [None, 0, 1, 50])
def test_account_limits_are_unlimited_despite_legacy_overrides(db, plan_key, legacy_cap):
    base = PLAN_CATALOG[plan_key]
    assert base.limits.connected_accounts == UNLIMITED
    if legacy_cap is not None:
        db["plan_overrides"].insert_one(
            {"plan_key": plan_key, "connected_accounts": legacy_cap}
        )

    effective = get_effective_plan(db, plan_key)
    assert effective.limits.connected_accounts == UNLIMITED
    assert effective.monthly_price_usd == base.monthly_price_usd
    assert effective.annual_price_usd == base.annual_price_usd
    assert {
        key: value for key, value in effective.limits.__dict__.items()
        if key != "connected_accounts"
    } == {
        key: value for key, value in base.limits.__dict__.items()
        if key != "connected_accounts"
    }
    output = to_plan_out(db, plan_key)
    assert output.limits.connected_accounts is None
    assert output.is_override is False
    pricing = next(plan for plan in list_pricing_plans(db) if plan.id == plan_key)
    assert pricing.limits.accounts is None


@pytest.mark.parametrize("plan_key", PLAN_CATALOG)
def test_new_account_overrides_cannot_restore_caps(db, plan_key):
    upsert_override(db, plan_key, {"connected_accounts": 1, "posts_per_month": 7})
    effective = get_effective_plan(db, plan_key)
    assert effective.limits.connected_accounts == UNLIMITED
    assert effective.limits.posts_per_month == 7
    output = to_plan_out(db, plan_key)
    assert output.limits.connected_accounts is None
    assert output.limits.posts_per_month == 7
    assert output.is_override is True


@pytest.mark.parametrize("plan_key,account_count", [("starter", 3), ("growth", 11), ("enterprise", 51)])
def test_oauth_start_and_usage_beyond_old_caps(
    client, db, fake_redis, monkeypatch, plan_key, account_count
):
    workspace_id, headers = _register(client)
    db["workspaces"].update_one({"id": workspace_id}, {"$set": {"plan": plan_key}})
    db["plan_overrides"].insert_one({"plan_key": plan_key, "connected_accounts": 1})
    db["social_accounts"].insert_many([
        {
            "id": f"account-{index}",
            "workspace_id": workspace_id,
            "platform": "linkedin",
            "platform_account_id": f"profile-{index}",
            "is_active": True,
        }
        for index in range(account_count)
    ])
    db["social_accounts"].insert_one(
        {"id": "inactive", "workspace_id": workspace_id, "is_active": False}
    )
    handler = Mock()
    handler.build_authorization_url.side_effect = lambda state: f"https://provider.example/auth?state={state}"
    monkeypatch.setattr("app.social.service.get_oauth_handler", lambda platform: handler)

    response = client.get(
        f"{API}/workspaces/{workspace_id}/social/oauth/linkedin/url", headers=headers
    )
    assert response.status_code == 200, response.text
    state = handler.build_authorization_url.call_args.args[0]
    assert response.json()["url"] == f"https://provider.example/auth?state={state}"
    assert json.loads(fake_redis.get(f"social_oauth_state:{state}")) == {
        "workspace_id": workspace_id,
        "platform": "linkedin",
        "reconnect_account_id": None,
    }
    reconnect = client.post(
        f"{API}/workspaces/{workspace_id}/social/accounts/account-0/reconnect", headers=headers
    )
    assert reconnect.status_code == 200, reconnect.text
    state = handler.build_authorization_url.call_args.args[0]
    assert json.loads(fake_redis.get(f"social_oauth_state:{state}"))["reconnect_account_id"] == "account-0"

    response = client.get(f"{API}/workspaces/{workspace_id}/social/usage", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["accounts"] == {"used": account_count, "limit": None}
    assert response.json()["postsThisMonth"]["limit"] == PLAN_CATALOG[plan_key].limits.posts_per_month
    response = client.get(f"{API}/plans")
    assert response.status_code == 200, response.text
    assert all(plan["limits"]["connected_accounts"] is None for plan in response.json())


def test_oauth_preserves_auth_workspace_and_provider_constraints(client, monkeypatch):
    workspace_id, headers = _register(client)
    _, other_headers = _register(client, "other-accounts@example.com")
    handler_factory = Mock(side_effect=ValueError("Provider not configured"))
    monkeypatch.setattr("app.social.service.get_oauth_handler", handler_factory)
    url = f"{API}/workspaces/{workspace_id}/social/oauth/linkedin/url"

    assert client.get(url).status_code in (401, 403)
    assert client.get(url, headers=other_headers).status_code == 403
    handler_factory.assert_not_called()
    response = client.get(url, headers=headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "Provider not configured"


@pytest.mark.parametrize("enforce", [enforce_posts_limit, enforce_templates_limit, enforce_ai_text_limit])
def test_other_quotas_remain_enforced(db, enforce):
    workspace = {"id": "quota-workspace", "plan": "starter"}
    upsert_override(db, "starter", {
        "connected_accounts": 1,
        "posts_per_month": 1,
        "templates": 1,
        "ai_text_per_month": 1,
    })
    db["social_posts"].insert_one({"workspace_id": workspace["id"], "created_at": utcnow()})
    db["social_templates"].insert_one({"workspace_id": workspace["id"], "is_system": False})
    db["plans_ai_usage"].insert_one({
        "workspace_id": workspace["id"], "kind": "text", "quantity": 1, "created_at": utcnow()
    })

    with pytest.raises(HTTPException) as exc:
        enforce(db, workspace)
    assert exc.value.status_code == 402
    assert exc.value.detail["limit"] == 1
    assert exc.value.detail["used"] == 1