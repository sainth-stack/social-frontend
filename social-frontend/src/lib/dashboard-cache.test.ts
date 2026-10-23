import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { getStoredAccessToken } from "@/lib/auth/session";
import {
  clearDashboardCache,
  fetchDashboardHomeCached,
  fetchDashboardUsageCached,
  getCachedDashboardHome,
  getCachedDashboardUsage,
  invalidateDashboardCache,
  isDashboardHomeFresh,
  prefetchDashboardHome,
  type DashboardHomePayload,
  type DashboardUsage,
} from "./dashboard-cache";

vi.mock("@/api/client", () => ({
  default: { interceptors: { response: { use: vi.fn() } } },
}));

vi.mock("@/api/endpoints/social-media.api", () => ({
  default: { getDashboardHome: vi.fn(), getUsage: vi.fn() },
}));

vi.mock("@/lib/auth/session", () => ({ getStoredAccessToken: vi.fn() }));

const workspace = "shared-workspace";
let token: string | null;
const getHome = vi.mocked(socialMediaApi.getDashboardHome);
const getUsage = vi.mocked(socialMediaApi.getUsage);

function usage(plan: string): DashboardUsage {
  return {
    plan,
    accounts: { used: 1, limit: 5 },
    postsThisMonth: { used: 2, limit: 20 },
    templates: { used: 0, limit: null },
    approvalWorkflow: false,
    brandVoice: true,
  };
}

function home(plan: string): DashboardHomePayload {
  return {
    stats: {
      connectedAccounts: 1,
      expiredAccounts: 0,
      postsThisWeek: 2,
      totalReach: 100,
      avgEngagementRate: 1,
      usage: usage(plan),
      accounts: [],
    },
    activity: [],
    recommendations: [],
    scheduledPosts: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  token = "session-a";
  vi.mocked(getStoredAccessToken).mockImplementation(() => token);
  clearDashboardCache();
  getHome.mockReset().mockResolvedValue(home("default"));
  getUsage.mockReset().mockResolvedValue(usage("default"));
});

afterEach(() => {
  clearDashboardCache();
  vi.useRealTimers();
});

