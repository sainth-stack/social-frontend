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

  it.each(kinds)("provides a simplified %s scene for small journey cards", kind => {
    const { container } = render(<ProductIllustration kind={kind} detail="compact" />);
    expect(screen.getByRole("img")).toHaveAttribute("data-detail", "compact");
    const text = Array.from(container.querySelectorAll("text"));
    expect(text.length).toBeGreaterThan(1);
    expect(text.every(node => Number(node.getAttribute("font-size")) >= 22)).toBe(true);
    expect(container.textContent).not.toMatch(/[—–]|--/);
  });

  it.each(kinds)("keeps the full %s scene self-contained and free from long dashes", kind => {
    const { container } = render(<ProductIllustration kind={kind} />);
    expect(screen.getByRole("img")).toHaveAttribute("data-detail", "full");
    expect(container.textContent).not.toMatch(/[—–]|--/);
    expect(container.querySelectorAll('[transform^="rotate"]')).toHaveLength(0);
  });
});