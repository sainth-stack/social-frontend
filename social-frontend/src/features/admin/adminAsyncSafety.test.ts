import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import adminReducer, { clearAdminErrors, type AdminState } from "@/features/admin/adminSlice";
import {
  changeAdminUserPlan,
  createAdminUser,
  fetchAdminAnalytics,
  fetchAdminOverview,
  fetchAdminUsers,
  fetchPricingPlans,
  suspendAdminUser,
  updatePricingPlan,
} from "@/features/admin/adminThunks";
import { DEFAULT_PRICING_CATALOG } from "@/features/admin/pricingCatalog";
import authReducer, { hydrateAuth, loginSuccess, logout } from "@/features/auth/authSlice";
import { login, register, validateSession } from "@/features/auth/authThunks";
import { persistSession } from "@/lib/auth/session";
import type { AdminAnalytics, AdminOverviewStats, AdminUser, AdminUserListResponse, PricingPlan } from "@/types/admin";
import type { User } from "@/types/auth";

const api = vi.hoisted(() => ({
  getOverview: vi.fn(),
  getAnalytics: vi.fn(),
  listUsers: vi.fn(),
  listPricingPlans: vi.fn(),
  createUser: vi.fn(),
  suspendUser: vi.fn(),
  changeUserPlan: vi.fn(),
  updatePricingPlan: vi.fn(),
}));

vi.mock("@/api/endpoints/admin.api", () => ({ default: api }));
vi.mock("@/api/endpoints/auth.api", () => ({ authApi: {} }));

const user: User = {
  id: "admin-a",
  name: "Admin A",
  email: "admin-a@example.com",
  isPlatformAdmin: true,
  workspaceId: "workspace-a",
  workspaceName: "Workspace A",
  socialPermissionLevel: "admin",
  plan: "growth",
};

const otherUser = { ...user, id: "admin-b", email: "admin-b@example.com" };

function overview(value: number): AdminOverviewStats {
  return {
    totalUsers: value,
    totalWorkspaces: value,
    posts30d: value,
    aiUsage30d: value,
    failedPublishes30d: 0,
    mrrEstimateUsd: value,
    userGrowth30dPct: value,
    planDistribution: [],
  };
}

function analytics(value: number): AdminAnalytics {
  return { postsOverTime: [{ date: "2026-10-24", posts: value }], planDistribution: [], platformMix: [] };
}

function adminUser(value: number): AdminUser {
  return { ...user, id: `user-${value}`, status: "active", createdAt: "2026-10-24" };
}

function users(value: number): AdminUserListResponse {
  return { items: [adminUser(value)], total: value, page: 1, pageSize: 20, totalPages: 1 };
}

function plan(value: number): PricingPlan {
  return { ...DEFAULT_PRICING_CATALOG[0], priceMonthlyUsd: value };
}

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function makeStore(preloadedUser?: User) {
  const auth = authReducer(undefined, { type: "init" });
  return configureStore({
    reducer: { admin: adminReducer, auth: authReducer },
    preloadedState: {
      auth: preloadedUser ? { ...auth, user: preloadedUser, accessToken: "existing-token", isAuthenticated: true } : auth,
    },
  });
}

type TestStore = ReturnType<typeof makeStore>;

