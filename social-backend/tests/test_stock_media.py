import io

import httpx
import pytest
from fastapi import HTTPException
from PIL import Image

from app.core.config import settings
from app.social import media, stock
from app.social.schemas import StockImportRequest
from test_upload_safety import image_bytes, mp4_bytes
from test_planner_runs import setup as planner_setup, generated


PHOTO = {
    "id": 123, "width": 8, "height": 6,
    "url": "https://www.pexels.com/photo/office-123/", "photographer": "Test Creator",
    "photographer_url": "https://www.pexels.com/@test/",
    "src": {"original": "https://images.pexels.com/photos/123/original.png",
            "large2x": "https://images.pexels.com/photos/123/large.png",
            "medium": "https://images.pexels.com/photos/123/medium.png"},
}
VIDEO = {
    "id": 456, "width": 1920, "height": 1080, "duration": 12,
    "url": "https://www.pexels.com/video/office-456/",
    "image": "https://images.pexels.com/videos/456/thumbnail.jpg",
    "user": {"name": "Test Creator", "url": "https://www.pexels.com/@test/"},
    "video_files": [{"file_type": "video/mp4", "width": 1920, "height": 1080,
                     "link": "https://videos.pexels.com/video-files/456/clip.mp4"}],
}


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setattr(settings, "pexels_api_key", "server-only-test-key")
    stock._cache.clear()

    def denied(*args, **kwargs):
        raise AssertionError("Live network is forbidden")

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", denied)
    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", denied)


@pytest.fixture
def account(client):
    body = client.post("/api/v1/auth/register", json={"email": "stock@example.com", "password": "stock-password"}).json()
    return body["workspace"]["id"], {"Authorization": f"Bearer {body['access_token']}"}


@pytest.fixture
def storage(monkeypatch):
    class Storage:
        uploads = []

        def upload_bytes(self, key, data, content_type):
            self.uploads.append((key, data, content_type))

        def presigned_get_url(self, key, **kwargs):
            return f"https://owned.test/{key}"

    instance = Storage()
    monkeypatch.setattr(media, "get_storage_provider", lambda: instance)
    return instance


def mock_provider(monkeypatch, handler):
    requests = []

    def tracked(request):
        requests.append(request)
        return handler(request)

    monkeypatch.setattr(stock, "_client", lambda: httpx.Client(
        transport=httpx.MockTransport(tracked), follow_redirects=False, trust_env=False,
    ))
    return requests


def url(account, path):
    return f"/api/v1/workspaces/{account[0]}/social/{path}"


def test_providers_no_key_and_search_error(client, account, monkeypatch):
    monkeypatch.setattr(settings, "pexels_api_key", "")
    providers = client.get(url(account, "stock/providers"), headers=account[1])
    assert providers.status_code == 200
    item = providers.json()["items"][0]
    assert item == {"id": "pexels", "name": "Pexels", "available": False,
                    "mediaTypes": ["image", "video"], "reason": "Pexels is not configured"}
    response = client.get(url(account, "stock/search"), headers=account[1], params={"query": "office"})
    assert response.status_code == 503
    assert response.json()["detail"]["error"] == "stock_unavailable"


@pytest.mark.parametrize("media_type,row,collection,path", [
    ("image", PHOTO, "photos", "/v1/search"), ("video", VIDEO, "videos", "/videos/search"),
])
def test_search_contract_and_cache(client, account, monkeypatch, media_type, row, collection, path):
    requests = mock_provider(monkeypatch, lambda request: httpx.Response(200, json={collection: [row], "total_results": 3}))
    params = {"query": "office", "mediaType": media_type, "page": 1, "pageSize": 1}
    response = client.get(url(account, "stock/search"), headers=account[1], params=params)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["page"] == 1 and body["pageSize"] == 1 and body["hasMore"] is True
    item = body["items"][0]
    assert item["id"] == str(row["id"])
    assert item["provider"] == "pexels" and item["mediaType"] == media_type
    assert item["creatorName"] == "Test Creator"
    assert item["licenseUrl"] == "https://www.pexels.com/license/"
    assert "Test Creator on Pexels" in item["attributionText"]
    assert requests[0].url.path == path
    assert requests[0].headers["Authorization"] == "server-only-test-key"
    assert requests[0].url.params["per_page"] == "1"
    assert "server-only-test-key" not in response.text
    assert client.get(url(account, "stock/search"), headers=account[1], params=params).json() == body
    assert len(requests) == 1
    stock.search("office", media_type, 2, 1)
    assert len(requests) == 2


