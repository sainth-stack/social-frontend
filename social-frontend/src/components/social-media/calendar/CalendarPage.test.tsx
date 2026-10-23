import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { axe } from "vitest-axe";
import socialMediaApi from "@/api/endpoints/social-media.api";
import type { CalendarPost, CalendarResponse } from "@/types/social-media.types";
import CalendarPage from "./CalendarPage";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/api/endpoints/social-media.api", () => ({ default: { getCalendar: vi.fn() } }));

function post(id: string, day = 12, status: CalendarPost["status"] = "scheduled", platform: "facebook" | "linkedin" = "linkedin"): CalendarPost {
  const now = new Date();
  return { id, title: `Campaign ${id}`, status, scheduledAt: new Date(now.getFullYear(), now.getMonth(), day, 14).toISOString(), publishedAt: null, platforms: [platform], captionPreview: "A useful update for our community", imageUrl: null };
}

function renderCalendar(workspaceId = "workspace") {
  const store = configureStore({ reducer: { auth: () => ({ user: { workspaceId } }) } });
  return render(<Provider store={store}><CalendarPage /></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(socialMediaApi.getCalendar).mockResolvedValue({ month: "", items: [post("one"), post("two", 15, "published", "facebook")] });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: false }) });
});
afterEach(cleanup);

describe("CalendarPage", () => {
  it("loads the selected month with one page heading and useful summaries", async () => {
    renderCalendar();
    await screen.findByRole("grid");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Posts on calendar" })).toBeTruthy();
    expect(socialMediaApi.getCalendar).toHaveBeenCalledTimes(1);
    expect(socialMediaApi.getCalendar).toHaveBeenCalledWith("workspace", expect.stringMatching(/^\d{4}-\d{2}$/));
    expect(screen.getByText(/Times shown in/)).toBeTruthy();
  });

  it("shows a matching skeleton while the initial request is pending", () => {
    vi.mocked(socialMediaApi.getCalendar).mockReturnValue(new Promise(() => {}));
    renderCalendar();
    expect(screen.getByRole("status", { name: "Loading calendar" })).toBeTruthy();
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("offers a retry instead of presenting a failure as an empty calendar", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.getCalendar).mockRejectedValueOnce(new Error("Offline"));
    renderCalendar();
    await screen.findByRole("alert");
    expect(screen.queryByText("A fresh month of possibilities")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("grid")).toBeTruthy();
  });

  it("uses an agenda by default on small screens", async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    renderCalendar();
    expect(await screen.findByRole("button", { name: /Campaign one/ })).toBeTruthy();
    expect(screen.queryByRole("grid")).toBeNull();
    expect(screen.getByRole("button", { name: "agenda" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("filters channels locally without additional API requests", async () => {
    const user = userEvent.setup();
    renderCalendar();
    await screen.findByRole("grid");
    await user.click(screen.getByRole("button", { name: "Facebook" }));
    expect(screen.queryByRole("button", { name: /Campaign one/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Campaign two/ })).toBeTruthy();
    expect(socialMediaApi.getCalendar).toHaveBeenCalledTimes(1);
  });

  it("supports arrow-key navigation and date-prefilled creation", async () => {
    const user = userEvent.setup();
    renderCalendar();
    await screen.findByRole("grid");
    const dates = screen.getAllByRole("button", { name: /^Create a post for/ });
    dates[10].focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(dates[11]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(dates[18]);
    await user.keyboard("{Enter}");
    const url = navigation.push.mock.calls[0][0];
    expect(new URL(url, "http://localhost").searchParams.get("scheduleAt")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("opens a post sheet without triggering date creation", async () => {
    const user = userEvent.setup();
    renderCalendar();
    await user.click(await screen.findByRole("button", { name: /Campaign one/ }));
    expect(screen.getByRole("dialog", { name: "Campaign one" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View post details" }).getAttribute("href")).toBe("/dashboard/posts/one");
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("lets users inspect every post on overflow days", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.getCalendar).mockResolvedValue({ month: "", items: [post("one"), post("two"), post("three"), post("four")] });
    renderCalendar();
    await user.click(await screen.findByRole("button", { name: /\+2 more/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Campaign four/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Campaign four/ }));
    expect(screen.getByRole("link", { name: "View post details" }).getAttribute("href")).toBe("/dashboard/posts/four");
  });

  it("retains the current month during a refresh failure", async () => {
    const user = userEvent.setup();
    renderCalendar();
    await screen.findByRole("grid");
    vi.mocked(socialMediaApi.getCalendar).mockRejectedValueOnce(new Error("Offline"));
    await user.click(screen.getByRole("button", { name: "Refresh calendar" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Campaign one/ })).toBeTruthy();
  });

  it("ignores stale month responses after navigation", async () => {
    const user = userEvent.setup();
    let resolveOld!: (value: CalendarResponse) => void;
    vi.mocked(socialMediaApi.getCalendar).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce({ month: "", items: [] });
    renderCalendar();
    await user.click(screen.getByRole("button", { name: "Next month" }));
    await screen.findByText("A fresh month of possibilities");
    await act(async () => resolveOld({ month: "", items: [post("obsolete")] }));
    expect(screen.queryByRole("button", { name: /Campaign obsolete/ })).toBeNull();
  });

  it("shows an empty-state action and can return to the current month", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.getCalendar).mockResolvedValue({ month: "", items: [] });
    renderCalendar();
    await screen.findByText("A fresh month of possibilities");
    const initial = vi.mocked(socialMediaApi.getCalendar).mock.calls[0][1];
    await user.click(screen.getByRole("button", { name: "Next month" }));
    await waitFor(() => expect(socialMediaApi.getCalendar).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "Today" }));
    await waitFor(() => expect(socialMediaApi.getCalendar).toHaveBeenLastCalledWith("workspace", initial));
  });

  it("passes automated accessibility checks without nested buttons", async () => {
    const { container } = renderCalendar();
    await screen.findByRole("grid");
    expect(container.querySelector("button button")).toBeNull();
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});