describe("session-scoped dashboard caches", () => {
  const accessors: Array<[string, () => unknown]> = [
    ["home lookup", () => getCachedDashboardHome(workspace)],
    ["home freshness", () => isDashboardHomeFresh(workspace)],
    ["usage lookup", () => getCachedDashboardUsage(workspace)],
    ["home fetch", () => fetchDashboardHomeCached(workspace)],
    ["usage fetch", () => fetchDashboardUsageCached(workspace)],
    ["prefetch", () => prefetchDashboardHome(workspace)],
    ["invalidation", () => invalidateDashboardCache(workspace)],
    ["clear", () => clearDashboardCache()],
  ];

  it.each(accessors)("checks the session during %s and clears every workspace", async (_, access) => {
    await fetchDashboardHomeCached(workspace);
    await fetchDashboardHomeCached("other-workspace");
    token = "session-b";
    vi.mocked(getStoredAccessToken).mockClear();
    await access();
    expect(getStoredAccessToken).toHaveBeenCalled();
    expect(getCachedDashboardHome("other-workspace")).toBeNull();
    expect(getCachedDashboardUsage("other-workspace")).toBeNull();
    expect(isDashboardHomeFresh("other-workspace")).toBe(false);
  });

  it.each(["session-b", null])("does not reuse cached data after switching to %s", async (nextToken) => {
    const oldHome = home("old");
    const newHome = home("new");
    getHome.mockResolvedValueOnce(oldHome).mockResolvedValueOnce(newHome);
    await fetchDashboardHomeCached(workspace);
    token = nextToken;
    expect(getCachedDashboardHome(workspace)).toBeNull();
    expect(getCachedDashboardUsage(workspace)).toBeNull();
    expect(isDashboardHomeFresh(workspace)).toBe(false);
    await expect(fetchDashboardHomeCached(workspace)).resolves.toBe(newHome);
    expect(getHome).toHaveBeenCalledTimes(2);
  });

  it("does not seed caches when a home response observes an unannounced session change", async () => {
    const pending = deferred<DashboardHomePayload>();
    getHome.mockReturnValueOnce(pending.promise);
    const request = fetchDashboardHomeCached(workspace);
    token = "session-b";
    pending.resolve(home("old"));
    await request;
    expect(getCachedDashboardHome(workspace)).toBeNull();
    expect(getCachedDashboardUsage(workspace)).toBeNull();
  });

  it("keeps a new same-workspace home request when the old session resolves", async () => {
    const old = deferred<DashboardHomePayload>();
    const current = deferred<DashboardHomePayload>();
    getHome.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const oldRequest = fetchDashboardHomeCached(workspace);
    token = "session-b";
    const currentRequest = fetchDashboardHomeCached(workspace);
    expect(currentRequest).not.toBe(oldRequest);
    old.resolve(home("old"));
    await oldRequest;
    expect(getCachedDashboardHome(workspace)).toBeNull();
    expect(fetchDashboardHomeCached(workspace)).toBe(currentRequest);
    const value = home("current");
    current.resolve(value);
    await currentRequest;
    expect(getCachedDashboardHome(workspace)).toBe(value);
    expect(getCachedDashboardUsage(workspace)).toBe(value.stats.usage);
  });

  it("does not overwrite a new session cache with a late old home response", async () => {
    const old = deferred<DashboardHomePayload>();
    const current = home("current");
    getHome.mockReturnValueOnce(old.promise).mockResolvedValueOnce(current);
    const oldRequest = fetchDashboardHomeCached(workspace);
    token = "session-b";
    await fetchDashboardHomeCached(workspace);
    old.resolve(home("old"));
    await oldRequest;
    expect(getCachedDashboardHome(workspace)).toBe(current);
    expect(getCachedDashboardUsage(workspace)).toBe(current.stats.usage);
  });

  it("isolates same-workspace usage requests across sessions", async () => {
    const old = deferred<DashboardUsage>();
    const current = deferred<DashboardUsage>();
    getUsage.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const oldRequest = fetchDashboardUsageCached(workspace);
    token = "session-b";
    const currentRequest = fetchDashboardUsageCached(workspace);
    old.resolve(usage("old"));
    await oldRequest;
    expect(getCachedDashboardUsage(workspace)).toBeNull();
    expect(fetchDashboardUsageCached(workspace)).toBe(currentRequest);
    const value = usage("current");
    current.resolve(value);
    await currentRequest;
    expect(getCachedDashboardUsage(workspace)).toBe(value);
  });

  it("rejects old-session usage seeding without an intervening cache call", async () => {
    const pending = deferred<DashboardUsage>();
    getUsage.mockReturnValueOnce(pending.promise);
    const request = fetchDashboardUsageCached(workspace);
    token = "session-b";
    pending.resolve(usage("old"));
    await request;
    expect(getCachedDashboardUsage(workspace)).toBeNull();
  });

  it("does not revive requests after an observed token round trip", async () => {
    const old = deferred<DashboardHomePayload>();
    getHome.mockReturnValueOnce(old.promise);
    const request = fetchDashboardHomeCached(workspace);
    token = "session-b";
    getCachedDashboardHome(workspace);
    token = "session-a";
    old.resolve(home("old"));
    await request;
    expect(getCachedDashboardHome(workspace)).toBeNull();
  });
});