const reads = [
  {
    name: "overview",
    api: api.getOverview,
    start: (store: TestStore) => store.dispatch(fetchAdminOverview()),
    result: overview,
    select: (state: AdminState) => state.overview,
    loading: "overviewLoading",
    error: "overviewError",
    requestId: "overviewRequestId",
    signalIndex: 0,
  },
  {
    name: "analytics",
    api: api.getAnalytics,
    start: (store: TestStore) => store.dispatch(fetchAdminAnalytics({ from: "2026-10-01", to: "2026-10-24" })),
    result: analytics,
    select: (state: AdminState) => state.analytics,
    loading: "analyticsLoading",
    error: "analyticsError",
    requestId: "analyticsRequestId",
    signalIndex: 1,
  },
  {
    name: "users",
    api: api.listUsers,
    start: (store: TestStore) => store.dispatch(fetchAdminUsers({ search: "admin", page: 2 })),
    result: users,
    select: (state: AdminState) => ({ items: state.users, total: state.usersTotal, page: 1, pageSize: 20, totalPages: 1 }),
    loading: "usersLoading",
    error: "usersError",
    requestId: "usersRequestId",
    signalIndex: 1,
  },
  {
    name: "pricing",
    api: api.listPricingPlans,
    start: (store: TestStore) => store.dispatch(fetchPricingPlans()),
    result: (value: number) => [plan(value)],
    select: (state: AdminState) => state.pricingPlans,
    loading: "pricingLoading",
    error: "pricingError",
    requestId: "pricingRequestId",
    signalIndex: null,
  },
] as const;

const mutations = [
  { name: "create user", api: api.createUser, start: (store: TestStore) => store.dispatch(createAdminUser({ name: "New", email: "new@example.com", password: "test-password" })), result: adminUser(3) },
  { name: "suspend user", api: api.suspendUser, start: (store: TestStore) => store.dispatch(suspendAdminUser({ userId: "user-1", suspended: true })), result: { ...adminUser(1), status: "suspended" } },
  { name: "change user plan", api: api.changeUserPlan, start: (store: TestStore) => store.dispatch(changeAdminUserPlan({ userId: "user-1", plan: "enterprise" })), result: { ...adminUser(1), plan: "enterprise" } },
  { name: "save pricing", api: api.updatePricingPlan, start: (store: TestStore) => store.dispatch(updatePricingPlan({ planId: "starter", payload: { priceMonthlyUsd: 20 } })), result: plan(20) },
] as const;

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});

describe.each(reads)("$name request safety", (read) => {
  it("keeps the latest response when reads complete in reverse order", async () => {
    const store = makeStore(user);
    const old = deferred();
    const latest = deferred();
    read.api.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    const oldRequest = read.start(store);
    const latestRequest = read.start(store);
    expect(store.getState().admin[read.requestId]).toBe(latestRequest.requestId);
    latest.resolve(read.result(2));
    await latestRequest;
    old.resolve(read.result(1));
    await oldRequest;
    expect(read.select(store.getState().admin)).toEqual(read.result(2));
    expect(store.getState().admin[read.loading]).toBe(false);
    expect(store.getState().admin[read.requestId]).toBeNull();
  });

  it.each(["resolve", "reject", "abort"] as const)("ignores a stale %s without clearing the newer loading state", async (completion) => {
    const store = makeStore(user);
    const old = deferred();
    const latest = deferred();
    read.api.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    const oldRequest = read.start(store);
    const latestRequest = read.start(store);
    if (completion === "abort") oldRequest.abort();
    else if (completion === "reject") old.reject(new Error("Stale failure"));
    else old.resolve(read.result(1));
    await oldRequest;
    expect(store.getState().admin[read.loading]).toBe(true);
    expect(store.getState().admin[read.error]).toBeNull();
    expect(store.getState().admin[read.requestId]).toBe(latestRequest.requestId);
    latest.resolve(read.result(2));
    await latestRequest;
    old.resolve(read.result(1));
    expect(read.select(store.getState().admin)).toEqual(read.result(2));
  });

  it("ignores late failures after the latest read succeeds", async () => {
    const store = makeStore(user);
    const old = deferred();
    read.api.mockReturnValueOnce(old.promise).mockResolvedValueOnce(read.result(2));
    const oldRequest = read.start(store);
    await read.start(store);
    old.reject(new Error("Stale failure"));
    await oldRequest;
    expect(read.select(store.getState().admin)).toEqual(read.result(2));
    expect(store.getState().admin[read.error]).toBeNull();
  });

  it.each([false, true])("silently aborts the current read with cached data=%s", async (cached) => {
    const store = makeStore(user);
    if (cached) {
      read.api.mockResolvedValueOnce(read.result(1));
      await read.start(store);
    }
    const before = read.select(store.getState().admin);
    const pending = deferred();
    read.api.mockReturnValueOnce(pending.promise);
    const request = read.start(store);
    const call = read.api.mock.calls.at(-1)!;
    const signal = read.signalIndex === null ? null : call[read.signalIndex] as AbortSignal;
    request.abort();
    const action = await request;
    expect(action.meta).toMatchObject({ aborted: true });
    if (signal) expect(signal.aborted).toBe(true);
    expect(store.getState().admin[read.loading]).toBe(false);
    expect(store.getState().admin[read.error]).toBeNull();
    expect(store.getState().admin[read.requestId]).toBeNull();
    expect(read.select(store.getState().admin)).toEqual(before);
    expect(store.getState().admin.pricingIsFallback).toBe(false);
    pending.resolve(read.result(2));
    await pending.promise;
    expect(read.select(store.getState().admin)).toEqual(before);
  });

  it("retains current errors for real failures and supports clearAdminErrors", async () => {
    const store = makeStore(user);
    read.api.mockRejectedValueOnce(new Error("Current failure"));
    await read.start(store);
    expect(store.getState().admin[read.error]).toBeTruthy();
    expect(store.getState().admin[read.loading]).toBe(false);
    if (read.name === "pricing") {
      expect(store.getState().admin.pricingPlans).toEqual(DEFAULT_PRICING_CATALOG);
      expect(store.getState().admin.pricingIsFallback).toBe(true);
    }
    store.dispatch(clearAdminErrors());
    expect(store.getState().admin[read.error]).toBeNull();
  });
});

