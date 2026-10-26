import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { ThemeControl } from "@/components/landing/ThemeControl";
import { readThemePreference, THEME_STORAGE_KEY, themeInitializationScript } from "@/lib/theme";

let systemDark = false;
const mediaListeners = new Set<() => void>();

function changeSystem(dark: boolean) {
  systemDark = dark;
  act(() => mediaListeners.forEach(listener => listener()));
}

function ThemeProbe() {
  const { preference, setPreference } = useTheme();
  return <><output aria-label="Preference">{preference}</output>{(["light", "dark", "system"] as const).map(value => <button key={value} onClick={() => setPreference(value)}>{value}</button>)}</>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  systemDark = false;
  mediaListeners.clear();
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({
    get matches() { return systemDark; },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => mediaListeners.add(listener as () => void),
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => mediaListeners.delete(listener as () => void),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
});

describe("landing theme", () => {
  it.each([
    { saved: "light", system: true, dark: false },
    { saved: "dark", system: false, dark: true },
    { saved: "system", system: true, dark: true },
    { saved: "invalid", system: true, dark: false },
    { saved: null, system: true, dark: false },
    { saved: null, system: false, dark: false },
  ])("initializes before hydration for $saved / system dark $system", ({ saved, system, dark }) => {
    if (saved) localStorage.setItem(THEME_STORAGE_KEY, saved);
    systemDark = system;
    Function(themeInitializationScript)();
    expect(document.documentElement.classList.contains("dark")).toBe(dark);
    expect(document.documentElement.style.colorScheme).toBe(dark ? "dark" : "light");
  });

  it("defaults to light when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    systemDark = true;
    expect(readThemePreference()).toBe("light");
    Function(themeInitializationScript)();
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("persists explicit choices across remounts and only follows system when selected", () => {
    const { unmount } = render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    changeSystem(true);
    expect(document.documentElement).not.toHaveClass("dark");
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    changeSystem(false);
    changeSystem(true);
    expect(document.documentElement).not.toHaveClass("dark");
    unmount();
    expect(mediaListeners.size).toBe(0);
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByLabelText("Preference")).toHaveTextContent("light");
    fireEvent.click(screen.getByRole("button", { name: "system" }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
    expect(document.documentElement).toHaveClass("dark");
    changeSystem(false);
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("syncs the shared app key across tabs and handles cleared storage", () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
    });
    expect(document.documentElement).toHaveClass("dark");
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(document.documentElement).not.toHaveClass("dark");
    expect(screen.getByLabelText("Preference")).toHaveTextContent("light");
  });

  it("keeps theme selection usable with blocked persistence", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    changeSystem(false);
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByLabelText("Preference")).toHaveTextContent("dark");
  });

  it("offers keyboard-accessible Light, Dark and System choices with checked state", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeControl /></ThemeProvider>);
    const trigger = screen.getByRole("button", { name: "Choose color theme" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    await user.click(trigger);
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });
});