@pytest.mark.parametrize("params", [
    {"query": ""}, {"query": " "}, {"query": "x" * 201}, {"query": "x", "mediaType": "audio"},
    {"query": "x", "page": 0}, {"query": "x", "page": 1001}, {"query": "x", "pageSize": 81},
])
def test_search_validation(client, account, params):
    assert client.get(url(account, "stock/search"), headers=account[1], params=params).status_code == 422


@pytest.mark.parametrize("status,expected,code", [
    (401, 503, "stock_unavailable"), (403, 503, "stock_unavailable"),
    (429, 429, "stock_rate_limited"), (500, 502, "stock_provider_error"),
    (302, 502, "stock_provider_error"), (404, 404, "stock_not_found"),
])
def test_provider_errors_are_safe_and_not_cached(monkeypatch, status, expected, code):
    requests = mock_provider(monkeypatch, lambda request: httpx.Response(
        status, text="server-only-test-key private error", headers={"Location": "https://evil.test"},
    ))
    for _ in range(2):
        with pytest.raises(HTTPException) as exc:
            stock.search("office", "image", 1, 24)
        assert exc.value.status_code == expected
        assert exc.value.detail["error"] == code
        assert "server-only-test-key" not in str(exc.value.detail)
    assert len(requests) == 2


@pytest.mark.parametrize("exception,status", [(httpx.ReadTimeout, 504), (httpx.ConnectError, 502)])
def test_provider_transport_errors(monkeypatch, exception, status):
    def fail(request):
        raise exception("private key")

    mock_provider(monkeypatch, fail)
    with pytest.raises(HTTPException) as exc:
        stock.search("office", "image", 1, 24)
    assert exc.value.status_code == status
    assert "private key" not in str(exc.value.detail)


@pytest.mark.parametrize("media_type,row,data,mime", [
    ("image", PHOTO, image_bytes(), "image/png"),
    ("video", VIDEO, mp4_bytes(), "video/mp4"),
])
def test_import_direct_media_asset_provenance_and_ownership(client, db, account, storage, monkeypatch, media_type, row, data, mime):
    requests = mock_provider(monkeypatch, lambda request: httpx.Response(200, json=row) if request.url.host == "api.pexels.com"
                             else httpx.Response(200, content=data, headers={"Content-Type": mime}))
    response = client.post(url(account, "stock/import"), headers=account[1],
                           json={"provider": "pexels", "id": str(row["id"]), "mediaType": media_type})
    assert response.status_code == 200, response.text
    asset = response.json()
    assert asset["source"] == "uploaded" and asset["mediaType"] == media_type
    assert asset["url"].startswith("https://owned.test/")
    assert asset["provenance"]["providerAssetId"] == str(row["id"])
    assert asset["provenance"]["provider"] == "pexels"
    assert asset["provenance"]["creatorName"] == "Test Creator"
    assert len(requests) == 2
    assert requests[0].url.path == ("/v1/photos/123" if media_type == "image" else "/videos/videos/456")
    assert "authorization" not in requests[1].headers
    assert "cookie" not in requests[1].headers
    assert len(storage.uploads) == 1
    key, stored, stored_mime = storage.uploads[0]
    assert key.startswith(f"{'social' if media_type == 'image' else 'social-video'}/{account[0]}/")
    if media_type == "image":
        assert stored_mime == "image/jpeg"
        assert b"private metadata" not in stored
        assert Image.open(io.BytesIO(stored)).format == "JPEG"
    assert db.social_media_assets.find_one({"id": asset["id"]})["provenance"] == asset["provenance"]
    assert db.plans_ai_usage.count_documents({"workspace_id": account[0]}) == 0
    detail = client.get(url(account, f"media-assets/{asset['id']}"), headers=account[1])
    assert detail.json()["provenance"] == asset["provenance"]
    listed = client.get(url(account, "media-assets"), headers=account[1]).json()["items"][0]
    assert listed["provenance"] == asset["provenance"]
    other = client.post("/api/v1/auth/register", json={"email": "other@example.com", "password": "other-password"}).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get(url(account, f"media-assets/{asset['id']}"), headers=other_headers).status_code == 403
    other_url = f"/api/v1/workspaces/{other['workspace']['id']}/social/media-assets/{asset['id']}"
    assert client.get(other_url, headers=other_headers).status_code == 404


