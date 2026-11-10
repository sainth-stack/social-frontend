from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

_FONT_DIR = Path(__file__).resolve().parents[2] / "assets" / "fonts"
COVER_RATIO_LIMIT = 1.3

_BOLD_FONTS = (
    "Inter-Bold.ttf",
    "DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
)
_REGULAR_FONTS = (
    "Inter-Regular.ttf",
    "DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
)

LOGO_POSITIONS = ("top-left", "top-right", "bottom-left", "bottom-right")


@dataclass
class OverlayCopy:
    headline: str = ""
    subtext: str = ""
    cta: str = ""


@lru_cache(maxsize=64)
def _font(size: int, bold: bool) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = _BOLD_FONTS if bold else _REGULAR_FONTS
    for name in candidates:
        path = _FONT_DIR / name if not os.path.isabs(name) else Path(name)
        try:
            if path.exists():
                return ImageFont.truetype(str(path), size)
            if not os.path.isabs(name):
                return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def parse_hex(value: Optional[str], fallback: tuple[int, int, int]) -> tuple[int, int, int]:
    raw = (value or "").strip().lstrip("#")
    if len(raw) == 3:
        raw = "".join(c * 2 for c in raw)
    if len(raw) != 6:
        return fallback
    try:
        return int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16)
    except ValueError:
        return fallback


def _luminance(rgb: tuple[int, int, int]) -> float:
    def ch(c: int) -> float:
        v = c / 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def _mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def _text_width(draw: ImageDraw.ImageDraw, text: str, font) -> int:
    left, _, right, _ = draw.textbbox((0, 0), text, font=font)
    return right - left


def _line_height(font) -> int:
    ascent, descent = font.getmetrics() if hasattr(font, "getmetrics") else (font.size, 0)
    return ascent + descent


def _wrap(draw: ImageDraw.ImageDraw, text: str, font, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.splitlines():
        current = ""
        for word in paragraph.split():
            trial = f"{current} {word}".strip()
            if _text_width(draw, trial, font) <= max_width:
                current = trial
                continue
            if current:
                lines.append(current)
            if _text_width(draw, word, font) <= max_width:
                current = word
                continue
            current = ""
            for char in word:
                if current and _text_width(draw, current + char, font) > max_width:
                    lines.append(current)
                    current = ""
                if _text_width(draw, char, font) > max_width:
                    raise ValueError("Overlay text cannot fit within the safe width")
                current += char
        lines.append(current)
    return lines


def _fit_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    *,
    max_width: int,
    start: int,
    minimum: int,
    max_lines: int,
    bold: bool,
) -> tuple[list[str], ImageFont.FreeTypeFont | ImageFont.ImageFont]:
    size = start
    while True:
        font = _font(size, bold)
        lines = _wrap(draw, text, font, max_width)
        if len(lines) <= max_lines or size <= minimum:
            return lines, font
        size = max(minimum, int(size * 0.9))


def _gradient(size: tuple[int, int], color: tuple[int, int, int], *, side: str, coverage: float, max_alpha: int) -> Image.Image:
    width, height = size
    vertical = side in ("top", "bottom")
    start = int(256 * (1 - coverage))
    values = [
        0 if i < start else int(max_alpha * (((i - start) / max(1, 255 - start)) ** 1.35))
        for i in range(256)
    ]
    ramp = Image.new("L", (1, 256) if vertical else (256, 1))
    ramp.putdata(values)
    if side == "top":
        ramp = ramp.transpose(Image.FLIP_TOP_BOTTOM)
    elif side == "left":
        ramp = ramp.transpose(Image.FLIP_LEFT_RIGHT)
    layer = Image.new("RGBA", (width, height), color + (0,))
    layer.putalpha(ramp.resize((width, height), Image.BILINEAR))
    return layer


