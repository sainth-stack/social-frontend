import type { StockMediaItem, StockProvider, StockSearchResponse } from "../../types/social-media.types";
import { addMockMediaAsset } from "./social";

const provider: StockProvider = { id: "pexels", name: "Pexels demo", available: true, mediaTypes: ["image", "video"], reason: "Offline sample results; no provider request." };
const artwork: StockMediaItem = {
  id: "offline-demo-artwork", provider: "pexels", mediaType: "image", previewUrl: "/mock-ui/sample.svg", thumbnailUrl: "/mock-ui/sample.svg",
  width: 1080, height: 1080, durationSeconds: null, creatorName: "Offline demo artwork", creatorUrl: "",
  providerPageUrl: "https://www.pexels.com/", licenseUrl: "https://www.pexels.com/license/",
  attributionText: "Offline demo artwork — local sample, not a Pexels photograph. Pexels links are informational only; no provider request.",
};

function pageNumber(value: string | undefined, fallback: number, maximum: number): number {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) throw new Error("Mock UI: invalid stock pagination.");
  return number;
}

export function handleStockMock(path: string, method: string, params: Record<string, string>, body: Record<string, unknown>): unknown | undefined {
  const prefix = "/api/v1/workspaces/mock-workspace/social/stock/";
  if (!path.startsWith(prefix)) return undefined;
  const route = path.slice(prefix.length);
  if (route === "providers" && method === "GET") return { items: [provider] };
  if (route === "search" && method === "GET") {
    if (!["image", "video"].includes(params.mediaType)) throw new Error("Mock UI: choose image or video stock.");
    if (!params.query?.trim() || params.query.length > 200) throw new Error("Mock UI: enter a stock query up to 200 characters.");
    const page = pageNumber(params.page, 1, 1000000);
    const pageSize = pageNumber(params.pageSize, 12, 80);
    const result: StockSearchResponse = { items: params.mediaType === "image" && page === 1 ? [artwork] : [], page, pageSize, hasMore: false };
    return result;
  }
  if (route === "import" && method === "POST") {
    if (body.provider !== "pexels" || body.id !== artwork.id || body.mediaType !== "image") throw new Error("Mock UI: choose the offline sample image. No stock videos are bundled; upload MP4 or WebM for a draft-only video.");
    return addMockMediaAsset({ mediaType: "image", source: "uploaded", url: artwork.previewUrl, mimeType: "image/svg+xml", fileSizeBytes: 0,
      prompt: "Offline demo artwork: local stock sample, not downloaded from Pexels.", durationSeconds: null, soraVideoId: null, postId: null,
      provenance: { provider: "pexels", providerAssetId: artwork.id, providerPageUrl: artwork.providerPageUrl, creatorName: artwork.creatorName,
        creatorUrl: artwork.creatorUrl, licenseUrl: artwork.licenseUrl, attributionText: artwork.attributionText } });
  }
  return undefined;
}