@pytest.mark.parametrize("bad", [
    "http://images.pexels.com/file", "https://images.pexels.com.evil.test/file",
    "https://images.pexels.com@evil.test/file", "https://evil@images.pexels.com/file",
    "https://images.pexels.com:444/file", "https://127.0.0.1/file", "https://[::1]/file",
    "https://images.pexels.com/file#fragment", "https://images.pexels.com\\@evil.test/file",
    "https://videos.pexels.com/file", "data:image/png;base64,abc", "https://images.pexels.com/file\n",
])
def test_unsafe_cdn_never_requested(db, account, storage, monkeypatch, bad):
    row = {**PHOTO, "src": {"original": bad}}
    requests = mock_provider(monkeypatch, lambda request: httpx.Response(200, json=row))
    workspace = db.workspaces.find_one({"id": account[0]})
    user = db.users.find_one({"id": workspace["owner_user_id"]})
    with pytest.raises(HTTPException) as exc:
        stock.import_asset(db, workspace, user, StockImportRequest(provider="pexels", id="123", mediaType="image"))
    assert exc.value.status_code == 502
    assert len(requests) == 1
    assert storage.uploads == []


@pytest.mark.parametrize("redirect", [301, 302, 303, 307, 308])
def test_cdn_redirect_denied(client, account, storage, monkeypatch, redirect):
    requests = mock_provider(monkeypatch, lambda request: httpx.Response(200, json=PHOTO) if request.url.host == "api.pexels.com"
                             else httpx.Response(redirect, headers={"Location": "https://images.pexels.com/other"}))
    response = client.post(url(account, "stock/import"), headers=account[1],
                           json={"provider": "pexels", "id": "123", "mediaType": "image"})
    assert response.status_code == 502
    assert len(requests) == 2 and storage.uploads == []


@pytest.mark.parametrize("body", [
    {"provider": "unsplash", "id": "123", "mediaType": "image"},
    {"provider": "pexels", "id": "../search", "mediaType": "image"},
    {"provider": "pexels", "id": "123", "mediaType": "image", "url": "https://evil.test"},
    {"provider": "pexels", "id": "0", "mediaType": "image"},
    {"provider": "pexels", "id": "123", "mediaType": "audio"},
])
def test_import_body_cannot_supply_url(client, account, body):
    assert client.post(url(account, "stock/import"), headers=account[1], json=body).status_code == 422


def test_import_provider_id_mismatch(client, account, storage, monkeypatch):
    requests = mock_provider(monkeypatch, lambda request: httpx.Response(200, json={**PHOTO, "id": 999}))
    response = client.post(url(account, "stock/import"), headers=account[1], json={"provider": "pexels", "id": "123", "mediaType": "image"})
    assert response.status_code == 502 and len(requests) == 1 and not storage.uploads


@pytest.mark.parametrize("declared", [False, True])
@pytest.mark.parametrize("media_type,row,mime", [("image", PHOTO, "image/png"), ("video", VIDEO, "video/mp4")])
def test_import_stream_bounds(client, account, storage, monkeypatch, declared, media_type, row, mime):
    monkeypatch.setattr(stock, "MAX_IMAGE_BYTES", 16)
    monkeypatch.setattr(stock, "MAX_VIDEO_BYTES", 16)

    class Chunks(httpx.SyncByteStream):
        count = 0

        def __iter__(self):
            for _ in range(100):
                self.count += 1
                yield b"x" * 65536

    stream = Chunks()
    headers = {"Content-Type": mime, **({"Content-Length": "999999999"} if declared else {})}
    requests = mock_provider(monkeypatch, lambda request: httpx.Response(200, json=row) if request.url.host == "api.pexels.com"
                             else httpx.Response(200, stream=stream, headers=headers))
    response = client.post(url(account, "stock/import"), headers=account[1], json={"provider": "pexels", "id": str(row["id"]), "mediaType": media_type})
    assert response.status_code == 413, response.text
    assert stream.count == (0 if declared else 1)
    assert len(requests) == 2 and not storage.uploads


