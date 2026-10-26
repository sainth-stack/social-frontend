import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter" }),
  Plus_Jakarta_Sans: () => ({ variable: "--font-display" }),
}));
vi.mock("@/components/providers/AppProviders", () => ({ default: () => null }));
vi.mock("./login/LoginForm", () => ({ default: () => null }));
vi.mock("./register/RegisterForm", () => ({ default: () => null }));

import { metadata, viewport } from "./layout";
import { metadata as loginMetadata } from "./login/page";
import { metadata as registerMetadata } from "./register/page";

describe("dashboard brand metadata", () => {
  it("uses EarnedVoice and theme-aware browser colors without changing privacy", () => {
    expect(metadata.title).toEqual({ default: "EarnedVoice — Social Media Manager", template: "%s · EarnedVoice" });
    expect(metadata.icons).toEqual({ icon: "/brand/earnedvoice-mark.svg" });
    expect(metadata.robots).toMatchObject({ index: false, follow: false, googleBot: { index: false, follow: false } });
    expect(viewport.themeColor).toEqual([{ media: "(prefers-color-scheme: light)", color: "#fffaf5" }, { media: "(prefers-color-scheme: dark)", color: "#181411" }]);
  });

  it.each([
    { page: loginMetadata, title: "Sign in" },
    { page: registerMetadata, title: "Create account" },
  ])("appends the brand exactly once to $title", ({ page, title }) => {
    expect(page.title).toBe(title);
    const template = (metadata.title as { template: string }).template;
    const resolved = template.replace("%s", page.title as string);
    expect(resolved).toBe(`${title} · EarnedVoice`);
    expect(resolved.match(/EarnedVoice/g)).toHaveLength(1);
    expect(page.description).toContain("EarnedVoice");
  });
});