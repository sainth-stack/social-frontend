import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore, type UnknownAction } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { axe } from "vitest-axe";
import authReducer from "@/features/auth/authSlice";
import type { User } from "@/types/auth";
import type { SocialSettings } from "@/types/social-media.types";
import SettingsPage from "./SettingsPage";
import SocialSettingsForm from "./SocialSettingsForm";

const controls = vi.hoisted(() => ({ query: "", loading: false, error: null as string | null, saveError: null as string | null, canEdit: true, saving: false, empty: false, initial: null as SocialSettings | null, savedForm: null as SocialSettings | null, save: vi.fn(), patch: vi.fn(), reset: vi.fn(), reload: vi.fn(), navigate: vi.fn() }));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(controls.query) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props} onClick={(event) => { event.preventDefault(); controls.navigate(href); }}>{children}</a> }));
vi.mock("@/hooks/useWorkspaceSettings", () => ({ useWorkspaceSettings: () => {
  const [form, setForm] = useState<SocialSettings | null>(() => controls.empty ? null : structuredClone(controls.initial));
  const [saved, setSaved] = useState(form);
  return {
    form, saved, loading: controls.loading, error: controls.error, saveError: controls.saveError, canEdit: controls.canEdit, saving: controls.saving,
    dirty: JSON.stringify(form) !== JSON.stringify(saved),
    patch: <K extends keyof SocialSettings>(key: K, value: SocialSettings[K]) => { controls.patch(key, value); setForm((current) => current ? { ...current, [key]: value } : null); },
    save: async () => { controls.savedForm = form; const success = await controls.save(); if (success) setSaved(form); return success; },
    reset: () => { controls.reset(); setForm(saved); }, reload: controls.reload,
  };
} }));

const admin: User = { id: "user-1", email: "admin@example.com", name: "Alex", isPlatformAdmin: false, workspaceId: "workspace-1", workspaceName: "Acme", socialPermissionLevel: "admin", plan: "growth" };
const settings: SocialSettings = {
  id: "settings-1", orgId: "workspace-1", timezone: "UTC", defaultLanguage: "en", enabledPlatforms: { facebook: true, instagram: true, linkedin: false, x: false },
  defaultPostingTimes: { mon: ["09:00"], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] }, queueGapMinutes: 30, blackoutDates: [],
  defaultTone: "Friendly", defaultCta: "Learn more", hashtagCount: 5, autoFirstComment: false, imageGenerationStyle: "Photographic", openaiModel: "gpt-4o-mini", systemPromptOverride: null,
  approvalRequired: false, approverUserIds: ["unknown-user"], approvalSlaHours: 24, approvalSlaAction: "none", notificationDelivery: "in_app", notificationEvents: { post_failed: true },
  usage: { plan: "growth", accounts: { used: 1, limit: 3 }, postsThisMonth: { used: 0, limit: 50 }, templates: { used: 0, limit: 10 }, brandVoice: true, approvalWorkflow: true },
};

function renderSettings(section?: React.ComponentProps<typeof SettingsPage>["section"], overrides: Partial<User> = {}) {
  const initial = { ...authReducer(undefined, { type: "init" }), user: { ...admin, ...overrides }, accessToken: "test-token", isAuthenticated: true, isHydrated: true };
  const store = configureStore({ reducer: { auth: (state: ReturnType<typeof authReducer> = initial, action: UnknownAction) => action.type === "test/user" ? { ...state, user: { ...state.user!, ...(action.payload as Partial<User>) } } : authReducer(state, action) } });
  return { ...render(<Provider store={store}><SettingsPage section={section} /></Provider>), store };
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: () => {} });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: () => {} });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => {} });
  controls.query = ""; controls.loading = false; controls.error = null; controls.saveError = null; controls.canEdit = true; controls.saving = false; controls.empty = false;
  controls.initial = structuredClone(settings); controls.savedForm = null;
  controls.save.mockReset().mockResolvedValue(true); controls.patch.mockReset(); controls.reset.mockReset(); controls.reload.mockReset().mockResolvedValue(undefined); controls.navigate.mockReset();
  window.history.replaceState({}, "", "/dashboard/settings");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); document.documentElement.classList.remove("dark"); });

