import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkflowVisual } from "@/components/landing/WorkflowVisual";
import { PlatformIcon } from "@/components/landing/Brand";
import { platforms } from "@/content/site";

describe("Responsive illustrative workflows", () => {
  it.each(["studio", "publishing", "brand", "analytics", "review", "plan", "campaign"] as const)("renders a readable labelled %s scene without raster screenshots or SVG text", kind => {
    const { container } = render(<WorkflowVisual kind={kind} />);
    expect(screen.getByRole("group", { name: /Illustrative/ })).toBeInTheDocument();
    expect(container.querySelector("svg text, foreignObject, image, script")).toBeNull();
    expect(container.querySelector("[data-scene] strong")).not.toBeNull();
    expect(container.textContent).not.toMatch(/[—–]|--/);
  });

  it("labels invented metrics as examples rather than results", () => {
    render(<WorkflowVisual kind="analytics" />);
    expect(screen.getByText("Example data, not customer results.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /not customer results/ })).toBeInTheDocument();
  });

  it.each(platforms)("renders a distinct decorative glyph for $name", ({ name }) => {
    const { container } = render(<PlatformIcon name={name} color="currentColor" />);
    expect(container.querySelector('span[aria-hidden="true"] svg path, span[aria-hidden="true"] svg rect')).not.toBeNull();
  });

  it("does not substitute a Threads logo for an unknown platform", () => {
    const { container } = render(<PlatformIcon name="Unknown" color="currentColor" />);
    expect(container.querySelector("path")).toBeNull();
  });
});