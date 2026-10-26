import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { EarnedVoiceLogo } from "./EarnedVoiceLogo";
import { OrgBrand, PlatformLogo } from "@/components/ui/Logo";
import { platformBrand } from "@/lib/brand";

afterEach(cleanup);

describe("EarnedVoice branding", () => {
  it("uses the theme-aware Ascent symbol with one accessible label", async () => {
    const { container } = render(<EarnedVoiceLogo size={36} className="text-sm" priority />);
    const logo = screen.getByRole("img", { name: "EarnedVoice" });
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(logo.querySelector("svg")?.getAttribute("width")).toBe("36");
    expect(logo.querySelector("svg")?.getAttribute("height")).toBe("36");
    expect(logo.querySelector("svg")?.getAttribute("viewBox")).toBe("4 16 112 98");
    expect(logo.querySelector("img, svg text")).toBeNull();
    expect(logo.querySelector(".earnedvoice-wordmark")?.textContent).toBe("EarnedVoice");
    expect(logo.querySelector("path")?.getAttribute("fill")).toBe("var(--brand-ribbon-deep)");
    expect(logo.className).toContain("text-sm");
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it.each([EarnedVoiceLogo, PlatformLogo])("keeps compact marks accessible without visible text", (Logo) => {
    render(<Logo compact size={24} />);
    const logo = screen.getByRole("img", { name: "EarnedVoice" });
    expect(logo.querySelector("svg")?.getAttribute("width")).toBe("24");
    expect(logo.querySelector(".earnedvoice-wordmark")).toBeNull();
  });

  it("preserves the legacy platform logo tone and size props without MUI", () => {
    render(<PlatformLogo tone="light" size={28} priority />);
    const logo = screen.getByRole("img", { name: "EarnedVoice" });
    expect(logo.className).toContain("earnedvoice-logo-inverse");
    expect(logo.className).toContain("text-sm");
    expect(logo.style.height).toBe("28px");
  });

  it("preserves organization initials and compact behavior", () => {
    const { rerender, container } = render(<OrgBrand name="Acme Studio" size={40} />);
    expect(screen.getByText("Acme Studio")).toBeTruthy();
    expect(screen.getByText("AS").style.width).toBe("40px");
    rerender(<OrgBrand name="Acme Studio" compact />);
    expect(screen.queryByText("Acme Studio")).toBeNull();
    expect(container.textContent).toBe("AS");
  });

  it.each(["light", "dark"])("keeps the same symbol and accessible name in %s mode", theme => {
    const { container } = render(<div className={theme}><EarnedVoiceLogo size={32} /></div>);
    expect(screen.getByRole("img", { name: "EarnedVoice" })).toBeTruthy();
    expect(container.querySelectorAll("path")).toHaveLength(3);
    expect(container.querySelector("path:nth-child(2)")?.getAttribute("fill")).toBe("var(--brand-ribbon)");
    expect(container.querySelector(".earnedvoice-wordmark")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("preserves uploaded organization logos", () => {
    const { container } = render(<OrgBrand name="Acme Studio" logoUrl="/brand/earnedvoice-mark.svg" size={40} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/brand/earnedvoice-mark.svg");
    expect(screen.queryByText("AS")).toBeNull();
    expect(screen.getByText("Acme Studio")).toBeTruthy();
  });

  it("defines the display name without an appended suffix", () => {
    expect(platformBrand.name).toBe("EarnedVoice");
    expect(platformBrand.suffix).toBe("");
    expect(platformBrand.mark).toBe("/brand/earnedvoice-mark.svg");
    expect(platformBrand.lockup).toBe("/brand/earnedvoice-lockup.svg");
  });
});
