import argparse
import asyncio
import json
import math
import shutil
import subprocess
import wave
from functools import lru_cache
from pathlib import Path

import edge_tts
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT.parent / "public"
OUT = ROOT / "output"
SPEC = json.loads((ROOT / "storyboard.json").read_text(encoding="utf-8"))
W, H = SPEC["width"], SPEC["height"]
INK = "#172033"
MUTED = "#586174"
PURPLE = "#5941DE"
LILAC = "#F0EDFF"
BORDER = "#E1E5EE"
GREEN = "#12634E"
MINT = "#E3F3EC"
BG = "#F7F8FC"
WHITE = "#FFFFFF"
PHOTOS = ["coffee-editorial.webp", "coffee-detail.webp", "brand-interior.webp"]


def run(args):
    subprocess.run([str(a) for a in args], check=True)


@lru_cache(maxsize=60)
def font(size, bold=False):
    value = ImageFont.truetype(str(ROOT / "assets" / "Inter.ttf"), size)
    value.set_variation_by_axes([18, 680 if bold else 420])
    return value


def text(im, value, xy, size=28, color=INK, bold=False, spacing=12):
    ImageDraw.Draw(im).multiline_text(xy, value, font=font(size, bold), fill=color, spacing=spacing)


def box(im, xy, fill=WHITE, radius=20, outline=None, width=1):
    ImageDraw.Draw(im).rounded_rectangle(xy, radius, fill=fill, outline=outline, width=width)


def line(im, xy, fill=BORDER, width=2):
    ImageDraw.Draw(im).line(xy, fill=fill, width=width)


def pill(im, value, x, y, fill=LILAC, color=PURPLE, size=22, dot=False):
    tw = ImageDraw.Draw(im).textlength(value, font=font(size, True))
    width = int(tw + (60 if dot else 36))
    box(im, (x, y, x + width, y + 44), fill, 22)
    if dot:
        ImageDraw.Draw(im).ellipse((x + 17, y + 17, x + 27, y + 27), fill=color)
    text(im, value, (x + (38 if dot else 18), y + 9), size, color, True)
    return width


@lru_cache(maxsize=24)
def photo(index, width, height):
    image = Image.open(PUBLIC / "images" / PHOTOS[index % 3]).convert("RGB")
    image = ImageOps.fit(image, (width, height), method=Image.Resampling.LANCZOS)
    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width, height), 14, fill=255)
    image.putalpha(mask)
    return image


@lru_cache(maxsize=4)
def mark(size):
    return ImageOps.contain(Image.open(PUBLIC / "brand" / "mark.png").convert("RGBA"), (size, size))


def logo(im, x, y, size=42, dark=False):
    im.paste(mark(size), (x, y), mark(size))
    text(im, "OpsBrain AI", (x + size + 12, y + 4), int(size * .67), WHITE if dark else INK, True)


def check(im, x, y, color=GREEN, size=20):
    ImageDraw.Draw(im).line([(x, y + size * .48), (x + size * .35, y + size * .83), (x + size, y)], fill=color, width=3)


