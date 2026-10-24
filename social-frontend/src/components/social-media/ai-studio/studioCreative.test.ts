import { describe, expect, it } from "vitest";
import type { CreativeSetItem, StoredSlide } from "@/types/social-media.types";
import { carouselReady, creativeMedia, creativeResultMessage, mergeCreativeItems } from "./studioCreative";

const slides: StoredSlide[] = ["one", "two", "three"].map((id) => ({ id, headline: id, body: "Copy", imagePrompt: "Artwork" }));
const item = (slideId: string, platform: "linkedin" | "instagram" = "linkedin"): CreativeSetItem => ({ slideId, platform, imageUrl: `https://example.test/${platform}/${slideId}.jpg`, assetId: `${platform}-${slideId}`, blobKey: `social/studio/${platform}/${slideId}.jpg`, width: 1080, height: platform === "instagram" ? 1350 : 1080, mimeType: "image/jpeg" });

describe("coordinated creative exports", () => {
  it("orders media by durable slide IDs and selects only the requested platform", () => {
    const items = [item("three"), item("one", "instagram"), item("one"), item("two")];
    expect(creativeMedia(items, "linkedin", slides)).toEqual(slides.map((slide) => {
      const { platform: _platform, imageUrl, ...media } = item(slide.id);
      return { ...media, url: imageUrl };
    }));
    expect(creativeMedia(items, "instagram", slides)[0].height).toBe(1350);
  });

  it("retains successful exports on partial retry and updates only matching slots", () => {
    const previous = [item("one"), item("two")];
    const merged = mergeCreativeItems(previous, [{ ...item("two"), imageUrl: "https://example.test/refreshed.jpg" }, item("three")]);
    expect(merged).toHaveLength(3);
    expect(merged[0]).toEqual(previous[0]);
    expect(merged[1].imageUrl).toContain("refreshed");
    expect(mergeCreativeItems(previous, [])).toEqual(previous);
  });

  it("requires owned exports for every selected platform and slide, never X or incomplete drafts", () => {
    const items = slides.map((slide) => item(slide.id));
    expect(carouselReady(["linkedin"], slides, items)).toBe(true);
    expect(carouselReady(["linkedin", "instagram"], slides, items)).toBe(false);
    expect(carouselReady(["x"], slides, items)).toBe(false);
    expect(carouselReady(["linkedin"], [], items)).toBe(false);
    expect(carouselReady(["linkedin"], slides, items.slice(1))).toBe(false);
  });

  it("reports processing and partial sets without claiming completion", () => {
    const result = { creativeSetId: "set", status: "partial", items: [], errors: [], warnings: [] };
    expect(creativeResultMessage(result)).toContain("Retry visuals");
    expect(creativeResultMessage({ ...result, status: "processing" })).toContain("still processing");
    expect(creativeResultMessage({ ...result, status: "completed", warnings: ["Layout warning"] })).toBe("Layout warning");
  });
});