@pytest.mark.parametrize("data,mime,status", [(b"<svg/>", "image/svg+xml", 415), (b"not-image", "image/jpeg", 400)])
def test_import_bad_bytes_not_stored(client, account, storage, monkeypatch, data, mime, status):
    mock_provider(monkeypatch, lambda request: httpx.Response(200, json=PHOTO) if request.url.host == "api.pexels.com"
                  else httpx.Response(200, content=data, headers={"Content-Type": mime}))
    response = client.post(url(account, "stock/import"), headers=account[1], json={"provider": "pexels", "id": "123", "mediaType": "image"})
    assert response.status_code == status and not storage.uploads


def test_cache_bound_ttl_and_credential_rotation(monkeypatch):
    requests = mock_provider(monkeypatch, lambda request: httpx.Response(200, json={"photos": [PHOTO]}))
    monkeypatch.setattr(stock, "CACHE_MAX_ENTRIES", 2)
    clock = [0]
    monkeypatch.setattr(stock.time, "monotonic", lambda: clock[0])
    first = stock.search("a", "image", 1, 24)
    first.items.clear()
    assert stock.search("a", "image", 1, 24).items
    for query in ("b", "c"):
        stock.search(query, "image", 1, 24)
    assert len(stock._cache) == 2
    stock.search("a", "image", 1, 24)
    assert len(requests) == 4
    clock[0] = 301
    stock.search("a", "image", 1, 24)
    assert len(requests) == 5
    monkeypatch.setattr(settings, "pexels_api_key", "rotated-key")
    stock.search("a", "image", 1, 24)
    assert len(requests) == 6
    monkeypatch.setattr(settings, "pexels_api_key", "")
    with pytest.raises(HTTPException):
        stock.search("a", "image", 1, 24)


def test_viewer_cannot_import_or_upload(client, db, account, storage):
    viewer = client.post("/api/v1/auth/register", json={"email": "viewer@example.com", "password": "viewer-password"}).json()
    db.workspace_members.insert_one({"id": "viewer-membership", "workspace_id": account[0],
                                     "user_id": viewer["user"]["id"], "social_level": "viewer", "role": "member"})
    headers = {"Authorization": f"Bearer {viewer['access_token']}"}
    assert client.post(url(account, "stock/import"), headers=headers, json={"provider": "pexels", "id": "123", "mediaType": "image"}).status_code == 403
    for path, mime in [("upload-image", "image/png"), ("upload-video", "video/mp4"), ("upload-logo", "image/png")]:
        response = client.post(url(account, path), headers=headers, files={"file": ("media", b"bytes", mime)})
        assert response.status_code == 403
    assert client.get(url(account, "stock/providers"), headers=headers).status_code == 200
    assert storage.uploads == []


@pytest.mark.parametrize("media_type,data,mime", [("image", image_bytes(), "image/png"), ("video", mp4_bytes(), "video/mp4")])
def test_existing_upload_contract(client, account, storage, media_type, data, mime):
    response = client.post(url(account, f"upload-{media_type}"), headers=account[1], files={"file": ("../../media.svg", data, mime)})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == "uploaded"
    assert body["assetId"] and body[f"{media_type}Url"].startswith("https://owned.test/")
    assert len(storage.uploads) == 1 and ".." not in storage.uploads[0][0]
    detail = client.get(url(account, f"media-assets/{body['assetId']}"), headers=account[1]).json()
    assert detail["provenance"] is None