describe("freshness, invalidation and request identity", () => {
  it("preserves 30-second freshness and the 10-minute stale lookup bound", async () => {
    const value = home("cached");
    getHome.mockResolvedValue(value);
    await fetchDashboardHomeCached(workspace);
    vi.advanceTimersByTime(29_999);
    expect(isDashboardHomeFresh(workspace)).toBe(true);
    await fetchDashboardHomeCached(workspace);
    await fetchDashboardUsageCached(workspace);
    expect(getHome).toHaveBeenCalledTimes(1);
    expect(getUsage).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(isDashboardHomeFresh(workspace)).toBe(false);
    expect(getCachedDashboardHome(workspace)).toBe(value);
    vi.advanceTimersByTime(569_999);
    expect(getCachedDashboardUsage(workspace)).toBe(value.stats.usage);
    vi.advanceTimersByTime(1);
    expect(getCachedDashboardHome(workspace)).toBeNull();
    expect(getCachedDashboardUsage(workspace)).toBeNull();
  });

  it("forces fresh data while preserving in-flight home deduplication", async () => {
    await fetchDashboardHomeCached(workspace);
    const pending = deferred<DashboardHomePayload>();
    getHome.mockReturnValueOnce(pending.promise);
    const request = fetchDashboardHomeCached(workspace, { force: true });
    expect(fetchDashboardHomeCached(workspace, { force: true })).toBe(request);
    const current = home("forced");
    pending.resolve(current);
    await request;
    expect(getHome).toHaveBeenCalledTimes(2);
    expect(getCachedDashboardHome(workspace)).toBe(current);
  });

  it.each(["invalidate", "clear"])("keeps late home responses from replacing forced requests after %s", async (action) => {
    const old = deferred<DashboardHomePayload>();
    const current = deferred<DashboardHomePayload>();
    getHome.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const oldRequest = fetchDashboardHomeCached(workspace);
    if (action === "invalidate") invalidateDashboardCache(workspace);
    else clearDashboardCache();
    const currentRequest = fetchDashboardHomeCached(workspace, { force: true });
    old.resolve(home("old"));
    await oldRequest;
    expect(getCachedDashboardHome(workspace)).toBeNull();
    expect(fetchDashboardHomeCached(workspace, { force: true })).toBe(currentRequest);
    const value = home("current");
    current.resolve(value);
    await currentRequest;
    expect(getCachedDashboardHome(workspace)).toBe(value);
  });

  it("does not overwrite a completed replacement with an invalidated home response", async () => {
    const old = deferred<DashboardHomePayload>();
    const current = home("current");
    getHome.mockReturnValueOnce(old.promise).mockResolvedValueOnce(current);
    const request = fetchDashboardHomeCached(workspace);
    invalidateDashboardCache(workspace);
    await fetchDashboardHomeCached(workspace, { force: true });
    old.resolve(home("old"));
    await request;
    expect(getCachedDashboardHome(workspace)).toBe(current);
    expect(getCachedDashboardUsage(workspace)).toBe(current.stats.usage);
  });

  it("preserves usage identity guards after invalidation", async () => {
    const old = deferred<DashboardUsage>();
    const current = deferred<DashboardUsage>();
    getUsage.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const oldRequest = fetchDashboardUsageCached(workspace);
    invalidateDashboardCache(workspace);
    const currentRequest = fetchDashboardUsageCached(workspace);
    old.resolve(usage("old"));
    await oldRequest;
    expect(getCachedDashboardUsage(workspace)).toBeNull();
    expect(fetchDashboardUsageCached(workspace)).toBe(currentRequest);
    current.resolve(usage("current"));
    await currentRequest;
    expect(getCachedDashboardUsage(workspace)?.plan).toBe("current");
  });

  it("evicts failed home requests and permits the next read", async () => {
    const error = new Error("home unavailable");
    getHome.mockRejectedValueOnce(error);
    const request = fetchDashboardHomeCached(workspace);
    expect(fetchDashboardHomeCached(workspace)).toBe(request);
    await expect(request).rejects.toBe(error);
    expect(getCachedDashboardHome(workspace)).toBeNull();
    await expect(fetchDashboardHomeCached(workspace)).resolves.toEqual(home("default"));
    expect(getHome).toHaveBeenCalledTimes(2);
  });
});

