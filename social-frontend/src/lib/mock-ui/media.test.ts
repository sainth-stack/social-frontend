import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_ACCESS_TOKEN } from "./config";

const base = "/api/v1/workspaces/mock-workspace/social";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";

async function demo() {
  const { mockAdapter } = await import("./adapter");
  return axios.create({ adapter: mockAdapter, headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` } });
}

function form(file: File) {
  const body = new FormData();
  body.append("file", file);
  return body;
}

function image() {
  return new File([Uint8Array.from(atob(png), char => char.charCodeAt(0))], "pasted.png", { type: "image/png" });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = undefined as unknown as typeof URL.createObjectURL;
    static revokeObjectURL = vi.fn();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("offline media adapter", () => {
  it("keeps actual multipart image bytes in the explicit data URL fallback and shared library", async () => {
    const client = await demo();
    const file = image();
    const uploaded = (await client.post(`${base}/upload-image`, form(file))).data;
    expect(uploaded).toMatchObject({ imageUrl: `data:image/png;base64,${png}`, source: "uploaded", assetId: expect.any(String) });
    expect(Uint8Array.from(atob(uploaded.imageUrl.split(",")[1]), char => char.charCodeAt(0))).toEqual(Uint8Array.from(atob(png), char => char.charCodeAt(0)));
    const saved = (await client.get(`${base}/media-assets/${uploaded.assetId}`)).data;
    expect(saved).toMatchObject({ id: uploaded.assetId, url: uploaded.imageUrl, mimeType: file.type, fileSizeBytes: file.size, mediaType: "image" });
    const library = (await client.get(`${base}/media-assets`, { params: { search: "pasted.png", source: "uploaded", mediaType: "image" } })).data;
    expect(library.items).toEqual([saved]);
    expect(library.stats).toEqual({ images: 9, videos: 0, totalBytes: file.size });
    await client.delete(`${base}/media-assets/${saved.id}`);
    await expect(client.get(`${base}/media-assets/${saved.id}`)).rejects.toMatchObject({ response: { status: 400 } });
  });

  it("uses browser object URLs with the original File rather than an empty copied object", async () => {
    const create = vi.fn().mockReturnValue("blob:http://localhost/offline-preview");
    URL.createObjectURL = create;
    const file = image();
    const client = await demo();
    const uploaded = (await client.post(`${base}/upload-image`, form(file))).data;
    expect(create).toHaveBeenCalledOnce();
    const source = create.mock.calls[0][0];
    expect(source).toBeInstanceOf(File);
    expect(source.size).toBe(file.size);
    expect(source.type).toBe(file.type);
    expect((await client.get(`${base}/media-assets/${uploaded.assetId}`)).data.url).toBe("blob:http://localhost/offline-preview");
  });

  it.each(["video/mp4", "video/webm"])("keeps %s uploads as draft-only library assets without generating video", async mimeType => {
    const client = await demo();
    const file = new File([new Uint8Array([0, 1, 2, 255])], `clip.${mimeType.split("/")[1]}`, { type: mimeType });
    const uploaded = (await client.post(`${base}/upload-video`, form(file))).data;
    expect(uploaded.videoUrl).toBe(`data:${mimeType};base64,AAEC/w==`);
    expect((await client.get(`${base}/media-assets/${uploaded.assetId}`)).data).toMatchObject({ mediaType: "video", durationSeconds: null, soraVideoId: null, prompt: expect.stringContaining("draft-only"), fileSizeBytes: 4 });
    await expect(client.post(`${base}/generate-video`, form(file))).rejects.toMatchObject({ response: { status: 400, data: { detail: expect.stringContaining("video generation are disabled") } } });
  });

  it.each(["image/jpeg", "image/webp"])("accepts supported %s uploads", async type => {
    const client = await demo();
    const file = new File([new Uint8Array([1, 2, 3])], "sample", { type });
    const result = (await client.post(`${base}/upload-image`, form(file))).data;
    expect((await client.get(`${base}/media-assets/${result.assetId}`)).data.mimeType).toBe(type);
  });

  it.each([
    { route: "image", type: "image/gif", size: 10 },
    { route: "image", type: "image/svg+xml", size: 10 },
    { route: "image", type: "video/mp4", size: 10 },
    { route: "video", type: "image/png", size: 10 },
    { route: "video", type: "video/quicktime", size: 10 },
    { route: "image", type: "image/png", size: 0 },
    { route: "video", type: "video/webm", size: 0 },
    { route: "image", type: "image/png", size: 8 * 1024 * 1024 + 1 },
    { route: "video", type: "video/mp4", size: 50 * 1024 * 1024 + 1 },
  ])("rejects invalid $route uploads ($type, $size bytes) before reading", async ({ route, type, size }) => {
    const client = await demo();
    const file = new File(["x"], "invalid", { type });
    Object.defineProperty(file, "size", { value: size });
    const create = vi.fn();
    URL.createObjectURL = create;
    await expect(client.post(`${base}/upload-${route}`, form(file))).rejects.toMatchObject({ response: { status: 400 } });
    expect(create).not.toHaveBeenCalled();
    expect((await client.get(`${base}/media-assets`)).data.total).toBe(8);
  });

  it.each([{ route: "image", type: "image/png", limit: 8 }, { route: "video", type: "video/mp4", limit: 50 }])("accepts the exact $limit MiB $route limit", async ({ route, type, limit }) => {
    const client = await demo();
    URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/boundary");
    const file = new File(["x"], "boundary", { type });
    Object.defineProperty(file, "size", { value: limit * 1024 * 1024 });
    const result = (await client.post(`${base}/upload-${route}`, form(file))).data;
    expect((await client.get(`${base}/media-assets/${result.assetId}`)).data.fileSizeBytes).toBe(limit * 1024 * 1024);
  });

  it("rejects missing files, JSON file impostors, foreign workspaces and unauthenticated uploads", async () => {
    const client = await demo();
    for (const body of [new FormData(), { file: { type: "image/png", size: 10 } }, { file: "https://example.test/image.png" }]) {
      await expect(client.post(`${base}/upload-image`, body)).rejects.toMatchObject({ response: { status: 400 } });
    }
    await expect(client.post(base.replace("mock-workspace", "foreign") + "/upload-image", form(image()))).rejects.toMatchObject({ response: { status: 501 } });
    await expect(client.post(`${base}/upload-image`, form(image()), { headers: { Authorization: "Bearer real-token" } })).rejects.toMatchObject({ response: { status: 401 } });
    expect((await client.get(`${base}/media-assets`)).data.total).toBe(8);
  });

  it("does not register canceled uploads during asynchronous file reading", async () => {
    const client = await demo();
    const controller = new AbortController();
    const pending = client.post(`${base}/upload-image`, form(image()), { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect((await client.get(`${base}/media-assets`)).data.total).toBe(8);
  });

  it("removes uploaded assets on a fresh module load (browser refresh)", async () => {
    const client = await demo();
    const result = (await client.post(`${base}/upload-image`, form(image()))).data;
    vi.resetModules();
    const refreshed = await demo();
    expect((await refreshed.get(`${base}/media-assets`)).data.total).toBe(8);
    await expect(refreshed.get(`${base}/media-assets/${result.assetId}`)).rejects.toMatchObject({ response: { status: 400 } });
  });
});

describe("offline stock adapter", () => {
  it("advertises the offline provider and returns paginated local image fixtures with honest attribution", async () => {
    const client = await demo();
    expect((await client.get(`${base}/stock/providers`)).data).toEqual({ items: [{ id: "pexels", name: "Pexels demo", available: true, mediaTypes: ["image", "video"], reason: "Offline sample results; no provider request." }] });
    const result = (await client.get(`${base}/stock/search`, { params: { query: "team", mediaType: "image", pageSize: 1 } })).data;
    expect(result).toMatchObject({ page: 1, pageSize: 1, hasMore: false, items: [{ previewUrl: "/mock-ui/sample.svg", thumbnailUrl: "/mock-ui/sample.svg", creatorName: "Offline demo artwork", creatorUrl: "", providerPageUrl: "https://www.pexels.com/", attributionText: expect.stringContaining("not a Pexels photograph") }] });
    expect((await client.get(`${base}/stock/search`, { params: { query: "team", mediaType: "image", page: 2 } })).data.items).toEqual([]);
    expect((await client.get(`${base}/stock/search`, { params: { query: "team", mediaType: "video" } })).data.items).toEqual([]);
  });

  it("imports only canned stock IDs into the same owned media registry and resets on refresh", async () => {
    const client = await demo();
    const payload = { provider: "pexels", id: "offline-demo-artwork", mediaType: "image" };
    const asset = (await client.post(`${base}/stock/import`, payload)).data;
    expect(asset).toMatchObject({ source: "uploaded", mediaType: "image", url: "/mock-ui/sample.svg", mimeType: "image/svg+xml", provenance: { provider: "pexels", providerAssetId: payload.id, creatorName: "Offline demo artwork", attributionText: expect.stringContaining("local sample") } });
    expect((await client.get(`${base}/media-assets/${asset.id}`)).data).toEqual(asset);
    expect((await client.get(`${base}/media-assets`, { params: { search: "Offline demo artwork" } })).data.items).toEqual([asset]);
    for (const input of [{ ...payload, id: "https://example.test/file" }, { ...payload, mediaType: "video" }, { ...payload, provider: "other" }]) {
      await expect(client.post(`${base}/stock/import`, input)).rejects.toMatchObject({ response: { status: 400 } });
    }
    vi.resetModules();
    await expect((await demo()).get(`${base}/media-assets/${asset.id}`)).rejects.toMatchObject({ response: { status: 400 } });
  });

  it.each([{ mediaType: "audio", query: "team" }, { mediaType: "image", query: " " }, { mediaType: "image", query: "team", page: 0 }, { mediaType: "image", query: "team", pageSize: 81 }])("rejects invalid stock search parameters %j", async params => {
    await expect((await demo()).get(`${base}/stock/search`, { params })).rejects.toMatchObject({ response: { status: 400 } });
  });

  it.each(["upload", "stock"])("attaches an owned %s image to a planner draft through media-assets lookup", async source => {
    const client = await demo();
    const assetId = source === "upload"
      ? (await client.post(`${base}/upload-image`, form(image()))).data.assetId
      : (await client.post(`${base}/stock/import`, { provider: "pexels", id: "offline-demo-artwork", mediaType: "image" })).data.id;
    const selection = { timezone: "UTC", dates: ["2099-01-03"], platforms: ["linkedin"], accountIds: { linkedin: "mock-demo-account-linkedin" }, overrides: [] };
    const preview = (await client.post(`${base}/content-plan/slots/preview`, selection)).data;
    const run = (await client.post(`${base}/content-plan/runs`, { ...selection, previewToken: preview.previewToken, requestId: `media-${source}`, prompt: "An offline media attachment test", excludedSlotIds: [] })).data;
    const item = run.items[0];
    const path = `${base}/content-plan/runs/${run.id}/items/${item.id}`;
    await client.post(`${path}/approve-copy`, { expectedRevision: item.revision });
    const attached = (await client.post(`${path}/image-asset`, { expectedRevision: item.revision, assetId })).data;
    expect(attached).toMatchObject({ visualState: "ready", imageIntent: "required", post: { imageSource: "uploaded", imageUrl: (await client.get(`${base}/media-assets/${assetId}`)).data.url } });
  });
});