import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "@/api/client";
import adminApi from "./admin.api";

vi.mock("@/api/client", () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());

describe("admin AI usage API", () => {
  it("forwards exact UTC scope, grouping, search, kind, sort, pagination and cancellation", async () => {
    const signal = new AbortController().signal;
    const params = { startDate: "2026-10-01", endDate: "2026-10-24", userId: "user", workspaceId: "workspace", groupBy: "model" as const, kind: "image" as const, search: "model [literal]", sort: "count" as const, order: "asc" as const, page: 3, pageSize: 50 };
    const data = { summary: { estimatedKnownCostUsd: 0, totalCostUsd: null }, items: [], total: 101 };
    vi.mocked(apiClient.get).mockResolvedValue({ data });
    expect(await adminApi.getAIUsage(params, signal)).toBe(data);
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/admin/ai-usage", { params, signal });
    expect(apiClient.post).not.toHaveBeenCalled(); expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it("preserves default server filters and propagates failures", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce(new Error("offline"));
    await adminApi.getAIUsage();
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/admin/ai-usage", { params: {}, signal: undefined });
    await expect(adminApi.getAIUsage({ days: 90 })).rejects.toThrow("offline");
  });
});

describe("admin marketing API", () => {
  it("returns camelCase marketing analytics and forwards cancellation", async () => {
    const signal = new AbortController().signal;
    const data = { pageViews30d: 12, contacts30d: 2, daily: [] };
    vi.mocked(apiClient.get).mockResolvedValue({ data });
    expect(await adminApi.getMarketingAnalytics(signal)).toBe(data);
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/admin/marketing-analytics", { signal });
  });

  it("forwards contact filters, pagination and optional AbortSignal", async () => {
    const signal = new AbortController().signal;
    const params = { search: "Ada", status: "in_progress" as const, page: 2, pageSize: 20 };
    const data = { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
    vi.mocked(apiClient.get).mockResolvedValue({ data });
    expect(await adminApi.listContacts(params, signal)).toBe(data);
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/admin/contacts", { params, signal });
  });

  it("uses PATCH with an encoded contact identifier and status payload", async () => {
    const payload = { status: "resolved" as const };
    const data = { id: "id/one", ...payload };
    vi.mocked(apiClient.patch).mockResolvedValue({ data });
    expect(await adminApi.updateContact("id/one", payload)).toBe(data);
    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/admin/contacts/id%2Fone", payload);
  });

  it("propagates request failures rather than returning empty success", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error("Offline"));
    await expect(adminApi.getMarketingAnalytics()).rejects.toThrow("Offline");
    await expect(adminApi.listContacts()).rejects.toThrow("Offline");
  });
});

describe("admin users and workspaces API", () => {
  it("forwards server-side user filters, pagination and cancellation", async () => {
    const signal = new AbortController().signal;
    const params = { search: "Owned workspace", plan: "growth" as const, status: "suspended", page: 3, pageSize: 20 };
    const data = { items: [], total: 41, page: 3, pageSize: 20, totalPages: 3 };
    vi.mocked(apiClient.get).mockResolvedValue({ data });
    expect(await adminApi.listUsers(params, signal)).toBe(data);
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/admin/users", { params, signal });
  });

  it("preserves user creation defaults and supports cancellation", async () => {
    const signal = new AbortController().signal; const payload = { name: "Ada", email: "ada@example.com", password: "long-password" };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: "ada" } });
    await adminApi.createUser(payload, signal);
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/admin/users", { ...payload, workspaceName: undefined, plan: "starter", isPlatformAdmin: false }, { signal });
    await adminApi.createUser({ ...payload, isPlatformAdmin: true, plan: "enterprise" });
    expect(apiClient.post).toHaveBeenLastCalledWith("/api/v1/admin/users", expect.objectContaining({ isPlatformAdmin: true, plan: "enterprise" }), { signal: undefined });
  });

  it("keeps existing user mutation routes and bodies with encoded identifiers", async () => {
    const signal = new AbortController().signal; vi.mocked(apiClient.post).mockResolvedValue({ data: { id: "id/one" } });
    await adminApi.suspendUser("id/one", true, signal); expect(apiClient.post).toHaveBeenLastCalledWith("/api/v1/admin/users/id%2Fone/suspend", { suspended: true }, { signal });
    await adminApi.changeUserPlan("id/one", "growth", signal); expect(apiClient.post).toHaveBeenLastCalledWith("/api/v1/admin/users/id%2Fone/plan", { plan: "growth" }, { signal });
  });

  it("returns the snake_case workspace array without inventing pagination metadata", async () => {
    const signal = new AbortController().signal; const params = { search: "Engines", limit: 21, offset: 20 };
    const data = [{ id: "workspace", name: "Engines", plan: "starter", is_active: true, owner_email: "ada@example.com", member_count: 7, created_at: "2026-10-23" }];
    vi.mocked(apiClient.get).mockResolvedValue({ data }); expect(await adminApi.listWorkspaces(params, signal)).toBe(data);
    expect(apiClient.get).toHaveBeenLastCalledWith("/api/v1/admin/workspaces", { params, signal });
  });

  it("patches workspace plan and status with exact backend bodies and preserves counts", async () => {
    const signal = new AbortController().signal; const data = { id: "id/one", member_count: 23 };
    vi.mocked(apiClient.patch).mockResolvedValue({ data });
    expect(await adminApi.changeWorkspacePlan("id/one", "enterprise", signal)).toBe(data);
    expect(apiClient.patch).toHaveBeenLastCalledWith("/api/v1/admin/workspaces/id%2Fone/plan", { plan: "enterprise" }, { signal });
    expect(await adminApi.changeWorkspaceStatus("id/one", false, signal)).toBe(data);
    expect(apiClient.patch).toHaveBeenLastCalledWith("/api/v1/admin/workspaces/id%2Fone/status", { is_active: false }, { signal });
  });

  it("keeps pricing requests unchanged", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] }); vi.mocked(apiClient.put).mockResolvedValue({ data: {} });
    await adminApi.listPricingPlans(); expect(apiClient.get).toHaveBeenCalledWith("/api/v1/admin/pricing");
    const payload = { priceMonthlyUsd: 10 }; await adminApi.updatePricingPlan("growth", payload);
    expect(apiClient.put).toHaveBeenCalledWith("/api/v1/admin/pricing/growth", payload);
  });

  it("propagates read and mutation failures", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error("offline")); vi.mocked(apiClient.patch).mockRejectedValue(new Error("offline")); vi.mocked(apiClient.post).mockRejectedValue(new Error("offline"));
    await expect(adminApi.listUsers()).rejects.toThrow("offline"); await expect(adminApi.listWorkspaces()).rejects.toThrow("offline");
    await expect(adminApi.changeWorkspacePlan("id", "starter")).rejects.toThrow("offline"); await expect(adminApi.changeWorkspaceStatus("id", true)).rejects.toThrow("offline");
    await expect(adminApi.changeUserPlan("id", "starter")).rejects.toThrow("offline"); await expect(adminApi.suspendUser("id", true)).rejects.toThrow("offline");
  });
});