describe("SettingsPage", () => {
  it("provides all existing routes with one page heading and associated fields", () => {
    renderSettings();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: "General" })).toBeTruthy();
    expect((screen.getByLabelText("Workspace name") as HTMLInputElement).value).toBe("Acme");
    expect(screen.getByLabelText("Timezone")).toBeTruthy();
    const routes = ["/dashboard/settings", "/dashboard/settings?tab=notifications", "/dashboard/settings?tab=appearance", "/dashboard/settings/schedule", "/dashboard/settings/ai", "/dashboard/settings/approval", "/dashboard/settings/team"];
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(routes);
    expect(screen.getByRole("link", { name: "General" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  it.each(["notifications", "appearance"])("reads the %s query section", (tab) => {
    controls.query = `tab=${tab}`;
    renderSettings();
    expect(screen.getByRole("heading", { level: 2, name: tab === "appearance" ? "Appearance" : "Notifications" })).toBeTruthy();
  });

  it("falls back to general for an unknown tab", () => {
    controls.query = "tab=unknown";
    renderSettings();
    expect(screen.getByRole("heading", { level: 2, name: "General" })).toBeTruthy();
  });

  it("keeps the legacy section wrapper and explicit section precedence", () => {
    controls.query = "tab=appearance";
    const store = configureStore({ reducer: { auth: () => ({ user: admin }) } });
    render(<Provider store={store}><SocialSettingsForm section="ai" /></Provider>);
    expect(screen.getByLabelText("Default tone")).toBeTruthy();
    expect(screen.getByText(/backend-managed AWS Bedrock/)).toBeTruthy();
    expect(screen.getByLabelText("Legacy model preference")).toBeTruthy();
  });

  it("edits and saves settings and removes the clean footer", async () => {
    renderSettings("ai");
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Default tone"));
    await user.type(screen.getByLabelText("Default tone"), "Warm");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(controls.save).toHaveBeenCalledTimes(1));
    expect(controls.savedForm?.defaultTone).toBe("Warm");
    expect(screen.queryByRole("button", { name: "Reset changes" })).toBeNull();
  });

  it("resets edited fields without saving", async () => {
    renderSettings("ai");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Default CTA"), " today");
    await user.click(screen.getByRole("button", { name: "Reset changes" }));
    expect((screen.getByLabelText("Default CTA") as HTMLInputElement).value).toBe("Learn more");
    expect(controls.save).not.toHaveBeenCalled();
  });

  it("preserves comma typing and commits all schedule drafts before Enter save", async () => {
    renderSettings("schedule");
    const user = userEvent.setup();
    const monday = screen.getByLabelText("MON times");
    await user.type(monday, ", 18:30");
    expect((monday as HTMLInputElement).value).toBe("09:00, 18:30");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(controls.save).toHaveBeenCalledTimes(1));
    expect(controls.savedForm?.defaultPostingTimes.mon).toEqual(["09:00", "18:30"]);
  });

  it.each([["MON times", "25:00", /HH:MM/], ["Blackout dates", "2026-02-30", /valid dates/]])("rejects invalid %s without saving", async (label, value, message) => {
    renderSettings("schedule");
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(label));
    await user.type(screen.getByLabelText(label), value);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert").textContent).toMatch(message);
    expect(controls.save).not.toHaveBeenCalled();
  });

  it("preserves unknown approver IDs and exposes a warning for empty approvers", async () => {
    renderSettings("approval");
    const user = userEvent.setup();
    const ids = screen.getByLabelText("Approver user IDs");
    await user.type(ids, ", another-user");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(controls.savedForm?.approverUserIds).toEqual(["unknown-user", "another-user"]));
    await user.clear(ids);
    await user.click(screen.getByRole("switch", { name: "Require approval before publishing" }));
    expect(screen.getByText(/No approvers selected/)).toBeTruthy();
  });

  it("gates approval settings by the actual plan feature", () => {
    controls.initial = { ...settings, usage: { ...settings.usage!, approvalWorkflow: false } };
    renderSettings("approval");
    expect(screen.getByText(/not included in your current plan/)).toBeTruthy();
    expect((screen.getByLabelText("Approval SLA (hours)") as HTMLInputElement).matches(":disabled")).toBe(true);
  });

  it("keeps all six notification events including approval decisions", async () => {
    renderSettings("notifications");
    expect(screen.getAllByRole("switch")).toHaveLength(6);
    await userEvent.setup().click(screen.getByRole("switch", { name: "Approval decisions" }));
    expect(controls.patch).toHaveBeenLastCalledWith("notificationEvents", { post_failed: true, approval_resolved: true });
  });

  it("applies and remembers device-local theme without a server save", async () => {
    controls.canEdit = false;
    controls.loading = true;
    renderSettings("appearance");
    await userEvent.setup().click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("opsbrain-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed")).toBe("true");
    expect(controls.save).not.toHaveBeenCalled();
    expect(controls.patch).not.toHaveBeenCalled();
  });

  it("still applies theme when local storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
    renderSettings("appearance");
    await userEvent.setup().click(screen.getByRole("button", { name: "Dark" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("status").textContent).toMatch(/could not remember/);
  });

  it("shows only pending skeletons and a retryable inline load failure", async () => {
    controls.loading = true;
    const view = renderSettings();
    expect(screen.getByRole("status", { name: "Loading settings" })).toBeTruthy();
    controls.loading = false; controls.error = "Offline";
    view.rerender(<Provider store={view.store}><SettingsPage /></Provider>);
    expect(screen.queryByRole("status", { name: "Loading settings" })).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Offline");
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry loading settings" }));
    expect(controls.reload).toHaveBeenCalledTimes(1);
  });

  it("keeps drafts on save failure and retries", async () => {
    controls.save.mockResolvedValue(false);
    controls.saveError = "Permission changed";
    renderSettings("ai");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Default tone"), " updated");
    await user.click(screen.getByRole("button", { name: "Retry saving settings" }));
    expect((screen.getByLabelText("Default tone") as HTMLInputElement).value).toBe("Friendly updated");
    expect(screen.getByRole("alert").textContent).toContain("Permission changed");
    expect(controls.save).toHaveBeenCalledTimes(1);
  });

  it("disables settings for nonadmins and all controls while saving", () => {
    controls.canEdit = false;
    const view = renderSettings("ai");
    expect((screen.getByLabelText("Default tone") as HTMLInputElement).matches(":disabled")).toBe(true);
    expect(screen.getByText(/Read-only access/)).toBeTruthy();
    controls.canEdit = true; controls.saving = true;
    view.rerender(<Provider store={view.store}><SettingsPage section="ai" /></Provider>);
    expect((screen.getByLabelText("Default tone") as HTMLInputElement).matches(":disabled")).toBe(true);
    expect((screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("confirms dirty navigation and resets only after confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderSettings("ai");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Default tone"), " changed");
    await user.click(screen.getByRole("link", { name: "Notifications" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(controls.navigate).not.toHaveBeenCalled();
    expect(controls.reset).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("link", { name: "Notifications" }));
    expect(controls.navigate).toHaveBeenCalledWith("/dashboard/settings?tab=notifications");
    expect(controls.reset).toHaveBeenCalledTimes(1);
  });

  it("guards reload and clears local drafts on workspace change", async () => {
    const view = renderSettings("schedule");
    await userEvent.setup().type(screen.getByLabelText("MON times"), ",");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    act(() => view.store.dispatch({ type: "test/user", payload: { workspaceId: "workspace-2" } }));
    expect((screen.getByLabelText("MON times") as HTMLInputElement).value).toBe("09:00");
  });

  it("restores the settings URL when dirty browser-history navigation is declined", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderSettings("ai");
    await userEvent.setup().type(screen.getByLabelText("Default tone"), " changed");
    window.history.replaceState({}, "", "/dashboard/settings/schedule");
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/dashboard/settings");
    expect((screen.getByLabelText("Default tone") as HTMLInputElement).value).toBe("Friendly changed");
  });

  it("edits general timezone, language and platform preferences", async () => {
    renderSettings();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Timezone"));
    await user.click(screen.getByRole("option", { name: "Asia/Tokyo" }));
    await user.click(screen.getByLabelText("Default language"));
    await user.click(screen.getByRole("option", { name: "Hindi" }));
    await user.click(screen.getByRole("switch", { name: "Linkedin" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(controls.save).toHaveBeenCalledTimes(1));
    expect(controls.savedForm?.timezone).toBe("Asia/Tokyo");
    expect(controls.savedForm?.defaultLanguage).toBe("hi");
    expect(controls.savedForm?.enabledPlatforms.linkedin).toBe(true);
  });

  it("renders missing workspace and empty settings without a skeleton", () => {
    const view = renderSettings(undefined, { workspaceId: "" });
    expect(screen.getByText("Select a workspace to view settings.")).toBeTruthy();
    view.unmount();
    controls.empty = true;
    renderSettings();
    expect(screen.getByText("No settings are available for this workspace.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload settings" })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Loading settings" })).toBeNull();
  });

  it("prevents overlapping submit actions", async () => {
    controls.save.mockImplementation(() => new Promise(() => {}));
    renderSettings("ai");
    fireEvent.change(screen.getByLabelText("Default tone"), { target: { value: "Changed" } });
    const button = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(controls.save).toHaveBeenCalledTimes(1));
  });

  it.each(["general", "notifications", "appearance", "schedule", "ai", "approval"] as const)("has no axe violations in %s", async (section) => {
    const { container } = renderSettings(section);
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});