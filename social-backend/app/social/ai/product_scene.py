from __future__ import annotations

from io import BytesIO

from PIL import Image

from app.providers.llm import bedrock_image
from app.social.ai.compositor import decode_image


def _has_transparency(image: Image.Image) -> bool:
    alpha = image.getchannel("A")
    low, _ = alpha.getextrema()
    if low > 16:
        return False
    histogram = alpha.histogram()
    transparent = sum(histogram[:17])
    return transparent > image.width * image.height * 0.05


def product_cutout(image_bytes: bytes) -> Image.Image:
    image = decode_image(image_bytes)
    if not _has_transparency(image):
        out = BytesIO()
        flat = image.convert("RGB")
        flat.thumbnail((2048, 2048), Image.LANCZOS)
        flat.save(out, format="PNG")
        image = decode_image(bedrock_image.remove_background(out.getvalue()))
    box = image.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    if not box:
        raise bedrock_image.ImageProviderError("PRODUCT_NOT_FOUND", "No product could be separated from the photo. Use a clear product shot.")
    return image.crop(box)


def _png(image: Image.Image) -> bytes:
    out = BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


def place_product(cutout: Image.Image, width: int, height: int) -> tuple[Image.Image, Image.Image, tuple[int, int]]:
    product = cutout.copy()
    product.thumbnail((int(width * 0.62), int(height * 0.58)), Image.LANCZOS)
    x = (width - product.width) // 2
    y = max(0, int(height * 0.8) - product.height)
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(product, (x, y))
    return canvas, product, (x, y)


def render_product_scene(cutout: Image.Image, *, width: int, height: int, prompt: str, negative_prompt: str | None) -> bytes:
    canvas, product, position = place_product(cutout, width, height)
    scene = decode_image(bedrock_image.inpaint(_png(canvas), prompt=prompt, negative_prompt=negative_prompt))
    if scene.size != (width, height):
        scene = scene.resize((width, height), Image.LANCZOS)
    scene.alpha_composite(product, position)
    return _png(scene.convert("RGB"))
