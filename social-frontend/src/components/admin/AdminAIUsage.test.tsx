import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import adminApi from "@/api/endpoints/admin.api";
import type { AdminAIUsageItem, AdminAIUsageMetrics, AdminAIUsageReport } from "@/types/admin";
import AdminAIUsage, { validateAIUsageFilters } from "./AdminAIUsage";

const auth = vi.hoisted(() => ({ user: { id: "admin", isPlatformAdmin: true }, token: "session-a", stored: "session-a", query: "" }));
vi.mock("@/store/hooks", () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: auth.user, accessToken: auth.token } }) }));
vi.mock("@/lib/auth/session", () => ({ getStoredAccessToken: () => auth.stored }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(auth.query) }));
vi.mock("@/api/endpoints/admin.api", () => ({ default: { getAIUsage: vi.fn() } }));

const userId = "00000000-0000-0000-0000-000000000001";
const workspaceId = "00000000-0000-0000-0000-000000000002";
const metrics: AdminAIUsageMetrics = { textGenerations: 30, imageGenerations: 7, providerCalls: 11, textProviderCalls: 8, imageProviderCalls: 3, providerQuantity: 13, inputTokens: 400, outputTokens: 120, cacheReadTokens: 20, cacheWriteTokens: 9, pricedCalls: 9, unpricedCalls: 2, failedCalls: 1, filteredCalls: 1, unattributedCalls: 1, legacyTextGenerations: 3, legacyImageGenerations: 2, estimatedKnownCostUsd: 1.25, totalCostUsd: null, estimatedCostUsd: null, historicalUnknown: true };
const item: AdminAIUsageItem = { ...metrics, id: userId, name: "Ada Lovelace", email: "ada@example.com", userId, workspaceId: null, modelId: null };
const report: AdminAIUsageReport = { startDate: "2026-09-25", endDate: "2026-10-24", currency: "USD", costBasis: "configured_estimate", groupBy: "user", summary: metrics, items: [item], total: 1, page: 1, pageSize: 20, totalPages: 1, daily: [{ ...metrics, date: "2026-10-24" }], models: [{ ...item, id: "model-x", name: "model-x", userId: null, modelId: "model-x" }], pricing: [{ modelId: "model-x", inputPerMillionUsd: 0.1, outputPerMillionUsd: 0, aliasOf: "base-model", region: "us-east-1" }], limitations: ["USD costs are configured estimates, not provider invoices."] };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function ready() { return screen.findByRole("region", { name: "AI usage groups" }); }
async function choose(label: string, option: string) { const user = userEvent.setup(); await user.click(screen.getByRole("combobox", { name: label })); await user.click(screen.getByRole("option", { name: option })); }

