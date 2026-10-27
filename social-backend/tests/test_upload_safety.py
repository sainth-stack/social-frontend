import io

import pytest
from fastapi import HTTPException, UploadFile
from PIL import Image, PngImagePlugin

from app.social import upload_safety as safety


def image_bytes(fmt="PNG", size=(8, 6)):
    output = io.BytesIO()
    image = Image.new("RGB", size, "orange")
    if fmt == "PNG":
        info = PngImagePlugin.PngInfo()
        info.add_text("secret", "private metadata")
        image.save(output, format=fmt, pnginfo=info)
    else:
        exif = Image.Exif()
        exif[0x010E] = "private metadata"
        image.save(output, format=fmt, exif=exif)
    return output.getvalue()


def mp4_bytes():
    def box(kind, data):
        return (len(data) + 8).to_bytes(4, "big") + kind + data

    return box(b"ftyp", b"isom\x00\x00\x00\x00isommp42") + box(b"moov", b"\x00" * 8) + box(b"mdat", b"\x00" * 16)


@pytest.mark.parametrize("fmt,mime", [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")])
def test_normalized_jpeg_strips_metadata(fmt, mime):
    data = safety.normalize_image(image_bytes(fmt), mime)
    assert b"private metadata" not in data
    with Image.open(io.BytesIO(data)) as image:
        assert image.format == "JPEG"
        assert image.size == (8, 6)
        assert not image.getexif()


@pytest.mark.parametrize("data,mime,status", [
    (b"<svg></svg>", "image/svg+xml", 415),
    (b"<svg></svg>", "image/jpeg", 400),
    (b"not an image", "image/png", 400),
    (image_bytes(), "image/jpeg", 400),
    (image_bytes(), "application/octet-stream", 415),
    (b"", "image/jpeg", 400),
])
def test_image_rejections(data, mime, status):
    with pytest.raises(HTTPException) as exc:
        safety.normalize_image(data, mime)
    assert exc.value.status_code == status


def test_image_pixel_bound(monkeypatch):
    monkeypatch.setattr(safety, "MAX_IMAGE_PIXELS", 10)
    with pytest.raises(HTTPException) as exc:
        safety.normalize_image(image_bytes(), "image/png")
    assert exc.value.status_code == 400


def test_image_input_and_output_bounds(monkeypatch):
    data = image_bytes()
    monkeypatch.setattr(safety, "MAX_IMAGE_BYTES", len(data) - 1)
    with pytest.raises(HTTPException) as exc:
        safety.normalize_image(data, "image/png")
    assert exc.value.status_code == 413
    monkeypatch.setattr(safety, "MAX_IMAGE_BYTES", len(data) + 1)
    with pytest.raises(HTTPException) as exc:
        safety.normalize_image(data, "image/png")
    assert exc.value.status_code == 413


@pytest.mark.parametrize("mime,data", [("video/mp4", mp4_bytes()), ("video/webm", b"\x1a\x45\xdf\xa3\x42\x82\x84webm")])
def test_video_supported_containers(mime, data):
    assert safety.validate_video(data, mime) == mime


@pytest.mark.parametrize("data,mime,status", [
    (mp4_bytes(), "video/quicktime", 415),
    (mp4_bytes(), "video/x-msvideo", 415),
    (b"fake mp4", "video/mp4", 400),
    (mp4_bytes()[:-1], "video/mp4", 400),
    (mp4_bytes().replace(b"isom", b"qt  ").replace(b"mp42", b"qt  "), "video/mp4", 400),
    (b"\x1a\x45\xdf\xa3matroska", "video/webm", 400),
    (b"", "video/mp4", 400),
])
def test_video_rejections(data, mime, status):
    with pytest.raises(HTTPException) as exc:
        safety.validate_video(data, mime)
    assert exc.value.status_code == status


def test_video_bound(monkeypatch):
    data = mp4_bytes()
    monkeypatch.setattr(safety, "MAX_VIDEO_BYTES", len(data) - 1)
    with pytest.raises(HTTPException) as exc:
        safety.validate_video(data, "video/mp4")
    assert exc.value.status_code == 413


@pytest.mark.parametrize("length,ok", [(0, True), (7, True), (8, True), (9, False), (100000, False)])
def test_upload_bounded_reader(length, ok):
    import asyncio

    class TrackedUpload(UploadFile):
        sizes = []

        async def read(self, size=-1):
            self.sizes.append(size)
            assert 0 < size <= 65536
            return await super().read(size)

    file = TrackedUpload(io.BytesIO(b"x" * length))
    if ok:
        assert asyncio.run(safety.read_upload(file, 8)) == b"x" * length
    else:
        with pytest.raises(HTTPException) as exc:
            asyncio.run(safety.read_upload(file, 8))
        assert exc.value.status_code == 413
        assert file.file.tell() == 9