@pytest.mark.parametrize("media_type,row,data,mime", [
    ("image", PHOTO, image_bytes(), "image/png"), ("video", VIDEO, mp4_bytes(), "video/mp4"),
])
def test_planner_import_preserves_copy_approval_and_remains_image_only(db, planner_setup, storage, monkeypatch, media_type, row, data, mime):
    from app.social.planner_schemas import ImageAsset

    mock_provider(monkeypatch, lambda request: httpx.Response(200, json=row) if request.url.host == "api.pexels.com"
                  else httpx.Response(200, content=data, headers={"Content-Type": mime}))
    service, run = generated(db, planner_setup)
    workspace, user = planner_setup[:2]
    original = run.items[0]
    asset = stock.import_asset(db, workspace, user, StockImportRequest(provider="pexels", id=str(row["id"]), mediaType=media_type))
    current = service.get(workspace, run.id).items[0]
    assert current.revision == original.revision and current.copyApproved is False
    payload = ImageAsset(expectedRevision=current.revision, assetId=asset.id)
    with pytest.raises(HTTPException) as exc:
        service.attach_image(workspace, user, run.id, current.id, payload)
    assert exc.value.status_code == 409
    approved = service.approve_copy(workspace, user, run.id, current.id, current.revision)
    assert approved.copyApproved and approved.revision == original.revision
    if media_type == "video":
        with pytest.raises(HTTPException) as exc:
            service.attach_image(workspace, user, run.id, current.id, payload)
        assert exc.value.status_code == 404
    else:
        result = service.attach_image(workspace, user, run.id, current.id, payload)
        assert result.copyApproved and result.revision == original.revision
        assert result.post.imageUrl == asset.url
        assert result.visualState == "ready"
        assert result.post.imageSource == "uploaded"
        with pytest.raises(HTTPException) as exc:
            service.attach_image(workspace, user, run.id, current.id,
                                 payload.model_copy(update={"expectedRevision": "stale"}))
        assert exc.value.status_code == 409
    assert db.social_media_assets.find_one({"id": asset.id})["provenance"] == asset.provenance.model_dump()


@pytest.mark.parametrize("kind", ["foreign", "deleted"])
def test_planner_rejects_foreign_or_deleted_import(db, planner_setup, storage, monkeypatch, kind):
    from app.social.planner_schemas import ImageAsset

    mock_provider(monkeypatch, lambda request: httpx.Response(200, json=PHOTO) if request.url.host == "api.pexels.com"
                  else httpx.Response(200, content=image_bytes(), headers={"Content-Type": "image/png"}))
    service, run = generated(db, planner_setup)
    workspace, user = planner_setup[:2]
    item = run.items[0]
    asset = stock.import_asset(db, workspace, user, StockImportRequest(provider="pexels", id="123", mediaType="image"))
    service.approve_copy(workspace, user, run.id, item.id, item.revision)
    db.social_media_assets.update_one({"id": asset.id}, {"$set": {"workspace_id": "foreign"} if kind == "foreign" else {"is_deleted": True}})
    with pytest.raises(HTTPException) as exc:
        service.attach_image(workspace, user, run.id, item.id, ImageAsset(expectedRevision=item.revision, assetId=asset.id))
    assert exc.value.status_code == 404


@pytest.mark.parametrize("data,mime,status", [
    (b"not-mp4", "video/mp4", 400), (mp4_bytes(), "video/webm", 415),
    (mp4_bytes(), "application/octet-stream", 415),
])
def test_video_import_invalid_bytes_and_mime(client, account, storage, monkeypatch, data, mime, status):
    mock_provider(monkeypatch, lambda request: httpx.Response(200, json=VIDEO) if request.url.host == "api.pexels.com"
                  else httpx.Response(200, content=data, headers={"Content-Type": mime}))
    response = client.post(url(account, "stock/import"), headers=account[1], json={"provider": "pexels", "id": "456", "mediaType": "video"})
    assert response.status_code == status and not storage.uploads


@pytest.mark.parametrize("body", [{"src": "invalid"}, {"id": None}, {"photographer_url": "javascript:alert(1)"}, {"width": -1}])
def test_malformed_provider_metadata(client, account, storage, monkeypatch, body):
    mock_provider(monkeypatch, lambda request: httpx.Response(200, json={**PHOTO, **body}))
    response = client.post(url(account, "stock/import"), headers=account[1], json={"provider": "pexels", "id": "123", "mediaType": "image"})
    assert response.status_code == 502 and not storage.uploads


def test_default_http_client_disables_redirects_and_environment():
    with stock._client() as client:
        assert client.follow_redirects is False
        assert client.trust_env is False
        assert client.timeout.connect == 5
        assert client.timeout.read == 30


@pytest.mark.parametrize("path,field", [("stock/providers", "items"), ("stock/search?query=office", "items"), ("media-assets", "items")])
def test_unauthenticated_access_denied(client, account, path, field):
    assert client.get(url(account, path)).status_code == 401