def wrap(value, width, size=26):
    words, lines, current = value.split(), [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if font(size).getlength(candidate) > width and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    return "\n".join(lines + ([current] if current else []))


def ease(t):
    t = max(0, min(1, t))
    return 1 - (1 - t) ** 3


def frame_shell(index):
    scene = SPEC["scenes"][index]
    im = Image.new("RGB", (W, H), BG)
    logo(im, 96, 56, 42)
    text(im, "PLAN  /  CREATE  /  PUBLISH  /  LEARN", (1180, 70), 20, MUTED)
    text(im, scene["eyebrow"], (96, 162), 23, PURPLE, True)
    text(im, scene["title"], (91, 210), 69, INK, True, 5)
    text(im, scene["subtitle"], (96, 391), 28, MUTED)
    text(im, "opsbrainai.com", (96, 1010), 21, MUTED)
    text(im, f"{index + 1:02} / 10", (1720, 1010), 21, MUTED)
    return im


def window(title, subtitle="Corner Café / Workspace"):
    im = Image.new("RGBA", (1728, 492), (0, 0, 0, 0))
    box(im, (0, 0, 1727, 491), WHITE, 24, BORDER)
    text(im, title, (34, 24), 27, INK, True)
    text(im, subtitle, (1120, 30), 21, MUTED)
    line(im, (0, 78, 1728, 78))
    return im


def floating(im, title, detail, x=1330, y=855):
    shadow = Image.new("RGBA", im.size)
    box(shadow, (x, y + 9, x + 448, y + 113), "#17203320", 18)
    im.paste(shadow.filter(ImageFilter.GaussianBlur(15)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(15)))
    box(im, (x, y, x + 448, y + 104), WHITE, 18, BORDER)
    box(im, (x + 20, y + 23, x + 70, y + 73), MINT, 25)
    check(im, x + 35, y + 39, size=20)
    text(im, title, (x + 87, y + 20), 23, INK, True)
    text(im, detail, (x + 87, y + 57), 19, MUTED)


def build_content(index):
    if index == 0:
        im = window("Your content, connected", "One workspace / Every stage")
        cards = [("Plan your week", "A clear direction", LILAC), ("Create on-brand", "Copy and visuals", "#FFF2E8"), ("Publish with confidence", "Review, then schedule", MINT)]
        for i, (title, detail, color) in enumerate(cards):
            x = 30 + i * 564
            box(im, (x, 104, x + 540, 461), color, 18)
            im.paste(photo(i, 490, 205), (x + 25, 125), photo(i, 490, 205))
            text(im, title, (x + 25, 351), 30, INK, True)
            text(im, detail, (x + 25, 402), 24, MUTED)
        return im
    if index == 1:
        im = window("Brand profile", "Corner Café / Brand settings")
        im.paste(photo(0, 440, 346), (28, 108), photo(0, 440, 346))
        text(im, "Corner Café", (505, 112), 38, INK, True)
        text(im, "A neighborhood ritual, worth sharing.", (505, 170), 25, MUTED)
        rows = [("Audience", "Local coffee lovers & remote workers"), ("Tone", "Warm, direct and welcoming"), ("Writing style", "Specific details. Everyday language.")]
        for i, (label, value) in enumerate(rows):
            y = 235 + i * 69
            text(im, label, (505, y), 24, MUTED)
            text(im, value, (730, y), 25, INK, True)
            if i < 2:
                line(im, (505, y + 49, 1270, y + 49))
        box(im, (1350, 112, 1690, 454), BG, 18)
        text(im, "Visual identity", (1380, 143), 25, INK, True)
        for i, color in enumerate(["#633F2F", "#EDDBC6", "#285748", "#172033"]):
            box(im, (1380 + i * 70, 213, 1432 + i * 70, 265), color, 26)
        text(im, "Brand colors\nLogo library\nSaved preferences", (1380, 302), 23, MUTED, spacing=15)
        return im
    if index == 2:
        im = window("Campaign brief", "Corner Café / New plan")
        fields = [("Your business", "Neighborhood café"), ("Your goal", "Introduce our new coffee menu")]
        for i, (label, value) in enumerate(fields):
            y = 119 + i * 143
            text(im, label, (38, y), 23, MUTED, True)
            box(im, (38, y + 43, 840, y + 117), BG, 12, BORDER)
            text(im, value, (58, y + 64), 27, INK)
        box(im, (900, 111, 1690, 455), LILAC, 18)
        text(im, "What should this week communicate?", (936, 144), 29, INK, True)
        text(im, "Introduce the new menu. Share our process.\nInvite people to find their next favorite.", (936, 210), 29, INK, spacing=17)
        pill(im, "Brand voice applied", 936, 340, WHITE, PURPLE, 23, True)
        return im
    if index in [3, 7]:
        im = window("Weekly content plan" if index == 3 else "Publishing calendar", "Corner Café / Week view")
        titles = ["Our story", "Coffee tips", "New menu", "Meet the team", "Your favorites", "Behind the bar", "Weekend ritual"]
        types = ["Brand story", "Helpful tip", "Product post", "Team story", "Conversation", "Behind the scenes", "Community"]
        for i in range(7):
            x = 24 + i * 241
            box(im, (x, 103, x + 228, 463), BG if i != 2 else LILAC, 14, BORDER)
            text(im, ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][i], (x + 16, 120), 20, MUTED, True)
            text(im, str(12 + i), (x + 16, 153), 32, INK, True)
            im.paste(photo(i % 3, 196, 122), (x + 16, 205), photo(i % 3, 196, 122))
            text(im, titles[i], (x + 16, 345), 22, INK, True)
            text(im, types[i] if index == 3 else ["9:00 AM", "12:30 PM", "5:00 PM"][i % 3], (x + 16, 381), 20, MUTED)
            pill(im, "Draft" if index == 3 else "Scheduled", x + 13, 414, LILAC if index == 3 else MINT, PURPLE if index == 3 else GREEN, 18)
        return im
    if index == 4:
        im = window("Content Studio", "Corner Café / Post editor")
        text(im, "Your draft", (36, 115), 24, MUTED, True)
        text(im, "Coffee, together.", (36, 163), 44, INK, True)
        text(im, "A new menu. The same neighborhood welcome.\nFind your favorite, pull up a chair,\nand make a little time for your next break.", (36, 240), 28, INK, spacing=15)
        pill(im, "#CornerCafe", 36, 390, LILAC, PURPLE)
        pill(im, "Warm & direct", 242, 390, BG, MUTED)
        im.paste(photo(0, 720, 348), (970, 105), photo(0, 720, 348))
        return im
    if index == 5:
        im = window("Connected accounts", "Nine platforms / One workspace")
        names = ["Instagram", "Facebook", "LinkedIn", "X", "Threads", "YouTube", "TikTok", "Pinterest", "Bluesky"]
        colors = ["#B12B76", "#225FDA", "#1467A2", INK, INK, "#B72829", INK, "#B72036", "#1476DB"]
        for i, (name, color) in enumerate(zip(names, colors)):
            x, y = 32 + (i % 3) * 560, 103 + (i // 3) * 124
            box(im, (x, y, x + 543, y + 105), BG, 15, BORDER)
            box(im, (x + 18, y + 22, x + 78, y + 82), color, 16)
            text(im, name[:2] if name != "X" else "X", (x + 30, y + 36), 25, WHITE, True)
            text(im, name, (x + 100, y + 35), 29, INK, True)
            check(im, x + 490, y + 42, size=22)
        return im
    if index == 6:
        im = window("Review & approvals", "Corner Café / Team workspace")
        im.paste(photo(1, 430, 348), (30, 107), photo(1, 430, 348))
        text(im, "New menu introduction", (500, 121), 34, INK, True)
        text(im, "Coffee, together. Find your next favorite.", (500, 180), 26, MUTED)
        box(im, (500, 250, 1210, 437), BG, 16, BORDER)
        pill(im, "Jules / Reviewer", 525, 270, WHITE, INK, 21)
        text(im, "Use the coffee detail shot first.\nThe caption is ready to go.", (525, 337), 27, INK, spacing=12)
        for i, label in enumerate(["Draft written", "In review", "Ready to schedule"]):
            y = 131 + i * 108
            box(im, (1260, y, 1690, y + 78), MINT if i == 2 else BG, 14)
            text(im, f"0{i + 1}", (1282, y + 24), 23, GREEN if i == 2 else MUTED, True)
            text(im, label, (1340, y + 24), 25, INK, True)
        return im
    if index == 8:
        im = window("Post performance", "Illustrative data / Not customer results")
        stats = [("Engagements", "418"), ("Posts reviewed", "7"), ("Connected channels", "3")]
        for i, (label, value) in enumerate(stats):
            y = 104 + i * 121
            box(im, (30, y, 430, y + 105), BG, 14)
            text(im, label, (52, y + 15), 21, MUTED)
            text(im, value, (52, y + 48), 38, INK, True)
        text(im, "Engagement over time", (494, 112), 27, INK, True)
        for y in [213, 285, 357]:
            line(im, (500, y, 1665, y), BORDER, 1)
        for i, label in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]):
            text(im, label, (491 + i * 185, 424), 21, MUTED)
        return im
    im = Image.new("RGBA", (1728, 492), (0, 0, 0, 0))
    box(im, (0, 0, 1727, 491), INK, 24)
    logo(im, 65, 57, 60, dark=True)
    text(im, "One connected workflow.", (65, 163), 59, WHITE, True)
    text(im, "Plan. Create. Review. Publish. Learn.", (65, 249), 33, "#CBD0DE")
    box(im, (65, 340, 387, 418), PURPLE, 14)
    text(im, "Start for free", (106, 360), 30, WHITE, True)
    text(im, "No credit card required.", (426, 367), 24, "#CBD0DE")
    for i in range(3):
        x = 1152 + i * 157
        im.paste(photo(i, 143, 273), (x, 111 + i * 20), photo(i, 143, 273))
    return im


