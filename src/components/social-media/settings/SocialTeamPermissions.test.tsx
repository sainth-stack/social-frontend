import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore, type UnknownAction } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { axe } from "vitest-axe";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { authApi } from "@/api/endpoints/auth.api";
import authReducer from "@/features/auth/authSlice";
import type { User } from "@/types/auth";
import SocialTeamPermissions from "./SocialTeamPermissions";

vi.mock("@/api/endpoints/social-media.api", () => ({ default: { listTeamPermissions: vi.fn(), updateTeamPermission: vi.fn() } }));
vi.mock("@/api/endpoints/auth.api", () => ({ authApi: { me: vi.fn() } }));

const admin: User = { id: "user-1", email: "admin@example.com", name: "Alex", isPlatformAdmin: false, workspaceId: "workspace-1", workspaceName: "Acme", socialPermissionLevel: "admin", plan: "growth" };
const rows = [{ userId: "user-1", name: "Alex", email: "admin@example.com", permission: "admin" }, { userId: "user-2", name: "Morgan", email: "morgan@example.com", permission: "viewer" }];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function renderTeam(overrides: Partial<User> = {}) {
  const initial = { ...authReducer(undefined, { type: "init" }), user: { ...admin, ...overrides }, accessToken: "test-token", isAuthenticated: true, isHydrated: true };
  const store = configureStore({ reducer: { auth: (state: ReturnType<typeof authReducer> = initial, action: UnknownAction) => action.type === "test/user" ? { ...state, user: { ...state.user!, ...(action.payload as Partial<User>) } } : authReducer(state, action) } });
  return { ...render(<Provider store={store}><SocialTeamPermissions /></Provider>), store };
}

async function chooseRole(name = "Morgan", role = "Editor") {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("combobox", { name: `Social role for ${name}` }));
  await user.click(screen.getByRole("option", { name: role }));
  return user;
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: () => {} });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: () => {} });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => {} });
  vi.mocked(socialMediaApi.listTeamPermissions).mockReset().mockResolvedValue(structuredClone(rows));
  vi.mocked(socialMediaApi.updateTeamPermission).mockReset().mockResolvedValue({});
  vi.mocked(authApi.me).mockReset().mockResolvedValue({ user: { id: admin.id, email: admin.email, full_name: admin.name, is_active: true, is_platform_admin: false }, workspaces: [{ id: admin.workspaceId, name: admin.workspaceName, plan: "growth", role: "member", social_level: "viewer" }] });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

