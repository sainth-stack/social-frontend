import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const css = read("src/styles.css");
const tokens = (selector: string) => Object.fromEntries([...css.match(new RegExp(`${selector} \\{([^}]+)\\}`))![1]!.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value]));
const light = tokens(":root");
const dark = { ...light, ...tokens("\\.dark") };

function resolve(palette: Record<string, string>, key: string): string {
  const value = palette[key]!;
  return value.startsWith("var(") ? resolve(palette, value.slice(6, -1)) : value;
}

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
}

describe("Ivory and Burnt Orange regression", () => {
  it.each([
    { mode: "light", palette: light, background: "#fffaf5", primary: "#c2410c", card: "#ffffff" },
    { mode: "dark", palette: dark, background: "#181411", primary: "#fb923c", card: "#241e19" },
  ])("uses the approved $mode palette and AA text pairs", ({ palette, background, primary, card }) => {
    expect(palette.background).toBe(background);
    expect(palette.primary).toBe(primary);
    expect(palette.card).toBe(card);
    for (const [foreground, surface] of [["foreground", "background"], ["foreground", "card"], ["muted-foreground", "background"], ["muted-foreground", "card"], ["muted-foreground", "surface"], ["primary", "background"], ["primary", "primary-soft"], ["primary-foreground", "primary"], ["primary-foreground", "primary-hover"], ["accent-foreground", "accent"], ["ink-foreground", "ink"], ["ink-muted", "ink"], ["brand-wordmark", "background"]]) {
      const values = [luminance(resolve(palette, foreground!)), luminance(resolve(palette, surface!))].sort((a, b) => a - b);
      expect((values[1]! + .05) / (values[0]! + .05), `${foreground} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps solid wordmarks and the original Ascent geometry in both active SVGs", () => {
    const mark = read("public/brand/earnedvoice-mark.svg");
    const lockup = read("public/brand/earnedvoice-lockup.svg");
    for (const source of [mark, lockup]) {
      for (const color of ["#9a3412", "#ea580c", "#fed7aa", "#fdba74", "#fb923c", "#7c2d12"]) expect(source).toContain(color);
      expect(source).toContain("M9 27Q6 20 14 20H37L65 78L51 106Q48 111 44 103Z");
      expect(source).not.toMatch(/linearGradient|#4f46e5|#312e81|#818cf8/);
    }
    expect(lockup).toContain(".wordmark { fill: #c2410c; }");
    expect(css).not.toMatch(/brand-wordmark-(start|middle|end)|#4f46e5|#312e81|276\.966/);
  });

  it("keeps active illustrations and the skip link theme-aware", () => {
    expect(read("src/components/landing/ProductIllustration.tsx")).not.toContain('"var(--ink)"} fontSize');
    expect(css).not.toMatch(/color-mix\([^;]*, white\)|background:\s*(white|#fff)\s*;/);
    expect(css).toMatch(/\.skip-link \{[^}]*color: var\(--primary-foreground\)/);
    expect(read("src/app/opengraph-image.tsx")).toContain("#fffaf5");
    expect(read("src/app/opengraph-image.tsx")).not.toContain("#4f46e5");
  });
});