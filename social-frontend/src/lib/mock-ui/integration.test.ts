import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("mock UI isolation", () => {
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