SHELLS = []
PANELS = []


def compose(index, local):
    im = SHELLS[index].copy()
    progress = min(local / SPEC["scenes"][index]["duration"], 1)
    panel = PANELS[index]
    entrance = ease(local / .85)
    x, y = 96, 480 + int(48 * (1 - entrance))
    im.paste(panel, (x, y), panel)
    if index in [3, 7]:
        current = min(int(max(0, local - 1.2) / .85), 6)
        dx = x + 24 + current * 241
        ImageDraw.Draw(im).rounded_rectangle((dx, y + 103, dx + 228, y + 463), 14, outline=PURPLE, width=3)
    elif index == 2:
        count = int(ease(max(0, local - .7) / 3.4) * 61)
        box(im, (x + 936, y + 207, x + 1678, y + 319), LILAC, 0)
        value = "Introduce the new menu. Share our process. Invite people in."[:count]
        text(im, wrap(value, 690, 29), (x + 936, y + 210), 29, INK, spacing=17)
    elif index == 8:
        points = [(596 + i * 185, 480 + p) for i, p in enumerate([362, 300, 240, 326, 274, 207, 343])]
        count = max(2, min(7, int(max(0, local - .6) * 2) + 1))
        ImageDraw.Draw(im).line(points[:count], fill=PURPLE, width=6, joint="curve")
        for px, py in points[:count]:
            ImageDraw.Draw(im).ellipse((px - 7, py - 7, px + 7, py + 7), fill=PURPLE)
    if index in [1, 3, 4, 6, 7] and local > 3:
        notices = {1: ("Brand profile saved", "Ready for your next draft"), 3: ("Your weekly plan", "Seven editable starting points"), 4: ("Your draft. Your decision.", "Review before publishing"), 6: ("Post approved", "Ready for scheduling"), 7: ("Schedule confirmed", "Your week, coordinated")}
        title, detail = notices[index]
        floating(im, title, detail, y=850 + int(25 * (1 - ease((local - 3) / .6))))
    for i in range(10):
        fill = PURPLE if i < index else BORDER
        box(im, (1150 + i * 48, 1019, 1184 + i * 48, 1024), fill, 2)
    box(im, (1150 + index * 48, 1019, int(1150 + index * 48 + 34 * progress), 1024), PURPLE, 2)
    return im