const resets = [
  { name: "logout", run: (store: TestStore) => store.dispatch(logout()) },
  { name: "loginSuccess", run: (store: TestStore) => store.dispatch(loginSuccess({ user: otherUser, accessToken: "new-token" })) },
  { name: "new session for the same user", run: (store: TestStore) => store.dispatch(loginSuccess({ user, accessToken: "new-token" })) },
  { name: "login.fulfilled", run: (store: TestStore) => store.dispatch(login.fulfilled({ user: otherUser, accessToken: "new-token" }, "login", { email: otherUser.email, password: "test-password" })) },
  { name: "register.fulfilled", run: (store: TestStore) => store.dispatch(register.fulfilled({ user: otherUser, accessToken: "new-token" }, "register", { name: otherUser.name, email: otherUser.email, password: "test-password" })) },
  { name: "validation switches identity", run: (store: TestStore) => store.dispatch(validateSession.fulfilled(otherUser, "validate")) },
  { name: "validation revokes admin", run: (store: TestStore) => store.dispatch(validateSession.fulfilled({ ...user, isPlatformAdmin: false }, "validate")) },
  { name: "validation fails", run: (store: TestStore) => store.dispatch(validateSession.rejected(new Error("Unauthorized"), "validate")) },
  { name: "hydration switches identity", run: (store: TestStore) => { persistSession({ user: otherUser, accessToken: "new-token" }); store.dispatch(hydrateAuth()); } },
  { name: "hydration revokes admin", run: (store: TestStore) => { persistSession({ user: { ...user, isPlatformAdmin: false }, accessToken: "new-token" }); store.dispatch(hydrateAuth()); } },
];

