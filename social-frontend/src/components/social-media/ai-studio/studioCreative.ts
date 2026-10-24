import type { CreativeSetItem, GenerateCreativeSetResult, SocialPlatform, SocialPostMedia, StoredSlide } from "@/types/social-media.types";

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