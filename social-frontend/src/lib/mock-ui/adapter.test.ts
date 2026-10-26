import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_ACCESS_TOKEN } from "./config";

async function demo() {
  const { mockAdapter } = await import("./adapter");
  return axios.create({ adapter: mockAdapter, headers: { Authorization: `Bearer ${MOCK_ACCESS_TOKEN}` } });
}

const social = "/api/v1/workspaces/mock-workspace/social";
beforeEach(() => vi.resetModules());

describe("offline mock UI", () => {
  it("authenticates only the documented demo credentials", async () => {
    const client = await demo();
    const login = await client.post("/api/v1/auth/login", { email: "admin@gmail.com", password: "Test@123" });
    expect(login.data).toMatchObject({ access_token: MOCK_ACCESS_TOKEN, user: { id: "mock-admin", is_platform_admin: true }, workspaces: [{ id: "mock-workspace", plan: "enterprise" }] });
    await expect(client.post("/api/v1/auth/login", { email: "admin@gmail.com", password: "wrong" })).rejects.toMatchObject({ response: { status: 401 } });
    await expect(client.get("/api/v1/auth/me", { headers: { Authorization: "Bearer real-token" } })).rejects.toMatchObject({ response: { status: 401 } });
  });

  it("returns complete typed screen fixtures without network calls", async () => {
    const client = await demo();
    expect((await client.get(`${social}/dashboard/home`)).data.stats.connectedAccounts).toBe(3);
    expect((await client.get(`${social}/accounts`)).data.items).toHaveLength(3);
    expect((await client.get(`${social}/brand-voice`)).data.brandName).toContain("Demo");
    expect((await client.get(`${social}/media-assets`)).data.stats.images).toBeGreaterThan(0);
    expect((await client.get(`${social}/templates`)).data.length).toBeGreaterThan(0);
    expect((await client.get(`${social}/settings`)).data.timezone).toBeTruthy();
    expect((await client.get(`${social}/analytics/overview`)).data.metrics.totalReach).toBeGreaterThan(0);
    expect((await client.get("/api/v1/admin/users", { params: { page: 2, pageSize: 5 } })).data).toMatchObject({ page: 2, pageSize: 5 });
    expect((await client.get("/api/v1/admin/workspaces")).data.length).toBeGreaterThan(0);
    expect((await client.get("/api/v1/admin/ai-usage")).data.summary).toBeTruthy();
    expect((await client.get("/api/v1/workspaces/mock-workspace/billing/plans")).data.length).toBeGreaterThan(0);
  });

  it("supports local edits and resets demo state with a fresh module", async () => {
    const client = await demo();
    const original = (await client.get(`${social}/brand-voice`)).data.brandName;
    await client.put(`${social}/brand-voice`, { brandName: "Demo edited brand" });
    expect((await client.get(`${social}/brand-voice`)).data.brandName).toBe("Demo edited brand");
    vi.resetModules();
    expect((await (await demo()).get(`${social}/brand-voice`)).data.brandName).toBe(original);
  });

  it("generates canned copy and keeps post changes local", async () => {
    const client = await demo();
    const generated = (await client.post(`${social}/generate`, { topic: "Customer onboarding", platforms: ["linkedin"], format: "single" })).data;
    expect(JSON.stringify(generated)).toContain("Demo");
    const posts = (await client.get(`${social}/posts`, { params: { status: "draft" } })).data.items;
    const duplicate = (await client.post(`${social}/posts/${posts[0].id}/duplicate`)).data;
    expect(duplicate.id).not.toBe(posts[0].id);
    await client.delete(`${social}/posts/${duplicate.id}`);
    await expect(client.get(`${social}/posts/${duplicate.id}`)).rejects.toMatchObject({ response: { status: 400 } });
  });

  it.each([
    ["/api/v1/workspaces/mock-workspace/billing/checkout", "POST"],
    [`${social}/oauth/linkedin/url`, "GET"],
    [`${social}/generate-video`, "POST"],
    ["/api/v1/auth/register", "POST"],
  ])("blocks external or unsupported effects: %s", async (url, method) => {
    await expect((await demo()).request({ url, method })).rejects.toMatchObject({ response: { status: expect.any(Number), data: { detail: expect.stringContaining("Mock UI") } } });
  });

  it("fails closed for unknown routes and honors cancellation", async () => {
    const client = await demo();
    await expect(client.get("https://real-backend.invalid/unknown")).rejects.toMatchObject({ response: { status: 501 } });
    const controller = new AbortController();
    controller.abort();
    await expect(client.get(`${social}/posts`, { signal: controller.signal })).rejects.toMatchObject({ code: "ERR_CANCELED" });
  });
});