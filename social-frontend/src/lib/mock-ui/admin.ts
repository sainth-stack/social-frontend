import type {
  AdminAIUsageItem,
  AdminAIUsageMetrics,
  AdminAIUsageReport,
  AdminAnalytics,
  AdminOverviewStats,
  AdminUser,
  AdminWorkspace,
  ContactSubmission,
  MarketingAnalytics,
  PlanLimits,
  PricingPlan,
} from "../../types/admin";
import type { PlanTier } from "../../types/auth";
import type {
  AdminCoupon,
  AdminCouponRedemption,
  BillingPayment,
  BillingPlanPrice,
  CouponPreview,
} from "../../types/billing";

const today = "2026-10-26";
const timestamp = `${today}T12:00:00.000Z`;
const tiers: PlanTier[] = ["starter", "growth", "enterprise"];
const names = ["Avery", "Morgan", "Jordan", "Taylor", "Riley", "Casey", "Quinn", "Skyler"];
let sequence = 100;

function dateAt(offset: number): string {
  return new Date(Date.parse(`${today}T00:00:00.000Z`) + offset * 86400000).toISOString().slice(0, 10);
}

function nextId(kind: string): string {
  sequence += 1;
  return `mock-demo-${kind}-${sequence}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function integer(value: string | undefined, fallback: number, minimum = 1, maximum = 1000000): number {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.floor(parsed))) : fallback;
}

function matches(search: string | undefined, ...values: unknown[]): boolean {
  return !search || values.join(" ").toLowerCase().includes(search.trim().toLowerCase());
}

function paginate<T>(items: T[], params: Record<string, string>) {
  const page = integer(params.page, 1);
  const pageSize = integer(params.pageSize, 20, 1, 200);
  return clone({ items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize, totalPages: Math.max(1, Math.ceil(items.length / pageSize)) });
}

function arrayPage<T>(items: T[], params: Record<string, string>): T[] {
  if (params.page !== undefined || params.pageSize !== undefined) return paginate(items, params).items;
  const offset = integer(params.offset, 0, 0);
  const limit = integer(params.limit, items.length, 1, 500);
  return clone(items.slice(offset, offset + limit));
}

function plan(value: unknown): PlanTier {
  if (!tiers.includes(value as PlanTier)) throw new Error("Mock UI: invalid demo plan.");
  return value as PlanTier;
}

function required<T>(value: T | undefined): T {
  if (!value) throw new Error("Mock UI: demo record not found.");
  return value;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nonnegative(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("Mock UI: enter a non-negative demo amount.");
  return value;
}

const workspaces: AdminWorkspace[] = Array.from({ length: 32 }, (_, i) => ({
  id: i === 0 ? "mock-workspace" : `mock-demo-workspace-${i}`,
  name: i === 0 ? "Demo Workspace" : `Demo ${["Northstar", "Orbit", "Meadow", "Summit"][i % 4]} Studio ${i}`,
  plan: i === 0 ? "enterprise" : tiers[i % tiers.length],
  is_active: i % 9 !== 8,
  owner_email: i === 0 ? "demo.admin@example.test" : `demo.user${i}@example.test`,
  member_count: 1 + i % 7,
  created_at: `${dateAt(-120 + i * 3)}T09:00:00.000Z`,
}));

const users: AdminUser[] = workspaces.map((workspace, i) => ({
  id: i === 0 ? "mock-admin" : `mock-demo-user-${i}`,
  email: workspace.owner_email!,
  name: i === 0 ? "Demo Admin" : `Demo ${names[i % names.length]} ${i}`,
  workspaceId: workspace.id,
  workspaceName: workspace.name,
  plan: workspace.plan,
  status: i % 11 === 10 ? "suspended" : "active",
  socialPermissionLevel: "admin",
  isPlatformAdmin: i === 0,
  createdAt: workspace.created_at,
}));

const contacts: ContactSubmission[] = Array.from({ length: 28 }, (_, i) => ({
  id: `mock-demo-contact-${i + 1}`,
  name: `Demo ${names[i % names.length]} ${i + 1}`,
  email: `demo.enquiry${i + 1}@example.test`,
  company: `Demo ${["Orbit Agency", "Meadow Consulting", "Summit Software"][i % 3]}`,
  message: `Demo enquiry: ${["We would like a walkthrough of team approvals.", "Can you explain the Growth plan allowances?", "We are exploring a shared content calendar for our team."][i % 3]}`,
  status: (["new", "in_progress", "resolved"] as const)[i % 3],
  createdAt: `${dateAt(-i)}T10:15:00.000Z`,
  updatedAt: `${dateAt(-Math.max(0, i - 1))}T11:30:00.000Z`,
}));

const pricing: PricingPlan[] = tiers.map((id, i) => ({
  id,
  name: ["Free", "Pro", "Growth"][i],
  tagline: `Demo plan: ${["Essential publishing", "Independent creators", "Growing teams and approvals"][i]}`,
  priceMonthlyUsd: [0, 99, 299][i],
  priceMonthlyInr: [0, 499, 999][i],
  priceAnnualUsd: [0, 990, 2990][i],
  isCustom: false,
  recommended: i === 2,
  limits: {
    accounts: null,
    postsPerMonth: [10, 100, 500][i],
    aiTextGenerations: [30, 300, 1500][i],
    aiImageGenerations: [5, 50, 200][i],
    aiVideoGenerations: [0, 5, 20][i],
    templates: [3, 30, 100][i],
    brandVoice: true,
    approvalWorkflow: i > 0,
  },
}));

const coupons: AdminCoupon[] = [
  { id: "mock-demo-coupon-1", code: "DEMO20", planKey: null, discountType: "percent", discountValue: 20, maxRedemptions: 100, redemptionCount: 4, validUntil: "2099-12-31T23:59:59.000Z", notes: "Demo only: illustrative 20% discount. Payments are disabled.", isActive: true, createdAt: `${dateAt(-25)}T09:00:00.000Z`, updatedAt: timestamp },
  { id: "mock-demo-coupon-2", code: "DEMO100", planKey: "growth", discountType: "fixed_inr", discountValue: 100, maxRedemptions: 50, redemptionCount: 2, validUntil: null, notes: "Demo only: illustrative INR 100 discount.", isActive: true, createdAt: `${dateAt(-20)}T09:00:00.000Z`, updatedAt: timestamp },
  { id: "mock-demo-coupon-3", code: "DEMOFREE", planKey: "enterprise", discountType: "free", discountValue: 0, maxRedemptions: 10, redemptionCount: 0, validUntil: null, notes: "Demo only: inactive complimentary offer.", isActive: false, createdAt: `${dateAt(-10)}T09:00:00.000Z`, updatedAt: timestamp },
];

const redemptions: AdminCouponRedemption[] = Array.from({ length: 6 }, (_, i) => {
  const coupon = coupons[i < 4 ? 0 : 1];
  const user = users[i];
  const planKey = i < 4 ? "enterprise" : "growth";
  const listPrice = planKey === "enterprise" ? 99900 : 49900;
  const discountPaise = i < 4 ? listPrice * 0.2 : 10000;
  return { id: `mock-demo-redemption-${i}`, couponId: coupon.id, couponCode: coupon.code, workspaceId: user.workspaceId!, workspaceName: user.workspaceName, userId: user.id, userEmail: user.email, planKey, amountPaise: listPrice - discountPaise, discountPaise, createdAt: `${dateAt(-i * 3 - 1)}T10:00:00.000Z` };
});

const payments: BillingPayment[] = redemptions.map((redemption, i) => ({
  id: `mock-demo-payment-${i}`,
  workspaceId: redemption.workspaceId,
  planKey: redemption.planKey,
  status: "paid",
  amountPaise: redemption.amountPaise,
  currency: "INR",
  couponCode: redemption.couponCode,
  createdAt: redemption.createdAt,
  paidAt: redemption.createdAt,
}));

function changePlan(workspace: AdminWorkspace, value: unknown): void {
  workspace.plan = plan(value);
  users.filter((user) => user.workspaceId === workspace.id).forEach((user) => { user.plan = workspace.plan; });
}

function distribution() {
  return tiers.map((tier) => ({ plan: tier, count: workspaces.filter((workspace) => workspace.plan === tier).length }));
}

function updatePricing(row: PricingPlan, body: Record<string, unknown>): PricingPlan {
  const updated = clone(row);
  for (const key of ["priceMonthlyUsd", "priceAnnualUsd"] as const) {
    if (body[key] !== undefined) updated[key] = body[key] === null ? null : nonnegative(body[key]);
  }
  if (body.tagline !== undefined) updated.tagline = `Demo plan: ${text(body.tagline, row.tagline).replace(/^Demo plan: /, "")}`;
  if (body.limits && typeof body.limits === "object" && !Array.isArray(body.limits)) {
    const limits = body.limits as Record<string, unknown>;
    for (const key of Object.keys(updated.limits) as (keyof PlanLimits)[]) {
      if (key === "accounts" || limits[key] === undefined) continue;
      if (key === "brandVoice" || key === "approvalWorkflow") {
        if (typeof limits[key] !== "boolean") throw new Error("Mock UI: invalid demo feature allowance.");
        updated.limits[key] = limits[key];
      } else {
        updated.limits[key] = limits[key] === null ? null : Math.floor(nonnegative(limits[key]));
      }
    }
  }
  Object.assign(row, updated);
  return clone(row);
}

function couponValues(body: Record<string, unknown>, existing?: AdminCoupon): AdminCoupon {
  const row: AdminCoupon = existing ? clone(existing) : {
    id: nextId("coupon"), code: "", planKey: null, discountType: "percent", discountValue: 0,
    maxRedemptions: null, redemptionCount: 0, validUntil: null, notes: "Demo only", isActive: true, createdAt: timestamp, updatedAt: timestamp,
  };
  if (body.code !== undefined || !existing) row.code = text(body.code, "").toUpperCase();
  if (!row.code) throw new Error("Mock UI: a demo coupon code is required.");
  if (coupons.some((coupon) => coupon.id !== row.id && coupon.code === row.code)) throw new Error("Mock UI: demo coupon code already exists.");
  if (body.planKey !== undefined) row.planKey = body.planKey === null || body.planKey === "" ? null : plan(body.planKey);
  if (body.discountType !== undefined) {
    if (!["percent", "fixed_inr", "free"].includes(String(body.discountType))) throw new Error("Mock UI: invalid demo discount type.");
    row.discountType = body.discountType as AdminCoupon["discountType"];
  }
  if (body.discountValue !== undefined) row.discountValue = nonnegative(body.discountValue);
  if (row.discountType === "percent" && row.discountValue > 100) throw new Error("Mock UI: demo percentage cannot exceed 100.");
  if (body.maxRedemptions !== undefined) row.maxRedemptions = body.maxRedemptions === null ? null : Math.floor(nonnegative(body.maxRedemptions));
  if (body.validUntil !== undefined) {
    if (body.validUntil !== null && (typeof body.validUntil !== "string" || !Number.isFinite(Date.parse(body.validUntil)))) throw new Error("Mock UI: invalid demo expiry date.");
    row.validUntil = body.validUntil as string | null;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") throw new Error("Mock UI: invalid demo coupon status.");
    row.isActive = body.isActive;
  }
  if (body.notes !== undefined) row.notes = `Demo only: ${text(body.notes, "illustrative coupon")}`;
  row.updatedAt = timestamp;
  return row;
}

function billingPlans(): BillingPlanPrice[] {
  return pricing.filter((row) => row.id !== "starter").map((row) => ({ planKey: row.id, name: row.name, monthlyPriceInr: row.priceMonthlyInr!, monthlyPricePaise: Math.round(row.priceMonthlyInr! * 100) }));
}

function previewCoupon(body: Record<string, unknown>): CouponPreview {
  const price = required(billingPlans().find((row) => row.planKey === body.planKey));
  const coupon = required(coupons.find((row) => row.code === text(body.couponCode, "").toUpperCase()));
  if (!coupon.isActive || (coupon.planKey && coupon.planKey !== price.planKey)
    || (coupon.validUntil && Date.parse(coupon.validUntil) < Date.parse(timestamp))
    || (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions)) throw new Error("Mock UI: demo coupon is unavailable for this plan.");
  const discountPaise = Math.min(price.monthlyPricePaise, Math.round(coupon.discountType === "free" ? price.monthlyPricePaise : coupon.discountType === "percent" ? price.monthlyPricePaise * coupon.discountValue / 100 : coupon.discountValue * 100));
  return { code: coupon.code, planKey: price.planKey, listPricePaise: price.monthlyPricePaise, discountPaise, amountPaise: price.monthlyPricePaise - discountPaise, currency: "INR" };
}

function metrics(textUnits = 0, imageUnits = 0): AdminAIUsageMetrics {
  const textCalls = textUnits + Math.floor(textUnits / 5);
  const imageCalls = imageUnits;
  const cost = Number((textCalls * 0.0036 + imageCalls * 0.04).toFixed(6));
  return {
    textGenerations: textUnits, imageGenerations: imageUnits, providerCalls: textCalls + imageCalls,
    textProviderCalls: textCalls, imageProviderCalls: imageCalls, providerQuantity: textCalls + imageCalls,
    inputTokens: textCalls * 1200, outputTokens: textCalls * 300, cacheReadTokens: 0, cacheWriteTokens: 0,
    pricedCalls: textCalls + imageCalls, unpricedCalls: 0, failedCalls: 0, filteredCalls: 0, unattributedCalls: 0,
    legacyTextGenerations: 0, legacyImageGenerations: 0, estimatedKnownCostUsd: cost,
    totalCostUsd: cost, estimatedCostUsd: cost, historicalUnknown: false,
  };
}

type UsageSample = { date: string; userId: string; workspaceId: string; modelId: string; text: number; image: number };

const usageSamples: UsageSample[] = Array.from({ length: 90 }, (_, day) => users.slice(0, 12).flatMap((user, index) => [
  { date: dateAt(-day), userId: user.id, workspaceId: user.workspaceId!, modelId: "demo-text-model", text: 3 + (day + index) % 9, image: 0 },
  { date: dateAt(-day), userId: user.id, workspaceId: user.workspaceId!, modelId: "demo-image-model", text: 0, image: (day + index) % 3 },
])).flat();

function sumMetrics(samples: UsageSample[]): AdminAIUsageMetrics {
  const result = metrics();
  for (const sample of samples) {
    const values = metrics(sample.text, sample.image);
    for (const key of Object.keys(result) as (keyof AdminAIUsageMetrics)[]) {
      if (key !== "historicalUnknown") result[key] = Number(((result[key] ?? 0) + (values[key] as number)).toFixed(6));
    }
  }
  return result;
}

function aiReport(params: Record<string, string>): AdminAIUsageReport {
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 30;
  const startDate = params.startDate || dateAt(1 - days);
  const endDate = params.endDate || today;
  if (!Number.isFinite(Date.parse(startDate)) || !Number.isFinite(Date.parse(endDate)) || startDate > endDate) throw new Error("Mock UI: invalid demo report date range.");
  const groupBy = params.groupBy === "model" || params.groupBy === "workspace" ? params.groupBy : "user";
  const samples = usageSamples.filter((sample) => {
    const user = users.find((row) => row.id === sample.userId);
    const workspace = workspaces.find((row) => row.id === sample.workspaceId);
    const label = groupBy === "model" ? sample.modelId : groupBy === "workspace" ? workspace?.name : `${user?.name} ${user?.email}`;
    return !!user && !!workspace && sample.date >= startDate.slice(0, 10) && sample.date <= endDate.slice(0, 10)
      && (!params.userId || sample.userId === params.userId) && (!params.workspaceId || sample.workspaceId === params.workspaceId)
      && (params.kind !== "text" || sample.text > 0) && (params.kind !== "image" || sample.image > 0)
      && matches(params.search, label);
  });
  function group(by: "user" | "workspace" | "model"): AdminAIUsageItem[] {
    const groups = new Map<string, UsageSample[]>();
    for (const sample of samples) {
      const key = by === "user" ? sample.userId : by === "workspace" ? sample.workspaceId : sample.modelId;
      groups.set(key, [...(groups.get(key) ?? []), sample]);
    }
    return Array.from(groups, ([id, rows]) => {
      const user = users.find((row) => row.id === id);
      const workspace = workspaces.find((row) => row.id === id);
      return { ...sumMetrics(rows), id, name: by === "user" ? user!.name : by === "workspace" ? workspace!.name : id, email: by === "user" ? user!.email : null, userId: by === "user" ? id : null, workspaceId: by === "workspace" ? id : null, modelId: by === "model" ? id : null };
    });
  }
  const rows = group(groupBy).sort((a, b) => {
    const difference = params.sort === "count" ? a.providerCalls - b.providerCalls : a.estimatedKnownCostUsd - b.estimatedKnownCostUsd;
    return (params.order === "asc" ? difference : -difference) || a.id.localeCompare(b.id);
  });
  const daily = Array.from(new Set(samples.map((row) => row.date))).sort().map((date) => ({ date, ...sumMetrics(samples.filter((row) => row.date === date)) }));
  return {
    ...paginate(rows, params), startDate, endDate, currency: "USD", costBasis: "configured_estimate", groupBy,
    summary: sumMetrics(samples), daily, models: group("model"),
    pricing: [
      { modelId: "demo-text-model", currency: "USD", inputPerMillionUsd: 2, outputPerMillionUsd: 4, cacheReadPerMillionUsd: null, cacheWritePerMillionUsd: null, imagePerUnitUsd: null },
      { modelId: "demo-image-model", currency: "USD", imagePerUnitUsd: 0.04, inputPerMillionUsd: null, outputPerMillionUsd: null },
    ],
    limitations: ["Demo only: all identities, usage, pricing and costs are fabricated fixtures.", "No provider was contacted. These configured estimates are not invoices or real charges.", "Demo history covers 90 days ending 2026-10-26; dates outside that window have no samples."],
  };
}

function analytics(params: Record<string, string>): AdminAnalytics {
  return {
    postsOverTime: Array.from({ length: 30 }, (_, i) => ({ date: dateAt(i - 29), posts: 12 + i % 7 * 3 })).filter((row) => (!params.from || row.date >= params.from) && (!params.to || row.date <= params.to)),
    planDistribution: distribution(),
    platformMix: [{ platform: "linkedin", count: 246 }, { platform: "instagram", count: 211 }, { platform: "facebook", count: 163 }],
  };
}

function marketingAnalytics(): MarketingAnalytics {
  const daily = Array.from({ length: 30 }, (_, i) => {
    const date = dateAt(i - 29);
    return { date, pageViews: 140 + i % 7 * 23, signupClicks: 12 + i % 5 * 2, contactClicks: 4 + i % 4, contacts: contacts.filter((row) => row.createdAt.startsWith(date)).length };
  });
  return {
    pageViews30d: daily.reduce((total, row) => total + row.pageViews, 0), signupClicks30d: daily.reduce((total, row) => total + row.signupClicks, 0),
    contactClicks30d: daily.reduce((total, row) => total + row.contactClicks, 0), contacts30d: daily.reduce((total, row) => total + row.contacts, 0),
    newContacts: contacts.filter((row) => row.status === "new").length, inProgressContacts: contacts.filter((row) => row.status === "in_progress").length,
    resolvedContacts: contacts.filter((row) => row.status === "resolved").length, daily,
  };
}

export function handleAdminMock(path: string, method: string, params: Record<string, string>, body: Record<string, unknown>): unknown | undefined {
  const verb = method.toUpperCase();
  const route = path.replace(/\/+$/, "");
  const billing = route.match(/^\/api\/v1\/workspaces\/([^/]+)\/billing\/(plans|payments|checkout|confirm|coupons\/validate)$/);
  if (billing) {
    const [, encodedId, action] = billing;
    if (verb === "POST" && (action === "checkout" || action === "confirm")) throw new Error("Mock UI: payments are disabled. No money has been charged.");
    if (!((verb === "GET" && (action === "plans" || action === "payments")) || (verb === "POST" && action === "coupons/validate"))) return undefined;
    const workspaceId = decodeURIComponent(encodedId);
    required(workspaces.find((row) => row.id === workspaceId));
    if (action === "plans") return clone(billingPlans());
    if (action === "payments") return clone(payments.filter((row) => row.workspaceId === workspaceId));
    return previewCoupon(body);
  }
  const match = route.match(/^\/api\/v1\/admin\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/);
  if (!match) return undefined;
  const [, collection, encodedId, action] = match;
  const id = encodedId === undefined ? undefined : decodeURIComponent(encodedId);
  if (!id && verb === "GET") {
    if (collection === "overview") {
      const data: AdminOverviewStats = { totalUsers: users.length, totalWorkspaces: workspaces.length, posts30d: analytics({}).postsOverTime.reduce((sum, row) => sum + row.posts, 0), aiUsage30d: usageSamples.filter((row) => row.date >= dateAt(-29)).reduce((sum, row) => sum + row.text + row.image, 0), failedPublishes30d: 3, mrrEstimateUsd: workspaces.filter((row) => row.is_active).reduce((sum, row) => sum + (pricing.find((item) => item.id === row.plan)?.priceMonthlyUsd ?? 0), 0), userGrowth30dPct: 12.5, planDistribution: distribution() };
      return clone(data);
    }
    if (collection === "analytics") return clone(analytics(params));
    if (collection === "marketing-analytics") return clone(marketingAnalytics());
    if (collection === "ai-usage") return clone(aiReport(params));
    if (collection === "pricing") return clone(pricing);
    if (collection === "users") return paginate(users.filter((row) => matches(params.search, row.name, row.email, row.workspaceName) && (!params.plan || row.plan === params.plan) && (!params.status || row.status === params.status)), params);
    if (collection === "workspaces") {
      const offset = integer(params.offset, 0, 0);
      const limit = integer(params.limit, 100, 1, 500);
      return clone(workspaces.filter((row) => matches(params.search, row.name, row.owner_email) && (!params.plan || row.plan === params.plan) && (!params.status || (params.status === "active" ? row.is_active : !row.is_active))).slice(offset, offset + limit));
    }
    if (collection === "contacts") return paginate(contacts.filter((row) => matches(params.search, row.name, row.email, row.company, row.message) && (!params.status || row.status === params.status)), params);
    if (collection === "coupons") return arrayPage(coupons.filter((row) => matches(params.search, row.code, row.notes) && (!params.planKey || row.planKey === params.planKey) && (!params.isActive || row.isActive === (params.isActive === "true"))), params);
  }
  if (collection === "coupons" && id === "redemptions" && !action && verb === "GET") return arrayPage(redemptions.filter((row) => (!params.couponId || row.couponId === params.couponId) && (!params.workspaceId || row.workspaceId === params.workspaceId) && matches(params.search, row.couponCode, row.workspaceName, row.userEmail)), params);
  if (collection === "pricing" && id && !action && (verb === "PUT" || verb === "PATCH")) return updatePricing(required(pricing.find((row) => row.id === id)), body);
  if (collection === "coupons" && !action) {
    if (!id && verb === "POST") {
      const row = couponValues(body);
      coupons.unshift(row);
      return clone(row);
    }
    if (id && (verb === "PATCH" || verb === "PUT")) {
      const row = required(coupons.find((item) => item.id === id));
      Object.assign(row, couponValues(body, row));
      return clone(row);
    }
    if (id && verb === "GET") return clone(required(coupons.find((row) => row.id === id)));
    if (id && verb === "DELETE") {
      required(coupons.find((row) => row.id === id));
      coupons.splice(coupons.findIndex((row) => row.id === id), 1);
      return { ok: true };
    }
  }
  if (collection === "users") {
    if (!id && verb === "POST") {
      const email = text(body.email, `demo.user${sequence + 1}@example.test`).toLowerCase();
      if (users.some((row) => row.email === email)) throw new Error("Mock UI: demo email already exists.");
      const tier = plan(body.plan ?? "starter");
      const workspace: AdminWorkspace = { id: nextId("workspace"), name: `Demo ${text(body.workspaceName, "New Workspace")}`, plan: tier, is_active: true, owner_email: email, member_count: 1, created_at: timestamp };
      const row: AdminUser = { id: nextId("user"), email, name: `Demo ${text(body.name, "New User")}`, workspaceId: workspace.id, workspaceName: workspace.name, plan: tier, status: "active", socialPermissionLevel: "admin", isPlatformAdmin: body.isPlatformAdmin === true, createdAt: timestamp };
      workspaces.unshift(workspace);
      users.unshift(row);
      return clone(row);
    }
    if (id && verb === "POST" && (action === "suspend" || action === "plan")) {
      const row = required(users.find((item) => item.id === id));
      if (action === "plan") changePlan(required(workspaces.find((workspace) => workspace.id === row.workspaceId)), body.plan);
      else {
        const suspended = typeof body.suspended === "boolean" ? body.suspended : row.status !== "suspended";
        if (id === "mock-admin" && suspended) throw new Error("Mock UI: the demo admin cannot suspend itself.");
        row.status = suspended ? "suspended" : "active";
      }
      return clone(row);
    }
    if (id && !action && verb === "GET") return clone(required(users.find((row) => row.id === id)));
    if (id && !action && verb === "PATCH") {
      const row = required(users.find((item) => item.id === id));
      if (id === "mock-admin" && (body.is_active === false || body.is_platform_admin === false || body.status === "suspended")) throw new Error("Mock UI: the demo admin must retain access.");
      const email = text(body.email, row.email).toLowerCase();
      if (users.some((item) => item.id !== id && item.email === email)) throw new Error("Mock UI: demo email already exists.");
      const workspace = workspaces.find((item) => item.id === row.workspaceId);
      if (workspace && workspace.owner_email === row.email) workspace.owner_email = email;
      row.email = email;
      if (body.name !== undefined || body.full_name !== undefined) row.name = `Demo ${text(body.name ?? body.full_name, row.name).replace(/^Demo /, "")}`;
      if (typeof body.is_active === "boolean") row.status = body.is_active ? "active" : "suspended";
      if (body.status === "active" || body.status === "suspended") row.status = body.status;
      if (typeof body.is_platform_admin === "boolean") row.isPlatformAdmin = body.is_platform_admin;
      return clone(row);
    }
    if (id && !action && verb === "DELETE") {
      if (id === "mock-admin") throw new Error("Mock UI: the demo admin cannot be deleted.");
      const row = required(users.find((item) => item.id === id));
      const workspace = workspaces.find((item) => item.id === row.workspaceId);
      if (workspace) { workspace.member_count = Math.max(0, workspace.member_count - 1); workspace.owner_email = null; }
      users.splice(users.indexOf(row), 1);
      return { ok: true };
    }
  }
  if (collection === "workspaces") {
    if (!id && verb === "POST") {
      const row: AdminWorkspace = { id: nextId("workspace"), name: `Demo ${text(body.name, "New Workspace")}`, plan: plan(body.plan ?? "starter"), is_active: true, owner_email: null, member_count: 0, created_at: timestamp };
      workspaces.unshift(row);
      return clone(row);
    }
    if (id && verb === "PATCH" && (!action || action === "plan" || action === "status")) {
      const row = required(workspaces.find((item) => item.id === id));
      if (action === "plan" || body.plan !== undefined) changePlan(row, body.plan);
      if (typeof body.is_active === "boolean") row.is_active = body.is_active;
      if (!action && body.name !== undefined) {
        row.name = `Demo ${text(body.name, row.name).replace(/^Demo /, "")}`;
        users.filter((user) => user.workspaceId === id).forEach((user) => { user.workspaceName = row.name; });
      }
      return clone(row);
    }
    if (id && !action && verb === "GET") return clone(required(workspaces.find((row) => row.id === id)));
    if (id && !action && verb === "DELETE") {
      if (id === "mock-workspace") throw new Error("Mock UI: the primary demo workspace cannot be deleted.");
      const row = required(workspaces.find((item) => item.id === id));
      workspaces.splice(workspaces.indexOf(row), 1);
      users.filter((user) => user.workspaceId === id).forEach((user) => { user.workspaceId = null; user.workspaceName = "Demo: no workspace"; user.plan = "starter"; });
      return { ok: true };
    }
  }
  if (collection === "contacts" && !action) {
    if (!id && verb === "POST") {
      const row: ContactSubmission = { id: nextId("contact"), name: `Demo ${text(body.name, "New Enquiry")}`, email: text(body.email, "demo.enquiry@example.test"), company: `Demo ${text(body.company, "Company")}`, message: `Demo enquiry: ${text(body.message, "Please share a product walkthrough.")}`, status: "new", createdAt: timestamp, updatedAt: timestamp };
      contacts.unshift(row);
      return clone(row);
    }
    if (id && verb === "PATCH") {
      const row = required(contacts.find((item) => item.id === id));
      if (!["new", "in_progress", "resolved"].includes(String(body.status))) throw new Error("Mock UI: invalid demo contact status.");
      row.status = body.status as ContactSubmission["status"];
      row.updatedAt = timestamp;
      return clone(row);
    }
    if (id && verb === "GET") return clone(required(contacts.find((row) => row.id === id)));
    if (id && verb === "DELETE") {
      const row = required(contacts.find((item) => item.id === id));
      contacts.splice(contacts.indexOf(row), 1);
      return { ok: true };
    }
  }
  return undefined;
}