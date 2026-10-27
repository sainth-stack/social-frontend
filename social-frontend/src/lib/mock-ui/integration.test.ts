import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("mock UI isolation", () => {
  it("uploads a real multipart File and imports stock through the API client without network access", async () => {
    vi.stubEnv("NEXT_PUBLIC_MOCK_UI", "true");
    vi.resetModules();
    const { default: client } = await import("@/api/client");
    const network = vi.fn().mockRejectedValue(new Error("Unexpected network request"));
    client.defaults.adapter = network;
    const { data } = await client.post("/api/v1/auth/login", { email: "admin@gmail.com", password: "Test@123" });
    const { persistSession } = await import("@/lib/auth/session");
    persistSession({ accessToken: data.access_token, user: { id: data.user.id, email: data.user.email } as never });
    const { socialMediaApi } = await import("@/api/endpoints/social-media.api");
    const file = new File([new Uint8Array([137, 80, 78, 71, 0, 255])], "clipboard.png", { type: "image/png" });
    const uploaded = await socialMediaApi.uploadImage("mock-workspace", file);
    expect(uploaded.assetId).toBeTruthy();
    const saved = await socialMediaApi.getMediaAsset("mock-workspace", uploaded.assetId!);
    expect(saved).toMatchObject({ url: uploaded.imageUrl, fileSizeBytes: 6, mimeType: "image/png", source: "uploaded" });
    expect((await socialMediaApi.getStockProviders("mock-workspace")).items[0].name).toBe("Pexels demo");
    const stock = await socialMediaApi.searchStock("mock-workspace", { query: "team", mediaType: "image" });
    const imported = await socialMediaApi.importStock("mock-workspace", { provider: "pexels", id: stock.items[0].id, mediaType: "image" });
    expect(await socialMediaApi.getMediaAsset("mock-workspace", imported.id)).toEqual(imported);
    expect(network).not.toHaveBeenCalled();
  });

  it("replaces the API transport and isolates real sessions when enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_MOCK_UI", "true");
    vi.resetModules();
    localStorage.setItem("opsbrain_auth", JSON.stringify({ accessToken: "real-session", user: { email: "real@example.test" } }));
    const { default: client } = await import("@/api/client");
    const network = vi.fn();
    client.defaults.adapter = network;
    const { readSession, persistSession } = await import("@/lib/auth/session");
    expect(readSession()).toBeNull();
    const { data } = await client.post("/api/v1/auth/login", { email: "admin@gmail.com", password: "Test@123" });
    persistSession({ accessToken: data.access_token, user: { id: data.user.id, email: data.user.email } as never });
    expect((await client.get("/api/v1/admin/overview")).status).toBe(200);
    expect(network).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("opsbrain_auth")!).accessToken).toBe("real-session");
    expect(localStorage.getItem("earnedvoice_mock_auth")).toContain("mock-ui-only");
  });

  it("uses the ordinary transport when disabled and rejects demo tokens", async () => {
    vi.stubEnv("NEXT_PUBLIC_MOCK_UI", "false");
    vi.resetModules();
    const { default: client } = await import("@/api/client");
    const network = vi.fn().mockImplementation(async config => ({ data: {}, status: 200, statusText: "OK", headers: {}, config }));
    client.defaults.adapter = network;
    await client.get("/health");
    expect(network).toHaveBeenCalledTimes(1);
    await expect(client.get("/api/v1/admin/overview", { headers: { Authorization: "Bearer mock-ui-only-not-a-real-token" } })).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(network).toHaveBeenCalledTimes(1);
    localStorage.setItem("opsbrain_auth", JSON.stringify({ accessToken: "mock-ui-only-not-a-real-token", user: { email: "admin@gmail.com" } }));
    expect((await import("@/lib/auth/session")).readSession()).toBeNull();
  });
});