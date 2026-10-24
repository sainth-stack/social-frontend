"""LinkedIn UGC post publisher (member profile or Company Page)."""

from __future__ import annotations

import logging
import os
import time
from io import BytesIO
from typing import Optional
from urllib.parse import quote

import httpx
from PIL import Image

from app.social.models import SocialPlatform
from app.social.publishers.base import BasePublisher, PublishResult, ambiguous_publish, format_caption, validate_image_urls

logger = logging.getLogger(__name__)


def _author_urn(platform_account_id: str) -> str:
    """Build author URN from stored account id (person:X / workspace:Y / legacy)."""
    value = (platform_account_id or "").strip()
    if value.startswith("urn:li:workspace:"):
        return value.replace("urn:li:workspace:", "urn:li:organization:", 1)
    if value.startswith("urn:li:"):
        return value
    if value.startswith("workspace:"):
        return f"urn:li:organization:{value.split(':', 1)[1]}"
    if value.startswith(("person:", "organization:")):
        return f"urn:li:{value}"
    # Legacy bare person id from earlier connects
    return f"urn:li:person:{value}"


class LinkedInPublisher(BasePublisher):
    platform = SocialPlatform.LINKEDIN

    def _headers(self, token: str) -> dict:
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
            "LinkedIn-Version": os.getenv("LINKEDIN_API_VERSION", "202610"),
        }

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
        _ = first_comment  # LinkedIn first-comment not supported in this release
        text = format_caption(caption, hashtags)
        if not text:
            return PublishResult(
                success=False,
                error_code="INVALID_CONTENT",
                error_message="LinkedIn post must include caption text",
                retryable=False,
            )

        author = _author_urn(platform_account_id)
        if image_urls is not None:
            invalid = validate_image_urls(image_urls)
            if invalid:
                return invalid
            if len(image_urls) > 1:
                return self._publish_multi(author, access_token, text, image_urls)
            image_url = image_urls[0]
        body = {
            "author": author,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": text[:3000]},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }

        try:
            with httpx.Client(timeout=60.0) as client:
                if image_url:
                    media = self._upload_image(client, image_url, author, access_token)
                    if isinstance(media, PublishResult):
                        return media
                    body["specificContent"]["com.linkedin.ugc.ShareContent"].update(
                        shareMediaCategory="IMAGE",
                        media=[{"status": "READY", "media": media}],
                    )
                self.checkpoint(submission_started=True)
                response = client.post(
                    "https://api.linkedin.com/v2/ugcPosts",
                    headers=self._headers(access_token),
                    json=body,
                )
                if not response.is_success:
                    if response.status_code < 500:
                        self.checkpoint(submission_started=False)
                    return self._error_result(response)
                data = response.json() if response.content else {}
                post_id = response.headers.get("x-restli-id") or data.get("id") or ""
                if not post_id:
                    return ambiguous_publish()
                self.checkpoint(platform_post_id=str(post_id), submission_started=False)
                return PublishResult(success=True, platform_post_id=str(post_id))
        except httpx.HTTPError:
            logger.warning("LinkedIn publish request failed")
            return PublishResult(
                success=False,
                error_code="API_ERROR",
                error_message="LinkedIn publish request failed",
                retryable=True,
            )
        except (ValueError, TypeError, AttributeError):
            return PublishResult(
                success=False,
                error_code="API_ERROR",
                error_message="Invalid LinkedIn publish response",
                retryable=False,
            )

    def _publish_multi(self, author, token, text, image_urls):
        headers = self._headers(token)
        try:
            images = list(self.publish_state().get("linkedin_images") or [])
            with httpx.Client(timeout=60.0) as client:
                for image_url in image_urls[len(images):]:
                    image = self._upload_image(client, image_url, author, token, images_api=True)
                    if isinstance(image, PublishResult):
                        return image
                    images.append(image)
                    self.checkpoint(linkedin_images=images)
                read_headers = dict(headers)
                for image in images:
                    for attempt in range(5):
                        image_url = f"https://api.linkedin.com/rest/images/{quote(image, safe='')}"
                        response = client.get(
                            image_url, headers=read_headers,
                        )
                        if response.status_code == 403 and author.startswith("urn:li:person:") and "LinkedIn-Version" in read_headers:
                            read_headers.pop("LinkedIn-Version")
                            response = client.get(image_url, headers=read_headers)
                        if response.status_code == 403:
                            return PublishResult(success=False, error_code="PERMISSION_DENIED", error_message="LinkedIn image readiness access denied for this token and owner")
                        if not response.is_success:
                            return self._error_result(response)
                        status = response.json().get("status")
                        if status == "AVAILABLE":
                            break
                        if status not in ("WAITING_UPLOAD", "PROCESSING") or attempt == 4:
                            return PublishResult(success=False, error_code="MEDIA_NOT_READY", error_message="LinkedIn image is not AVAILABLE; check upload processing before retrying")
                        time.sleep(1)
                self.checkpoint(submission_started=True)
                response = client.post(
                    "https://api.linkedin.com/rest/posts", headers=headers,
                    json={
                        "author": author, "commentary": text[:3000], "visibility": "PUBLIC",
                        "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
                        "lifecycleState": "PUBLISHED", "isReshareDisabledByAuthor": False,
                        "content": {"multiImage": {"images": [{"id": image} for image in images]}},
                    },
                )
                if not response.is_success:
                    if response.status_code >= 500:
                        return ambiguous_publish()
                    self.checkpoint(submission_started=False)
                    return self._error_result(response)
                post_id = response.headers.get("x-restli-id")
                if not post_id:
                    return ambiguous_publish()
                self.checkpoint(platform_post_id=post_id, submission_started=False)
                return PublishResult(success=True, platform_post_id=post_id)
        except (httpx.HTTPError, ValueError, TypeError, KeyError, AttributeError):
            if self.publish_state().get("submission_started"):
                return ambiguous_publish()
            return PublishResult(success=False, error_code="API_ERROR", error_message="LinkedIn multi-image upload failed", retryable=True)

    def _upload_image(
        self, client: httpx.Client, image_url: str, author: str, access_token: str,
        images_api: bool = False,
    ) -> str | PublishResult:
        max_bytes = 10 * 1024 * 1024
        try:
            if httpx.URL(image_url).scheme not in ("http", "https"):
                raise ValueError
            with client.stream("GET", image_url, follow_redirects=True) as response:
                if not response.is_success:
                    return self._error_result(response)
                mime = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
                expected_format = {"image/jpeg": "JPEG", "image/png": "PNG"}.get(mime)
                if not expected_format:
                    raise ValueError
                length = response.headers.get("content-length")
                if length is not None and not 0 < int(length) <= max_bytes:
                    raise ValueError
                content = bytearray()
                for chunk in response.iter_bytes(chunk_size=64 * 1024):
                    if len(content) + len(chunk) > max_bytes:
                        raise ValueError
                    content.extend(chunk)
            if not content:
                raise ValueError
            with Image.open(BytesIO(content)) as image:
                if image.format != expected_format:
                    raise ValueError
                image.verify()
        except (ValueError, httpx.InvalidURL, OSError, Image.DecompressionBombError):
            return PublishResult(
                success=False,
                error_code="INVALID_IMAGE",
                error_message="LinkedIn requires a valid JPEG or PNG image up to 10 MB at an HTTP(S) URL",
                retryable=False,
            )

        if images_api:
            response = client.post(
                "https://api.linkedin.com/rest/images?action=initializeUpload",
                headers=self._headers(access_token), json={"initializeUploadRequest": {"owner": author}},
            )
            if not response.is_success:
                return self._error_result(response)
            try:
                value = response.json()["value"]
                image = value["image"]
                upload_url = value["uploadUrl"]
                if not isinstance(image, str) or not image.startswith("urn:li:image:"):
                    raise ValueError
                if not isinstance(upload_url, str) or httpx.URL(upload_url).scheme not in ("http", "https"):
                    raise ValueError
            except (KeyError, TypeError, ValueError, httpx.InvalidURL):
                return PublishResult(success=False, error_code="INVALID_IMAGE", error_message="Invalid LinkedIn Images API upload response")
            response = client.put(upload_url, headers={"Authorization": f"Bearer {access_token}", "Content-Type": mime}, content=bytes(content))
            if not response.is_success:
                return self._error_result(response)
            return image

        headers = {
            "Authorization": f"Bearer {access_token}",
            "X-Restli-Protocol-Version": "2.0.0",
        }
        response = client.post(
            "https://api.linkedin.com/v2/assets?action=registerUpload",
            headers=headers,
            json={
                "registerUploadRequest": {
                    "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                    "owner": author,
                    "serviceRelationships": [
                        {"relationshipType": "OWNER", "identifier": "urn:li:userGeneratedContent"}
                    ],
                }
            },
        )
        if not response.is_success:
            return self._error_result(response)
        try:
            value = response.json()["value"]
            asset = value["asset"]
            upload = value["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]
            upload_url = upload["uploadUrl"]
            if not isinstance(asset, str) or not asset.startswith("urn:li:digitalmediaAsset:"):
                raise ValueError
            if not isinstance(upload_url, str) or httpx.URL(upload_url).scheme not in ("http", "https"):
                raise ValueError
            upload_headers = dict(upload.get("headers") or {})
            upload_headers.update(Authorization=f"Bearer {access_token}")
            upload_headers["Content-Type"] = mime
        except (KeyError, TypeError, ValueError, httpx.InvalidURL):
            return PublishResult(
                success=False,
                error_code="API_ERROR",
                error_message="Invalid LinkedIn image registration response",
                retryable=False,
            )
        response = client.put(upload_url, headers=upload_headers, content=bytes(content))
        if not response.is_success:
            return self._error_result(response)
        return asset

    def _error_result(self, response: httpx.Response) -> PublishResult:
        status_code = response.status_code
        error_code = "API_ERROR"
        retryable = status_code >= 500 or status_code == 429
        if status_code in (401, 403):
            error_code = "TOKEN_EXPIRED" if status_code == 401 else "PERMISSION_DENIED"
            retryable = False
        elif status_code == 429:
            error_code = "RATE_LIMITED"

        return PublishResult(
            success=False,
            error_code=error_code,
            error_message=f"LinkedIn request failed (HTTP {status_code})",
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
        raw_id = (platform_post_id or "").strip()
        if not raw_id:
            return PublishResult(
                success=False,
                error_code="INVALID_CONTENT",
                error_message="Missing LinkedIn post id",
                retryable=False,
            )
        if raw_id.startswith("urn:li:"):
            post_urn = raw_id
        elif raw_id.startswith("ugcPost:"):
            post_urn = f"urn:li:{raw_id}"
        else:
            post_urn = f"urn:li:ugcPost:{raw_id}"
        encoded = quote(post_urn, safe="")
        url = f"https://api.linkedin.com/rest/posts/{encoded}"
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.delete(
                    url,
                    headers=self._headers(access_token),
                )
                if response.status_code >= 400:
                    return self._error_result(response)
            return PublishResult(success=True, platform_post_id=post_urn)
        except httpx.HTTPError as exc:
            logger.exception("LinkedIn delete failed: %s", exc)
            return PublishResult(
                success=False,
                error_code="API_ERROR",
                error_message=str(exc),
                retryable=True,
            )
