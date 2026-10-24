from io import BytesIO
import json
from urllib.parse import parse_qs

import httpx
from PIL import Image
import pytest

from app.social.publishers.base import is_retryable_error
from app.social.publishers.facebook import FacebookPublisher
from app.social.publishers.instagram import InstagramPublisher
from app.social.publishers.linkedin import LinkedInPublisher, _author_urn
from app.social.publishers.x_twitter import XTwitterPublisher


@pytest.fixture
def transport(monkeypatch):
    original = httpx.Client

    def install(handler):
        requests = []

        def handle(request):
            requests.append(request)
            return handler(request)

        monkeypatch.setattr(httpx, "Client", lambda **kwargs: original(**kwargs, transport=httpx.MockTransport(handle)))
        return requests

    return install


def form(request):
    return {key: values[0] for key, values in parse_qs(request.content.decode()).items()}


def publish(publisher, **changes):
    kwargs = dict(platform_account_id="account", access_token="token", caption="Intro", hashtags=["tag"], image_urls=["https://images.test/1.jpg", "https://images.test/2.jpg"])
    kwargs.update(changes)
    return publisher.publish(**kwargs)


@pytest.mark.parametrize("count", [2, 8])
def test_instagram_ordered_children_parent_publish(transport, count):
    urls = [f"https://images.test/{i}.jpg" for i in range(count)]
    children = []

    def handle(request):
        if request.method == "GET":
            return httpx.Response(200, json={"status_code": "FINISHED"})
        data = form(request)
        if request.url.path.endswith("/media_publish"):
            assert data == {"creation_id": "parent", "access_token": "token"}
            return httpx.Response(200, json={"id": "published"})
        if data.get("media_type") == "CAROUSEL":
            assert data == {"media_type": "CAROUSEL", "children": ",".join(children), "caption": "Intro\n\n#tag", "access_token": "token"}
            return httpx.Response(200, json={"id": "parent"})
        assert data == {"image_url": urls[len(children)], "is_carousel_item": "true", "access_token": "token"}
        child = f"child-{len(children)}"
        children.append(child)
        return httpx.Response(200, json={"id": child})

    requests = transport(handle)
    publisher = InstagramPublisher()
    result = publish(publisher, image_urls=urls)
    assert result.success and result.platform_post_id == "published"
    assert len(requests) == count * 2 + 3
    assert [request.url.path.split("/")[-1] for request in requests if request.method == "GET"] == children + ["parent"]
    assert publisher.publish_state()["instagram_children"] == children


@pytest.mark.parametrize("status", ["ERROR", "EXPIRED", "IN_PROGRESS", None])
def test_instagram_readiness_never_publishes(transport, monkeypatch, status):
    monkeypatch.setattr("app.social.publishers.instagram.time.sleep", lambda _: None)
    requests = transport(lambda request: httpx.Response(200, json={"id": "child"} if request.method == "POST" else {"status_code": status}))
    result = publish(InstagramPublisher())
    assert not result.success and result.error_code == "MEDIA_NOT_READY"
    assert not any(request.url.path.endswith("/media_publish") for request in requests)
    assert not is_retryable_error(result.error_code, True)


def test_instagram_resume_saved_children_and_parent(transport):
    requests = transport(lambda request: httpx.Response(200, json={"status_code": "FINISHED"} if request.method == "GET" else {"id": "published"}))
    publisher = InstagramPublisher()
    saved = []
    publisher.set_publish_context({"instagram_children": ["one", "two"], "instagram_parent": "parent"}, saved.append)
    assert publish(publisher).success
    assert [request.method for request in requests] == ["GET", "GET", "GET", "POST"]
    assert saved[-1]["platform_post_id"] == "published"


