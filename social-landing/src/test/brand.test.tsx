import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLockup, BrandMark } from "@/components/landing/Brand";

describe("EarnedVoice logo", () => {
  it.each(["light", "dark"])("renders one accessible lockup with theme-aware vector paths in %s mode", theme => {
    const { container } = render(<div className={theme}><BrandLockup height={40} /></div>);
    const logo = screen.getByRole("img", { name: "EarnedVoice" });
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(logo.style.height).toBe("40px");
    expect(container.querySelector("svg")?.getAttribute("height")).toBe("40");
    expect(container.querySelector("path")?.getAttribute("fill")).toBe("var(--brand-ribbon-deep)");
    expect(container.querySelector("img, svg text")).toBeNull();
    expect(container.querySelector(".earnedvoice-wordmark")).toHaveTextContent("EarnedVoice");
  });

  it("keeps compact and full marks optically identical", () => {
    const { container } = render(<><BrandMark size={24} /><BrandLockup height={24} /></>);
    const symbols = container.querySelectorAll("svg");
    expect(symbols).toHaveLength(2);
    expect(symbols[0]?.innerHTML).toBe(symbols[1]?.innerHTML);
    expect(symbols[0]?.getAttribute("viewBox")).toBe(symbols[1]?.getAttribute("viewBox"));
  });
});