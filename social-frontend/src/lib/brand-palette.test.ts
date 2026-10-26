import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { brandTokens, darkBrandTokens } from "./tokens";
import { appThemes } from "./theme";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const css = read("src/app/globals.css");
const parse = (selector: string) => Object.fromEntries([...css.match(new RegExp(`${selector} \\{([^}]+)\\}`))![1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value]));
const light = parse(":root");
const dark = { ...light, ...parse("\\.dark") };

function luminance(hex: string) {
  const c = hex.slice(1).match(/../g)!.map((v) => parseInt(v, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}

describe("Ivory and Burnt Orange app palette", () => {
  it.each([{ mode: "light" as const, palette: light, tokens: brandTokens }, { mode: "dark" as const, palette: dark, tokens: darkBrandTokens }])("keeps CSS and MUI synchronized in $mode", ({ mode, palette, tokens }) => {
    for (const [cssKey, tokenKey] of [["primary", "primary"], ["background", "surfaceMuted"], ["foreground", "textPrimary"], ["ring", "ring"], ["muted-foreground", "textMuted"], ["border", "borderDefault"]] as const) expect(palette[cssKey]).toBe(tokens[tokenKey]);
    expect(appThemes[mode].palette.primary.main).toBe(palette.primary);
    expect(appThemes[mode].palette.background.paper).toBe(tokens.surfaceWhite);
    for (const [fg, bg] of [["foreground", "background"], ["muted-foreground", "background"], ["primary-foreground", "primary"], ["primary", "background"], ["accent-foreground", "accent"], ["sidebar-accent-foreground", "sidebar-accent"]]) {
      const values = [luminance(palette[fg]), luminance(palette[bg])].sort((a, b) => a - b);
      expect((values[1] + .05) / (values[0] + .05), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses matching orange SVG assets in both products without changing geometry", () => {
    for (const asset of ["earnedvoice-mark.svg", "earnedvoice-lockup.svg"]) {
      const source = read(`public/brand/${asset}`);
      expect(source).toBe(read(`../social-landing/public/brand/${asset}`));
      expect(source).toContain("M9 27Q6 20 14 20H37L65 78L51 106Q48 111 44 103Z");
      expect(source).not.toMatch(/linearGradient|#4f46e5|#312e81|#818cf8/);
    }
    expect(css).not.toMatch(/brand-wordmark-(start|middle|end)|#4f46e5|#312e81/);
  });
});