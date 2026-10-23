import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ token: "settings-user", get: vi.fn(), put: vi.fn() }));
vi.mock("@/api/client", () => ({ default: { get: mocks.get, put: mocks.put } }));
vi.mock("@/lib/auth/session", () => ({ getStoredAccessToken: () => mocks.token }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); mocks.token = "settings-user"; });
async function api() { return (await import("./social-media.api")).default; }

describe("settings read cache", () => {
  it("deduplicates reads across settings sections and expires", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    mocks.get.mockResolvedValue({ data: { timezone: "UTC" } });
    const client = await api();
    const [a, b] = await Promise.all([client.getSettings("workspace"), client.getSettings("workspace")]);
    expect(a).toBe(b);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    await client.getSettings("workspace");
    expect(mocks.get).toHaveBeenCalledTimes(1);
    now.mockReturnValue(32000);
    await client.getSettings("workspace");
    expect(mocks.get).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });
  it("isolates workspaces and sessions", async () => {
    mocks.get.mockResolvedValue({ data: { timezone: "UTC" } });
    const client = await api();
    await client.getSettings("first"); await client.getSettings("second");
    mocks.token = "other-user";
    await client.getSettings("first");
    expect(mocks.get).toHaveBeenCalledTimes(3);
  });
  it("evicts failures and supports explicit retry", async () => {
    mocks.get.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue({ data: { timezone: "UTC" } });
    const client = await api();
    await expect(client.getSettings("workspace")).rejects.toThrow("Offline");
    await client.getSettings("workspace");
    await client.getSettings("workspace", { force: true });
    expect(mocks.get).toHaveBeenCalledTimes(3);
  });
  it("seeds successful saves instead of fetching again", async () => {
    mocks.get.mockResolvedValue({ data: { timezone: "UTC" } });
    mocks.put.mockResolvedValue({ data: { timezone: "Asia/Tokyo" } });
    const client = await api();
    await client.getSettings("workspace");
    await client.saveSettings("workspace", { timezone: "Asia/Tokyo" });
    expect(await client.getSettings("workspace")).toEqual({ timezone: "Asia/Tokyo" });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });
  it("does not cache a late old-session mutation", async () => {
    let finish!: (data: unknown) => void;
    mocks.get.mockResolvedValue({ data: { timezone: "UTC" } });
    mocks.put.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const client = await api();
    await client.getSettings("workspace");
    const pending = client.saveSettings("workspace", { timezone: "Asia/Tokyo" });
    mocks.token = "new-user";
    await client.getSettings("workspace");
    finish({ data: { timezone: "Asia/Tokyo" } });
    await pending;
    expect(await client.getSettings("workspace")).toEqual({ timezone: "UTC" });
  });
  it("does not let old in-flight reads overwrite a saved value", async () => {
    let finish!: (data: unknown) => void;
    mocks.get.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    mocks.put.mockResolvedValue({ data: { timezone: "Asia/Tokyo" } });
    const client = await api();
    const pending = client.getSettings("workspace");
    await client.saveSettings("workspace", { timezone: "Asia/Tokyo" });
    finish({ data: { timezone: "UTC" } }); await pending;
    expect(await client.getSettings("workspace")).toEqual({ timezone: "Asia/Tokyo" });
  });
});