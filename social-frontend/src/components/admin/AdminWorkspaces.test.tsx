import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import adminApi from "@/api/endpoints/admin.api";
import type { AdminWorkspace } from "@/types/admin";
import AdminWorkspaces from "./AdminWorkspaces";

const auth = vi.hoisted(() => ({ user: { id: "self", isPlatformAdmin: true }, token: "session-a", stored: "session-a" }));
vi.mock("@/store/hooks", () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: auth.user, accessToken: auth.token } }) }));
vi.mock("@/lib/auth/session", () => ({ getStoredAccessToken: () => auth.stored }));
vi.mock("@/api/endpoints/admin.api", () => ({ default: { listWorkspaces: vi.fn(), changeWorkspacePlan: vi.fn(), changeWorkspaceStatus: vi.fn() } }));

const workspace: AdminWorkspace = { id: "owned", name: "Analytical Engines", plan: "starter", is_active: true, owner_email: "ada@example.com", member_count: 7, created_at: "2026-10-23T10:00:00Z" };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function ready() { return screen.findByText(workspace.name); }
async function choose(option: string) { const user = userEvent.setup(); await user.click(screen.getByRole("combobox", { name: "Plan" })); await user.click(screen.getByRole("option", { name: option })); }

beforeEach(() => {
  vi.resetAllMocks(); auth.user = { id: "self", isPlatformAdmin: true }; auth.token = "session-a"; auth.stored = "session-a";
  vi.mocked(adminApi.listWorkspaces).mockResolvedValue([workspace]);
  vi.mocked(adminApi.changeWorkspacePlan).mockResolvedValue({ ...workspace, plan: "growth" });
  vi.mocked(adminApi.changeWorkspaceStatus).mockResolvedValue({ ...workspace, is_active: false });
  HTMLElement.prototype.scrollIntoView = vi.fn(); HTMLElement.prototype.hasPointerCapture = () => false; HTMLElement.prototype.setPointerCapture = vi.fn(); HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

describe("AdminWorkspaces", () => {
  it("uses a 21-row lookahead, renders 20 and never fabricates a total", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ ...workspace, id: `ws-${i}`, name: `Workspace ${i + 1}` }));
    vi.mocked(adminApi.listWorkspaces).mockResolvedValueOnce(rows).mockResolvedValueOnce(rows.slice(20));
    render(<AdminWorkspaces />); expect(screen.getByRole("status", { name: "Loading workspaces" })).toBeTruthy();
    await screen.findByText("Workspace 20"); expect(screen.queryByText("Workspace 21")).toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(21); expect(screen.getByText("Showing 1–20")).toBeTruthy();
    expect(screen.queryByText(/Page 1 of/)).toBeNull();
    expect(adminApi.listWorkspaces).toHaveBeenCalledWith({ search: undefined, limit: 21, offset: 0 }, expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", { name: "Next" })); expect(await screen.findByText("Workspace 21")).toBeTruthy();
    expect(screen.getByText("Showing 21–21")).toBeTruthy(); expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    expect(adminApi.listWorkspaces).toHaveBeenLastCalledWith({ search: undefined, limit: 21, offset: 20 }, expect.any(AbortSignal));
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables next for exactly 20 rows without a lookahead", async () => {
    vi.mocked(adminApi.listWorkspaces).mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ ...workspace, id: `${i}`, name: `Workspace ${i}` })));
    render(<AdminWorkspaces />); await screen.findByText("Workspace 19"); expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("debounces search and resets offsets after pagination", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ ...workspace, id: `${i}`, name: `Workspace ${i}` }));
    vi.mocked(adminApi.listWorkspaces).mockResolvedValue(rows);
    render(<AdminWorkspaces />); await screen.findByText("Workspace 0"); fireEvent.click(screen.getByRole("button", { name: "Next" })); await screen.findByText("Page 2");
    const count = vi.mocked(adminApi.listWorkspaces).mock.calls.length;
    fireEvent.change(screen.getByLabelText("Search workspaces"), { target: { value: "Engine" } }); fireEvent.change(screen.getByLabelText("Search workspaces"), { target: { value: "Engines" } });
    expect(adminApi.listWorkspaces).toHaveBeenCalledTimes(count);
    await waitFor(() => expect(adminApi.listWorkspaces).toHaveBeenLastCalledWith({ search: "Engines", limit: 21, offset: 0 }, expect.any(AbortSignal)));
    expect(adminApi.listWorkspaces).toHaveBeenCalledTimes(count + 1);
  });

  it("ignores stale responses during debounce and aborts them", async () => {
    const old = deferred<AdminWorkspace[]>(); vi.mocked(adminApi.listWorkspaces).mockReturnValueOnce(old.promise).mockResolvedValue([{ ...workspace, name: "New team" }]);
    render(<AdminWorkspaces />); await waitFor(() => expect(adminApi.listWorkspaces).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(adminApi.listWorkspaces).mock.calls[0][1];
    fireEvent.change(screen.getByLabelText("Search workspaces"), { target: { value: "New" } }); expect(signal?.aborted).toBe(true);
    await act(async () => old.resolve([workspace])); expect(screen.queryByText(workspace.name)).toBeNull();
    expect(await screen.findByText("New team")).toBeTruthy();
  });

  it("ignores a stale failure after new data arrives", async () => {
    const old = deferred<AdminWorkspace[]>(); vi.mocked(adminApi.listWorkspaces).mockReturnValueOnce(old.promise);
    render(<AdminWorkspaces />); await waitFor(() => expect(adminApi.listWorkspaces).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("Search workspaces"), { target: { value: "Engines" } }); await ready();
    await act(async () => old.reject(new Error("offline"))); expect(screen.queryByRole("alert")).toBeNull();
  });

  it("retries failures and shows a distinct empty state with search reset", async () => {
    vi.mocked(adminApi.listWorkspaces).mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
    render(<AdminWorkspaces />); await screen.findByRole("alert"); expect(screen.queryByText("No workspaces found")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry workspaces" })); await screen.findByText("No workspaces found");
    fireEvent.change(screen.getByLabelText("Search workspaces"), { target: { value: "missing" } });
    fireEvent.click(await screen.findByRole("button", { name: "Clear search" }));
    expect((screen.getByLabelText("Search workspaces") as HTMLInputElement).value).toBe(""); await screen.findByText("No workspaces found");
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true); expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("steps back if the last page becomes empty", async () => {
    vi.mocked(adminApi.listWorkspaces).mockResolvedValueOnce(Array.from({ length: 21 }, (_, i) => ({ ...workspace, id: `${i}`, name: `Workspace ${i}` }))).mockResolvedValueOnce([]).mockResolvedValue([workspace]);
    render(<AdminWorkspaces />); await screen.findByText("Workspace 0"); fireEvent.click(screen.getByRole("button", { name: "Next" })); await ready();
    expect(adminApi.listWorkspaces).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0 }), expect.any(AbortSignal)); expect(screen.getByText("Page 1")).toBeTruthy();
  });

  it("renders truthful member counts, plan labels and unlimited account policy", async () => {
    vi.mocked(adminApi.listWorkspaces).mockResolvedValue([workspace, { ...workspace, id: "pro", name: "Pro team", plan: "growth", member_count: 23 }, { ...workspace, id: "growth", name: "Growth team", plan: "enterprise", owner_email: null, is_active: false }]);
    render(<AdminWorkspaces />); await ready();
    for (const label of ["Free", "Pro", "Growth", "23", "Owner unavailable", "Inactive"]) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText(/All plans include unlimited connected accounts/)).toBeTruthy();
    expect(screen.queryByText(/account limit/i)).toBeNull();
  });

  it("requires status confirmation and locks duplicate requests while saving", async () => {
    const pending = deferred<AdminWorkspace>(); vi.mocked(adminApi.changeWorkspaceStatus).mockReturnValueOnce(pending.promise);
    render(<AdminWorkspaces />); await ready(); fireEvent.click(screen.getByRole("button", { name: `Deactivate ${workspace.name}` }));
    expect(adminApi.changeWorkspaceStatus).not.toHaveBeenCalled();
    const confirm = screen.getByRole("button", { name: "Confirm workspace update" }); act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    expect(adminApi.changeWorkspaceStatus).toHaveBeenCalledTimes(1); expect(adminApi.changeWorkspaceStatus).toHaveBeenCalledWith(workspace.id, false, expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", { name: "Close" })); expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => pending.reject(new Error("offline"))); await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Retry workspace update" })); await screen.findByText("Workspace updated."); expect(adminApi.changeWorkspaceStatus).toHaveBeenCalledTimes(2);
  });

  it("confirms activation of an inactive workspace", async () => {
    vi.mocked(adminApi.listWorkspaces).mockResolvedValue([{ ...workspace, is_active: false }]);
    render(<AdminWorkspaces />); await ready(); fireEvent.click(screen.getByRole("button", { name: `Activate ${workspace.name}` }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm workspace update" })); await screen.findByText("Workspace updated.");
    expect(adminApi.changeWorkspaceStatus).toHaveBeenCalledWith(workspace.id, true, expect.any(AbortSignal));
  });

  it("preserves plan choices on error and refreshes accurate member counts after retry", async () => {
    vi.mocked(adminApi.changeWorkspacePlan).mockRejectedValueOnce(new Error("offline"));
    render(<AdminWorkspaces />); await ready(); fireEvent.click(screen.getByRole("button", { name: `Change plan for ${workspace.name}` }));
    expect((screen.getByRole("button", { name: "Confirm workspace update" }) as HTMLButtonElement).disabled).toBe(true);
    await choose("Growth"); expect(adminApi.changeWorkspacePlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm workspace update" })); await screen.findByRole("alert");
    expect(screen.getByRole("combobox", { name: "Plan" }).textContent).toContain("Growth");
    vi.mocked(adminApi.listWorkspaces).mockResolvedValue([{ ...workspace, plan: "enterprise", member_count: 9 }]);
    fireEvent.click(screen.getByRole("button", { name: "Retry workspace update" })); await screen.findByText("Workspace updated."); await screen.findByText("9");
    expect(adminApi.changeWorkspacePlan).toHaveBeenLastCalledWith(workspace.id, "enterprise", expect.any(AbortSignal)); expect(screen.getByText("Growth")).toBeTruthy();
  });

  it("refreshes the latest search and rejects a pre-mutation response", async () => {
    const pending = deferred<AdminWorkspace>(); const stale = deferred<AdminWorkspace[]>(); vi.mocked(adminApi.changeWorkspaceStatus).mockReturnValue(pending.promise);
    render(<AdminWorkspaces />); await ready(); fireEvent.click(screen.getByRole("button", { name: `Deactivate ${workspace.name}` })); fireEvent.click(screen.getByRole("button", { name: "Confirm workspace update" }));
    vi.mocked(adminApi.listWorkspaces).mockReturnValueOnce(stale.promise).mockResolvedValue([{ ...workspace, name: "New team" }]);
    fireEvent.change(screen.getByLabelText("Search workspaces"), { target: { value: "New" } }); await waitFor(() => expect(adminApi.listWorkspaces).toHaveBeenCalledTimes(2));
    await act(async () => pending.resolve(workspace)); await screen.findByText("New team");
    await act(async () => stale.resolve([workspace])); expect(screen.queryByText(workspace.name)).toBeNull();
    expect(adminApi.listWorkspaces).toHaveBeenLastCalledWith({ search: "New", limit: 21, offset: 0 }, expect.any(AbortSignal));
  });

  it("aborts reads and writes on unmount without refreshing", async () => {
    const pending = deferred<AdminWorkspace>(); vi.mocked(adminApi.changeWorkspaceStatus).mockReturnValue(pending.promise);
    const view = render(<AdminWorkspaces />); await ready(); fireEvent.click(screen.getByRole("button", { name: `Deactivate ${workspace.name}` })); fireEvent.click(screen.getByRole("button", { name: "Confirm workspace update" }));
    const read = vi.mocked(adminApi.listWorkspaces).mock.calls[0][1]; const write = vi.mocked(adminApi.changeWorkspaceStatus).mock.calls[0][2];
    view.unmount(); expect(read?.aborted).toBe(true); expect(write?.aborted).toBe(true);
    await act(async () => pending.resolve(workspace)); expect(adminApi.listWorkspaces).toHaveBeenCalledTimes(1);
  });

  it("isolates sessions and discards old mutation completions", async () => {
    const pending = deferred<AdminWorkspace>(); vi.mocked(adminApi.changeWorkspaceStatus).mockReturnValue(pending.promise);
    const view = render(<AdminWorkspaces />); await ready(); fireEvent.click(screen.getByRole("button", { name: `Deactivate ${workspace.name}` })); fireEvent.click(screen.getByRole("button", { name: "Confirm workspace update" }));
    auth.token = "session-b"; auth.stored = "session-b"; view.rerender(<AdminWorkspaces />); await ready();
    await act(async () => pending.resolve(workspace)); expect(screen.queryByText("Workspace updated.")).toBeNull(); expect(screen.queryByRole("dialog")).toBeNull(); expect(adminApi.listWorkspaces).toHaveBeenCalledTimes(2);
  });

  it("ignores storage-session changes before Redux updates", async () => {
    const pending = deferred<AdminWorkspace[]>(); vi.mocked(adminApi.listWorkspaces).mockReturnValue(pending.promise);
    render(<AdminWorkspaces />); await waitFor(() => expect(adminApi.listWorkspaces).toHaveBeenCalledTimes(1));
    auth.stored = "session-b"; await act(async () => pending.resolve([workspace])); expect(screen.queryByText(workspace.name)).toBeNull();
  });

  it("does not request workspaces for non-admin users", () => {
    auth.user.isPlatformAdmin = false; render(<AdminWorkspaces />); expect(screen.getByRole("alert").textContent).toContain("administrator access"); expect(adminApi.listWorkspaces).not.toHaveBeenCalled();
  });

  it("has accessible labels, contained table overflow and scroll-bounded dialogs with focus return", async () => {
    const view = render(<AdminWorkspaces />); await ready(); const region = screen.getByRole("region", { name: "Workspaces table" });
    expect(region.getAttribute("tabindex")).toBe("0"); expect(region.className).toContain("overflow-x-auto"); expect((await axe(view.container)).violations).toEqual([]);
    const trigger = screen.getByRole("button", { name: `Change plan for ${workspace.name}` }); trigger.focus(); fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog"); expect(dialog.className).toContain("max-h-dvh"); expect(dialog.className).toContain("overflow-y-auto"); expect((await axe(dialog)).violations).toEqual([]);
    await userEvent.setup().keyboard("{Escape}"); await waitFor(() => expect(document.activeElement).toBe(trigger)); expect(adminApi.changeWorkspacePlan).not.toHaveBeenCalled();
  });
});