describe.each(resets)("$name", (reset) => {
  it.each(["resolve", "reject"] as const)("clears sensitive data and ignores late read/mutation %s", async (completion) => {
    const store = makeStore(user);
    for (const read of reads) {
      read.api.mockResolvedValueOnce(read.result(1));
      await read.start(store);
    }
    const pendingReads = reads.map((read) => {
      const pending = deferred();
      read.api.mockReturnValueOnce(pending.promise);
      return { pending, request: read.start(store), result: read.result(2) };
    });
    const pendingMutations = mutations.map((mutation) => {
      const pending = deferred();
      mutation.api.mockReturnValueOnce(pending.promise);
      return { pending, request: mutation.start(store), result: mutation.result };
    });
    reset.run(store);
    const cleared = store.getState().admin;
    expect(cleared).toEqual({ ...adminReducer(undefined, { type: "init" }), sessionUserId: cleared.sessionUserId });
    for (const { pending, result } of [...pendingReads, ...pendingMutations]) {
      if (completion === "resolve") pending.resolve(result);
      else pending.reject(new Error("Old session failure"));
    }
    await Promise.all([...pendingReads, ...pendingMutations].map(({ request }) => request));
    expect(store.getState().admin).toEqual(cleared);
  });
});

describe("session identity", () => {
  it("learns preloaded auth identity and preserves data and active requests on same-user validation", async () => {
    const store = makeStore(user);
    api.getOverview.mockResolvedValueOnce(overview(1));
    await store.dispatch(fetchAdminOverview());
    const pending = deferred();
    api.getAnalytics.mockReturnValueOnce(pending.promise);
    const request = store.dispatch(fetchAdminAnalytics());
    const before = store.getState().admin;
    expect(before.sessionUserId).toBe(user.id);
    store.dispatch(validateSession.fulfilled({ ...user, workspaceId: "another-workspace", name: "Updated name" }, "validate"));
    expect(store.getState().admin).toEqual(before);
    pending.resolve(analytics(2));
    await request;
    expect(store.getState().admin.analytics).toEqual(analytics(2));
  });

  it("tracks hydrated identity before the first request and preserves same-user validation", async () => {
    const store = makeStore();
    persistSession({ user, accessToken: "existing-token" });
    store.dispatch(hydrateAuth());
    expect(store.getState().admin.sessionUserId).toBe(user.id);
    api.getOverview.mockResolvedValueOnce(overview(1));
    await store.dispatch(fetchAdminOverview());
    const before = store.getState().admin;
    store.dispatch(validateSession.fulfilled(user, "validate"));
    store.dispatch(hydrateAuth());
    expect(store.getState().admin).toEqual(before);
  });

  it("does not let an old completion clear a new session's active read or save", async () => {
    const store = makeStore(user);
    const oldRead = deferred();
    const newRead = deferred();
    const oldSave = deferred();
    const newSave = deferred();
    api.listPricingPlans.mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(newRead.promise);
    api.updatePricingPlan.mockReturnValueOnce(oldSave.promise).mockReturnValueOnce(newSave.promise);
    const firstRead = store.dispatch(fetchPricingPlans());
    const firstSave = mutations[3].start(store);
    store.dispatch(logout());
    store.dispatch(loginSuccess({ user: otherUser, accessToken: "new-token" }));
    const secondRead = store.dispatch(fetchPricingPlans());
    const secondSave = mutations[3].start(store);
    oldRead.resolve([plan(1)]);
    oldSave.resolve(plan(1));
    await Promise.all([firstRead, firstSave]);
    expect(store.getState().admin).toMatchObject({ pricingLoading: true, pricingSaving: true, pricingPlans: [], pricingRequestId: secondRead.requestId });
    newRead.resolve([plan(2)]);
    await secondRead;
    newSave.resolve(plan(3));
    await secondSave;
    expect(store.getState().admin.pricingPlans).toEqual([plan(3)]);
  });

  it("accepts legacy AdminState objects without request metadata", () => {
    const legacy: AdminState = {
      overview: null, overviewLoading: false, overviewError: null,
      analytics: null, analyticsLoading: false, analyticsError: null,
      users: [], usersTotal: 0, usersLoading: false, usersError: null,
      pricingPlans: [], pricingLoading: false, pricingSaving: false, pricingError: null, pricingIsFallback: false,
    };
    const pending = adminReducer(legacy, fetchAdminOverview.pending("read", undefined, { sessionUserId: user.id }));
    expect(adminReducer(pending, fetchAdminOverview.fulfilled(overview(1), "read"))).toMatchObject({ overview: overview(1), overviewLoading: false });
  });
});

