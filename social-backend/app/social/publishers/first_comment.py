from __future__ import annotations

import hashlib
import re

import httpx

from app.core.mongo_utils import utcnow


def comment_state(message: str | None, supported: bool) -> dict | None:
    text = (message or "").strip()
    if not text:
        return None
    return {
        "status": "pending" if supported else "unsupported",
        "content_hash": hashlib.sha256(text.encode()).hexdigest(),
        "attempt_count": 0,
        "platform_comment_id": None,
        "error_code": None if supported else "UNSUPPORTED_PLATFORM",
        "http_status": None,
        "provider_error_code": None,
        "updated_at": utcnow(),
    }


def send_graph_comment(url: str, token: str, message: str) -> dict:
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, data={"message": message.strip(), "access_token": token})
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        response = exc.response
        outcome = {
            "status": "failed" if 400 <= response.status_code < 500 else "unknown",
            "error_code": "RATE_LIMITED" if response.status_code == 429 else "HTTP_ERROR",
            "http_status": response.status_code,
        }
        try:
            payload = response.json()
        except ValueError:
            payload = None
        return {**outcome, **_provider_code(payload)}
    except Exception:
        return {"status": "unknown", "error_code": "AMBIGUOUS_COMMENT"}
    try:
        payload = response.json()
    except ValueError:
        return {"status": "unknown", "error_code": "INVALID_RESPONSE", "http_status": response.status_code}
    if isinstance(payload, dict) and "error" in payload:
        confirmed_error = isinstance(payload["error"], dict) and bool(payload["error"]) and not payload.get("id")
        return {"status": "failed" if confirmed_error else "unknown", "error_code": "PROVIDER_ERROR" if confirmed_error else "INVALID_RESPONSE", "http_status": response.status_code, **_provider_code(payload)}
    remote_id = payload.get("id") if isinstance(payload, dict) else None
    if not isinstance(remote_id, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,256}", remote_id):
        return {"status": "unknown", "error_code": "INVALID_RESPONSE", "http_status": response.status_code}
    return {"status": "succeeded", "platform_comment_id": remote_id, "error_code": None, "http_status": response.status_code}


def _provider_code(payload) -> dict:
    error = payload.get("error") if isinstance(payload, dict) else None
    code = error.get("code") if isinstance(error, dict) else None
    return {"provider_error_code": code if type(code) is int else None}


def deliver_first_comment(publisher, post_id: str, token: str, message: str, *, explicit_retry: bool = False, initial_attempt: bool = False) -> dict | None:
    state = publisher.publish_state().get("first_comment_state")
    initial = comment_state(message, publisher.supports_first_comment)
    if initial is None:
        return state
    if state is not None and not explicit_retry and not initial_attempt:
        return state
    if explicit_retry and (not state or state.get("status") != "failed" or state.get("content_hash") != initial["content_hash"]):
        return state
    if not publisher.supports_first_comment:
        publisher.checkpoint(first_comment_state=initial)
        return initial
    pending = {**initial, "attempt_count": (state or {}).get("attempt_count", 0) + 1, "attempted_at": utcnow()}
    publisher.checkpoint(first_comment_state=pending)
    try:
        outcome = publisher._post_comment(post_id, token, message)
    except Exception:
        outcome = {"status": "unknown", "error_code": "AMBIGUOUS_COMMENT"}
    final = {**pending, **outcome, "updated_at": utcnow()}
    publisher.checkpoint(first_comment_state=final)
    return final