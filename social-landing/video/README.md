# OpsBrain AI launch film

Original 90-second, 1920×1080, 24 fps product explainer. Editable Python motion source, JSON storyboard, neural English narration, synthesized instrumental score and English subtitle sidecar. This is an original production, not a reproduction of the referenced Operator video.

## Art direction

Inter typography, off-white canvas, restrained violet accents, editorial photography and animated interface compositions. No magic-wand/sparkle imagery, fake testimonials, customer results or autonomous-publishing promises. All nine channels are presented per product-owner confirmation. Analytics are explicitly illustrative. Interface compositions demonstrate workflows; they are not recordings of the live dashboard.

## Reproduce

Requires Python 3.11+, FFmpeg on PATH, and the packages listed in requirements.txt. Run render.py from the isolated environment. The --preview option produces stills without narration or encoding. The --skip-voice option reuses cached narration files. Edit storyboard.json to change copy and voice; delete affected cached voice files after narration changes. The composition assumes ten nine-second scenes and a 90-second master.

The narration step sends the public marketing script to the online Edge TTS service. It contains no account or customer information. Voice availability and service terms may change; verify commercial narration rights before public release. A supplied human narration recording can replace the per-scene audio. No voice cloning is used.

## Deliverables

- output/opsbrain-ai-launch-1080p.mp4: H.264 video, AAC stereo sound, optional embedded English subtitles and fast-start metadata.
- output/opsbrain-ai.en.srt: editable, phrase-timed English captions; review timing before publishing.
- output/youtube-thumbnail.jpg: 1920×1080 cover image.
- output/storyboard-contact-sheet.jpg and ten scene stills: visual review assets.
- output/master.wav: normalized narration and music mix.

Outputs and the local environment are ignored by Git. Keep the MP4 and audio outside the web app's public assets until approved; no application routes or packages are changed.

## Asset rights and release

OpsBrain logo: supplied project asset. Photography: existing local Unsplash samples, with source credits in the public image credits. Inter font: SIL Open Font License, included in assets. The instrumental bed is generated mathematically by render.py, not sampled from the reference or a commercial song. Do not imply the narrator is a real spokesperson. Confirm voice-service rights, brand copy, real product capabilities and production URL before public upload. No claim of guaranteed video quality, performance or rankings is made.