"""Instagram media publisher (Graph API — Business accounts)."""

from __future__ import annotations

import logging
import time
from typing import Optional
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.social.models import SocialPlatform
from app.social.publishers.base import BasePublisher, PublishResult, ambiguous_publish, format_caption, validate_image_urls
from app.social.publishers.first_comment import send_graph_comment

logger = logging.getLogger(__name__)


class InstagramPublisher(BasePublisher):
    platform = SocialPlatform.INSTAGRAM
    supports_first_comment = True
    # Instagram Login tokens use graph.instagram.com (not graph.facebook.com).
    graph_host = "https://graph.instagram.com"

    def __init__(self) -> None:
        self.api_version = settings.meta_api_version

    def publish(
        self,
        *,
        platform_account_id: str,
        access_token: str,
        caption: str,
        hashtags: list[str],
        image_url: Optional[str] = None,
        image_urls: Optional[list[str]] = None,
        first_comment: Optional[str] = None,
    ) -> PublishResult:
        message = format_caption(caption, hashtags)
        if image_urls is not None:
            invalid = validate_image_urls(image_urls)
            if invalid:
                return invalid
            if len(image_urls) > 1:
                return self._publish_carousel(platform_account_id, access_token, message, image_urls, first_comment)
            image_url = image_urls[0]
        if not image_url:
            return PublishResult(
                success=False,
                error_code="INVALID_IMAGE",
                error_message="Instagram requires a publicly accessible image URL",
                retryable=False,
            )
        if image_url.startswith("data:"):
            return PublishResult(
                success=False,
                error_code="INVALID_IMAGE",
                error_message=(
                    "Instagram requires a public HTTP(S) image URL. "
                    "Upload the image to cloud storage before publishing."
                ),
                retryable=False,
            )
        if urlparse(image_url).scheme not in ("http", "https"):
            return PublishResult(
                success=False,
                error_code="INVALID_IMAGE",
                error_message="Instagram image URL must be http(s)",
                retryable=False,
            )

        try:
            container_id = self._create_container(
                platform_account_id, access_token, message, image_url
            )
            self._wait_for_container(container_id, access_token)
            self.checkpoint(submission_started=True)
            media_id = self._publish_container(
                platform_account_id, access_token, container_id
            )
            if not media_id:
                return ambiguous_publish()
            return self.complete_publish(media_id, access_token, first_comment)
        except httpx.HTTPStatusError as exc:
            if self.publish_state().get("submission_started") and exc.response.status_code >= 500:
                return ambiguous_publish()
            self.checkpoint(submission_started=False)
            return self._http_error(exc)
        except Exception as exc:
            if self.publish_state().get("submission_started"):
                return ambiguous_publish()
            logger.exception("Instagram publish failed: %s", exc)
            return PublishResult(
                success=False,
                error_code="MEDIA_NOT_READY" if isinstance(exc, RuntimeError) else "API_ERROR",
                error_message=str(exc),
                retryable=True,
            )

    def _create_container(
        self, ig_user_id: str, token: str, caption: str, image_url: str
    ) -> str:
        url = f"{self.graph_host}/{self.api_version}/{ig_user_id}/media"
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                url,
                data={
                    "image_url": image_url,
                    "caption": caption,
                    "access_token": token,
                },
            )
            response.raise_for_status()
            data = response.json()
        if "error" in data:
            raise RuntimeError(data["error"].get("message", "Instagram API error"))
        container_id = data.get("id")
        if not container_id:
            raise RuntimeError("Instagram did not return a media container id")
        return str(container_id)

    def _wait_for_container(self, container_id: str, token: str, attempts: int = 10) -> None:
        url = f"{self.graph_host}/{self.api_version}/{container_id}"
        with httpx.Client(timeout=30.0) as client:
            for _ in range(attempts):
                response = client.get(
                    url,
                    params={"fields": "status_code", "access_token": token},
                )
                response.raise_for_status()
                data = response.json()
                status_code = data.get("status_code")
                if status_code == "FINISHED":
                    return
                if status_code in ("ERROR", "EXPIRED"):
                    raise RuntimeError(f"Instagram media container processing failed: {status_code}")
                time.sleep(1.5)
        raise RuntimeError("Instagram media container readiness timed out")

    def _publish_carousel(self, account_id, token, message, image_urls, first_comment):
        try:
            state = self.publish_state()
            children = list(state.get("instagram_children") or [])
            for image_url in image_urls[len(children):]:
                with httpx.Client(timeout=60.0) as client:
                    response = client.post(
                        f"{self.graph_host}/{self.api_version}/{account_id}/media",
                        data={"image_url": image_url, "is_carousel_item": "true", "access_token": token},
                    )
                    response.raise_for_status()
                    child = response.json().get("id")
                    if not child:
                        raise RuntimeError("Instagram did not return a carousel child id")
                children.append(str(child))
                self.checkpoint(instagram_children=children)
            for child in children:
                self._wait_for_container(child, token)
            parent = state.get("instagram_parent")
            if not parent:
                with httpx.Client(timeout=60.0) as client:
                    response = client.post(
                        f"{self.graph_host}/{self.api_version}/{account_id}/media",
                        data={"media_type": "CAROUSEL", "children": ",".join(children), "caption": message, "access_token": token},
                    )
                    response.raise_for_status()
                    parent = response.json().get("id")
                    if not parent:
                        raise RuntimeError("Instagram did not return a carousel parent id")
                self.checkpoint(instagram_parent=str(parent))
            self._wait_for_container(str(parent), token)
            self.checkpoint(submission_started=True)
            media_id = self._publish_container(account_id, token, str(parent))
            if not media_id:
                return ambiguous_publish()
            return self.complete_publish(media_id, token, first_comment)
        except httpx.HTTPStatusError as exc:
            if self.publish_state().get("submission_started") and exc.response.status_code >= 500:
                return ambiguous_publish()
            self.checkpoint(submission_started=False)
            return self._http_error(exc)
        except Exception:
            if self.publish_state().get("submission_started"):
                return ambiguous_publish()
            return PublishResult(success=False, error_code="MEDIA_NOT_READY", error_message="Instagram carousel creation or readiness failed; check container status before retrying")

    def _publish_container(self, ig_user_id: str, token: str, container_id: str) -> str:
        url = f"{self.graph_host}/{self.api_version}/{ig_user_id}/media_publish"
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                url,
                data={"creation_id": container_id, "access_token": token},
            )
            response.raise_for_status()
            data = response.json()
        if "error" in data:
            raise RuntimeError(data["error"].get("message", "Instagram API error"))
        return str(data.get("id") or "")

    def _post_comment(self, media_id: str, token: str, message: str) -> dict:
        url = f"{self.graph_host}/{self.api_version}/{media_id}/comments"
        return send_graph_comment(url, token, message)

    def _http_error(self, exc: httpx.HTTPStatusError) -> PublishResult:
        status_code = exc.response.status_code
        try:
            payload = exc.response.json()
            message = payload.get("error", {}).get("message") or exc.response.text
            code = payload.get("error", {}).get("code")
        except Exception:
            message = exc.response.text
            code = None

        error_code = "API_ERROR"
        retryable = status_code >= 500 or status_code == 429
        if status_code == 401 or code in (190, 102):
            error_code = "TOKEN_EXPIRED"
            retryable = False
        elif status_code == 429:
            error_code = "RATE_LIMITED"
        elif "image" in (message or "").lower() or "media" in (message or "").lower():
            error_code = "INVALID_IMAGE"
            retryable = False

        return PublishResult(
            success=False,
            error_code=error_code,
            error_message=message,
            retryable=retryable,
        )

    def delete_remote(
        self,
        *,
        platform_post_id: str,
        platform_account_id: str,
        access_token: str,
    ) -> PublishResult:
        _ = platform_account_id
        media_id = (platform_post_id or "").strip()
        if not media_id:
            return PublishResult(
                success=False,
                error_code="INVALID_CONTENT",
                error_message="Missing Instagram media id",
                retryable=False,
            )
        url = f"{self.graph_host}/{self.api_version}/{media_id}"
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.delete(url, params={"access_token": access_token})
                response.raise_for_status()
                data = response.json()
            if data.get("success") is False:
                return PublishResult(
                    success=False,
                    error_code="API_ERROR",
                    error_message="Instagram did not confirm delete",
                    retryable=True,
                )
            return PublishResult(success=True, platform_post_id=media_id)
        except httpx.HTTPStatusError as exc:
            return self._http_error(exc)
        except Exception as exc:
            logger.exception("Instagram delete failed: %s", exc)
            return PublishResult(
                success=False,
                error_code="API_ERROR",
                error_message=str(exc),
                retryable=True,
            )