describe("SocialTeamPermissions", () => {
  it("shows a real pending skeleton then member identities and labels", async () => {
    const pending = deferred<typeof rows>();
    vi.mocked(socialMediaApi.listTeamPermissions).mockReturnValueOnce(pending.promise);
    renderTeam();
    expect(screen.getByRole("status", { name: "Loading team permissions" })).toBeTruthy();
    await act(async () => pending.resolve(rows));
    expect(await screen.findByRole("combobox", { name: "Social role for Morgan" })).toBeTruthy();
    expect(screen.getByText("user-2")).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: "Team permissions" })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Loading team permissions" })).toBeNull();
    expect(socialMediaApi.listTeamPermissions).toHaveBeenCalledWith("workspace-1");
  });

  it("does not update a role until explicit save and supports cancel", async () => {
    renderTeam();
    const user = await chooseRole();
    expect(socialMediaApi.updateTeamPermission).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel role change for Morgan" }));
    expect(screen.getByRole("combobox", { name: "Social role for Morgan" }).textContent).toBe("Viewer");
    expect(screen.queryByRole("button", { name: "Save role for Morgan" })).toBeNull();
    await chooseRole();
    await user.click(screen.getByRole("button", { name: "Save role for Morgan" }));
    await waitFor(() => expect(socialMediaApi.updateTeamPermission).toHaveBeenCalledWith("workspace-1", "user-2", "editor"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save role for Morgan" })).toBeNull());
    expect(screen.getByRole("combobox", { name: "Social role for Morgan" }).textContent).toBe("Editor");
  });

  it("retries loading after errors and never leaves a fake skeleton", async () => {
    vi.mocked(socialMediaApi.listTeamPermissions).mockRejectedValueOnce(new Error("Offline"));
    renderTeam();
    expect((await screen.findByRole("alert")).textContent).toContain("Offline");
    expect(screen.queryByRole("status", { name: "Loading team permissions" })).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry loading team" }));
    expect(await screen.findByRole("combobox", { name: "Social role for Morgan" })).toBeTruthy();
    expect(socialMediaApi.listTeamPermissions).toHaveBeenCalledTimes(2);
  });

  it("provides an honest empty state with refresh, not an invented invitation", async () => {
    vi.mocked(socialMediaApi.listTeamPermissions).mockResolvedValueOnce([]);
    renderTeam();
    expect(await screen.findByText("No team members found")).toBeTruthy();
    expect(screen.getByText(/does not send invitations/)).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh team" }));
    expect(await screen.findByText("Morgan")).toBeTruthy();
  });

  it.each(["viewer", "editor", "publisher"] as const)("keeps %s access read-only", async (socialPermissionLevel) => {
    renderTeam({ socialPermissionLevel });
    const select = await screen.findByRole("combobox", { name: "Social role for Morgan" });
    expect(select.matches(":disabled")).toBe(true);
    expect(screen.getByText("You have read-only access to team permissions.")).toBeTruthy();
    expect(socialMediaApi.updateTeamPermission).not.toHaveBeenCalled();
  });

  it("allows a platform administrator to prepare role changes", async () => {
    renderTeam({ socialPermissionLevel: "viewer", isPlatformAdmin: true });
    await chooseRole();
    expect(screen.getByRole("button", { name: "Save role for Morgan" })).toBeTruthy();
  });

  it("preserves failed drafts with inline error and an explicit retry", async () => {
    vi.mocked(socialMediaApi.updateTeamPermission).mockRejectedValueOnce(new Error("Permission denied"));
    renderTeam();
    const user = await chooseRole();
    await user.click(screen.getByRole("button", { name: "Save role for Morgan" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Permission denied");
    expect(screen.getByRole("combobox", { name: "Social role for Morgan" }).textContent).toBe("Editor");
    await user.click(screen.getByRole("button", { name: "Save role for Morgan" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(socialMediaApi.updateTeamPermission).toHaveBeenCalledTimes(2);
  });

  it("locks all roles and prevents concurrent saves while a mutation is pending", async () => {
    const pending = deferred<object>();
    vi.mocked(socialMediaApi.updateTeamPermission).mockReturnValueOnce(pending.promise);
    renderTeam();
    const user = await chooseRole();
    const save = screen.getByRole("button", { name: "Save role for Morgan" });
    await user.dblClick(save);
    expect(socialMediaApi.updateTeamPermission).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("combobox").every((select) => select.matches(":disabled"))).toBe(true);
    expect(screen.getByRole("button", { name: "Cancel role change for Morgan" }).matches(":disabled")).toBe(true);
    await act(async () => pending.resolve({}));
    await waitFor(() => expect(screen.getAllByRole("combobox").every((select) => !select.matches(":disabled"))).toBe(true));
  });

  it("ignores a late load from the previous workspace", async () => {
    const pending = deferred<typeof rows>();
    vi.mocked(socialMediaApi.listTeamPermissions).mockReturnValueOnce(pending.promise).mockResolvedValueOnce([{ ...rows[1], name: "New workspace member" }]);
    const view = renderTeam();
    act(() => view.store.dispatch({ type: "test/user", payload: { workspaceId: "workspace-2" } }));
    expect(await screen.findByText("New workspace member")).toBeTruthy();
    await act(async () => pending.resolve(rows));
    expect(screen.queryByText("Morgan")).toBeNull();
    expect(screen.getByText("New workspace member")).toBeTruthy();
  });

  it("ignores stale mutation failures after workspace changes", async () => {
    const pending = deferred<object>();
    vi.mocked(socialMediaApi.updateTeamPermission).mockReturnValueOnce(pending.promise);
    const view = renderTeam();
    const user = await chooseRole();
    await user.click(screen.getByRole("button", { name: "Save role for Morgan" }));
    act(() => view.store.dispatch({ type: "test/user", payload: { workspaceId: "workspace-2" } }));
    await screen.findByText("Morgan");
    await act(async () => pending.reject(new Error("Old failure")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Social role for Morgan" }).textContent).toBe("Viewer");
  });

  it("refreshes the existing session after saving a self-role change", async () => {
    const view = renderTeam();
    const user = await chooseRole("Alex", "Viewer");
    expect(screen.getByText(/may remove your management access/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save role for Alex" }));
    await waitFor(() => expect(view.store.getState().auth.user?.socialPermissionLevel).toBe("viewer"));
    expect(view.store.getState().auth.user?.workspaceId).toBe("workspace-1");
    expect(authApi.me).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("combobox", { name: "Social role for Morgan" }).matches(":disabled")).toBe(true);
  });

  it("preserves selected workspace during self-session refresh", async () => {
    const me = await authApi.me();
    vi.mocked(authApi.me).mockClear().mockResolvedValue({ ...me, workspaces: [{ ...me.workspaces[0], id: "other-workspace", social_level: "admin" }, me.workspaces[0]] });
    const view = renderTeam();
    const user = await chooseRole("Alex", "Viewer");
    await user.click(screen.getByRole("button", { name: "Save role for Alex" }));
    await waitFor(() => expect(view.store.getState().auth.user?.socialPermissionLevel).toBe("viewer"));
    expect(view.store.getState().auth.user?.workspaceId).toBe("workspace-1");
  });

  it("retries session refresh without repeating the already saved role mutation", async () => {
    vi.mocked(authApi.me).mockRejectedValueOnce(new Error("Offline"));
    renderTeam();
    const user = await chooseRole("Alex", "Viewer");
    await user.click(screen.getByRole("button", { name: "Save role for Alex" }));
    expect((await screen.findByRole("alert")).textContent).toContain("session could not be refreshed");
    await user.click(screen.getByRole("button", { name: "Retry session refresh" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(socialMediaApi.updateTeamPermission).toHaveBeenCalledTimes(1);
    expect(authApi.me).toHaveBeenCalledTimes(2);
  });

  it("does not request team data without a selected workspace", () => {
    renderTeam({ workspaceId: "" });
    expect(screen.getByText("Select a workspace to view team permissions.")).toBeTruthy();
    expect(socialMediaApi.listTeamPermissions).not.toHaveBeenCalled();
  });

  it("keeps effective owner access after changing their stored social role", async () => {
    const me = await authApi.me();
    vi.mocked(authApi.me).mockClear().mockResolvedValue({ ...me, workspaces: [{ ...me.workspaces[0], role: "owner" }] });
    const view = renderTeam();
    const user = await chooseRole("Alex", "Viewer");
    await user.click(screen.getByRole("button", { name: "Save role for Alex" }));
    await waitFor(() => expect(authApi.me).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save role for Alex" })).toBeNull());
    expect(view.store.getState().auth.user?.socialPermissionLevel).toBe("admin");
  });

  it("has no axe violations in loaded and pending-draft states", async () => {
    const { container } = renderTeam();
    await screen.findByText("Morgan");
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
    await chooseRole();
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});