def timestamp(seconds):
    ms = int(round(seconds * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


async def narration():
    for scene in SPEC["scenes"]:
        target = OUT / f"voice-{scene['id']}.mp3"
        if not target.exists() or target.stat().st_size < 1024:
            print(f"Narrating {scene['id']}", flush=True)
            await edge_tts.Communicate(scene["narration"], SPEC["voice"], rate="+4%").save(str(target))


def audio():
    sample_rate = 48000
    duration = sum(s["duration"] for s in SPEC["scenes"])
    track = np.zeros(duration * sample_rate, dtype=np.float64)
    captions, cue, start = [], 1, 0
    for scene in SPEC["scenes"]:
        data = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(OUT / f"voice-{scene['id']}.mp3"), "-f", "f32le", "-ac", "1", "-ar", str(sample_rate), "-"])
        samples = np.frombuffer(data, dtype=np.float32)
        length = len(samples) / sample_rate
        if length > scene["duration"] - .7:
            raise ValueError(f"Narration too long: {scene['id']} ({length:.2f}s). Increase voice rate or shorten script.")
        offset = int((start + .35) * sample_rate)
        track[offset:offset + len(samples)] += samples * .88
        words = scene["narration"].split()
        chunks = [" ".join(words[i:i + 8]) for i in range(0, len(words), 8)]
        cursor = start + .35
        for chunk in chunks:
            end = cursor + length * len(chunk.split()) / len(words)
            captions.append(f"{cue}\n{timestamp(cursor)} --> {timestamp(end)}\n{chunk}\n")
            cursor, cue = end, cue + 1
        start += scene["duration"]
    music = np.zeros_like(track)
    beat = 60 / 104
    chords = [[146.832, 184.997, 220], [110, 138.591, 164.814], [130.813, 164.814, 195.998], [97.999, 123.471, 146.832]]
    for bar_start in np.arange(0, duration, beat * 4):
        chord = chords[int(bar_start / (beat * 4)) % 4]
        n = min(int(beat * 4.7 * sample_rate), len(track) - int(bar_start * sample_rate))
        t = np.arange(n) / sample_rate
        env = np.minimum(t / .4, 1) * np.minimum((n / sample_rate - t) / .8, 1)
        pad = sum(np.sin(2 * np.pi * freq * t) + .18 * np.sin(2 * np.pi * freq * 2 * t) for freq in chord) / 3
        p = int(bar_start * sample_rate)
        music[p:p + n] += .045 * pad * env
    for i, pulse in enumerate(np.arange(0, duration, beat / 2)):
        p = int(pulse * sample_rate)
        n = min(int(.32 * sample_rate), len(track) - p)
        t = np.arange(n) / sample_rate
        freq = chords[(i // 8) % 4][i % 3] * 4
        music[p:p + n] += .032 * np.sin(2 * np.pi * freq * t) * np.exp(-t * 14) * np.minimum(t / .008, 1)
        if i % 2 == 0:
            music[p:p + n] += .045 * np.sin(2 * np.pi * (48 * t + 2.2 * (1 - np.exp(-t * 24)))) * np.exp(-t * 20)
    times = np.arange(len(track)) / sample_rate
    fade = np.clip(times / 2, 0, 1) * np.clip((duration - times) / 3, 0, 1)
    left = track + music * fade
    right = track + (music * .92 + np.roll(music, 480) * .08) * fade
    stereo = np.stack([left, right], axis=1)
    peak = np.max(np.abs(stereo))
    if peak > .95:
        stereo *= .95 / peak
    with wave.open(str(OUT / "mix.wav"), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes((stereo * 32767).astype("<i2").tobytes())
    (OUT / "opsbrain-ai.en.srt").write_text("\n".join(captions), encoding="utf-8")
    run(["ffmpeg", "-y", "-v", "error", "-i", OUT / "mix.wav", "-af", "loudnorm=I=-16:TP=-1.5:LRA=9", "-ar", "48000", OUT / "master.wav"])


def render(preview=False):
    global SHELLS, PANELS
    SHELLS = [frame_shell(i) for i in range(10)]
    PANELS = [build_content(i) for i in range(10)]
    contact = Image.new("RGB", (1920, 1080), BG)
    for i in range(10):
        still = compose(i, 5)
        still.save(OUT / f"scene-{i + 1:02}.jpg", quality=92)
        thumb = still.resize((480, 270), Image.Resampling.LANCZOS)
        contact.paste(thumb, ((i % 4) * 480, (i // 4) * 270))
    contact.save(OUT / "storyboard-contact-sheet.jpg", quality=95)
    compose(0, 5).save(OUT / "youtube-thumbnail.jpg", quality=96)
    if preview:
        return
    fps = SPEC["fps"]
    video = OUT / "picture.mp4"
    command = ["ffmpeg", "-y", "-v", "warning", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(video)]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE)
    try:
        for index, scene in enumerate(SPEC["scenes"]):
            print(f"Rendering scene {index + 1}/10: {scene['id']}", flush=True)
            for frame_index in range(scene["duration"] * fps):
                local = frame_index / fps
                frame = compose(index, local)
                if index > 0 and local < .55:
                    previous = compose(index - 1, SPEC["scenes"][index - 1]["duration"] - .1)
                    frame = Image.blend(previous, frame, ease(local / .55))
                if index == 0 and local < .4:
                    frame = Image.blend(Image.new("RGB", (W, H), BG), frame, ease(local / .4))
                if index == 9 and local > scene["duration"] - .6:
                    frame = Image.blend(frame, Image.new("RGB", (W, H), BG), (local - scene["duration"] + .6) / .6)
                encoder.stdin.write(frame.tobytes())
    finally:
        encoder.stdin.close()
        encoder.wait()
    if encoder.returncode:
        raise RuntimeError("Video encoder failed")
    run(["ffmpeg", "-y", "-v", "warning", "-i", video, "-i", OUT / "master.wav", "-i", OUT / "opsbrain-ai.en.srt", "-map", "0:v", "-map", "1:a", "-map", "2:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-metadata", f"title={SPEC['title']}", "-metadata", "comment=Original OpsBrain AI animation. Illustrative product UI. Synthetic English narration. Original synthesized score.", "-movflags", "+faststart", "-t", "90", OUT / "opsbrain-ai-launch-1080p.mp4"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--skip-voice", action="store_true")
    args = parser.parse_args()
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg is required on PATH")
    OUT.mkdir(exist_ok=True)
    if not args.preview:
        if not args.skip_voice:
            asyncio.run(narration())
        audio()
    render(args.preview)
    print(f"Output: {OUT}", flush=True)


if __name__ == "__main__":
    main()