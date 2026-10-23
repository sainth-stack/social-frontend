import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import { EarnedVoiceLogo } from "./EarnedVoiceLogo";
import { OrgBrand, PlatformLogo } from "@/components/ui/Logo";
import { platformBrand } from "@/lib/brand";

afterEach(cleanup);

describe("EarnedVoice branding", () => {
  it("uses the shared SVG and contiguous wordmark with one exact accessible label", async () => {
    const { container } = render(<EarnedVoiceLogo size={36} className="text-sm" priority />);
    const logo = screen.getByRole("img", { name: "EarnedVoice" });
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(logo.textContent).toBe("EarnedVoice");
    const image = logo.querySelector("img")!;
    expect(image.getAttribute("src")).toBe("/brand/earnedvoice-mark.svg");
    expect(image.getAttribute("alt")).toBe("");
    expect(image.getAttribute("width")).toBe("36");
    expect(image.getAttribute("height")).toBe("36");
    expect(logo.className).toContain("text-sm");
      expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it.each([EarnedVoiceLogo, PlatformLogo])("keeps compact marks accessible without visible text", (Logo) => {
    render(<Logo compact size={24} />);
    const logo = screen.getByRole("img", { name: "EarnedVoice" });
    expect(logo.textContent).toBe("");
    expect(logo.querySelector("img")?.getAttribute("width")).toBe("24");
  });

  it("preserves the legacy platform logo tone and size props without MUI", () => {
    render(<PlatformLogo tone="light" size={28} priority />);
    const logo = screen.getByRole("img", { name: "EarnedVoice" });
    expect(logo.className).toContain("text-primary-foreground");
    expect(logo.className).toContain("text-sm");
    expect(logo.querySelector("img")?.getAttribute("width")).toBe("28");
  });

  it("preserves organization initials and compact behavior", () => {
    const { rerender, container } = render(<OrgBrand name="Acme Studio" size={40} />);
    expect(screen.getByText("Acme Studio")).toBeTruthy();
    expect(screen.getByText("AS").style.width).toBe("40px");
    rerender(<OrgBrand name="Acme Studio" compact />);
    expect(screen.queryByText("Acme Studio")).toBeNull();
    expect(container.textContent).toBe("AS");
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
  });
});