def decode_image(image_bytes: bytes) -> Image.Image:
    if not isinstance(image_bytes, bytes) or not image_bytes or len(image_bytes) > 30 * 1024 * 1024:
        raise ValueError("Image must contain valid bytes no larger than 30 MiB")
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            if image.format not in ("PNG", "JPEG", "WEBP"):
                raise ValueError("Image must be PNG, JPEG or WebP")
            if min(image.size) < 1 or max(image.size) > 16384 or image.width * image.height > 40_000_000:
                raise ValueError("Image dimensions exceed safe decoding limits")
            image.load()
            return ImageOps.exif_transpose(image).convert("RGBA")
    except (OSError, SyntaxError, Image.DecompressionBombError) as exc:
        raise ValueError("Image bytes could not be decoded safely") from exc


def load_logo(logo_bytes: bytes, max_w: int, max_h: int) -> Optional[Image.Image]:
    try:
        logo = decode_image(logo_bytes)
    except Exception:
        return None
    logo.thumbnail((max_w, max_h), Image.LANCZOS)
    return logo


def _logo_box(
    canvas_size: tuple[int, int],
    logo: Image.Image,
    *,
    position: str,
    margin_x: int,
    margin_y: int,
) -> tuple[int, int, int, int]:
    pad = max(6, int(logo.height * 0.28))
    plate_w, plate_h = logo.width + pad * 2, logo.height + pad * 2
    width, height = canvas_size
    x = margin_x if position.endswith("left") else width - margin_x - plate_w
    y = margin_y if position.startswith("top") else height - margin_y - plate_h
    return x, y, x + plate_w, y + plate_h


