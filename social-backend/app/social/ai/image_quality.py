from __future__ import annotations

from PIL import Image, ImageStat


class ImageReliabilityError(ValueError):
    def __init__(self, code: str, stage: str, message: str):
        super().__init__(message)
        self.code = code
        self.stage = stage


def validate_image_content(image: Image.Image, *, stage: str) -> dict[str, float | int]:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    if alpha.getextrema()[1] == 0:
        raise ImageReliabilityError("IMAGE_FULLY_TRANSPARENT", stage, "Image is fully transparent; request new artwork or upload an image")
    sample = rgba.crop(alpha.getbbox())
    sample.thumbnail((256, 256))
    visible = sample.getchannel("A").point(lambda value: 255 if value else 0)
    luminance = sample.convert("RGB").convert("L")
    stats = ImageStat.Stat(luminance, visible)
    mean = stats.mean[0]
    deviation = stats.stddev[0]
    extrema = stats.extrema[0]
    color_stats = ImageStat.Stat(sample, visible)
    uniform_alpha = alpha.getextrema()[1] - alpha.getextrema()[0] <= 1
    suspect_black = uniform_alpha and extrema[1] <= 3 and deviation <= 0.6 and max(color_stats.stddev[:3]) <= 0.6
    suspect_uniform = uniform_alpha and max(color_stats.stddev[:3]) <= 0.25 and all(high - low <= 1 for low, high in color_stats.extrema[:3])
    if suspect_black or suspect_uniform:
        full_stats = ImageStat.Stat(rgba, alpha)
        full_luminance = ImageStat.Stat(rgba.convert("RGB").convert("L"), alpha)
        suspect_black = suspect_black and full_luminance.extrema[0][1] <= 3 and max(full_stats.stddev[:3]) <= 0.6
        suspect_uniform = suspect_uniform and max(full_stats.stddev[:3]) <= 0.25 and all(high - low <= 1 for low, high in full_stats.extrema[:3])
    if suspect_black:
        raise ImageReliabilityError("IMAGE_NEAR_BLACK", stage, "Image is nearly uniform black; request new artwork or upload an image")
    if suspect_uniform:
        raise ImageReliabilityError("IMAGE_UNIFORM", stage, "Image has no meaningful visible detail; request new artwork or upload an image")
    return {"width": rgba.width, "height": rgba.height, "meanLuminance": round(mean, 3), "luminanceDeviation": round(deviation, 3)}


def validate_image_bytes(data: bytes, *, stage: str) -> dict[str, float | int]:
    from app.social.ai.compositor import decode_image

    try:
        image = decode_image(data)
    except ValueError as exc:
        raise ImageReliabilityError("IMAGE_DECODE_FAILED", stage, "Image bytes could not be decoded safely") from exc
    return validate_image_content(image, stage=stage)