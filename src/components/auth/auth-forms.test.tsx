import type { ReactNode } from "react";
import { configureStore } from "@reduxjs/toolkit";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import LoginForm from "@/app/login/LoginForm";
import RegisterForm from "@/app/register/RegisterForm";
import authReducer, { loginFailure } from "@/features/auth/authSlice";
import { login } from "@/features/auth/authThunks";
import { platformBrand } from "@/lib/brand";
import type { AuthSessionResponse, RegisterResponse, User } from "@/types/auth";

const { default: RealAuthCardShell } = await vi.importActual<typeof import("./AuthCardShell")>("./AuthCardShell");

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), prefetch: vi.fn() },
  params: new URLSearchParams(),
  login: vi.fn(), register: vi.fn(), me: vi.fn(), prefetchHome: vi.fn(), success: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, useSearchParams: () => mocks.params }));
vi.mock("@/api/endpoints/auth.api", () => ({ authApi: { login: mocks.login, register: mocks.register, me: mocks.me } }));
vi.mock("@/lib/dashboard-cache", () => ({ prefetchDashboardHome: mocks.prefetchHome }));
vi.mock("sonner", () => ({ toast: { success: mocks.success } }));
vi.mock("@/components/auth/AuthCardShell", () => ({ default: ({ title, subtitle, footer, children }: { title: string; subtitle: string; footer: ReactNode; children: ReactNode }) => <main><h1>{title}</h1><p>{subtitle}</p>{children}<footer>{footer}</footer></main> }));

const key = "opsbrain_remember_email";
const apiUser = { id: "u1", email: "ava@example.com", full_name: "Ava Chen", is_active: true, is_platform_admin: false };
const workspace = { id: "w1", name: "Northstar", plan: "starter", role: "owner", social_level: "admin" };
const session: AuthSessionResponse = { access_token: "token", token_type: "bearer", user: apiUser, workspaces: [workspace] };
const registered: RegisterResponse = { ...session, workspace };
const user: User = { id: "u1", email: "ava@example.com", name: "Ava Chen", isPlatformAdmin: false, workspaceId: "w1", workspaceName: "Northstar", socialPermissionLevel: "admin", plan: "starter" };

function setup(kind: "login" | "register" = "login", overrides: Partial<ReturnType<typeof authReducer>> = {}) {
  const store = configureStore({ reducer: { auth: authReducer }, preloadedState: { auth: { ...authReducer(undefined, { type: "init" }), isHydrated: true, ...overrides } } });
  const view = render(<Provider store={store}>{kind === "login" ? <LoginForm /> : <RegisterForm />}</Provider>);
  return { ...view, store, form: view.container.querySelector("form")! };
}

function fillLogin() {
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "ava@example.com" } });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "abc12345" } });
}

function fillRegister(password = "abc12345") {
  fillLogin();
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ava Chen" } });
  fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Northstar" } });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: password } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  mocks.params = new URLSearchParams();
  mocks.login.mockReset().mockResolvedValue(session);
  mocks.register.mockReset().mockResolvedValue(registered);
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("authentication shell", () => {
  it.each([
    ["Welcome back", "Sign in to your account", "Create an account", "/register"],
    ["Create your account", "Get started with your workspace", "Sign in", "/login"],
    ["Forgot your password?", "Enter your email for a reset link", "Back to sign in", "/login"],
  ])("provides a simple centered card for %s with unchanged content and footer", (title, subtitle, footerLabel, footerHref) => {
    const { container } = render(<RealAuthCardShell title={title} subtitle={subtitle} footer={<a href={footerHref}>{footerLabel}</a>}><p>Account form</p></RealAuthCardShell>);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByText(subtitle)).toBeTruthy();
    expect(screen.getByRole("main").className).toContain("items-center");
    expect(screen.getByRole("main").className).toContain("justify-center");
    expect(screen.getByRole("region", { name: "Account access" }).className).toContain("max-w-md");
    expect(screen.getByRole("link", { name: "OpsBrain AI home" }).getAttribute("href")).toBe(platformBrand.marketingUrl);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "OpsBrain AI" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Illustration of an OpsBrain workspace/ })).toBeNull();
    expect(screen.queryByText(/Your next great idea starts here|One workspace\. Every channel\.|Visit website/)).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByText("Account form")).toBeTruthy();
    expect(screen.getByRole("link", { name: footerLabel }).getAttribute("href")).toBe(footerHref);
  });

  it.each(["Welcome back", "Create your account", "Forgot your password?"])("passes structural accessibility checks for the simple %s shell", async (title) => {
    const { container } = render(<RealAuthCardShell title={title} subtitle="Enter your details below" footer={<a href="/login">Sign in</a>}><label htmlFor="test-email">Email</label><input id="test-email" type="email" /></RealAuthCardShell>);
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});

