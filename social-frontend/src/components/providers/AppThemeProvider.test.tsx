import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "@mui/material/styles";
import AppThemeProvider, { useAppTheme } from "./AppThemeProvider";

function Probe() {
  const { mode, preference, setTheme, themeError } = useAppTheme();
  const mui = useTheme();
  return <><output>{`${preference}/${mode}/${mui.palette.mode}`}</output>{(["light", "dark", "system"] as const).map((value) => <button key={value} onClick={() => setTheme(value)}>{value}</button>)}{themeError && <p role="status">{themeError}</p>}</>;
}

let media: MediaQueryList;
let listeners: Set<(event: MediaQueryListEvent) => void>;

beforeEach(() => {
  listeners = new Set();
  media = { matches: true, addEventListener: vi.fn((_, callback) => listeners.add(callback)), removeEventListener: vi.fn((_, callback) => listeners.delete(callback)) } as unknown as MediaQueryList;
  vi.stubGlobal("matchMedia", () => media);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.removeProperty("color-scheme");
});

function systemChange(matches: boolean) {
  Object.defineProperty(media, "matches", { value: matches, configurable: true });
  act(() => listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent)));
}

describe("AppThemeProvider", () => {
  it("restores persisted mode and matches DOM and MUI", () => {
    localStorage.setItem("opsbrain-theme", "light");
    document.documentElement.classList.add("dark");
    render(<AppThemeProvider><Probe /></AppThemeProvider>);
    expect(screen.getByRole("status").textContent).toBe("light/light/light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(screen.getByRole("status").textContent).toBe("dark/dark/dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem("opsbrain-theme")).toBe("dark");
  });

  it("follows system changes only while system is selected and cleans up", () => {
    const view = render(<AppThemeProvider><Probe /></AppThemeProvider>);
    expect(screen.getByRole("status").textContent).toBe("system/dark/dark");
    systemChange(false);
    expect(screen.getByRole("status").textContent).toBe("system/light/light");
    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    systemChange(false);
    expect(screen.getByRole("status").textContent).toBe("dark/dark/dark");
    fireEvent.click(screen.getByRole("button", { name: "system" }));
    expect(screen.getByRole("status").textContent).toBe("system/light/light");
    expect(localStorage.getItem("opsbrain-theme")).toBeNull();
    view.unmount();
    expect(listeners.size).toBe(0);
  });

  it("synchronizes storage updates, deletion and clear without writing back", () => {
    render(<AppThemeProvider><Probe /></AppThemeProvider>);
    const write = vi.spyOn(Storage.prototype, "setItem");
    const sync = (key: string | null, newValue: string | null) => act(() => window.dispatchEvent(new StorageEvent("storage", { key, newValue })));
    sync("unrelated", "light");
    expect(screen.getByRole("status").textContent).toBe("system/dark/dark");
    sync("opsbrain-theme", "light");
    expect(screen.getByRole("status").textContent).toBe("light/light/light");
    sync("opsbrain-theme", null);
    expect(screen.getByRole("status").textContent).toBe("system/dark/dark");
    sync("opsbrain-theme", "light");
    sync(null, null);
    expect(screen.getByRole("status").textContent).toBe("system/dark/dark");
    expect(write).not.toHaveBeenCalled();
  });

  it("keeps an in-memory selection if persistence fails", () => {
    render(<AppThemeProvider><Probe /></AppThemeProvider>);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(screen.getByText("light/light/light")).toBeTruthy();
    expect(screen.getByText(/could not remember/)).toBeTruthy();
    systemChange(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});