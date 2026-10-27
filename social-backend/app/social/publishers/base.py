"""Abstract publisher interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Callable, Optional
from urllib.parse import urlparse

from app.social.models import SocialPlatform


@dataclass
class PublishResult:
    success: bool
    platform_post_id: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    retryable: bool = False
    first_comment_state: Optional[dict] = None


class BasePublisher(ABC):
    platform: SocialPlatform
    supports_first_comment = False

    @abstractmethod
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
        """Publish content to the platform and return the result."""

    def set_publish_context(self, state: dict, save: Callable[[dict], None]) -> None:
        self._publish_state = dict(state)
        self._save_publish_state = save

    def checkpoint(self, **values) -> None:
        state = dict(getattr(self, "_publish_state", {}))
        state.update(values)
        save = getattr(self, "_save_publish_state", None)
        if save:
            save(state)
        self._publish_state = state

    def publish_state(self) -> dict:
        return dict(getattr(self, "_publish_state", {}))

    def complete_publish(self, post_id: str, token: str, first_comment: str | None) -> PublishResult:
        from app.social.publishers.first_comment import comment_state, deliver_first_comment

        existing = self.publish_state().get("first_comment_state")
        initial = existing or comment_state(first_comment, self.supports_first_comment)
        self.checkpoint(platform_post_id=post_id, submission_started=False, first_comment_state=initial)
        if initial and not existing and self.supports_first_comment:
            try:
                deliver_first_comment(self, post_id, token, first_comment, initial_attempt=True)
            except Exception:
                pass
        return PublishResult(success=True, platform_post_id=post_id, first_comment_state=self.publish_state().get("first_comment_state"))

    def delete_remote(
        self,
        *,
        platform_post_id: str,
        platform_account_id: str,
        access_token: str,
    ) -> PublishResult:
        """Remove a published post from the platform (best-effort)."""
        _ = platform_post_id, platform_account_id, access_token
        return PublishResult(
            success=False,
            error_code="UNSUPPORTED_PLATFORM",
            error_message="Remote delete is not supported for this platform",
            retryable=False,
        )


def get_publisher(platform: SocialPlatform | str) -> BasePublisher:
    from app.social.publishers.facebook import FacebookPublisher
    from app.social.publishers.instagram import InstagramPublisher
    from app.social.publishers.linkedin import LinkedInPublisher
    from app.social.publishers.x_twitter import XTwitterPublisher

    value = platform.value if isinstance(platform, SocialPlatform) else platform
    if value == SocialPlatform.FACEBOOK.value:
        return FacebookPublisher()
    if value == SocialPlatform.INSTAGRAM.value:
        return InstagramPublisher()
    if value == SocialPlatform.LINKEDIN.value:
        return LinkedInPublisher()
    if value == SocialPlatform.X.value:
        return XTwitterPublisher()
    raise ValueError(f"Publisher not available for platform: {value}")


NON_RETRYABLE_ERROR_CODES = frozenset(
    {
        "TOKEN_EXPIRED",
        "INVALID_IMAGE",
        "ACCOUNT_NOT_FOUND",
        "PERMISSION_DENIED",
        "UNSUPPORTED_PLATFORM",
        "INVALID_CONTENT",
        "AMBIGUOUS_PUBLISH",
        "MEDIA_NOT_READY",
    }
)

# Exponential backoff seconds by retry_count (0-indexed attempt after failure)
RETRY_BACKOFF_SECONDS = [
    5 * 60,  # 5 min
    30 * 60,  # 30 min
    2 * 60 * 60,  # 2 hr
    6 * 60 * 60,  # 6 hr
    24 * 60 * 60,  # 24 hr
]
MAX_RETRIES = 5


def is_retryable_error(error_code: str | None, retryable_flag: bool = False) -> bool:
    if not error_code:
        return retryable_flag
    if error_code in NON_RETRYABLE_ERROR_CODES:
        return False
    if error_code in ("RATE_LIMITED", "API_ERROR"):
        return True
    return retryable_flag


def backoff_seconds(retry_count: int, error_code: str | None = None) -> int:
    idx = min(max(retry_count, 0), len(RETRY_BACKOFF_SECONDS) - 1)
    seconds = RETRY_BACKOFF_SECONDS[idx]
    if error_code == "RATE_LIMITED":
        return max(seconds, 30 * 60)
    return seconds



def format_caption(caption: str, hashtags: list[str]) -> str:
    text = (caption or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    normalized = [h.strip().lstrip("#").strip() for h in (hashtags or []) if isinstance(h, str)]
    tags = " ".join(f"#{tag}" for tag in normalized if tag)
    if not tags:
        return text
    return f"{text}\n\n{tags}" if text else tags


def validate_image_urls(image_urls: list[str]) -> Optional[PublishResult]:
    if not 1 <= len(image_urls) <= 8 or any(
        not isinstance(url, str) or urlparse(url).scheme not in ("http", "https") or not urlparse(url).netloc
        for url in image_urls
    ):
        return PublishResult(
            success=False, error_code="INVALID_IMAGE",
            error_message="Provide 1–8 ordered public HTTP(S) image URLs", retryable=False,
        )
    return None


def ambiguous_publish() -> PublishResult:
    return PublishResult(
        success=False, error_code="AMBIGUOUS_PUBLISH",
        error_message="Provider submission may have succeeded; reconcile before retrying",
        retryable=False,
    )
