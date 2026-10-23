import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore, type UnknownAction } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { axe } from "vitest-axe";
import { toast } from "sonner";
import socialMediaApi from "@/api/endpoints/social-media.api";
import authReducer from "@/features/auth/authSlice";
import type { User } from "@/types/auth";
import type { SocialAccount } from "@/types/social-media.types";
import { openSocialOAuthPopup } from "./OAuthConnectButton";
import AccountsPage from "./AccountsPage";

vi.mock("@/api/endpoints/social-media.api", () => ({
  default: {
    listAccounts: vi.fn(),
    getUsage: vi.fn(),
    getDashboardStats: vi.fn(),
    getOAuthUrl: vi.fn(),
    reconnectAccount: vi.fn(),
    syncAccount: vi.fn(),
    deleteAccount: vi.fn(),
  },
}));
vi.mock("./OAuthConnectButton", () => ({ openSocialOAuthPopup: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }) }));

const user: User = {
  id: "user-1", email: "alex@example.com", name: "Alex", isPlatformAdmin: false,
  workspaceId: "workspace-1", workspaceName: "Acme", socialPermissionLevel: "admin", plan: "starter",
};
const account: SocialAccount = {
  id: "account-1", orgId: "workspace-1", platform: "instagram", accountType: "profile",
  platformAccountId: "profile-1", accountName: "Acme Studio", accountPictureUrl: null,
  followerCount: 100, tokenExpiresAt: null, tokenStatus: "active", isDefault: true,
  isActive: true, lastSyncedAt: null, createdAt: "2026-10-20T10:00:00Z", updatedAt: "2026-10-20T10:00:00Z",
};
const second: SocialAccount = { ...account, id: "account-2", accountName: "Acme Shop", isDefault: false, tokenStatus: "expired" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function renderAccounts(workspaceId = "workspace-1", strict = false, plan: User["plan"] = "starter") {
  const initial = { ...authReducer(undefined, { type: "init" }), user: { ...user, workspaceId, plan }, accessToken: "test-token", isAuthenticated: true, isHydrated: true };
  const store = configureStore({
    reducer: {
      auth: (state: ReturnType<typeof authReducer> = initial, action: UnknownAction) => action.type === "test/workspace"
        ? { ...state, user: { ...state.user!, workspaceId: action.payload as string } }
        : authReducer(state, action),
    },
  });
  const page = <Provider store={store}><AccountsPage /></Provider>;
  return { ...render(strict ? <StrictMode>{page}</StrictMode> : page), store };
}

function switchWorkspace(store: ReturnType<typeof renderAccounts>["store"]) {
  act(() => { store.dispatch({ type: "test/workspace", payload: "workspace-2" }); });
}

function oauthResult(success: boolean, message?: string, silent?: boolean) {
  const callback = vi.mocked(openSocialOAuthPopup).mock.calls.at(-1)![1];
  act(() => callback(success, message, silent));
  return callback;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
  vi.mocked(socialMediaApi.listAccounts).mockReset().mockResolvedValue([account, second]);
  vi.mocked(socialMediaApi.getUsage).mockReset();
  vi.mocked(socialMediaApi.getOAuthUrl).mockReset().mockResolvedValue({ url: "https://provider.example/connect" });
  vi.mocked(socialMediaApi.reconnectAccount).mockReset().mockResolvedValue({ url: "https://provider.example/reconnect" });
  vi.mocked(socialMediaApi.syncAccount).mockReset().mockResolvedValue(account);
  vi.mocked(socialMediaApi.deleteAccount).mockReset().mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("AccountsPage", () => {
  it("loads only accounts with an unlimited summary and no usage or dashboard dependency", async () => {
    const pending = deferred<SocialAccount[]>();
    vi.mocked(socialMediaApi.listAccounts).mockReturnValueOnce(pending.promise);
    renderAccounts();
    expect(screen.getByRole("status", { name: "Loading accounts" })).toBeTruthy();
    expect(screen.getByText("— / Unlimited")).toBeTruthy();
    expect(screen.queryByText("No accounts connected yet")).toBeNull();
    expect(socialMediaApi.listAccounts).toHaveBeenCalledWith("workspace-1");
    expect(socialMediaApi.getUsage).not.toHaveBeenCalled();
    expect(socialMediaApi.getDashboardStats).not.toHaveBeenCalled();
    await act(async () => pending.resolve([account]));
    expect(screen.getByText("1 / Unlimited")).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("renders every active account with its own actions, health, default and sync information", async () => {
    vi.mocked(socialMediaApi.listAccounts).mockResolvedValue([
      account, second, { ...account, id: "inactive", accountName: "Inactive", isActive: false },
      { ...account, id: "linkedin", platform: "linkedin", accountName: "Acme Team", tokenStatus: "expires_soon", lastSyncedAt: new Date().toISOString() },
      { ...account, id: "facebook", platform: "facebook", accountName: "Acme Page", tokenStatus: "disconnected" },
    ]);
    renderAccounts();
    const shop = await screen.findByRole("region", { name: "Instagram account Acme Shop" });
    expect(within(shop).getByText("Expired")).toBeTruthy();
    expect(within(shop).getByRole("button", { name: "Sync now" })).toBeTruthy();
    expect(within(shop).getByRole("button", { name: "Reconnect" })).toBeTruthy();
    expect(within(shop).getByRole("button", { name: "Disconnect" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Instagram account Acme Studio" })).getByText("Default")).toBeTruthy();
    expect(screen.getByText("Healthy")).toBeTruthy();
    expect(screen.getByText("Expires soon")).toBeTruthy();
    expect(screen.getByText("just now")).toBeTruthy();
    expect(screen.getByText("Disconnected")).toBeTruthy();
    expect(screen.getByText("4 / Unlimited")).toBeTruthy();
    expect(screen.queryByText("Inactive")).toBeNull();
  });

  it("separates initial list failure from empty and retries only accounts", async () => {
    vi.mocked(socialMediaApi.listAccounts).mockRejectedValueOnce(new Error("Offline")).mockResolvedValue([]);
    renderAccounts();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("No accounts connected yet")).toBeNull();
    expect(screen.queryByRole("button", { name: "Connect Instagram" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Retry accounts" }));
    expect(await screen.findByText("No accounts connected yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect Instagram" })).toBeTruthy();
    expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(2);
    expect(socialMediaApi.getUsage).not.toHaveBeenCalled();
  });

  it("retains rows while refreshing and after refresh failure, then retries", async () => {
    renderAccounts();
    await screen.findByText("Acme Shop");
    const pending = deferred<SocialAccount[]>();
    vi.mocked(socialMediaApi.listAccounts).mockReturnValueOnce(pending.promise);
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(screen.getByText("Acme Shop")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refreshing…" })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Loading accounts" })).toBeNull();
    await act(async () => pending.reject(new Error("Offline")));
    expect(screen.getByText(/Showing the last loaded accounts/)).toBeTruthy();
    expect(screen.getByText("Acme Shop")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Retry accounts" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it.each(["free", "pro", "growth", "scale", "starter", "enterprise"])("allows more accounts beyond old caps on the %s plan without reading usage", async (plan) => {
    vi.mocked(socialMediaApi.listAccounts).mockResolvedValue(Array.from({ length: 26 }, (_, index) => ({ ...account, id: `account-${index}`, accountName: `Account ${index}` })));
    renderAccounts("workspace-1", false, plan as User["plan"]);
    await screen.findByText("26 / Unlimited");
    expect(screen.getByText("Unlimited accounts on every plan.")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("link", { name: "Upgrade" })).toBeNull();
    expect(screen.queryByText(/Checking account limit|Limit unknown|Retry usage/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Add another Instagram account" }));
    expect(socialMediaApi.getOAuthUrl).toHaveBeenCalledWith("workspace-1", "instagram");
    oauthResult(true);
    await waitFor(() => expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(2));
    expect(socialMediaApi.getUsage).not.toHaveBeenCalled();
  });

  it("keeps an empty account list connectable with an unlimited summary", async () => {
    vi.mocked(socialMediaApi.listAccounts).mockResolvedValue([]);
    renderAccounts();
    expect(await screen.findByText("0 / Unlimited")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Connect Instagram" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Connect Facebook" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Connect LinkedIn" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each(["X", "Threads", "YouTube", "TikTok", "Pinterest", "Bluesky"])("shows %s as Coming soon with no authorization or account API actions", async (name) => {
    renderAccounts();
    await screen.findByText("Acme Shop");
    const upcoming = screen.getByRole("region", { name: "More channels, coming soon" });
    expect(within(upcoming).getAllByRole("heading", { level: 3 })).toHaveLength(6);
    expect(within(upcoming).getByRole("heading", { name })).toBeTruthy();
    const button = within(upcoming).getByRole("button", { name: `Connect ${name} — Coming soon` });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(button);
    fireEvent.click(button);
    expect(socialMediaApi.getOAuthUrl).not.toHaveBeenCalled();
    expect(socialMediaApi.reconnectAccount).not.toHaveBeenCalled();
    expect(socialMediaApi.syncAccount).not.toHaveBeenCalled();
    expect(socialMediaApi.deleteAccount).not.toHaveBeenCalled();
    expect(openSocialOAuthPopup).not.toHaveBeenCalled();
    expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(1);
    expect(socialMediaApi.getUsage).not.toHaveBeenCalled();
  });

  it("connects via the original popup helper, refreshes on success and ignores repeated callbacks", async () => {
    renderAccounts();
    await userEvent.click(await screen.findByRole("button", { name: "Connect LinkedIn" }));
    expect(socialMediaApi.getOAuthUrl).toHaveBeenCalledWith("workspace-1", "linkedin");
    expect(openSocialOAuthPopup).toHaveBeenCalledWith("https://provider.example/connect", expect.any(Function));
    const callback = oauthResult(true);
    await waitFor(() => expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(2));
    act(() => callback(true));
    expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(2);
    expect(socialMediaApi.getUsage).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("LinkedIn connected");
  });

  it("handles blocked or cancelled popups, API errors and silent callbacks without leaving actions locked", async () => {
    renderAccounts();
    await userEvent.click(await screen.findByRole("button", { name: "Connect LinkedIn" }));
    oauthResult(false, "Popup blocked");
    expect(toast.error).toHaveBeenCalledWith("Popup blocked");
    vi.mocked(socialMediaApi.getOAuthUrl).mockRejectedValueOnce({ response: { data: { detail: "Provider unavailable" } } });
    await userEvent.click(screen.getByRole("button", { name: "Connect LinkedIn" }));
    expect(toast.error).toHaveBeenCalledWith("Provider unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Connect LinkedIn" }));
    oauthResult(false, "Authorization was cancelled");
    expect(toast.error).toHaveBeenCalledWith("Authorization was cancelled");
    await userEvent.click(screen.getByRole("button", { name: "Connect LinkedIn" }));
    oauthResult(true, "Silent", true);
    expect(toast.success).not.toHaveBeenCalled();
    expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "Connect LinkedIn" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("reconnects the selected non-primary account using its ID", async () => {
    renderAccounts();
    const row = await screen.findByRole("region", { name: "Instagram account Acme Shop" });
    await userEvent.click(within(row).getByRole("button", { name: "Reconnect" }));
    expect(socialMediaApi.reconnectAccount).toHaveBeenCalledWith("workspace-1", "account-2");
    expect(socialMediaApi.getOAuthUrl).not.toHaveBeenCalled();
    oauthResult(true);
    await waitFor(() => expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith("Account reconnected");
  });

  it("preserves the original reconnect fallback but tells the user and surfaces fallback failure", async () => {
    vi.mocked(socialMediaApi.reconnectAccount).mockRejectedValue(new Error("Unavailable"));
    renderAccounts();
    const row = await screen.findByRole("region", { name: "Instagram account Acme Shop" });
    await userEvent.click(within(row).getByRole("button", { name: "Reconnect" }));
    expect(toast.message).toHaveBeenCalledWith(expect.stringContaining("Trying a new authorization"));
    expect(socialMediaApi.getOAuthUrl).toHaveBeenCalledWith("workspace-1", "instagram");
    oauthResult(false, "Denied");
    vi.mocked(socialMediaApi.getOAuthUrl).mockRejectedValueOnce(new Error("Unavailable"));
    await userEvent.click(within(row).getByRole("button", { name: "Reconnect" }));
    expect(toast.error).toHaveBeenCalledWith("Failed to reconnect");
  });

  it("syncs and disconnects the selected account, preserving confirmation and cancel", async () => {
    renderAccounts();
    const row = await screen.findByRole("region", { name: "Instagram account Acme Shop" });
    await userEvent.click(within(row).getByRole("button", { name: "Sync now" }));
    expect(socialMediaApi.syncAccount).toHaveBeenCalledWith("workspace-1", "account-2");
    await waitFor(() => expect((within(row).getByRole("button", { name: "Disconnect" }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(within(row).getByRole("button", { name: "Disconnect" }));
    expect(within(screen.getByRole("dialog")).getByText(/Acme Shop:/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(socialMediaApi.deleteAccount).not.toHaveBeenCalled();
    await userEvent.click(within(row).getByRole("button", { name: "Disconnect" }));
    vi.mocked(socialMediaApi.listAccounts).mockResolvedValue([account]);
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(screen.queryByText("Acme Shop")).toBeNull());
    expect(socialMediaApi.deleteAccount).toHaveBeenCalledWith("workspace-1", "account-2");
    expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(3);
  });

  it("surfaces sync and disconnect failures and keeps confirmation available for retry", async () => {
    vi.mocked(socialMediaApi.syncAccount).mockRejectedValueOnce({ response: { data: { detail: "Sync unavailable" } } });
    vi.mocked(socialMediaApi.deleteAccount).mockRejectedValueOnce(new Error("Offline"));
    renderAccounts();
    const row = await screen.findByRole("region", { name: "Instagram account Acme Shop" });
    await userEvent.click(within(row).getByRole("button", { name: "Sync now" }));
    expect(toast.error).toHaveBeenCalledWith("Sync unavailable");
    await userEvent.click(within(row).getByRole("button", { name: "Disconnect" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }));
    expect(toast.error).toHaveBeenCalledWith("Failed to disconnect");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(1);
  });

  it("keeps X reconnect and new connections disabled while sync and disconnect remain available", async () => {
    vi.mocked(socialMediaApi.listAccounts).mockResolvedValue([{ ...account, platform: "x" }]);
    renderAccounts();
    const row = await screen.findByRole("region", { name: "X account Acme Studio" });
    expect((within(row).getByRole("button", { name: "Reconnect" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(row).getByRole("button", { name: "Sync now" }) as HTMLButtonElement).disabled).toBe(false);
    const connect = screen.getByRole("button", { name: "Connect X — Coming soon" });
    expect((connect as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(connect);
    await userEvent.click(within(row).getByRole("button", { name: "Reconnect" }));
    expect(screen.queryByRole("button", { name: /Add another X/ })).toBeNull();
    await userEvent.click(within(row).getByRole("button", { name: "Sync now" }));
    await waitFor(() => expect((within(row).getByRole("button", { name: "Disconnect" }) as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(within(row).getByRole("button", { name: "Disconnect" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }));
    expect(socialMediaApi.deleteAccount).toHaveBeenCalledWith("workspace-1", account.id);
    expect(socialMediaApi.getOAuthUrl).not.toHaveBeenCalled();
    expect(socialMediaApi.reconnectAccount).not.toHaveBeenCalled();
  });

  it.each(["connect", "reconnect", "sync", "disconnect"] as const)("prevents duplicate %s actions even in the same event batch", async (kind) => {
    const pending = deferred<SocialAccount & { url: string }>();
    if (kind === "connect") vi.mocked(socialMediaApi.getOAuthUrl).mockReturnValueOnce(pending.promise);
    if (kind === "reconnect") vi.mocked(socialMediaApi.reconnectAccount).mockReturnValueOnce(pending.promise);
    if (kind === "sync") vi.mocked(socialMediaApi.syncAccount).mockReturnValueOnce(pending.promise);
    if (kind === "disconnect") vi.mocked(socialMediaApi.deleteAccount).mockReturnValueOnce(pending.promise.then(() => undefined));
    renderAccounts();
    const row = await screen.findByRole("region", { name: "Instagram account Acme Shop" });
    if (kind === "disconnect") await userEvent.click(within(row).getByRole("button", { name: "Disconnect" }));
    const button = kind === "connect" ? screen.getByRole("button", { name: "Connect LinkedIn" })
      : kind === "disconnect" ? within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" })
        : within(row).getByRole("button", { name: kind === "sync" ? "Sync now" : "Reconnect" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    const method = kind === "connect" ? socialMediaApi.getOAuthUrl : kind === "reconnect" ? socialMediaApi.reconnectAccount
      : kind === "sync" ? socialMediaApi.syncAccount : socialMediaApi.deleteAccount;
    expect(method).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve({ ...account, url: "https://provider.example/oauth" }));
  });

  it("ignores old workspace list results", async () => {
    const oldList = deferred<SocialAccount[]>();
    vi.mocked(socialMediaApi.listAccounts).mockReturnValueOnce(oldList.promise).mockResolvedValue([]);
    const { store } = renderAccounts();
    switchWorkspace(store);
    await screen.findByText("0 / Unlimited");
    await act(async () => { oldList.resolve([second]); });
    expect(screen.queryByText("Acme Shop")).toBeNull();
    expect(screen.getByText("0 / Unlimited")).toBeTruthy();
    expect(socialMediaApi.listAccounts).toHaveBeenLastCalledWith("workspace-2");
  });

  it("ignores old workspace list failures", async () => {
    const oldList = deferred<SocialAccount[]>();
    vi.mocked(socialMediaApi.listAccounts).mockReturnValueOnce(oldList.promise);
    const { store } = renderAccounts();
    switchWorkspace(store);
    await screen.findByText("Acme Shop");
    await act(async () => { oldList.reject(new Error("Offline")); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("2 / Unlimited")).toBeTruthy();
  });

  it("deduplicates refreshes and blocks actions until the account read settles", async () => {
    renderAccounts();
    const row = await screen.findByRole("region", { name: "Instagram account Acme Shop" });
    const pending = deferred<SocialAccount[]>();
    vi.mocked(socialMediaApi.listAccounts).mockReturnValueOnce(pending.promise);
    const refresh = screen.getByRole("button", { name: "Refresh" });
    act(() => {
      fireEvent.click(refresh);
      fireEvent.click(refresh);
      fireEvent.click(within(row).getByRole("button", { name: "Sync now" }));
    });
    expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(2);
    expect(socialMediaApi.syncAccount).not.toHaveBeenCalled();
    await act(async () => pending.resolve([account, second]));
  });

  it("blocks a same-batch manual refresh after a mutation starts and reloads after it settles", async () => {
    const pending = deferred<SocialAccount>();
    vi.mocked(socialMediaApi.syncAccount).mockReturnValueOnce(pending.promise);
    renderAccounts();
    const row = await screen.findByRole("region", { name: "Instagram account Acme Shop" });
    const refresh = screen.getByRole("button", { name: "Refresh" });
    act(() => {
      fireEvent.click(within(row).getByRole("button", { name: "Sync now" }));
      fireEvent.click(refresh);
    });
    expect(socialMediaApi.syncAccount).toHaveBeenCalledTimes(1);
    expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(1);
    expect(socialMediaApi.getUsage).not.toHaveBeenCalled();
    vi.mocked(socialMediaApi.listAccounts).mockResolvedValue([account, { ...second, accountName: "Synced shop" }]);
    await act(async () => pending.resolve(second));
    expect(await screen.findByText("Synced shop")).toBeTruthy();
    expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(2);
    expect(socialMediaApi.getUsage).not.toHaveBeenCalled();
  });

  it("guards account retries while a mutation is pending, including the same event batch", async () => {
    const pending = deferred<SocialAccount>();
    vi.mocked(socialMediaApi.syncAccount).mockReturnValueOnce(pending.promise);
    renderAccounts();
    const row = await screen.findByRole("region", { name: "Instagram account Acme Shop" });
    vi.mocked(socialMediaApi.listAccounts).mockRejectedValueOnce(new Error("Offline"));
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    const retryAccounts = await screen.findByRole("button", { name: "Retry accounts" });
    act(() => {
      fireEvent.click(within(row).getByRole("button", { name: "Sync now" }));
      fireEvent.click(retryAccounts);
    });
    expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(2);
    expect(socialMediaApi.getUsage).not.toHaveBeenCalled();
    expect((retryAccounts as HTMLButtonElement).disabled).toBe(true);
    await act(async () => pending.resolve(second));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(3);
    expect(socialMediaApi.getUsage).not.toHaveBeenCalled();
  });

  it.each(["connect", "reconnect", "sync", "disconnect"] as const)("reloads only accounts after %s and keeps the summary unlimited", async (kind) => {
    renderAccounts();
    const row = await screen.findByRole("region", { name: "Instagram account Acme Shop" });
    if (kind === "connect") await userEvent.click(screen.getByRole("button", { name: "Connect LinkedIn" }));
    else if (kind === "disconnect") {
      await userEvent.click(within(row).getByRole("button", { name: "Disconnect" }));
      await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }));
    } else await userEvent.click(within(row).getByRole("button", { name: kind === "sync" ? "Sync now" : "Reconnect" }));
    if (kind === "connect" || kind === "reconnect") oauthResult(true);
    await waitFor(() => expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(2));
    await waitFor(() => expect((screen.getByRole("button", { name: "Add another Instagram account" }) as HTMLButtonElement).disabled).toBe(false));
    expect(socialMediaApi.getUsage).not.toHaveBeenCalled();
    expect(screen.getByText("2 / Unlimited")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["connect", "reconnect", "sync", "disconnect"] as const)("ignores stale %s results after a workspace switch", async (kind) => {
    const pending = deferred<SocialAccount & { url: string }>();
    if (kind === "connect") vi.mocked(socialMediaApi.getOAuthUrl).mockReturnValueOnce(pending.promise);
    if (kind === "reconnect") vi.mocked(socialMediaApi.reconnectAccount).mockReturnValueOnce(pending.promise);
    if (kind === "sync") vi.mocked(socialMediaApi.syncAccount).mockReturnValueOnce(pending.promise);
    if (kind === "disconnect") vi.mocked(socialMediaApi.deleteAccount).mockReturnValueOnce(pending.promise.then(() => undefined));
    const { store } = renderAccounts();
    const row = await screen.findByRole("region", { name: "Instagram account Acme Shop" });
    if (kind === "connect") await userEvent.click(screen.getByRole("button", { name: "Connect LinkedIn" }));
    else if (kind === "disconnect") {
      await userEvent.click(within(row).getByRole("button", { name: "Disconnect" }));
      await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }));
    } else await userEvent.click(within(row).getByRole("button", { name: kind === "sync" ? "Sync now" : "Reconnect" }));
    vi.mocked(socialMediaApi.listAccounts).mockResolvedValue([]);
    switchWorkspace(store);
    await screen.findByText("No accounts connected yet");
    await act(async () => pending.resolve({ ...account, url: "https://provider.example/stale" }));
    expect(openSocialOAuthPopup).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ignores stale reconnect errors rather than opening fallback OAuth in the old workspace", async () => {
    const pending = deferred<{ url: string }>();
    vi.mocked(socialMediaApi.reconnectAccount).mockReturnValueOnce(pending.promise);
    const { store } = renderAccounts();
    const row = await screen.findByRole("region", { name: "Instagram account Acme Shop" });
    await userEvent.click(within(row).getByRole("button", { name: "Reconnect" }));
    switchWorkspace(store);
    await act(async () => pending.reject(new Error("Old workspace failure")));
    expect(socialMediaApi.getOAuthUrl).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.message).not.toHaveBeenCalled();
  });

  it.each(["switch", "unmount"] as const)("ignores OAuth callbacks after %s", async (kind) => {
    const { store, unmount } = renderAccounts();
    await userEvent.click(await screen.findByRole("button", { name: "Connect LinkedIn" }));
    if (kind === "switch") switchWorkspace(store);
    else unmount();
    oauthResult(true, "Old connection");
    expect(toast.success).not.toHaveBeenCalled();
    expect(socialMediaApi.listAccounts).toHaveBeenCalledTimes(kind === "switch" ? 2 : 1);
  });

  it("does not let an old OAuth callback unlock an action in the new workspace", async () => {
    const { store } = renderAccounts();
    await userEvent.click(await screen.findByRole("button", { name: "Connect LinkedIn" }));
    const oldCallback = vi.mocked(openSocialOAuthPopup).mock.calls[0][1];
    switchWorkspace(store);
    await userEvent.click(await screen.findByRole("button", { name: "Connect LinkedIn" }));
    act(() => oldCallback(false, "Old popup cancelled"));
    expect((screen.getByRole("button", { name: "Connecting…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
    oauthResult(false, "Current popup cancelled");
    expect((screen.getByRole("button", { name: "Connect LinkedIn" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("ignores superseded requests under StrictMode", async () => {
    const pending = deferred<SocialAccount[]>();
    vi.mocked(socialMediaApi.listAccounts).mockReturnValueOnce(pending.promise).mockResolvedValue([]);
    renderAccounts("workspace-1", true);
    await screen.findByText("No accounts connected yet");
    await act(async () => pending.resolve([account]));
    expect(screen.queryByText("Acme Studio")).toBeNull();
  });

  it("does not load or leave an endless skeleton without a workspace", () => {
    renderAccounts("");
    expect(screen.getByText("Select a workspace to manage its accounts.")).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Loading accounts" })).toBeNull();
    expect(socialMediaApi.listAccounts).not.toHaveBeenCalled();
    expect(socialMediaApi.getUsage).not.toHaveBeenCalled();
  });

  it("supports keyboard connection and has no axe violations in loaded and confirmation states", async () => {
    const { container } = renderAccounts();
    await screen.findByText("Acme Shop");
    expect((await axe(container)).violations).toEqual([]);
    const keyboard = userEvent.setup();
    screen.getByRole("button", { name: "Connect LinkedIn" }).focus();
    await keyboard.keyboard("{Enter}");
    expect(socialMediaApi.getOAuthUrl).toHaveBeenCalledWith("workspace-1", "linkedin");
    oauthResult(false);
    const row = screen.getByRole("region", { name: "Instagram account Acme Shop" });
    await keyboard.click(within(row).getByRole("button", { name: "Disconnect" }));
    expect((await axe(screen.getByRole("dialog"))).violations).toEqual([]);
  });

  it.each(["loading", "empty", "error"] as const)("has no axe violations in the %s state", async (state) => {
    if (state === "loading") vi.mocked(socialMediaApi.listAccounts).mockReturnValue(new Promise(() => {}));
    if (state === "empty") vi.mocked(socialMediaApi.listAccounts).mockResolvedValue([]);
    if (state === "error") vi.mocked(socialMediaApi.listAccounts).mockRejectedValue(new Error("Offline"));
    const { container } = renderAccounts();
    if (state === "empty") await screen.findByText("No accounts connected yet");
    if (state === "error") await screen.findByRole("alert");
    if (state === "loading") await screen.findByText("— / Unlimited");
    expect((await axe(container)).violations).toEqual([]);
  });
});