@pytest.mark.parametrize("count", [2, 8])
def test_facebook_unpublished_photos_then_ordered_feed(transport, count):
    urls = [f"https://images.test/{i}.jpg" for i in range(count)]
    photos = []

    def handle(request):
        data = form(request)
        if request.url.path.endswith("/photos"):
            assert data == {"url": urls[len(photos)], "published": "false", "access_token": "token"}
            photos.append(f"photo-{len(photos)}")
            return httpx.Response(200, json={"id": photos[-1]})
        assert request.url.path.endswith("/feed")
        assert data["message"] == "Intro\n\n#tag"
        assert json.loads(data["attached_media"]) == [{"media_fbid": photo} for photo in photos]
        return httpx.Response(200, json={"id": "feed-post"})

    requests = transport(handle)
    assert publish(FacebookPublisher(), image_urls=urls).platform_post_id == "feed-post"
    assert len(requests) == count + 1
    assert all("album" not in str(request.url) for request in requests)


def test_facebook_resume_uploaded_photos(transport):
    requests = transport(lambda request: httpx.Response(200, json={"id": "post"}))
    publisher = FacebookPublisher()
    publisher.set_publish_context({"facebook_photos": ["one", "two"]}, lambda _: None)
    assert publish(publisher).success
    assert len(requests) == 1
    assert json.loads(form(requests[0])["attached_media"]) == [{"media_fbid": "one"}, {"media_fbid": "two"}]


@pytest.mark.parametrize("account", ["person:member", "workspace:123", "organization:123"])
@pytest.mark.parametrize("count", [2, 8])
def test_linkedin_images_api_and_organic_multiimage(transport, monkeypatch, account, count):
    monkeypatch.setenv("LINKEDIN_API_VERSION", "202610")
    buffer = BytesIO()
    Image.new("RGB", (3, 3), "blue").save(buffer, format="JPEG")
    content = buffer.getvalue()
    images = []
    urls = [f"https://images.test/{i}.jpg" for i in range(count)]

    def handle(request):
        if request.url.host == "images.test":
            assert "authorization" not in request.headers
            return httpx.Response(200, headers={"content-type": "image/jpeg"}, content=content)
        if request.method == "PUT":
            assert request.content == content
            assert request.headers["content-type"] == "image/jpeg"
            return httpx.Response(201)
        assert request.headers["authorization"] == "Bearer token"
        assert request.headers["linkedin-version"] == "202610"
        assert request.headers["x-restli-protocol-version"] == "2.0.0"
        if request.method == "GET":
            return httpx.Response(200, json={"status": "AVAILABLE"})
        body = json.loads(request.content)
        if request.url.path == "/rest/images":
            assert request.url.query == b"action=initializeUpload"
            assert body == {"initializeUploadRequest": {"owner": _author_urn(account)}}
            images.append(f"urn:li:image:{len(images)}")
            return httpx.Response(200, json={"value": {"image": images[-1], "uploadUrl": f"https://upload.test/{len(images)}"}})
        assert request.url.path == "/rest/posts"
        assert body == {
            "author": _author_urn(account), "commentary": "Intro\n\n#tag", "visibility": "PUBLIC",
            "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
            "lifecycleState": "PUBLISHED", "isReshareDisabledByAuthor": False,
            "content": {"multiImage": {"images": [{"id": image} for image in images]}},
        }
        return httpx.Response(201, headers={"x-restli-id": "urn:li:share:published"})

    requests = transport(handle)
    assert publish(LinkedInPublisher(), image_urls=urls, platform_account_id=account).platform_post_id == "urn:li:share:published"
    assert len(requests) == count * 4 + 1
    assert [str(request.url) for request in requests if request.url.host == "images.test"] == urls
    assert not any("ugcPosts" in str(request.url) or "/v2/assets" in str(request.url) for request in requests)


@pytest.mark.parametrize("status", ["PROCESSING_FAILED", "WAITING_UPLOAD", None])
def test_linkedin_unready_images_never_create_post(transport, monkeypatch, status):
    monkeypatch.setattr("app.social.publishers.linkedin.time.sleep", lambda _: None)
    requests = transport(lambda request: httpx.Response(200, json={"status": status}))
    publisher = LinkedInPublisher()
    publisher.set_publish_context({"linkedin_images": ["urn:li:image:one", "urn:li:image:two"]}, lambda _: None)
    result = publish(publisher)
    assert result.error_code == "MEDIA_NOT_READY"
    assert all(request.method == "GET" for request in requests)


