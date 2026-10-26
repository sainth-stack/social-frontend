import { afterEach, describe, expect, it, vi } from "vitest";
import { appThemes, colors, chartColors, chartTooltipStyle, surfaceSx } from "./theme";
import { initializeTheme, themeInitializationScript } from "./theme-preference";
import { darkBrandTokens } from "./tokens";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.removeProperty("color-scheme");
});

describe("theme initialization", () => {
  it.each(["light", "dark"] as const)("restores persisted %s before React mounts", (mode) => {
    localStorage.setItem("opsbrain-theme", mode);
    vi.stubGlobal("matchMedia", () => ({ matches: mode !== "dark" }));
    new Function(themeInitializationScript)();
    expect(document.documentElement.classList.contains("dark")).toBe(mode === "dark");
    expect(document.documentElement.style.colorScheme).toBe(mode);
  });

  it.each([null, "invalid"])("defaults to light for %s even on dark devices", (saved) => {
    if (saved) localStorage.setItem("opsbrain-theme", saved);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(initializeTheme()).toEqual({ preference: "light", mode: "light" });
  });

  it("defaults to light when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    new Function(themeInitializationScript)();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("works without storage or matchMedia access", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    vi.stubGlobal("matchMedia", undefined);
    expect(initializeTheme()).toEqual({ preference: "light", mode: "light" });
  });
});

describe("shared theme surfaces", () => {
  it("provides dynamic MUI palettes with burnt orange branding", () => {
    expect(appThemes.light.palette.mode).toBe("light");
    expect(appThemes.light.palette.primary.main).toBe("#c2410c");
    expect(appThemes.dark.palette.mode).toBe("dark");
    expect(appThemes.dark.palette.background.paper).toBe(darkBrandTokens.surfaceWhite);
    expect(appThemes.dark.palette.text.primary).toBe(darkBrandTokens.textPrimary);
    expect(appThemes.dark.palette.primary.main).toBe(darkBrandTokens.primary);
  });

  it("uses CSS tokens for legacy surfaces, text, status chips and chart tooltips", () => {
    expect(surfaceSx.bgcolor).toBe("var(--card)");
    expect(colors.textPrimary).toBe("var(--foreground)");
    expect(colors.chipSuccessText).toBe("var(--legacy-success-text)");
    expect(chartTooltipStyle.backgroundColor).toBe("var(--card)");
    expect(chartTooltipStyle.color).toBe("var(--foreground)");
    expect(chartColors.primary).toBe("var(--chart-1)");
    expect(chartColors.secondary).toBe("var(--chart-2)");
    expect(colors.primary).toBe("var(--primary)");
    expect(colors.success).toBe("var(--success)");
  });
});