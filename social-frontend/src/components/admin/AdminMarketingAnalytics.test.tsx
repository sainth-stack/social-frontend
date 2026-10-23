import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import adminApi from "@/api/endpoints/admin.api";
import type { MarketingAnalytics } from "@/types/admin";
import AdminMarketingAnalytics from "./AdminMarketingAnalytics";

const auth = vi.hoisted(() => ({ user: { id: "admin", isPlatformAdmin: true }, token: "session-a", stored: "session-a" }));
vi.mock("@/store/hooks", () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: auth.user, accessToken: auth.token } }) }));
vi.mock("@/lib/auth/session", () => ({ getStoredAccessToken: () => auth.stored }));
vi.mock("@/api/endpoints/admin.api", () => ({ default: { getMarketingAnalytics: vi.fn() } }));

const analytics: MarketingAnalytics = {
  pageViews30d: 1234,
  signupClicks30d: 40,
  contactClicks30d: 17,
  contacts30d: 9,
  newContacts: 12,
  inProgressContacts: 5,
  resolvedContacts: 28,
  daily: [{ date: "2026-10-23", pageViews: 100, signupClicks: 4, contactClicks: 2, contacts: 1 }],
};

beforeEach(() => {
  vi.resetAllMocks();
  auth.user = { id: "admin", isPlatformAdmin: true }; auth.token = "session-a"; auth.stored = "session-a";
  vi.mocked(adminApi.getMarketingAnalytics).mockResolvedValue(analytics);
});
afterEach(cleanup);

describe("AdminMarketingAnalytics", () => {
  it("shows a loading state without invented totals", () => {
    vi.mocked(adminApi.getMarketingAnalytics).mockReturnValue(new Promise(() => {}));
    render(<AdminMarketingAnalytics />);
    expect(screen.getByRole("status", { name: "Loading marketing analytics" })).toBeTruthy();
    expect(screen.queryByText("1,234")).toBeNull();
  });

  it("renders real event totals, daily activity, all-time status counts and enquiries link", async () => {
    render(<AdminMarketingAnalytics />);
    expect(await screen.findByText("1,234")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByText("17")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
    expect(screen.getByText(/not unique visitors/)).toBeTruthy();
    expect(screen.getByText(/not registrations/)).toBeTruthy();
    expect(screen.getByText(/include all enquiries/)).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("28")).toBeTruthy();
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Date (UTC)" })).toBeTruthy();
    expect(within(table).getByRole("rowheader", { name: "2026-10-23" })).toBeTruthy();
    expect(within(table).getByText("100")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View enquiries" }).getAttribute("href")).toBe("/admin/contacts");
  });

  it("does not display zero totals on failure and supports retry", async () => {
    vi.mocked(adminApi.getMarketingAnalytics).mockRejectedValueOnce(new Error("Offline"));
    render(<AdminMarketingAnalytics />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Page views")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry marketing analytics" }));
    expect(await screen.findByText("1,234")).toBeTruthy();
    expect(adminApi.getMarketingAnalytics).toHaveBeenCalledTimes(2);
  });

  it.each([{ daily: [] }, { daily: [{ date: "2026-10-23", pageViews: 0, signupClicks: 0, contactClicks: 0, contacts: 0 }] }])("shows an empty state for zero activity", async ({ daily }) => {
    vi.mocked(adminApi.getMarketingAnalytics).mockResolvedValue({ pageViews30d: 0, signupClicks30d: 0, contactClicks30d: 0, contacts30d: 0, newContacts: 0, inProgressContacts: 0, resolvedContacts: 0, daily });
    render(<AdminMarketingAnalytics />);
    expect(await screen.findByText("No marketing activity recorded in the last 30 days.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("aborts its request on unmount and ignores late results", async () => {
    let resolve!: (value: MarketingAnalytics) => void;
    vi.mocked(adminApi.getMarketingAnalytics).mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<AdminMarketingAnalytics />);
    const signal = vi.mocked(adminApi.getMarketingAnalytics).mock.calls[0][0];
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => resolve(analytics));
    expect(screen.queryByText("1,234")).toBeNull();
  });

  it("has accessible summary and daily totals markup", async () => {
    const { container } = render(<AdminMarketingAnalytics />);
    await screen.findByText("1,234");
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it("does not confuse a missing daily breakdown with zero aggregate activity", async () => {
    vi.mocked(adminApi.getMarketingAnalytics).mockResolvedValue({ ...analytics, daily: [] });
    render(<AdminMarketingAnalytics />);
    await screen.findByText("1,234");
    expect(screen.getByText(/No daily breakdown returned/)).toBeTruthy();
    expect(screen.queryByText(/No marketing activity recorded/)).toBeNull();
    expect(screen.getByText(/Do Not Track \(DNT\)/)).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("preserves labelled stale totals on refresh failure and prevents duplicate refresh", async () => {
    render(<AdminMarketingAnalytics />);
    await screen.findByText("1,234");
    let reject!: (reason: Error) => void;
    vi.mocked(adminApi.getMarketingAnalytics).mockReturnValueOnce(new Promise((_, no) => { reject = no; }));
    const refresh = screen.getByRole("button", { name: "Refresh marketing analytics" });
    fireEvent.click(refresh); fireEvent.click(refresh);
    expect(adminApi.getMarketingAnalytics).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status").textContent).toContain("previously loaded data");
    expect(screen.getByText("1,234")).toBeTruthy();
    await act(async () => reject(new Error("Offline")));
    expect(screen.getByRole("alert").textContent).toContain("out of date");
    expect(screen.getByText("1,234")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry marketing analytics" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("refreshes an empty report", async () => {
    vi.mocked(adminApi.getMarketingAnalytics).mockResolvedValueOnce({ ...analytics, pageViews30d: 0, signupClicks30d: 0, contactClicks30d: 0, contacts30d: 0, daily: [] });
    render(<AdminMarketingAnalytics />);
    await screen.findByText("No marketing activity recorded in the last 30 days.");
    fireEvent.click(screen.getByRole("button", { name: "Refresh marketing analytics" }));
    expect(await screen.findByText("1,234")).toBeTruthy();
  });

  it("clears previous totals on session change and ignores late responses", async () => {
    const view = render(<AdminMarketingAnalytics />);
    await screen.findByText("1,234");
    let resolve!: (value: MarketingAnalytics) => void;
    vi.mocked(adminApi.getMarketingAnalytics).mockReturnValueOnce(new Promise((yes) => { resolve = yes; })).mockResolvedValueOnce({ ...analytics, pageViews30d: 5678 });
    fireEvent.click(screen.getByRole("button", { name: "Refresh marketing analytics" }));
    const signal = vi.mocked(adminApi.getMarketingAnalytics).mock.calls[1][0];
    auth.token = "session-b"; auth.stored = "session-b";
    view.rerender(<AdminMarketingAnalytics />);
    expect(screen.queryByText("1,234")).toBeNull();
    expect(signal?.aborted).toBe(true);
    await screen.findByText("5,678");
    await act(async () => resolve(analytics));
    expect(screen.queryByText("1,234")).toBeNull();
  });

  it("ignores responses if persisted auth changes before the component rerenders", async () => {
    let resolve!: (value: MarketingAnalytics) => void;
    vi.mocked(adminApi.getMarketingAnalytics).mockReturnValue(new Promise((yes) => { resolve = yes; }));
    render(<AdminMarketingAnalytics />);
    auth.stored = "session-b";
    await act(async () => resolve(analytics));
    expect(screen.queryByText("1,234")).toBeNull();
  });
});