def _paste_logo(canvas: Image.Image, logo: Image.Image, box: tuple[int, int, int, int]) -> None:
    plate_w, plate_h = box[2] - box[0], box[3] - box[1]
    plate = Image.new("RGBA", (plate_w, plate_h), (0, 0, 0, 0))
    ImageDraw.Draw(plate).rounded_rectangle(
        (0, 0, plate_w - 1, plate_h - 1), radius=int(plate_h * 0.28), fill=(255, 255, 255, 236)
    )
    plate.alpha_composite(logo, ((plate_w - logo.width) // 2, (plate_h - logo.height) // 2))
    canvas.alpha_composite(plate, (box[0], box[1]))


def _draw_brand_lockup(
    canvas: Image.Image,
    *,
    origin: tuple[int, int],
    extent: tuple[int, int],
    brand_name: str,
    brand_tagline: Optional[str],
    logo: Optional[Image.Image],
    primary: tuple[int, int, int],
) -> None:
    x0, y0 = origin
    max_w, max_h = extent
    short = min(max_w, max_h)
    margin = int(short * 0.04)
    pad = int(short * 0.035)
    draw = ImageDraw.Draw(canvas)
    name_font = _font(max(18, int(short * 0.048)), True)
    tag_font = _font(max(13, int(short * 0.028)), False)
    name_lines, name_font = _fit_text(draw, brand_name, max_width=max_w - margin * 2 - pad * 2, start=name_font.size, minimum=16, max_lines=2, bold=True)
    tag_lines = _wrap(draw, brand_tagline, tag_font, max_w - margin * 2 - pad * 2)[:2] if brand_tagline else []
    logo_w = logo.width + int(pad * 0.6) if logo is not None else 0
    text_block_h = int(_line_height(name_font) * 1.05 * len(name_lines) + (_line_height(tag_font) * 1.1 * len(tag_lines) if tag_lines else 0))
    block_h = max(text_block_h, logo.height if logo else 0) + pad * 2
    block_w = min(max_w, max(logo_w + pad * 2 + max((_text_width(draw, line, name_font) for line in name_lines), default=0), int(short * 0.55)))
    block_w = min(block_w, max_w)
    scrim = _gradient((block_w, block_h), (0, 0, 0), side="left", coverage=0.95, max_alpha=165)
    canvas.alpha_composite(scrim, (x0 + margin, y0 + margin))
    cursor_x = x0 + margin + pad
    cursor_y = y0 + margin + pad
    if logo is not None:
        canvas.alpha_composite(logo, (cursor_x, cursor_y + max(0, (text_block_h - logo.height) // 2)))
        cursor_x += logo_w
    for line in name_lines:
        draw.text((cursor_x, cursor_y), line, font=name_font, fill=(255, 255, 255, 255))
        cursor_y += int(_line_height(name_font) * 1.05)
    if tag_lines:
        cursor_y += int(pad * 0.35)
        for line in tag_lines:
            draw.text((cursor_x, cursor_y), line, font=tag_font, fill=(235, 238, 245, 230))
            cursor_y += int(_line_height(tag_font) * 1.1)


def _pill(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    *,
    font,
    fill: tuple[int, int, int, int],
    color: tuple[int, int, int],
    pad_x: int,
    pad_y: int,
) -> tuple[int, int, int, int]:
    tw = _text_width(draw, text, font)
    th = _line_height(font)
    x, y = xy
    box = (x, y, x + tw + pad_x * 2, y + th + pad_y * 2)
    draw.rounded_rectangle(box, radius=(th + pad_y * 2) // 2, fill=fill)
    draw.text((x + pad_x, y + pad_y), text, font=font, fill=color)
    return box


def compose_creative(
    image_bytes: bytes,
    *,
    width: int,
    height: int,
    layout: str = "post",
    copy: Optional[OverlayCopy] = None,
    logo_bytes: Optional[bytes] = None,
    logo_position: str = "top-right",
    primary_color: Optional[str] = None,
    accent_color: Optional[str] = None,
    slide_label: Optional[str] = None,
    brand_lockup: bool = False,
    brand_name: Optional[str] = None,
    brand_tagline: Optional[str] = None,
    lockup_logo: bool = False,
) -> bytes:
    if not isinstance(width, int) or not isinstance(height, int) or min(width, height) < 64 or max(width, height) > 8192 or width * height > 32_000_000:
        raise ValueError("Output dimensions must be between 64 and 8192 pixels within 32 megapixels")
    if copy and sum(len(value) for value in (copy.headline, copy.subtext, copy.cta)) > 12000:
        raise ValueError("Overlay copy cannot fit safely; provide no more than 12000 characters")
    from app.social.ai.image_quality import validate_image_content, validate_image_bytes

    decoded = decode_image(image_bytes)
    validate_image_content(decoded, stage="base")
    source_ratio = decoded.width / decoded.height
    target_ratio = width / height
    fill = parse_hex(primary_color, (255, 255, 255)) + (255,)
    transparent = decoded.mode == "RGBA" and decoded.getchannel("A").getextrema()[0] < 255
    if max(source_ratio, target_ratio) / min(source_ratio, target_ratio) <= COVER_RATIO_LIMIT:
        base = ImageOps.fit(decoded, (width, height), Image.LANCZOS, centering=(0.5, 0.45))
        canvas = Image.new("RGBA", (width, height), fill)
        canvas.alpha_composite(base.convert("RGBA"))
    else:
        base = ImageOps.contain(decoded, (width, height), Image.LANCZOS).convert("RGBA")
        if transparent:
            canvas = Image.new("RGBA", (width, height), fill)
        else:
            backdrop = ImageOps.fit(decoded.convert("RGB"), (width, height), Image.BILINEAR)
            backdrop = backdrop.filter(ImageFilter.GaussianBlur(radius=max(8, min(width, height) // 25)))
            backdrop = Image.blend(backdrop, Image.new("RGB", (width, height), (0, 0, 0)), 0.22)
            canvas = backdrop.convert("RGBA")
        canvas.alpha_composite(base, ((width - base.width) // 2, (height - base.height) // 2))
    base_x = (width - base.width) // 2
    base_y = (height - base.height) // 2
    draw = ImageDraw.Draw(canvas)

    short = min(width, height)
    short_art = min(base.width, base.height)
    margin = int(short * 0.065)
    margin_art = int(short_art * 0.065)
    safe_top = int(height * 0.1) if layout == "story" else margin
    safe_bottom = int(height * 0.16) if layout == "story" else margin

    primary = parse_hex(primary_color, (17, 24, 39))
    accent = parse_hex(accent_color, (250, 204, 21))
    scrim_color = _mix(primary, (0, 0, 0), 0.72)

    copy = copy or OverlayCopy()
    headline = "\n".join(" ".join(line.split()) for line in copy.headline.splitlines()).strip()
    subtext = "\n".join(" ".join(line.split()) for line in copy.subtext.splitlines()).strip()
    cta = " ".join(copy.cta.split())
    has_text = bool(headline or subtext or cta)

    position = logo_position if logo_position in LOGO_POSITIONS else "top-right"
    logo_box: Optional[tuple[int, int, int, int]] = None
    logo: Optional[Image.Image] = None
    lockup_logo_image: Optional[Image.Image] = None
    use_lockup = brand_lockup and bool(brand_name)
    if logo_bytes:
        if use_lockup and lockup_logo:
            lockup_logo_image = load_logo(logo_bytes, int(short_art * 0.14), int(short_art * 0.14))
        elif not use_lockup:
            logo = load_logo(logo_bytes, int(short_art * 0.2), int(short_art * 0.075))
            if logo is not None:
                art_top = int(base.height * 0.1) if layout == "story" else margin_art
                art_bottom = int(base.height * 0.16) if layout == "story" else margin_art
                rel = _logo_box(
                    (base.width, base.height),
                    logo,
                    position=position,
                    margin_x=margin_art,
                    margin_y=art_top if position.startswith("top") else art_bottom,
                )
                logo_box = (rel[0] + base_x, rel[1] + base_y, rel[2] + base_x, rel[3] + base_y)

    region_top = safe_top
    region_bottom = height - safe_bottom
    if slide_label:
        region_top += int(short * 0.08)
    if logo_box and not (layout == "banner" and position.endswith("right")):
        gap = int(short * 0.03)
        if position.startswith("top"):
            region_top = max(region_top, logo_box[3] + gap)
        else:
            region_bottom = min(region_bottom, logo_box[1] - gap)

    if has_text:
        if layout == "quote":
            veil = Image.new("RGBA", (width, height), scrim_color + (190,))
            canvas.alpha_composite(veil)
        elif layout == "banner":
            canvas.alpha_composite(_gradient((width, height), scrim_color, side="left", coverage=0.72, max_alpha=238))
        else:
            coverage = 0.62 if layout == "story" else 0.68
            canvas.alpha_composite(_gradient((width, height), scrim_color, side="bottom", coverage=coverage, max_alpha=240))
        draw = ImageDraw.Draw(canvas)

        if layout == "banner":
            text_left, text_width = margin, int(width * 0.56) - margin
            align = "left"
        elif layout in ("quote", "story"):
            text_left, text_width = margin, width - margin * 2
            align = "center"
        else:
            text_left, text_width = margin, width - margin * 2
            align = "left"

        if layout == "quote":
            head_start, head_min, head_lines = int(short * 0.075), int(short * 0.04), 7
        elif layout == "story":
            head_start, head_min, head_lines = int(short * 0.105), int(short * 0.06), 4
        elif layout == "banner":
            head_start, head_min, head_lines = int(height * 0.13), int(height * 0.07), 3
        else:
            head_start, head_min, head_lines = int(short * 0.088), int(short * 0.05), 3

        bar_h = max(4, int(short * 0.008)) if layout != "quote" else 0
        gap = int(short * 0.025)
        avail = region_bottom - region_top

        while True:
            head_lines_text, head_font = (
                _fit_text(draw, headline, max_width=text_width, start=head_start, minimum=head_min, max_lines=head_lines, bold=True)
                if headline
                else ([], _font(head_start, True))
            )
            head_size = getattr(head_font, "size", head_start)
            sub_font = _font(max(14, int(head_size * 0.42)), False)
            sub_lines = _wrap(draw, subtext, sub_font, text_width) if subtext else []
            cta_font = _font(max(14, int(head_size * 0.36)), True)

            head_lh = int(_line_height(head_font) * 1.04)
            sub_lh = int(_line_height(sub_font) * 1.18)
            cta_pad_y = int(_line_height(cta_font) * 0.45)
            cta_h = _line_height(cta_font) + cta_pad_y * 2 if cta else 0
            quote_mark_h = int(head_size * 1.1) if layout == "quote" else 0

            block_h = (
                quote_mark_h
                + (bar_h + gap if bar_h and headline else 0)
                + head_lh * len(head_lines_text)
                + (gap + sub_lh * len(sub_lines) if sub_lines else 0)
                + (gap + cta_h if cta else 0)
            )
            cta_width = _text_width(draw, cta, cta_font) + int(_line_height(cta_font) * 0.9) * 2 if cta else 0
            if block_h <= avail and cta_width <= text_width:
                break
            if head_start <= 16:
                raise ValueError("Overlay copy cannot fit within safe areas; shorten the headline, body or CTA")
            head_start = max(16, int(head_start * 0.88))
            head_min = min(head_min, head_start)

        if layout in ("quote", "banner"):
            y = region_top + max(0, (region_bottom - region_top - block_h) // 2)
        else:
            y = max(region_top, region_bottom - block_h)

        draw.rounded_rectangle(
            (text_left - gap // 2, max(safe_top, y - gap // 2), text_left + text_width + gap // 2, min(height - safe_bottom, y + block_h + gap // 2)),
            radius=max(2, gap // 2), fill=scrim_color + (240,),
        )

        def x_for(line_width: int) -> int:
            if align == "center":
                return text_left + (text_width - line_width) // 2
            return text_left

        if layout == "quote":
            mark_font = _font(int(head_size * 2.2), True)
            mark = "\u201c"
            draw.text((x_for(_text_width(draw, mark, mark_font)), y - int(head_size * 0.35)), mark, font=mark_font, fill=accent + (255,))
            y += quote_mark_h
        elif bar_h and headline:
            bar_w = int(short * 0.09)
            bx = x_for(bar_w)
            draw.rounded_rectangle((bx, y, bx + bar_w, y + bar_h), radius=bar_h // 2, fill=accent + (255,))
            y += bar_h + gap

        shadow = (0, 0, 0, 110)
        for line in head_lines_text:
            lx = x_for(_text_width(draw, line, head_font))
            draw.text((lx + 1, y + 2), line, font=head_font, fill=shadow)
            draw.text((lx, y), line, font=head_font, fill=(255, 255, 255, 255))
            y += head_lh
        if sub_lines:
            y += gap
            for line in sub_lines:
                draw.text((x_for(_text_width(draw, line, sub_font)), y), line, font=sub_font, fill=(235, 238, 245, 255))
                y += sub_lh
        if cta:
            y += gap
            pad_x = int(_line_height(cta_font) * 0.9)
            cta_w = _text_width(draw, cta, cta_font) + pad_x * 2
            text_color = (17, 17, 17) if _luminance(accent) > 0.45 else (255, 255, 255)
            _pill(draw, (x_for(cta_w), y), cta, font=cta_font, fill=accent + (255,), color=text_color, pad_x=pad_x, pad_y=cta_pad_y)

    if logo is not None and logo_box:
        _paste_logo(canvas, logo, logo_box)
        draw = ImageDraw.Draw(canvas)

    if use_lockup:
        _draw_brand_lockup(
            canvas,
            origin=(base_x, base_y),
            extent=(base.width, base.height),
            brand_name=brand_name or "",
            brand_tagline=brand_tagline,
            logo=lockup_logo_image,
            primary=primary,
        )
        draw = ImageDraw.Draw(canvas)

    if slide_label:
        label_font = _font(max(14, int(short * 0.03)), True)
        pad_x, pad_y = int(short * 0.018), int(short * 0.01)
        label_w = _text_width(draw, slide_label, label_font) + pad_x * 2
        on_left = not (logo_box and position == "top-left")
        lx = margin if on_left else width - margin - label_w
        if logo_box and position == "top-right" and lx + label_w > logo_box[0]:
            lx = margin
        _pill(draw, (lx, safe_top), slide_label, font=label_font, fill=(0, 0, 0, 140), color=(255, 255, 255), pad_x=pad_x, pad_y=pad_y)

    out = BytesIO()
    canvas.convert("RGB").save(out, format="JPEG", quality=92, optimize=True, progressive=True)
    result = out.getvalue()
    validate_image_bytes(result, stage="export")
    return result
