import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), "src", path), "utf8");

describe("non-core palette compatibility", () => {
  it.each([
    "components/ui/AppButton.tsx",
    "components/ui/AppField.tsx",
    "components/ui/LoadingState.tsx",
    "components/ui/StatCard.tsx",
    "lib/authStyles.ts",
  ])("keeps translucent branding valid with CSS variable colors in %s", (path) => {
    const content = source(path);
    expect(content).not.toMatch(/\$\{colors\.(?:primary|success)\}[\da-f]{2}/i);
    expect(content).not.toMatch(/rgb\(79 70 229/i);
    expect(content).toContain("color-mix(in srgb, var(--");
  });

  it.each([
    "components/social-media/calendar/CalendarDayCell.tsx",
    "components/social-media/content-studio/AIGenerate.tsx",
    "components/social-media/content-studio/StudioSidebar.tsx",
  ])("pairs primary backgrounds with semantic foregrounds in %s", (path) => {
    expect(source(path)).toContain("var(--primary-foreground)");
  });

  it("uses a semantic success surface on password recovery", () => {
    const content = source("app/forgot-password/page.tsx");
    expect(content).toContain("bgcolor: colors.successLight");
    expect(content).not.toContain("${colors.success}22");
  });

  it("uses theme-aware data-series colors rather than branding literals", () => {
    const content = source("components/social-media/analytics/PlatformAnalytics.tsx");
    for (const series of [1, 2, 3, 4]) expect(content).toContain(`var(--chart-${series})`);
    expect(content).not.toMatch(/#[\da-f]{6}/i);
  });
});