describe("login form", () => {
  it("restores the default remembered email and preserves navigation links and prefetch", () => {
    window.localStorage.setItem(key, "saved@example.com");
    setup();
    expect((screen.getByLabelText("Work email") as HTMLInputElement).value).toBe("saved@example.com");
    expect(screen.getByRole("checkbox", { name: "Remember my email" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Saves your email on this device.")).toBeTruthy();
    expect(mocks.router.prefetch).toHaveBeenCalledWith("/dashboard");
    expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/forgot-password");
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe("/register");
  });

  it("validates the exact fields and connects stable IDs to errors", async () => {
    const { form } = setup();
    const email = screen.getByLabelText("Work email");
    const id = email.id;
    fireEvent.submit(form);
    await screen.findByText("Email is required");
    expect(screen.getByText("Password is required")).toBeTruthy();
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(email.getAttribute("aria-describedby")!)?.textContent).toBe("Email is required");
    expect(email.id).toBe(id);
    fireEvent.change(email, { target: { value: "invalid" } });
    fireEvent.submit(form);
    await screen.findByText("Enter a valid email");
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("submits only credentials, saves email, prefetches workspace home and redirects", async () => {
    const { form, store } = setup();
    fillLogin();
    fireEvent.submit(form);
    await waitFor(() => expect(store.getState().auth.isAuthenticated).toBe(true));
    expect(mocks.login).toHaveBeenCalledExactlyOnceWith({ email: "ava@example.com", password: "abc12345" });
    expect(window.localStorage.getItem(key)).toBe("ava@example.com");
    expect(mocks.prefetchHome).toHaveBeenCalledWith("w1");
    expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("removes saved email when remembering is unchecked", async () => {
    window.localStorage.setItem(key, "old@example.com");
    const { form } = setup();
    fillLogin();
    await userEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it.each(["getItem", "setItem", "removeItem"] as const)("still submits when remember-email %s throws", async (method) => {
    const original = Storage.prototype[method];
    vi.spyOn(Storage.prototype, method).mockImplementation(function (this: Storage, storageKey: string, ...args: string[]) {
      if (storageKey === key) throw new DOMException("Storage unavailable", "SecurityError");
      return Reflect.apply(original, this, [storageKey, ...args]);
    });
    const { form, store } = setup();
    fillLogin();
    if (method === "removeItem") await userEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(form);
    await waitFor(() => expect(store.getState().auth.isAuthenticated).toBe(true));
    expect(mocks.login).toHaveBeenCalledTimes(1);
    expect(mocks.router.prefetch).toHaveBeenCalledWith("/dashboard");
  });

  it("keeps values after failure and allows retry", async () => {
    mocks.login.mockRejectedValueOnce(new Error("Incorrect credentials"));
    const { form } = setup();
    fillLogin();
    fireEvent.submit(form);
    expect((await screen.findByRole("alert")).textContent).toBe("Incorrect credentials");
    await waitFor(() => expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByLabelText("Work email") as HTMLInputElement).value).toBe("ava@example.com");
    expect((screen.getByLabelText("Password", { exact: true }) as HTMLInputElement).value).toBe("abc12345");
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard"));
    expect(mocks.login).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    [false, "", "/dashboard"],
    [true, "", "/admin"],
    [false, "?redirect=%2Fdashboard%2Fposts", "/dashboard/posts"],
    [true, "?redirect=%2Fdashboard%2Fposts", "/dashboard/posts"],
    [false, "?redirect=", ""],
    [false, "?redirect=https%3A%2F%2Fexample.com", "https://example.com"],
  ])("preserves authenticated routing for admin=%s and %s", (admin, query, route) => {
    mocks.params = new URLSearchParams(query as string);
    setup("login", { user: { ...user, isPlatformAdmin: admin as boolean }, isAuthenticated: true });
    expect(mocks.router.replace).toHaveBeenCalledWith(route);
    expect(mocks.prefetchHome).toHaveBeenCalledTimes(admin ? 0 : 1);
  });

  it("waits for hydration before redirecting", () => {
    setup("login", { user, isAuthenticated: true, isHydrated: false });
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.prefetchHome).not.toHaveBeenCalled();
  });
});

describe("register form", () => {
  it("validates required fields, original password rules and confirmation", async () => {
    const { form } = setup("register");
    fireEvent.submit(form);
    for (const message of ["Enter your full name", "Enter your business or workspace name", "Email is required", "At least 8 characters", "Confirm your password"]) expect(await screen.findByText(message)).toBeTruthy();
    fillRegister("abcdefgh");
    fireEvent.submit(form);
    await screen.findByText("Include at least one letter and one number");
    fillRegister();
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different1" } });
    fireEvent.submit(form);
    await screen.findByText("Passwords do not match");
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("keeps strength informational and submits the existing onboarding payload", async () => {
    const { form, store } = setup("register");
    fillRegister();
    expect(screen.getByText("Weak")).toBeTruthy();
    fireEvent.submit(form);
    await waitFor(() => expect(store.getState().auth.isAuthenticated).toBe(true));
    expect(mocks.register).toHaveBeenCalledExactlyOnceWith({ name: "Ava Chen", workspaceName: "Northstar", email: "ava@example.com", password: "abc12345" });
    expect(mocks.success).toHaveBeenCalledWith("Workspace created — welcome to OpsBrain");
    expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard/onboarding");
  });

  it("preserves entered data on server failure and retries", async () => {
    mocks.register.mockRejectedValueOnce(new Error("Email already registered"));
    const { form } = setup("register");
    fillRegister();
    fireEvent.submit(form);
    expect((await screen.findByRole("alert")).textContent).toBe("Email already registered");
    await waitFor(() => expect((screen.getByRole("button", { name: "Create account" }) as HTMLButtonElement).disabled).toBe(false));
    for (const [label, value] of [["Full name", "Ava Chen"], ["Business name", "Northstar"], ["Work email", "ava@example.com"], ["Password", "abc12345"], ["Confirm password", "abc12345"]]) expect((screen.getByLabelText(label, { exact: true }) as HTMLInputElement).value).toBe(value);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(1));
    expect(mocks.register).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])("preserves existing authenticated onboarding routing for admin=%s", (admin) => {
    setup("register", { user: { ...user, isPlatformAdmin: admin }, isAuthenticated: true });
    expect(mocks.router.replace).toHaveBeenCalledWith(admin ? "/admin" : "/dashboard/onboarding");
  });

  it("retains terms, privacy and login links without adding consent requirements", () => {
    setup("register");
    for (const [name, route] of [["Terms", "terms"], ["Privacy Policy", "privacy"]]) {
      const link = screen.getByRole("link", { name });
      expect(link.getAttribute("href")).toBe(`${platformBrand.marketingUrl}/${route}`);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("toggles distinct password fields without changing names, autocomplete, values or focus", async () => {
    setup("register");
    fillRegister();
    const password = screen.getByLabelText("Password", { exact: true }) as HTMLInputElement;
    const confirm = screen.getByLabelText("Confirm password") as HTMLInputElement;
    password.focus();
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(document.activeElement).toBe(password);
    expect(password.type).toBe("text");
    expect(confirm.type).toBe("password");
    expect(password.name).toBe("password");
    expect(password.autocomplete).toBe("new-password");
    expect(password.value).toBe("abc12345");
    await userEvent.click(screen.getByRole("button", { name: "Show confirm password" }));
    expect(document.activeElement).toBe(confirm);
    expect(confirm.type).toBe("text");
    expect(confirm.name).toBe("confirm");
    expect(confirm.autocomplete).toBe("new-password");
    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password.type).toBe("password");
  });
});

describe.each(["login", "register"] as const)("%s shared states", (kind) => {
  it("clears cross-form stale errors on mount", () => {
    const { store } = setup(kind, { error: "Error from another form" });
    expect(store.getState().auth.error).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    act(() => { store.dispatch(loginFailure("New failure")); });
    expect(screen.getByRole("alert").textContent).toBe("New failure");
  });

  it("locks duplicate submissions immediately and disables all fields during pending", async () => {
    const pending = deferred<RegisterResponse>();
    const api = kind === "login" ? mocks.login : mocks.register;
    api.mockReturnValueOnce(pending.promise);
    const { form, container } = setup(kind);
    if (kind === "login") fillLogin(); else fillRegister();
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    expect(form.getAttribute("aria-busy")).toBe("true");
    for (const control of container.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button")) expect(control.disabled).toBe(true);
    fireEvent.submit(form);
    expect(api).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(registered); });
    await waitFor(() => expect(form.getAttribute("aria-busy")).toBe("false"));
  });

  it("blocks submissions while Redux is already loading", async () => {
    const { form, store } = setup(kind, { isLoading: true });
    fireEvent.submit(form);
    await act(async () => {});
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(form.getAttribute("aria-busy")).toBe("true");
    act(() => { store.dispatch(login.rejected(new Error("Failed"), "request", { email: "", password: "" })); });
    expect(form.getAttribute("aria-busy")).toBe("false");
  });

  it("has no axe violations before and after validation", async () => {
    const { container, form } = setup(kind);
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
    fireEvent.submit(form);
    await screen.findByText("Email is required");
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});