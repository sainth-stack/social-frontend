import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AuthHeroIllustration from "./AuthHeroIllustration";

describe("AuthHeroIllustration palette", () => {
  it.each(["integrations", "voice", "campaigns"] as const)("uses semantic branding and surfaces for %s", (variant) => {
    const { container } = render(<AuthHeroIllustration variant={variant} />);
    expect(container.querySelector('[fill="var(--card)"]')).not.toBeNull();
    expect(container.querySelector('[fill="var(--muted)"]')).not.toBeNull();
    expect(container.querySelector('[stroke="var(--primary)"]')).not.toBeNull();
    expect(container.querySelector('[stroke="var(--muted-foreground)"]')).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/#(?:4f46e5|6366f1|eef2ff|e2e8f0|f1f5f9)/i);
    expect(container.querySelector('svg')?.getAttribute("aria-hidden")).toBe("true");
  });

  it("preserves the integration artwork accent and success indicators", () => {
    const { container } = render(<AuthHeroIllustration variant="integrations" />);
    expect(container.querySelector('[fill="#FF7A59"]')).not.toBeNull();
    expect(container.querySelector('[stroke="#10B981"]')).not.toBeNull();
  });
});