import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Settings } from "lucide-react";
import { axe } from "vitest-axe";
import authReducer from "@/features/auth/authSlice";
import Sidebar from "./Sidebar";
import PortalLayout from "./PortalLayout";
import { adminNavSections, dashboardNavSections, type NavSection } from "./nav-config";
import uiReducer, { setMobileSidebarOpen } from "@/features/ui/uiSlice";
import { useDashboardUsage } from "@/hooks/useDashboardUsage";
import type { DashboardUsage } from "@/lib/dashboard-cache";
import type { User } from "@/types/auth";

const mocks = vi.hoisted(() => ({ pathname: "/dashboard/posts", fetch: vi.fn(), cached: vi.fn(), push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname, useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock("next/link", () => ({ default: ({ children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) mocks.push(props.href); event.preventDefault(); }}>{children}</a> }));
vi.mock("@/lib/dashboard-cache", () => ({ fetchDashboardUsageCached: mocks.fetch, getCachedDashboardUsage: mocks.cached }));
vi.mock("@/features/auth/AuthGuard", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("./Topbar", () => ({ default: ({ onMenuClick, onCollapseClick, collapsed, menuOpen, isAdmin }: {
  onMenuClick: () => void;
  onCollapseClick: () => void;
  collapsed: boolean;
  menuOpen: boolean;
  isAdmin: boolean;
}) => <header data-admin={isAdmin}><button id="navigation-menu-trigger" aria-expanded={menuOpen} onClick={onMenuClick}>Open navigation</button><button aria-pressed={collapsed} onClick={onCollapseClick}>Toggle sidebar</button></header> }));

const { default: ActualTopbar } = await vi.importActual<typeof import("./Topbar")>("./Topbar");

const usage: DashboardUsage = {
  plan: "starter", accounts: { used: 1, limit: 3 }, postsThisMonth: { used: 12, limit: 60 }, templates: { used: 0, limit: 10 }, approvalWorkflow: false, brandVoice: true,
};
const user: User = { id: "user", email: "user@example.com", name: "Alex", isPlatformAdmin: false, workspaceId: "workspace", workspaceName: "Acme", socialPermissionLevel: "admin", plan: "starter" };
const brand = { type: "organization" as const, name: "Acme Studio" };
let media: MediaQueryList;
let mediaListener: (() => void) | undefined;

function wrapperFor(overrides: Partial<User> = {}) {
  const store = configureStore({ reducer: { auth: (state = { user: { ...user, ...overrides } }) => state, ui: uiReducer } });
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
  return { store, wrapper };
}

function desktop(overrides: Partial<User> = {}, collapsed = false, sections = dashboardNavSections) {
  const { wrapper } = wrapperFor(overrides);
  return render(<Sidebar sections={sections} brand={brand} collapsed={collapsed} />, { wrapper });
}

beforeEach(() => {
  mocks.pathname = "/dashboard/posts";
  mocks.fetch.mockReset().mockResolvedValue(usage);
  mocks.cached.mockReset().mockReturnValue(null);
  mocks.push.mockReset();
  mocks.replace.mockReset();
  window.localStorage.clear();
  mediaListener = undefined;
  media = { matches: false, media: "(min-width: 1024px)", onchange: null, addEventListener: vi.fn((_type, listener) => { mediaListener = listener; }), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() } as unknown as MediaQueryList;
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  const style = document.createElement("style");
  style.dataset.navigationTest = "true";
  style.textContent = '.hidden { display: none !important; } [aria-label="Desktop sidebar"] { display: flex !important; } [hidden] { display: none !important; }';
  document.head.appendChild(style);
});

afterEach(() => {
  cleanup();
  document.querySelectorAll("style[data-navigation-test]").forEach((style) => style.remove());
  vi.unstubAllGlobals();
});

describe("Sidebar navigation", () => {
  it("preserves sections and uses exact aria-current with desktop widths", async () => {
    const { container } = desktop();
    await screen.findByText("12 / 60");
    expect(screen.getByRole("link", { name: "Posts" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Dashboard" }).hasAttribute("aria-current")).toBe(false);
    expect(screen.getAllByRole("link").filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Acme Studio · Social workspace" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByText("Create")).toBeTruthy();
    expect(screen.getByText("Insights")).toBeTruthy();
    expect(container.querySelector("aside")?.className).toContain("w-64");
    expect(container.querySelector("aside")?.className).toContain("lg:flex");
    expect(screen.getByRole("link", { name: "Posts" }).className).toContain("focus-visible:ring-2");
  });

  it("does not mark a route prefix as the current leaf", async () => {
    mocks.pathname = "/dashboard/posts/post-1";
    desktop();
    await screen.findByText("12 / 60");
    expect(screen.getByRole("link", { name: "Posts" }).hasAttribute("aria-current")).toBe(false);
  });

  it("provides collapsed icon labels and billing access", async () => {
    const { container } = desktop({}, true);
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    expect(container.querySelector("aside")?.className).toContain("w-20");
    expect(screen.getByRole("link", { name: "AI Studio" }).getAttribute("title")).toBe("AI Studio");
    expect(screen.getByRole("link", { name: "Manage billing" }).getAttribute("href")).toBe("/dashboard/billing");
  });

  it("connects expandable groups to their children and supports the keyboard", async () => {
    const sections: NavSection[] = [{ items: [{ label: "Workspace tools", href: "/tools", icon: Settings, children: [{ label: "Preferences", href: "/tools/preferences", icon: Settings }] }] }];
    desktop({}, false, sections);
    const group = screen.getByRole("button", { name: "Workspace tools" });
    expect(group.getAttribute("aria-expanded")).toBe("false");
    group.focus();
    await userEvent.keyboard("{Enter}");
    expect(group.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(group.getAttribute("aria-controls")!)?.contains(screen.getByRole("link", { name: "Preferences" }))).toBe(true);
  });

  it("preserves platform branding and workspace return without fetching usage", () => {
    mocks.pathname = "/admin/users";
    const { wrapper } = wrapperFor({ isPlatformAdmin: true });
    render(<Sidebar sections={adminNavSections} brand={{ type: "platform" }} />, { wrapper });
    expect(screen.getByRole("link", { name: "EarnedVoice" }).getAttribute("href")).toBe("/admin");
    expect(screen.getByRole("img", { name: "EarnedVoice" }).querySelector("img")?.getAttribute("src")).toBe("/brand/earnedvoice-mark.svg");
    expect(screen.getByRole("link", { name: "Back to workspace app" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("link", { name: "Users" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Workspaces" }).getAttribute("href")).toBe("/admin/workspaces");
    expect(screen.getByRole("link", { name: "AI Usage & Costs" }).getAttribute("href")).toBe("/admin/ai-usage");
    expect(screen.queryByRole("region", { name: "Plan and usage" })).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each(["enterprise", "viewer"])("keeps billing but hides Upgrade for %s", async (kind) => {
    desktop(kind === "enterprise" ? { plan: "enterprise" } : { socialPermissionLevel: "viewer" });
    await screen.findByText("12 / 60");
    expect(screen.queryByRole("link", { name: "Upgrade" })).toBeNull();
    expect(screen.getByRole("link", { name: "Manage billing" })).toBeTruthy();
  });

  it.each([[null, "0 / Unlimited"], [0, "0 / 0"]] as const)("preserves a %s limit without a fallback", async (limit, text) => {
    mocks.fetch.mockResolvedValue({ ...usage, postsThisMonth: { used: 0, limit } });
    desktop();
    await screen.findByText(text);
    expect(screen.queryByRole("progressbar") === null).toBe(limit === null);
  });

  it("shows a retry instead of fabricated counts after a usage failure", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("Offline"));
    desktop();
    await screen.findByRole("alert");
    expect(screen.queryByText("0 / 60")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Retry usage" }));
    await screen.findByText("12 / 60");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("rechecks the cached loader on route changes, not ordinary rerenders", async () => {
    const { rerender } = desktop();
    await screen.findByText("12 / 60");
    rerender(<Sidebar sections={dashboardNavSections} brand={brand} collapsed />);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    mocks.pathname = "/dashboard/calendar";
    rerender(<Sidebar sections={dashboardNavSections} brand={brand} />);
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
  });
});

describe("Mobile navigation", () => {
  function mobile(onClose = vi.fn()) {
    const { wrapper } = wrapperFor();
    return { onClose, ...render(<><button id="navigation-menu-trigger">Open navigation</button><Sidebar sections={dashboardNavSections} brand={brand} mobileOpen onMobileClose={onClose} /></>, { wrapper }) };
  }

  it("shares one usage load across desktop and mobile content and labels its dialog", async () => {
    mobile();
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    await within(dialog).findByText("12 / 60");
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole("link", { name: "Posts" }).getAttribute("aria-current")).toBe("page");
  });

  it.each(["Manage billing", "Upgrade", "Acme Studio · Social workspace", "Calendar"])("closes after the %s link", async (name) => {
    const { onClose } = mobile();
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("link", { name }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when the dirty-settings capture guard cancels navigation", async () => {
    const { onClose } = mobile();
    const guard = (event: Event) => { event.preventDefault(); event.stopPropagation(); };
    document.addEventListener("click", guard, true);
    try { await userEvent.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Manage billing" })); }
    finally { document.removeEventListener("click", guard, true); }
    expect(onClose).not.toHaveBeenCalled();
  });

  it("traps focus and requests close on Escape", async () => {
    const { onClose } = mobile();
    const dialog = screen.getByRole("dialog");
    const links = within(dialog).getAllByRole("link");
    links[links.length - 1].focus();
    await userEvent.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes with the close button and outside pointer", async () => {
    const { onClose } = mobile();
    await userEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(document.querySelector('[data-state="open"][class*="bg-foreground"]')!, { pointerType: "mouse", button: 0, ctrlKey: false });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("PortalLayout", () => {
  function portal() {
    const setup = wrapperFor();
    return { ...setup, ...render(<PortalLayout navSections={dashboardNavSections} brand={brand}><h1>Workspace overview</h1></PortalLayout>, { wrapper: setup.wrapper }) };
  }

  it("restores and persists collapse preference and exposes a skip target", async () => {
    window.localStorage.setItem("opsbrain-sidebar-collapsed", "true");
    const { container } = portal();
    expect(screen.getByRole("button", { name: "Toggle sidebar" }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".lg\\:pl-20")).toBeTruthy();
    expect(screen.getByRole("main").id).toBe("main-content");
    expect(screen.getByRole("main").tabIndex).toBe(-1);
    expect(screen.getByRole("link", { name: "Skip to main content" }).getAttribute("href")).toBe("#main-content");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    expect(window.localStorage.getItem("opsbrain-sidebar-collapsed")).toBe("false");
    expect(container.querySelector(".lg\\:pl-64")).toBeTruthy();
  });

  it("closes on Escape, restores trigger focus and closes at the desktop transition", async () => {
    const { store, unmount } = portal();
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(store.getState().ui.mobileSidebarOpen).toBe(true);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    await userEvent.click(trigger);
    act(() => { Object.defineProperty(media, "matches", { value: true }); mediaListener?.(); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(store.getState().ui.mobileSidebarOpen).toBe(false);
    unmount();
    expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("clears an already-open mobile state when mounted on desktop", () => {
    Object.defineProperty(media, "matches", { value: true });
    const { store, wrapper } = wrapperFor();
    store.dispatch(setMobileSidebarOpen(true));
    render(<PortalLayout navSections={dashboardNavSections} brand={brand}><h1>Dashboard</h1></PortalLayout>, { wrapper });
    expect(store.getState().ui.mobileSidebarOpen).toBe(false);
  });

  it("works when storage is unavailable", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Denied"); });
    try {
      portal();
      await userEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
      expect(screen.getByRole("button", { name: "Toggle sidebar" }).getAttribute("aria-pressed")).toBe("true");
    } finally { spy.mockRestore(); }
  });
});

describe("Actual Topbar", () => {
  function topbar(overrides: Partial<User> = {}, props: Parameters<typeof ActualTopbar>[0] = {}) {
    const store = configureStore({
      reducer: { auth: authReducer, ui: uiReducer },
      preloadedState: { auth: { user: { ...user, ...overrides }, accessToken: "test-token", isAuthenticated: true, isHydrated: true, isLoading: false, error: null } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
    return { store, ...render(<ActualTopbar {...props} />, { wrapper }) };
  }

  it("uses friendly dynamic post breadcrumbs with linked ancestors", () => {
    mocks.pathname = "/dashboard/posts/507f1f77bcf86cd799439011";
    topbar();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    const items = within(breadcrumb).getAllByRole("listitem", { hidden: true });
    expect(within(items[0]).getByText("Dashboard").getAttribute("href")).toBe("/dashboard");
    expect(within(items[1]).getByText("Posts").getAttribute("href")).toBe("/dashboard/posts");
    expect(within(breadcrumb).getByText("Post details").getAttribute("aria-current")).toBe("page");
    expect(breadcrumb.textContent).not.toContain("507f1f77bcf86cd799439011");
    expect(breadcrumb.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(screen.getByText("Acme")).toBeTruthy();
  });

  it.each(["drafts", "scheduled", "published", "failed", "archived", "publishing"])("keeps the %s breadcrumb instead of treating it as an id", (status) => {
    mocks.pathname = `/dashboard/posts/${status}`;
    topbar();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" }).querySelector('[aria-current="page"]')?.textContent).toBe(status[0].toUpperCase() + status.slice(1));
    expect(screen.queryByText("Post details")).toBeNull();
  });

  it("calls navigation and collapse callbacks and reflects their controlled state", async () => {
    const onMenuClick = vi.fn();
    const onCollapseClick = vi.fn();
    const { rerender } = topbar({}, { onMenuClick, onCollapseClick });
    const menu = screen.getByRole("button", { name: "Open navigation" });
    const collapse = screen.getByLabelText("Collapse sidebar");
    expect(menu.getAttribute("aria-controls")).toBe("mobile-navigation");
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(collapse.getAttribute("aria-controls")).toBe("desktop-navigation");
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
    await userEvent.click(menu);
    fireEvent.click(collapse);
    expect(onMenuClick).toHaveBeenCalledTimes(1);
    expect(onCollapseClick).toHaveBeenCalledTimes(1);
    rerender(<ActualTopbar onMenuClick={onMenuClick} onCollapseClick={onCollapseClick} collapsed menuOpen />);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("Expand sidebar").getAttribute("aria-expanded")).toBe("false");
  });

  it.each(["viewer", "editor", "publisher", "admin"] as const)("respects %s permissions in account links and create action", async (permission) => {
    topbar({ socialPermissionLevel: permission });
    expect(screen.queryByRole("link", { name: "Create a post" })?.getAttribute("href") ?? null).toBe(permission === "viewer" ? null : "/dashboard/content-studio/generate");
    await userEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Alex")).toBeTruthy();
    expect(within(menu).getByText("user@example.com")).toBeTruthy();
    expect(within(menu).getByText(permission[0].toUpperCase() + permission.slice(1))).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "Dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(within(menu).getByRole("menuitem", { name: "Plan & billing" }).getAttribute("href")).toBe("/dashboard/billing");
    expect(within(menu).queryByRole("menuitem", { name: "Workspace settings" })?.getAttribute("href") ?? null).toBe(permission === "admin" ? "/dashboard/settings" : null);
    expect(within(menu).queryByRole("menuitem", { name: "Admin console" })).toBeNull();
  });

  it.each([false, true])("offers the correct platform-admin switch when isAdmin is %s", async (isAdmin) => {
    mocks.pathname = isAdmin ? "/admin/users" : "/dashboard/posts";
    topbar({ isPlatformAdmin: true, socialPermissionLevel: "viewer" }, { isAdmin });
    expect(Boolean(screen.queryByRole("link", { name: "Create a post" }))).toBe(!isAdmin);
    await userEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Platform admin")).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: isAdmin ? "Exit admin" : "Admin console" }).getAttribute("href")).toBe(isAdmin ? "/dashboard" : "/admin");
    expect(within(menu).getByRole("menuitem", { name: "Workspace settings" }).getAttribute("href")).toBe("/dashboard/settings");
    expect(Boolean(within(menu).queryByRole("menuitem", { name: "Dashboard" }))).toBe(!isAdmin);
    expect(Boolean(within(menu).queryByRole("menuitem", { name: "Plan & billing" }))).toBe(!isAdmin);
  });

  it("clears actual auth state and replaces the route on sign out", async () => {
    const { store } = topbar();
    await userEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.accessToken).toBeNull();
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/login");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it.each([false, true])("has no search or quick-navigation controls when isAdmin is %s", (isAdmin) => {
    mocks.pathname = isAdmin ? "/admin/users" : "/dashboard/posts";
    const { container } = topbar({ isPlatformAdmin: isAdmin }, { isAdmin });
    expect(screen.queryByRole("button", { name: /search|quick navigation/i, hidden: true })).toBeNull();
    expect(screen.queryByText(/quick navigation|Ctrl \/ ⌘ K/i)).toBeNull();
    expect(screen.queryByRole("combobox", { hidden: true })).toBeNull();
    expect(screen.queryByRole("searchbox", { hidden: true })).toBeNull();
    expect(container.querySelector("[aria-keyshortcuts]")).toBeNull();
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });

  it.each([[false, "Control"], [false, "Meta"], [true, "Control"], [true, "Meta"]] as const)("does not open an app dialog for isAdmin=%s and %s+K", async (isAdmin, modifier) => {
    mocks.pathname = isAdmin ? "/admin/users" : "/dashboard/posts";
    topbar({ isPlatformAdmin: isAdmin }, { isAdmin });
    const trigger = screen.getByRole("button", { name: "Open account menu" });
    trigger.focus();
    const shortcut = new KeyboardEvent("keydown", { key: "k", ctrlKey: modifier === "Control", metaKey: modifier === "Meta", bubbles: true, cancelable: true });
    fireEvent(window, shortcut);
    expect(shortcut.defaultPrevented).toBe(false);
    await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    expect(screen.queryByRole("combobox", { hidden: true })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("has accessible header and account-menu structure", async () => {
    const { container } = topbar();
    const options = { rules: { "color-contrast": { enabled: false } } };
    expect((await axe(container, options)).violations).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    expect((await axe(screen.getByRole("menu"), options)).violations).toEqual([]);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("useDashboardUsage", () => {
  it("reports a failed load and clears the error after retry", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("Offline"));
    const { result } = renderHook(() => useDashboardUsage("workspace"));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.error).toBe("Usage is unavailable."));
    expect(result.current.usage).toBeNull();
    expect(result.current.loading).toBe(false);
    await act(async () => result.current.reload());
    expect(result.current.error).toBeNull();
    expect(result.current.usage).toEqual(usage);
  });

  it("never exposes the previous workspace and ignores its late response", async () => {
    let resolveOld!: (value: DashboardUsage) => void;
    mocks.cached.mockImplementation((id) => id === "old" ? usage : null);
    mocks.fetch.mockReturnValueOnce(new Promise<DashboardUsage>((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce({ ...usage, postsThisMonth: { used: 3, limit: null } });
    const { result, rerender } = renderHook(({ id }) => useDashboardUsage(id), { initialProps: { id: "old" } });
    expect(result.current.usage).toEqual(usage);
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith("old"));
    rerender({ id: "new" });
    expect(result.current.usage).toBeNull();
    await waitFor(() => expect(result.current.usage?.postsThisMonth.used).toBe(3));
    await act(async () => resolveOld(usage));
    expect(result.current.usage?.postsThisMonth.used).toBe(3);
  });

  it("clears data and ignores pending failures when disabled", async () => {
    let reject!: (reason: Error) => void;
    mocks.fetch.mockReturnValueOnce(new Promise<DashboardUsage>((_resolve, fail) => { reject = fail; }));
    const { result, rerender } = renderHook(({ enabled }) => useDashboardUsage("workspace", enabled), { initialProps: { enabled: true } });
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith("workspace"));
    rerender({ enabled: false });
    await act(async () => reject(new Error("Late failure")));
    expect(result.current.usage).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("does not fetch without a workspace", () => {
    const { result } = renderHook(() => useDashboardUsage(undefined));
    expect(result.current.loading).toBe(false);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});