@pytest.mark.parametrize("publisher_class,state", [
    (InstagramPublisher, {"instagram_children": ["one", "two"], "instagram_parent": "parent"}),
    (FacebookPublisher, {"facebook_photos": ["one", "two"]}),
    (LinkedInPublisher, {"linkedin_images": ["urn:li:image:one", "urn:li:image:two"]}),
])
@pytest.mark.parametrize("failure", ["timeout", "server", "missing_id", "invalid_json"])
def test_ambiguous_final_submission_is_nonretryable(transport, publisher_class, state, failure):
    def handle(request):
        if request.method == "GET":
            return httpx.Response(200, json={"status_code": "FINISHED", "status": "AVAILABLE"})
        if failure == "timeout":
            raise httpx.ReadTimeout("timeout")
        if failure == "server":
            return httpx.Response(503)
        if failure == "invalid_json":
            return httpx.Response(200, content=b"not json")
        return httpx.Response(200, json={})

    transport(handle)
    publisher = publisher_class()
    publisher.set_publish_context(state, lambda _: None)
    result = publish(publisher)
    assert result.error_code == "AMBIGUOUS_PUBLISH"
    assert not is_retryable_error(result.error_code, True)


@pytest.mark.parametrize("publisher_class", [InstagramPublisher, FacebookPublisher, LinkedInPublisher])
@pytest.mark.parametrize("urls", [[], ["https://images.test/a"] * 9, ["file:///a", "https://images.test/b"]])
def test_invalid_ordered_images_never_call_provider(transport, publisher_class, urls):
    requests = transport(lambda _: pytest.fail("Unexpected HTTP request"))
    result = publish(publisher_class(), image_urls=urls)
    assert result.error_code == "INVALID_IMAGE" and not result.retryable
    assert not requests


def test_x_rejects_ordered_images(transport):
    requests = transport(lambda _: pytest.fail("Unexpected X request"))
    assert publish(XTwitterPublisher()).error_code == "INVALID_IMAGE"
    assert not requests


def test_linkedin_member_write_only_token_uses_documented_legacy_status_reads(transport):
    def handle(request):
        if request.method == "GET":
            if "linkedin-version" in request.headers:
                return httpx.Response(403)
            assert request.headers["authorization"] == "Bearer token"
            return httpx.Response(200, json={"status": "AVAILABLE"})
        assert request.url.path == "/rest/posts"
        assert request.headers["linkedin-version"] == "202610"
        return httpx.Response(201, headers={"x-restli-id": "urn:li:share:published"})

    requests = transport(handle)
    publisher = LinkedInPublisher()
    publisher.set_publish_context({"linkedin_images": ["urn:li:image:one", "urn:li:image:two"]}, lambda _: None)
    assert publish(publisher, platform_account_id="person:member").success
    assert [request.method for request in requests] == ["GET", "GET", "GET", "POST"]


@pytest.mark.parametrize("account,expected_gets", [("person:member", 2), ("organization:123", 1)])
def test_linkedin_readiness_permission_denial_stays_nonretryable(transport, account, expected_gets):
    requests = transport(lambda _: httpx.Response(403))
    publisher = LinkedInPublisher()
    publisher.set_publish_context({"linkedin_images": ["urn:li:image:one", "urn:li:image:two"]}, lambda _: None)
    result = publish(publisher, platform_account_id=account)
    assert result.error_code == "PERMISSION_DENIED"
    assert not is_retryable_error(result.error_code, True)
    assert len(requests) == expected_gets
    assert all(request.method == "GET" for request in requests)


@pytest.mark.parametrize("publisher_class", [InstagramPublisher, FacebookPublisher])
def test_partial_upload_failure_does_not_create_final_post(transport, publisher_class):
    calls = []

    def handle(request):
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(200, json={"id": "first"})
        return httpx.Response(429, json={"error": {"message": "rate limited"}})

    transport(handle)
    publisher = publisher_class()
    result = publish(publisher)
    assert result.error_code == "RATE_LIMITED"
    assert len(calls) == 2
    assert not publisher.publish_state().get("submission_started")
    assert "first" in list(publisher.publish_state().values())[0]