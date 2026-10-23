import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductIllustration, type IllustrationKind } from "@/components/landing/ProductIllustration";

const kinds: IllustrationKind[] = ["campaign", "studio", "publishing", "brand", "analytics", "review", "plan"];

describe("Original product illustrations", () => {
  it.each(kinds)("renders an accessible, self-contained %s scene", kind => {
    const { container } = render(<ProductIllustration kind={kind} />);
    expect(screen.getByRole("img", { name: /Illustrative/ })).toHaveAttribute("viewBox", "0 0 640 480");
    expect(container.querySelectorAll("image, img, a, foreignObject, script")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/Hyvo|Canva|Unsplash|best time|guaranteed/i);
    expect(container.textContent).not.toMatch(/Northstar/i);
  });

  it("can repeat scenes without SVG ID collisions", () => {
    const { container } = render(<><ProductIllustration kind="analytics" /><ProductIllustration kind="analytics" /></>);
    const ids = Array.from(container.querySelectorAll("[id]")).map(el => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(screen.getAllByRole("img", { name: /not customer results/ })).toHaveLength(2);
  });
});