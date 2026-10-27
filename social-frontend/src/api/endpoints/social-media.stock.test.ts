import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "@/api/client";
import socialMediaApi from "./social-media.api";
import type { MediaAsset, StockProvider, StockSearchResponse } from "@/types/social-media.types";

vi.mock("@/api/client", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/lib/auth/session", () => ({ getStoredAccessToken: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

describe("stock media API contract", () => {
  it.each([true, false])("preserves the provider items envelope when available=%s", async available => {
    const result: { items: StockProvider[] } = { items: [{ id: "pexels", name: "Pexels", available, mediaTypes: ["image", "video"], reason: available ? null : "missing_api_key" }] };
    const controller = new AbortController();
    vi.mocked(apiClient.get).mockResolvedValue({ data: result });

    expect(await socialMediaApi.getStockProviders("workspace", controller.signal)).toBe(result);
    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith("/api/v1/workspaces/workspace/social/stock/providers", { signal: controller.signal });
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("preserves an empty provider envelope without fabricating a provider", async () => {
    const result = { items: [] };
    vi.mocked(apiClient.get).mockResolvedValue({ data: result });

    expect(await socialMediaApi.getStockProviders("other-workspace")).toBe(result);
    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith("/api/v1/workspaces/other-workspace/social/stock/providers", { signal: undefined });
  });

  it.each(["image", "video"] as const)("forwards abortable %s search parameters and preserves pagination and attribution", async mediaType => {
    const controller = new AbortController();
    const params = { query: "forest & lakes", mediaType, page: 2, pageSize: 12 };
    const result: StockSearchResponse = {
      items: [{ id: "provider-asset", provider: "pexels", mediaType, previewUrl: "https://media.example/preview", thumbnailUrl: "https://media.example/thumbnail.jpg", width: 1200, height: 800, durationSeconds: mediaType === "video" ? 8 : null, creatorName: "Alex", creatorUrl: "https://www.pexels.com/@alex/", providerPageUrl: "https://www.pexels.com/photo/1/", licenseUrl: "https://www.pexels.com/license/", attributionText: "Media by Alex on Pexels" }],
      page: 2, pageSize: 12, hasMore: true,
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: result });

    expect(await socialMediaApi.searchStock("workspace", params, controller.signal)).toBe(result);
    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith("/api/v1/workspaces/workspace/social/stock/search", { params, signal: controller.signal });
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it.each(["image", "video"] as const)("imports %s by provider ID and returns the direct canonical MediaAsset", async mediaType => {
    const payload = { provider: "pexels" as const, id: "provider-asset", mediaType };
    const result: MediaAsset = {
      id: "saved-asset", mediaType, source: "uploaded", url: "https://media.example/saved", mimeType: mediaType === "image" ? "image/jpeg" : "video/mp4", fileSizeBytes: 1200, createdAt: "2026-10-27T00:00:00Z",
      provenance: { provider: "pexels", providerAssetId: payload.id, providerPageUrl: "https://www.pexels.com/photo/1/", creatorName: "Alex", creatorUrl: "https://www.pexels.com/@alex/", licenseUrl: "https://www.pexels.com/license/", attributionText: "Media by Alex on Pexels" },
    };
    vi.mocked(apiClient.post).mockResolvedValue({ data: result });

    expect(await socialMediaApi.importStock("other-workspace", payload)).toBe(result);
    expect(apiClient.post).toHaveBeenCalledExactlyOnceWith("/api/v1/workspaces/other-workspace/social/stock/import", payload, { timeout: 120_000 });
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it.each(["providers", "search", "import"] as const)("propagates %s failures without retries or placeholder results", async operation => {
    const error = new Error("Stock provider unavailable");
    vi.mocked(apiClient.get).mockRejectedValue(error);
    vi.mocked(apiClient.post).mockRejectedValue(error);

    const request = operation === "providers" ? socialMediaApi.getStockProviders("workspace")
      : operation === "search" ? socialMediaApi.searchStock("workspace", { query: "forest", mediaType: "image" })
        : socialMediaApi.importStock("workspace", { provider: "pexels", id: "provider-asset", mediaType: "image" });

    await expect(request).rejects.toBe(error);
    expect(apiClient.get).toHaveBeenCalledTimes(operation === "import" ? 0 : 1);
    expect(apiClient.post).toHaveBeenCalledTimes(operation === "import" ? 1 : 0);
  });
});