# EarnedVoice product film

## Deliverables

- [1080p MP4](output/earnedvoice-product-film-1080p.mp4): 60 seconds, 1920 × 1080, 60 fps, H.264 / AAC stereo, web-optimized fast start.
- [Preview player](index.html): responsive player with controls, optional English captions, transcript and downloads. Serve over HTTP to load captions reliably.
- [English captions](output/earnedvoice-captions.vtt): timed descriptions of the film's on-screen story; there is no spoken narration.
- [Poster](output/earnedvoice-poster.jpg).
- [Scene manifest](output/scene-manifest.json): timing and caption copy.
- [Editable renderer](render.mjs): original SVG artwork, layered motion, cursor animation, crossfades and procedural instrumental soundtrack.

## Reference analysis

The supplied Hyvo reference is 60 seconds, 1920 × 1080, 60 fps, H.264 with stereo AAC audio. Representative frames at five-second intervals show this visual sequence:

| Approximate time | Observed content |
| --- | --- |
| 0 s | Brand mark with floating social-platform symbols |
| 5 s | Floating, perspective-framed account connection interface |
| 10 s | Brand voice and network-specific writing preferences |
| 15–20 s | Composer and AI-assisted draft editing |
| 25 s | Content calendar |
| 30 s | Media and publishing cards |
| 35 s | Analytics chart and metric cards |
| 40–45 s | Conversational analytics input and response |
| 50 s | Consolidated create/publish/calendar/analytics composition |
| 55 s | Brand closing with surrounding platform symbols |

Its visual vocabulary is pale gradients, floating white software panels, soft shadows and a product-led story. The sampled frames show no on-camera presenter. Audio-stream presence and signal levels were checked; the reference's narration or musical content was not transcribed or audibly reviewed. No source footage, text, logo or audio was reused.

## EarnedVoice adaptation

The revised film follows the reference's feature-led montage rather than a step-by-step tutorial. Larger centered floating software panels use the ivory/burnt-orange identity and Ascent mark. There are no workflow gates or confirmation dialogs in the film:

1. Give your expertise a voice.
2. Connect available social channels.
3. Set business, audience and brand voice.
4. Create AI-assisted channel copy.
5. Show writing and live preview.
6. See posts in the calendar.
7. Explore media and brand assets.
8. View scheduled posts.
9. Explore engagement and channel reporting.
10. Compare supported channel metrics.
11. Bring the features together in one workspace.
12. Close with the free-plan call to action.

The illustrations are not pixel-identical screen recordings. They intentionally simplify the app for readability and are labelled illustrative. Northstar is fictional. Only currently available Instagram, Facebook and LinkedIn integrations are depicted. No customer metrics, testimonials, guaranteed growth or autonomous-publishing claims are included. The analytics curve is explicitly labelled illustrative, without numerical performance values; the channel table uses dashes instead of invented metrics. Scheduled posts are not proof of delivery. The film omits conversational analytics because that reference feature is not verified for EarnedVoice. Actual application behavior is unchanged.

The instrumental music is synthesized locally from an original chord/arpeggio arrangement. It contains no samples or third-party recordings. No voice cloning, external AI service, paid generation, production mutation or live social publishing was used.

## Reproduction

Requirements: Node.js, the repository's existing `sharp` installation, and `ffmpeg` / `ffprobe` on PATH. No new dependencies are needed.

From the monorepo directory, run `node video/earnedvoice/render.mjs`. Add `--artwork-only` to produce artwork without encoding. All scene clips are rebuilt on every full render to avoid stale artwork. Edit `feature-scenes.mjs` for scene content and timing. Temporary SVG/PNG frames, uncompressed soundtrack and intermediate clips are in the ignored `.render/` directory.

For the standalone preview, run `node video/earnedvoice/serve.mjs` and open http://127.0.0.1:3038/. The local-only server supports byte ranges for seeking and the correct WebVTT MIME type. Set `VIDEO_PORT` to choose another port.

The renderer generates 12 scene clips, composes a 60-second timeline with half-second crossfades, normalizes the original soundtrack, encodes the final MP4 and prints media metadata. It does not modify the landing page or dashboard.

## Verification

- All 3,600 final frames decoded successfully with no reported decode errors.
- Metadata confirms exactly 60 seconds, 1920 × 1080, 60 fps, H.264 and 48 kHz stereo AAC.
- Automated black-gap scan reported no intervals of at least 0.25 seconds.
- Audio peak measured approximately −6.6 dBFS with no clipping; audio quality still merits a human listening pass before public release.
- Export contact sheet and a full-size review scene inspected for layout and text problems.
- Browser playback, seeking, metadata and caption loading checked in the local preview.

Before public release, watch the complete film with sound and check the simplified representations, current free-plan call to action and any desired website destination. No website embed or product redesign was applied.