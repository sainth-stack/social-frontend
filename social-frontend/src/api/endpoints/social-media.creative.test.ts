import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "@/api/client";
import socialMediaApi from "./social-media.api";
import type { GenerateCreativeSetPayload } from "@/types/social-media.types";

vi.mock("@/api/client", () => ({ default: { post: vi.fn(), get: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

describe("creative-set API contract", () => {
  const payload: GenerateCreativeSetPayload = { requestId: "durable-request", topic: "A full coordinated brief ".repeat(50), caption: "Intro caption", platforms: ["linkedin", "instagram"], format: "carousel", textOverlay: false, includeLogo: false, slides: [{ id: "one", headline: "First", body: "Useful copy", imagePrompt: "Editorial" }, { id: "two", headline: "Second", body: "More copy", imagePrompt: "Diagram" }] };

  it("posts the exact full brief and request ID without legacy size/platform transformations", async () => {
    const result = { creativeSetId: "set", status: "partial", items: [{ slideId: "one", platform: "instagram", imageUrl: "https://example.test/one.jpg", assetId: "asset", blobKey: "social/workspace/one.jpg", width: 1080, height: 1350, mimeType: "image/jpeg" }], errors: [{ slideId: "two", platform: "linkedin", message: "Retry" }], warnings: ["Check layout"] };
    vi.mocked(apiClient.post).mockResolvedValue({ data: result });
    expect(await socialMediaApi.generateCreativeSet("workspace", payload)).toEqual(result);
    expect(apiClient.post).toHaveBeenCalledExactlyOnceWith("/api/v1/workspaces/workspace/social/generate-creative-set", payload, { timeout: 600_000 });
    expect(payload.topic.length).toBeGreaterThan(500);
    await socialMediaApi.generateCreativeSet("workspace", payload);
    expect(vi.mocked(apiClient.post).mock.calls[1][1]).toBe(payload);
  });

  it("propagates errors and never retries a paid request with a new ID", async () => {
    const error = new Error("Network failure");
    vi.mocked(apiClient.post).mockRejectedValue(error);
    await expect(socialMediaApi.generateCreativeSet("workspace", payload)).rejects.toBe(error);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });
});