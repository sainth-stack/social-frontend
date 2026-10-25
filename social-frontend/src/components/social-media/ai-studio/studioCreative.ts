import type { CreativeSetItem, GenerateCreativeSetResult, SocialPlatform, SocialPostMedia, StoredSlide } from "@/types/social-media.types";

export function copyFingerprint(value: unknown): string {
  const canonical = (input: unknown): unknown => Array.isArray(input)
    ? input.map(canonical)
    : input && typeof input === "object"
      ? Object.fromEntries(Object.entries(input).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]))
      : input;
  return JSON.stringify({ version: 1, content: canonical(value) });
}

export function approvedCaptionContext(platforms: { platform: SocialPlatform; caption: string; hashtags: string[] }[]): string {
  return platforms.map(({ platform, caption, hashtags }) => `${platform}:\n${caption}${hashtags.length ? `\n${hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ")}` : ""}`).join("\n\n");
}

export function creativeMedia(items: CreativeSetItem[], platform: SocialPlatform, slides?: StoredSlide[] | null): SocialPostMedia[] {
  const selected = items.filter((item) => item.platform === platform);
  const ordered = slides?.length ? slides.flatMap((slide) => selected.filter((item) => item.slideId === slide.id)) : selected;
  return ordered.map(({ imageUrl, platform: _platform, ...item }) => ({ ...item, url: imageUrl }));
}

export function mergeCreativeItems(previous: CreativeSetItem[], incoming: CreativeSetItem[]): CreativeSetItem[] {
  const items = new Map(previous.map((item) => [`${item.platform}:${item.slideId}`, item]));
  incoming.forEach((item) => items.set(`${item.platform}:${item.slideId}`, item));
  return [...items.values()];
}

export function creativeResultMessage(result: GenerateCreativeSetResult): string | null {
  if (result.status === "processing") return "This creative set is still processing. Check again using Retry visuals; do not start another set.";
  if (result.status !== "completed") return "Some visuals are missing. Retry visuals reuses this request and saved artwork.";
  return result.warnings.length ? result.warnings.join(" ") : null;
}

export function carouselReady(platforms: SocialPlatform[], slides: StoredSlide[] | null | undefined, items: CreativeSetItem[]): boolean {
  return Boolean(slides && slides.length >= 2 && slides.length <= 8 && platforms.length && platforms.every((platform) => platform !== "x" && slides.every((slide) => items.some((item) => item.platform === platform && item.slideId === slide.id && item.imageUrl && (item.assetId || item.blobKey)))));
}