describe("usage reuse and bounded fallback", () => {
  it("keeps an existing usage request when a later home request fails", async () => {
    const pendingUsage = deferred<DashboardUsage>();
    const pendingHome = deferred<DashboardHomePayload>();
    getUsage.mockReturnValueOnce(pendingUsage.promise);
    getHome.mockReturnValueOnce(pendingHome.promise);
    const request = fetchDashboardUsageCached(workspace);
    const homeResult = fetchDashboardHomeCached(workspace).catch(() => undefined);
    expect(fetchDashboardUsageCached(workspace)).toBe(request);
    pendingHome.reject(new Error("home unavailable"));
    await homeResult;
    expect(fetchDashboardUsageCached(workspace)).toBe(request);
    const value = usage("existing");
    pendingUsage.resolve(value);
    await expect(request).resolves.toBe(value);
    expect(getUsage).toHaveBeenCalledTimes(1);
  });

  it("deduplicates lightweight usage reads and caches success", async () => {
    const pending = deferred<DashboardUsage>();
    getUsage.mockReturnValueOnce(pending.promise);
    const request = fetchDashboardUsageCached(workspace);
    expect(fetchDashboardUsageCached(workspace)).toBe(request);
    const value = usage("usage-only");
    pending.resolve(value);
    await expect(request).resolves.toBe(value);
    await expect(fetchDashboardUsageCached(workspace)).resolves.toBe(value);
    expect(getUsage).toHaveBeenCalledTimes(1);
    expect(getHome).not.toHaveBeenCalled();
  });

  it("reuses successful in-flight home usage without a lightweight request", async () => {
    const pending = deferred<DashboardHomePayload>();
    getHome.mockReturnValueOnce(pending.promise);
    const homeRequest = fetchDashboardHomeCached(workspace);
    const request = fetchDashboardUsageCached(workspace);
    expect(fetchDashboardUsageCached(workspace)).toBe(request);
    const value = home("home-usage");
    pending.resolve(value);
    await homeRequest;
    await expect(request).resolves.toBe(value.stats.usage);
    expect(getCachedDashboardUsage(workspace)).toBe(value.stats.usage);
    expect(getUsage).not.toHaveBeenCalled();
  });

  it("falls back once after home failure and deduplicates before and during fallback", async () => {
    const pendingHome = deferred<DashboardHomePayload>();
    const pendingUsage = deferred<DashboardUsage>();
    const error = new Error("home unavailable");
    getHome.mockReturnValueOnce(pendingHome.promise);
    getUsage.mockReturnValueOnce(pendingUsage.promise);
    const homeResult = fetchDashboardHomeCached(workspace).catch((failure: unknown) => failure);
    const request = fetchDashboardUsageCached(workspace);
    expect(fetchDashboardUsageCached(workspace)).toBe(request);
    pendingHome.reject(error);
    expect(await homeResult).toBe(error);
    expect(getUsage).toHaveBeenCalledExactlyOnceWith(workspace);
    expect(fetchDashboardUsageCached(workspace)).toBe(request);
    const value = usage("fallback");
    pendingUsage.resolve(value);
    await expect(request).resolves.toBe(value);
    expect(getCachedDashboardUsage(workspace)).toBe(value);
    await expect(fetchDashboardUsageCached(workspace)).resolves.toBe(value);
    expect(getUsage).toHaveBeenCalledTimes(1);
    expect(getCachedDashboardHome(workspace)).toBeNull();
  });

  it("does not retry failed fallback and evicts it for the next read", async () => {
    const pending = deferred<DashboardHomePayload>();
    const error = new Error("usage unavailable");
    getHome.mockReturnValueOnce(pending.promise);
    getUsage.mockRejectedValueOnce(error);
    const homeResult = fetchDashboardHomeCached(workspace).catch(() => undefined);
    const result = expect(fetchDashboardUsageCached(workspace)).rejects.toBe(error);
    pending.reject(new Error("home unavailable"));
    await homeResult;
    await result;
    expect(getUsage).toHaveBeenCalledTimes(1);
    expect(getCachedDashboardUsage(workspace)).toBeNull();
    await expect(fetchDashboardUsageCached(workspace)).resolves.toEqual(usage("default"));
    expect(getUsage).toHaveBeenCalledTimes(2);
  });

  it("evicts direct usage failures without automatic retries", async () => {
    const error = new Error("usage unavailable");
    getUsage.mockRejectedValueOnce(error);
    await expect(fetchDashboardUsageCached(workspace)).rejects.toBe(error);
    expect(getUsage).toHaveBeenCalledTimes(1);
    await expect(fetchDashboardUsageCached(workspace)).resolves.toEqual(usage("default"));
    expect(getUsage).toHaveBeenCalledTimes(2);
  });

  it.each(["session", "invalidate", "clear"])("does not dispatch a stale home fallback after %s", async (action) => {
    const pending = deferred<DashboardHomePayload>();
    const error = new Error("old home unavailable");
    getHome.mockReturnValueOnce(pending.promise);
    const homeResult = fetchDashboardHomeCached(workspace).catch(() => undefined);
    const result = expect(fetchDashboardUsageCached(workspace)).rejects.toBe(error);
    if (action === "session") token = "session-b";
    else if (action === "invalidate") invalidateDashboardCache(workspace);
    else clearDashboardCache();
    pending.reject(error);
    await homeResult;
    await result;
    expect(getUsage).not.toHaveBeenCalled();
    expect(getCachedDashboardUsage(workspace)).toBeNull();
  });

  it("does not seed a new session from an already dispatched fallback", async () => {
    const pendingHome = deferred<DashboardHomePayload>();
    const pendingUsage = deferred<DashboardUsage>();
    getHome.mockReturnValueOnce(pendingHome.promise);
    getUsage.mockReturnValueOnce(pendingUsage.promise).mockResolvedValueOnce(usage("current"));
    const homeResult = fetchDashboardHomeCached(workspace).catch(() => undefined);
    const oldRequest = fetchDashboardUsageCached(workspace);
    pendingHome.reject(new Error("home unavailable"));
    await homeResult;
    expect(getUsage).toHaveBeenCalledTimes(1);
    token = "session-b";
    await fetchDashboardUsageCached(workspace);
    pendingUsage.resolve(usage("old"));
    await oldRequest;
    expect(getCachedDashboardUsage(workspace)?.plan).toBe("current");
  });
});