describe("mutation/read ordering", () => {
  it.each(["before", "during"] as const)("does not let a pricing read started %s a save undo the saved plan", async (timing) => {
    const store = makeStore(user);
    const read = deferred();
    const save = deferred();
    api.listPricingPlans.mockReturnValueOnce(read.promise);
    api.updatePricingPlan.mockReturnValueOnce(save.promise);
    const readRequest = timing === "before" ? store.dispatch(fetchPricingPlans()) : null;
    const saveRequest = mutations[3].start(store);
    const duringRead = timing === "during" ? store.dispatch(fetchPricingPlans()) : null;
    save.resolve(plan(20));
    await saveRequest;
    read.resolve([plan(1)]);
    await (readRequest ?? duringRead);
    expect(store.getState().admin).toMatchObject({ pricingPlans: [plan(20)], pricingLoading: false, pricingSaving: false, pricingIsFallback: false });
    api.listPricingPlans.mockResolvedValueOnce([plan(30)]);
    await store.dispatch(fetchPricingPlans());
    expect(store.getState().admin.pricingPlans).toEqual([plan(30)]);
  });

  it("ignores an older pricing read failure after saving", async () => {
    const store = makeStore(user);
    const read = deferred();
    api.listPricingPlans.mockReturnValueOnce(read.promise);
    const request = store.dispatch(fetchPricingPlans());
    api.updatePricingPlan.mockResolvedValueOnce(plan(20));
    await mutations[3].start(store);
    read.reject(new Error("Stale failure"));
    await request;
    expect(store.getState().admin).toMatchObject({ pricingPlans: [plan(20)], pricingError: null, pricingIsFallback: false });
  });

  it("keeps pricingSaving true until every active save settles", async () => {
    const store = makeStore(user);
    const first = deferred();
    const second = deferred();
    api.updatePricingPlan.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const requestA = mutations[3].start(store);
    const requestB = store.dispatch(updatePricingPlan({ planId: "growth", payload: { priceMonthlyUsd: 30 } }));
    first.resolve(plan(20));
    await requestA;
    expect(store.getState().admin.pricingSaving).toBe(true);
    second.resolve({ ...plan(30), id: "growth" });
    await requestB;
    expect(store.getState().admin.pricingSaving).toBe(false);
    expect(store.getState().admin.pricingPlans).toHaveLength(2);
  });

  it.each(mutations)("silently aborts $name and ignores the eventual API result", async (mutation) => {
    const store = makeStore(user);
    const pending = deferred();
    mutation.api.mockReturnValueOnce(pending.promise);
    const request = mutation.start(store);
    request.abort();
    await request;
    expect(store.getState().admin).toMatchObject({ users: [], usersError: null, pricingPlans: [], pricingSaving: false, pricingError: null, userMutationRequestIds: {}, pricingMutationRequestIds: {} });
    pending.resolve(mutation.result);
    await pending.promise;
    expect(store.getState().admin.users).toEqual([]);
    expect(store.getState().admin.pricingPlans).toEqual([]);
  });

  it("does not let a stale users read undo a successful mutation", async () => {
    const store = makeStore(user);
    const pending = deferred();
    api.listUsers.mockReturnValueOnce(pending.promise);
    const request = store.dispatch(fetchAdminUsers());
    api.suspendUser.mockResolvedValueOnce({ ...adminUser(1), status: "suspended" });
    await mutations[1].start(store);
    pending.resolve(users(1));
    await request;
    expect(store.getState().admin.users[0].status).toBe("suspended");
    expect(store.getState().admin.usersLoading).toBe(false);
  });
});