import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import adminApi from "@/api/endpoints/admin.api";
import type { AdminUser, AdminUserListResponse } from "@/types/admin";
import AdminUsersTable from "./AdminUsersTable";

const auth = vi.hoisted(() => ({ user: { id: "self", isPlatformAdmin: true }, token: "session-a", stored: "session-a" }));
vi.mock("@/store/hooks", () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: auth.user, accessToken: auth.token } }) }));
vi.mock("@/lib/auth/session", () => ({ getStoredAccessToken: () => auth.stored }));
vi.mock("@/api/endpoints/admin.api", () => ({ default: { listUsers: vi.fn(), createUser: vi.fn(), suspendUser: vi.fn(), changeUserPlan: vi.fn() } }));

const person: AdminUser = { id: "ada", name: "Ada Lovelace", email: "ada@example.com", workspaceId: "owned", workspaceName: "Analytical Engines", plan: "starter", status: "active", isPlatformAdmin: false, socialPermissionLevel: "admin", createdAt: "2026-10-23T10:00:00Z" };
const list = (items = [person], total = items.length, page = 1): AdminUserListResponse => ({ items, total, page, pageSize: 20, totalPages: Math.max(1, Math.ceil(total / 20)) });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function choose(label: string, option: string) { const user = userEvent.setup(); await user.click(screen.getByRole("combobox", { name: label })); await user.click(screen.getByRole("option", { name: option })); }
async function ready() { return screen.findByText(person.email); }
function fillCreate() {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: " Grace Hopper " } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "grace@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-password" } });
  fireEvent.change(screen.getByLabelText("Workspace"), { target: { value: " Compiler team " } });
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.resetAllMocks(); auth.user = { id: "self", isPlatformAdmin: true }; auth.token = "session-a"; auth.stored = "session-a";
  vi.mocked(adminApi.listUsers).mockResolvedValue(list());
  vi.mocked(adminApi.createUser).mockResolvedValue(person);
  vi.mocked(adminApi.suspendUser).mockResolvedValue({ ...person, status: "suspended" });
  vi.mocked(adminApi.changeUserPlan).mockResolvedValue({ ...person, plan: "growth" });
  HTMLElement.prototype.scrollIntoView = vi.fn(); HTMLElement.prototype.hasPointerCapture = () => false; HTMLElement.prototype.setPointerCapture = vi.fn(); HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("AdminUsersTable", () => {
  it("loads 20 users per server page and reaches users beyond the first 20", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ ...person, id: `user-${i}`, email: `user${i}@example.com` }));
    vi.mocked(adminApi.listUsers).mockResolvedValueOnce(list(rows, 41)).mockResolvedValueOnce(list([{ ...person, name: "User twenty-one" }], 41, 2));
    render(<AdminUsersTable />);
    expect(screen.getByRole("status", { name: "Loading users" })).toBeTruthy();
    await screen.findByText("user19@example.com");
    expect(screen.getAllByRole("row")).toHaveLength(21);
    expect(screen.getByText("41 users matching current filters")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("User twenty-one")).toBeTruthy();
    expect(adminApi.listUsers).toHaveBeenLastCalledWith({ search: undefined, status: undefined, plan: undefined, page: 2, pageSize: 20 }, expect.any(AbortSignal));
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  });

  it("sends search, status and plan to the server and resets page", async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(list([person], 41));
    render(<AdminUsersTable />); await ready();
    fireEvent.click(screen.getByRole("button", { name: "Next" })); await ready();
    await choose("Filter plan", "Pro"); await ready();
    await choose("Filter status", "Suspended"); await ready();
    const count = vi.mocked(adminApi.listUsers).mock.calls.length;
    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "Analytical" } });
    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "Analytical Engines" } });
    expect(adminApi.listUsers).toHaveBeenCalledTimes(count);
    await waitFor(() => expect(adminApi.listUsers).toHaveBeenLastCalledWith({ search: "Analytical Engines", plan: "growth", status: "suspended", page: 1, pageSize: 20 }, expect.any(AbortSignal)));
    expect(adminApi.listUsers).toHaveBeenCalledTimes(count + 1);
  });

  it("invalidates stale results immediately while a new search is debouncing", async () => {
    const stale = deferred<AdminUserListResponse>();
    vi.mocked(adminApi.listUsers).mockReturnValueOnce(stale.promise).mockResolvedValue(list([{ ...person, name: "Grace Hopper" }]));
    render(<AdminUsersTable />); await waitFor(() => expect(adminApi.listUsers).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(adminApi.listUsers).mock.calls[0][1];
    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "Grace" } });
    expect(signal?.aborted).toBe(true);
    await act(async () => stale.resolve(list()));
    expect(screen.queryByText(person.name)).toBeNull();
    expect(await screen.findByText("Grace Hopper")).toBeTruthy();
  });

  it("ignores stale errors after a newer request succeeds", async () => {
    const stale = deferred<AdminUserListResponse>();
    vi.mocked(adminApi.listUsers).mockReturnValueOnce(stale.promise);
    render(<AdminUsersTable />); await waitFor(() => expect(adminApi.listUsers).toHaveBeenCalledTimes(1));
    await choose("Filter plan", "Growth"); await ready();
    await act(async () => stale.reject(new Error("late error")));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("retries list failures without losing the query", async () => {
    render(<AdminUsersTable />); await ready();
    vi.mocked(adminApi.listUsers).mockRejectedValueOnce(new Error("offline"));
    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "Ada" } });
    expect((await screen.findByRole("alert")).textContent).toContain("Users could not be loaded");
    expect(screen.queryByText("No users found")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry users" })); await ready();
    expect((screen.getByLabelText("Search users") as HTMLInputElement).value).toBe("Ada");
  });

  it("shows empty results and recovers when a page disappears", async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValueOnce(list([person], 21)).mockResolvedValueOnce(list([], 20, 2)).mockResolvedValueOnce(list([], 0));
    render(<AdminUsersTable />); await ready(); fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("No users found")).toBeTruthy();
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    expect(adminApi.listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }), expect.any(AbortSignal));
  });

  it("shows admin badges, prevents self suspension and disables plans without an owned workspace", async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(list([{ ...person, id: "self", isPlatformAdmin: true, workspaceId: null, workspaceName: "" }]));
    render(<AdminUsersTable />); await ready();
    expect(screen.getByText("Platform admin")).toBeTruthy(); expect(screen.getByText("You")).toBeTruthy();
    expect((screen.getByRole("button", { name: `Suspend ${person.email}` }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: `Change plan for ${person.email}` }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("No owned workspace")).toBeTruthy();
  });

  it("requires confirmation, locks double submission, blocks dismissal and retries status failure", async () => {
    const pending = deferred<AdminUser>(); vi.mocked(adminApi.suspendUser).mockReturnValueOnce(pending.promise);
    render(<AdminUsersTable />); await ready();
    fireEvent.click(screen.getByRole("button", { name: `Suspend ${person.email}` }));
    expect(adminApi.suspendUser).not.toHaveBeenCalled();
    const confirm = screen.getByRole("button", { name: "Confirm status change" });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    expect(adminApi.suspendUser).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => pending.reject(new Error("offline")));
    expect((await screen.findByRole("alert")).textContent).toContain("entries are preserved");
    fireEvent.click(screen.getByRole("button", { name: "Retry status change" }));
    expect(await screen.findByText("User status updated.")).toBeTruthy();
    expect(adminApi.suspendUser).toHaveBeenCalledTimes(2);
  });

  it("reactivates a suspended user only after confirmation", async () => {
    vi.mocked(adminApi.listUsers).mockResolvedValue(list([{ ...person, status: "suspended" }]));
    render(<AdminUsersTable />); await ready();
    fireEvent.click(screen.getByRole("button", { name: `Activate ${person.email}` }));
    expect(adminApi.suspendUser).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm status change" }));
    await screen.findByText("User status updated.");
    expect(adminApi.suspendUser).toHaveBeenCalledWith(person.id, false, expect.any(AbortSignal));
  });

  it("preserves the selected plan on failure and requires an explicit assignment", async () => {
    vi.mocked(adminApi.changeUserPlan).mockRejectedValueOnce(new Error("offline"));
    render(<AdminUsersTable />); await ready();
    fireEvent.click(screen.getByRole("button", { name: `Change plan for ${person.email}` }));
    expect((screen.getByRole("button", { name: "Confirm plan assignment" }) as HTMLButtonElement).disabled).toBe(true);
    await choose("Plan", "Pro"); expect(adminApi.changeUserPlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm plan assignment" })); await screen.findByRole("alert");
    expect(screen.getByRole("combobox", { name: "Plan" }).textContent).toContain("Pro");
    fireEvent.click(screen.getByRole("button", { name: "Retry plan assignment" }));
    expect(await screen.findByText("Workspace plan updated.")).toBeTruthy();
    expect(adminApi.changeUserPlan).toHaveBeenLastCalledWith(person.id, "growth", expect.any(AbortSignal));
  });

  it("creates users with explicit admin privilege context and preserves the whole draft on failure", async () => {
    vi.mocked(adminApi.createUser).mockRejectedValueOnce(new Error("offline"));
    render(<AdminUsersTable />); await ready(); fireEvent.click(screen.getByRole("button", { name: "Create user" })); fillCreate();
    const box = screen.getByRole("checkbox", { name: "Grant platform administrator access" });
    expect(box.getAttribute("aria-checked")).toBe("false"); fireEvent.click(box);
    expect(screen.getByText(/Confirm that grace@example.com/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create platform admin" })); await screen.findByRole("alert");
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe(" Grace Hopper "); expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("long-password"); expect(box.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Retry creation" }));
    expect(await screen.findByText("User created.")).toBeTruthy();
    expect(adminApi.createUser).toHaveBeenLastCalledWith({ name: "Grace Hopper", email: "grace@example.com", password: "long-password", workspaceName: "Compiler team", plan: "starter", isPlatformAdmin: true }, expect.any(AbortSignal));
  });

  it("locks duplicate create submissions and clears drafts only after reopening", async () => {
    const pending = deferred<AdminUser>(); vi.mocked(adminApi.createUser).mockReturnValue(pending.promise);
    render(<AdminUsersTable />); await ready(); fireEvent.click(screen.getByRole("button", { name: "Create user" })); fillCreate();
    const form = screen.getByLabelText("Full name").closest("form")!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(adminApi.createUser).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(person)); await screen.findByText("User created.");
    fireEvent.click(screen.getByRole("button", { name: "Create user" })); expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("");
  });

  it("invalidates pre-mutation lists and refreshes the latest filters", async () => {
    const pending = deferred<AdminUser>(); const stale = deferred<AdminUserListResponse>();
    vi.mocked(adminApi.suspendUser).mockReturnValue(pending.promise);
    render(<AdminUsersTable />); await ready(); fireEvent.click(screen.getByRole("button", { name: `Suspend ${person.email}` })); fireEvent.click(screen.getByRole("button", { name: "Confirm status change" }));
    vi.mocked(adminApi.listUsers).mockReturnValueOnce(stale.promise).mockResolvedValue(list([{ ...person, name: "Grace Hopper" }]));
    fireEvent.change(screen.getByLabelText("Search users"), { target: { value: "Grace" } }); await waitFor(() => expect(adminApi.listUsers).toHaveBeenCalledTimes(2));
    await act(async () => pending.resolve(person)); await screen.findByText("Grace Hopper");
    await act(async () => stale.resolve(list())); expect(screen.queryByText(person.name)).toBeNull();
    expect(adminApi.listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Grace" }), expect.any(AbortSignal));
  });

  it("aborts list and mutation requests on unmount", async () => {
    const pending = deferred<AdminUser>(); vi.mocked(adminApi.suspendUser).mockReturnValue(pending.promise);
    const view = render(<AdminUsersTable />); await ready(); fireEvent.click(screen.getByRole("button", { name: `Suspend ${person.email}` })); fireEvent.click(screen.getByRole("button", { name: "Confirm status change" }));
    const readSignal = vi.mocked(adminApi.listUsers).mock.calls[0][1]; const writeSignal = vi.mocked(adminApi.suspendUser).mock.calls[0][2];
    view.unmount(); expect(readSignal?.aborted).toBe(true); expect(writeSignal?.aborted).toBe(true);
    await act(async () => pending.resolve(person)); expect(adminApi.listUsers).toHaveBeenCalledTimes(1);
  });

  it("discards old-session list responses and resets private drafts", async () => {
    const old = deferred<AdminUserListResponse>(); vi.mocked(adminApi.listUsers).mockReturnValueOnce(old.promise);
    const view = render(<AdminUsersTable />); await waitFor(() => expect(adminApi.listUsers).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Create user" })); fillCreate();
    auth.token = "session-b"; auth.stored = "session-b"; view.rerender(<AdminUsersTable />); await ready();
    await act(async () => old.resolve(list([{ ...person, name: "Old session data" }])));
    expect(screen.queryByText("Old session data")).toBeNull(); expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Create user" })); expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
  });

  it("ignores mutation completion when storage changes before Redux updates", async () => {
    const pending = deferred<AdminUser>(); vi.mocked(adminApi.suspendUser).mockReturnValue(pending.promise);
    render(<AdminUsersTable />); await ready(); fireEvent.click(screen.getByRole("button", { name: `Suspend ${person.email}` })); fireEvent.click(screen.getByRole("button", { name: "Confirm status change" }));
    auth.stored = "session-b"; await act(async () => pending.resolve(person));
    expect(screen.queryByText("User status updated.")).toBeNull(); expect(adminApi.listUsers).toHaveBeenCalledTimes(1);
  });

  it("does not fetch private data without administrator permission", () => {
    auth.user.isPlatformAdmin = false; render(<AdminUsersTable />);
    expect(screen.getByRole("alert").textContent).toContain("administrator access"); expect(adminApi.listUsers).not.toHaveBeenCalled();
  });

  it("provides accessible filters, contained keyboard-scrollable tables and focus restoration", async () => {
    const view = render(<AdminUsersTable />); await ready();
    const region = screen.getByRole("region", { name: "Users table" }); expect(region.getAttribute("tabindex")).toBe("0"); expect(region.className).toContain("overflow-x-auto");
    expect((await axe(view.container)).violations).toEqual([]);
    const trigger = screen.getByRole("button", { name: `Suspend ${person.email}` }); trigger.focus(); fireEvent.click(trigger);
    expect((await axe(screen.getByRole("dialog"))).violations).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })); await waitFor(() => expect(document.activeElement).toBe(trigger));
    fireEvent.click(screen.getByRole("button", { name: "Create user" }));
    const dialog = screen.getByRole("dialog"); expect(dialog.className).toContain("max-h-dvh"); expect(dialog.className).toContain("overflow-y-auto");
    expect(within(dialog).getByLabelText("Full name")).toBeTruthy(); expect((await axe(dialog)).violations).toEqual([]);
  });
});