beforeEach(() => {
  vi.resetAllMocks(); auth.user = { id: "admin", isPlatformAdmin: true }; auth.token = "session-a"; auth.stored = "session-a"; auth.query = "";
  vi.mocked(adminApi.getAIUsage).mockResolvedValue(report);
  HTMLElement.prototype.scrollIntoView = vi.fn(); HTMLElement.prototype.hasPointerCapture = () => false; HTMLElement.prototype.setPointerCapture = vi.fn(); HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("AdminAIUsage", () => {
  it("defaults to 30 UTC days with no fabricated loading totals", async () => {
    const pending = deferred<AdminAIUsageReport>(); vi.mocked(adminApi.getAIUsage).mockReturnValue(pending.promise);
    render(<AdminAIUsage />);
    expect(screen.getByRole("status", { name: "Loading AI usage" })).toBeTruthy();
    expect(screen.queryByText(/\$\d/)).toBeNull();
    await waitFor(() => expect(adminApi.getAIUsage).toHaveBeenCalledWith({ days: 30, groupBy: "user", kind: "all", search: undefined, userId: undefined, workspaceId: undefined, sort: "cost", order: "desc", page: 1, pageSize: 20 }, expect.any(AbortSignal)));
    await act(async () => pending.resolve(report)); await ready();
    expect(screen.getByText(/2026-09-25 through 2026-10-24/)).toBeTruthy();
  });

  it("keeps generation units distinct from calls and unknown full cost distinct from the known subtotal", async () => {
    render(<AdminAIUsage />); const table = within(await ready());
    expect(table.getByRole("cell", { name: "30" })).toBeTruthy(); expect(table.getByRole("cell", { name: "7" })).toBeTruthy();
    expect(table.getByText("11")).toBeTruthy(); expect(table.getByText("$1.25")).toBeTruthy();
    expect(table.getByText("Total: Unknown · partial estimate")).toBeTruthy();
    expect(screen.queryByText(/Total estimate: \$0/)).toBeNull();
    expect(screen.getByText(/never assumed to match one-to-one/)).toBeTruthy();
    expect(screen.getByText(/Historical costs unknown; total estimate is partial/)).toBeTruthy();
    fireEvent.click(table.getByText("Usage details"));
    expect(table.getByText("400")).toBeTruthy(); expect(table.getByText("Legacy text units")).toBeTruthy();
    expect(table.getByRole("link", { name: "Scope AI usage" }).getAttribute("href")).toBe(`/admin/ai-usage?userId=${userId}`);
  });

  it("never presents a zero known subtotal as a complete zero total when unpriced calls exist", async () => {
    vi.mocked(adminApi.getAIUsage).mockResolvedValue({ ...report, summary: { ...metrics, estimatedKnownCostUsd: 0, historicalUnknown: false, legacyTextGenerations: 0, legacyImageGenerations: 0 }, items: [{ ...item, estimatedKnownCostUsd: 0 }] });
    render(<AdminAIUsage />); await ready();
    expect(screen.getAllByText("$0.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Total: Unknown · partial estimate").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Total estimate: \$0/)).toBeNull();
  });

  it("shows a legitimate complete zero only for an empty known scope", async () => {
    const zero = Object.fromEntries(Object.keys(metrics).map((key) => [key, key === "historicalUnknown" ? false : 0])) as AdminAIUsageMetrics;
    vi.mocked(adminApi.getAIUsage).mockResolvedValue({ ...report, summary: zero, items: [], models: [], daily: [], total: 0 });
    render(<AdminAIUsage />); await screen.findByText("No AI usage found");
    expect(screen.getByText("Total estimate: $0.00")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("forwards presets, grouping, kind, sort and order to the server", async () => {
    render(<AdminAIUsage />); await ready();
    await choose("UTC period", "Last 7 days"); await ready(); expect(adminApi.getAIUsage).toHaveBeenLastCalledWith(expect.objectContaining({ days: 7 }), expect.any(AbortSignal));
    await choose("UTC period", "Last 90 days"); await ready();
    await choose("Group by", "Model"); await ready();
    await choose("Generation kind", "Image"); await ready();
    await choose("Sort by", "Provider calls"); await ready();
    await choose("Sort order", "Lowest first"); await ready();
    await choose("Rows per page", "50"); await ready();
    expect(adminApi.getAIUsage).toHaveBeenLastCalledWith(expect.objectContaining({ days: 90, groupBy: "model", kind: "image", sort: "count", order: "asc", pageSize: 50, page: 1 }), expect.any(AbortSignal));
  });

  it("uses server pagination and resets to page one while immediately clearing stale summaries on search", async () => {
    vi.mocked(adminApi.getAIUsage).mockImplementation(async (params) => ({ ...report, total: 41, totalPages: 3, page: params?.page ?? 1, summary: { ...metrics, textGenerations: 9000 } }));
    render(<AdminAIUsage />); await ready();
    fireEvent.click(screen.getByRole("button", { name: "Next" })); await screen.findByText("Page 2 of 3");
    expect(adminApi.getAIUsage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.any(AbortSignal));
    const count = vi.mocked(adminApi.getAIUsage).mock.calls.length;
    fireEvent.change(screen.getByLabelText("Search grouped identities"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Search grouped identities"), { target: { value: "Ada [literal]" } });
    expect(screen.queryByText("9,000")).toBeNull(); expect(screen.queryByRole("region", { name: "AI usage groups" })).toBeNull();
    expect(adminApi.getAIUsage).toHaveBeenCalledTimes(count);
    await ready();
    expect(adminApi.getAIUsage).toHaveBeenCalledTimes(count + 1);
    expect(adminApi.getAIUsage).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Ada [literal]", page: 1 }), expect.any(AbortSignal));
    expect(screen.getByText("9,000")).toBeTruthy();
  });

  it("aborts old requests during debounce and ignores their late success", async () => {
    const old = deferred<AdminAIUsageReport>(); vi.mocked(adminApi.getAIUsage).mockReturnValueOnce(old.promise);
    render(<AdminAIUsage />); await waitFor(() => expect(adminApi.getAIUsage).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(adminApi.getAIUsage).mock.calls[0][1];
    fireEvent.change(screen.getByLabelText("Search grouped identities"), { target: { value: "Ada" } });
    expect(signal?.aborted).toBe(true);
    await act(async () => old.resolve({ ...report, summary: { ...metrics, textGenerations: 99999 } }));
    expect(screen.queryByText("99,999")).toBeNull(); await ready();
    expect(screen.queryByText("99,999")).toBeNull();
  });

  it("ignores stale failures after newer success and corrects a vanished page", async () => {
    const old = deferred<AdminAIUsageReport>(); vi.mocked(adminApi.getAIUsage).mockReturnValueOnce(old.promise).mockResolvedValue({ ...report, total: 21, totalPages: 2 });
    render(<AdminAIUsage />); await waitFor(() => expect(adminApi.getAIUsage).toHaveBeenCalledTimes(1));
    await choose("Generation kind", "Text"); await ready();
    await act(async () => old.reject(new Error("late"))); expect(screen.queryByRole("alert")).toBeNull();
    vi.mocked(adminApi.getAIUsage).mockResolvedValue(report);
    fireEvent.click(screen.getByRole("button", { name: "Next" })); await ready();
    expect(adminApi.getAIUsage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }), expect.any(AbortSignal));
  });

  it("validates paired explicit UTC dates and sends no days preset with a custom range", async () => {
    render(<AdminAIUsage />); await ready(); const count = vi.mocked(adminApi.getAIUsage).mock.calls.length;
    await choose("UTC period", "Explicit UTC dates"); expect(screen.getByRole("alert").textContent).toContain("1–366 inclusive UTC days");
    expect(screen.queryByRole("region", { name: "AI usage groups" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Start date (UTC)"), { target: { value: "2025-01-01" } });
    fireEvent.change(screen.getByLabelText("End date (UTC)"), { target: { value: "2026-01-02" } });
    expect(adminApi.getAIUsage).toHaveBeenCalledTimes(count); expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Start date (UTC)"), { target: { value: "2026-01-02" } }); await ready();
    const params = vi.mocked(adminApi.getAIUsage).mock.calls.at(-1)![0];
    expect(params).toMatchObject({ startDate: "2026-01-02", endDate: "2026-01-02" }); expect(params).not.toHaveProperty("days");
  });

  it.each([
    ["2024-02-29", "2024-02-29", true], ["2025-02-29", "2025-03-01", false], ["2026-02-30", "2026-03-01", false],
    ["2026-01-02", "2026-01-01", false], ["2024-01-01", "2024-12-31", true], ["2024-01-01", "2025-01-01", false],
    ["", "2026-01-01", false], ["2026-1-01", "2026-01-02", false], ["2028-01-01", "2028-01-02", true],
  ])("validates UTC calendar boundaries %s to %s", (startDate, endDate, valid) => {
    expect(validateAIUsageFilters({ period: "custom", startDate, endDate, userId: "", workspaceId: "" }) === null).toBe(valid);
  });

  it("initializes query-linked UUID scopes and rejects malformed scope without a request", async () => {
    auth.query = `userId=${userId}&workspaceId=${workspaceId}`;
    const view = render(<AdminAIUsage />); await ready();
    expect(adminApi.getAIUsage).toHaveBeenLastCalledWith(expect.objectContaining({ userId, workspaceId }), expect.any(AbortSignal));
    expect((screen.getByLabelText("User ID scope") as HTMLInputElement).value).toBe(userId);
    auth.query = "workspaceId=not-a-uuid"; view.rerender(<AdminAIUsage />);
    expect(screen.getByRole("alert").textContent).toContain("valid UUIDs"); expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(adminApi.getAIUsage).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Workspace ID scope"), { target: { value: workspaceId } }); await ready();
    expect(adminApi.getAIUsage).toHaveBeenLastCalledWith(expect.objectContaining({ workspaceId, groupBy: "workspace" }), expect.any(AbortSignal));
  });

  it("resets private data across sessions and discards old-session completions", async () => {
    const old = deferred<AdminAIUsageReport>(); vi.mocked(adminApi.getAIUsage).mockReturnValueOnce(old.promise);
    const view = render(<AdminAIUsage />); await waitFor(() => expect(adminApi.getAIUsage).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(adminApi.getAIUsage).mock.calls[0][1];
    auth.token = "session-b"; auth.stored = "session-b"; view.rerender(<AdminAIUsage />); expect(signal?.aborted).toBe(true); await ready();
    await act(async () => old.resolve({ ...report, summary: { ...metrics, textGenerations: 99999 } }));
    expect(screen.queryByText("99,999")).toBeNull();
  });

  it("rejects stored-session changes before Redux updates and aborts on unmount", async () => {
    const pending = deferred<AdminAIUsageReport>(); vi.mocked(adminApi.getAIUsage).mockReturnValue(pending.promise);
    const view = render(<AdminAIUsage />); await waitFor(() => expect(adminApi.getAIUsage).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(adminApi.getAIUsage).mock.calls[0][1];
    auth.stored = "session-b"; await act(async () => pending.resolve(report));
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    fireEvent.change(screen.getByLabelText("Search grouped identities"), { target: { value: "Ada" } });
    view.unmount(); expect(signal?.aborted).toBe(true); expect(adminApi.getAIUsage).toHaveBeenCalledTimes(1);
  });

  it("retries failures without showing empty success or dollars", async () => {
    vi.mocked(adminApi.getAIUsage).mockRejectedValueOnce(new Error("offline"));
    render(<AdminAIUsage />); await screen.findByRole("alert");
    expect(screen.queryByText("No AI usage found")).toBeNull(); expect(screen.queryByText(/\$\d/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry AI usage" })); await ready();
  });

  it("gates all report requests behind platform administrator access", () => {
    auth.user.isPlatformAdmin = false; render(<AdminAIUsage />);
    expect(screen.getByRole("alert").textContent).toContain("administrator access"); expect(adminApi.getAIUsage).not.toHaveBeenCalled();
  });

  it("bounds breakdown rows and renders allowlisted read-only rates, missing rates and configured zero distinctly", async () => {
    vi.mocked(adminApi.getAIUsage).mockResolvedValue({ ...report, daily: Array.from({ length: 31 }, (_, i) => ({ ...metrics, date: `2026-10-${String(i + 1).padStart(2, "0")}` })), pricing: [{ ...report.pricing[0], ...{ apiKey: "secret-never-render" } }] });
    render(<AdminAIUsage />); await ready();
    fireEvent.click(screen.getByText("Daily & model breakdown"));
    const daily = within(screen.getByRole("region", { name: "Daily breakdown table" }));
    expect(daily.getAllByRole("row")).toHaveLength(21); expect(daily.queryByText("2026-10-21")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next daily" }));
    expect(daily.getByText("2026-10-21")).toBeTruthy(); expect(daily.getAllByRole("row")).toHaveLength(12);
    fireEvent.click(screen.getByText("Read-only pricing configuration"));
    const pricing = within(screen.getByRole("region", { name: "Configured pricing" }));
    expect(pricing.getByText("$0.10")).toBeTruthy(); expect(pricing.getByText("$0.00")).toBeTruthy();
    expect(pricing.getAllByText("Not configured")).toHaveLength(3); expect(pricing.getByText("Alias of base-model")).toBeTruthy();
    expect(screen.queryByText("secret-never-render")).toBeNull(); expect(pricing.queryByRole("button")).toBeNull();
  });

  it("has accessible filters and keyboard-scrollable contained tables", async () => {
    const view = render(<AdminAIUsage />); const region = await ready();
    expect(region.getAttribute("tabindex")).toBe("0"); expect(region.className).toContain("overflow-x-auto");
    expect((await axe(view.container)).violations).toEqual([]);
  });
});