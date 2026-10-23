import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { PricingPlan } from "@/types/admin";
import PricingPlanCard from "./PricingPlanCard";

const plan: PricingPlan = {
  id: "enterprise", name: "Growth", tagline: "For teams", priceMonthlyUsd: 299, priceAnnualUsd: 2990, priceMonthlyInr: 1289, isCustom: false, recommended: true,
  limits: { accounts: 3, postsPerMonth: 0, aiTextGenerations: null, aiImageGenerations: 20, aiVideoGenerations: 0, templates: 4, brandVoice: true, approvalWorkflow: false },
};
afterEach(cleanup);

describe("PricingPlanCard", () => {
  it("shows actual INR, paid-access terms, fixed unlimited accounts and accessible features", async () => {
    const onEdit = vi.fn();
    const { container } = render(<PricingPlanCard plan={plan} verified onEdit={onEdit} />);
    expect(screen.getByText("₹1,289.00")).toBeTruthy();
    expect(screen.getByText("Recommended")).toBeTruthy();
    expect(screen.getByText(/30 days per payment/)).toBeTruthy();
    expect(screen.getByText(/no auto-renewal/)).toBeTruthy();
    expect(screen.getByText("Connected accounts").parentElement?.textContent).toBe("Connected accountsUnlimited");
    expect(screen.getByText("Posts / month").parentElement?.textContent).toBe("Posts / month0");
    expect(screen.getByText("AI text").parentElement?.textContent).toBe("AI textUnlimited");
    expect(screen.queryByText(/\$/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit Growth allowances" }));
    expect(onEdit).toHaveBeenCalledWith(plan);
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it.each([undefined, null, -1, NaN, Infinity])("reports unavailable price %s without inventing INR", (priceMonthlyInr) => {
    render(<PricingPlanCard plan={{ ...plan, priceMonthlyInr }} verified onEdit={vi.fn()} />);
    expect(screen.getByText("Price unavailable")).toBeTruthy();
    expect(screen.queryByText(/₹/)).toBeNull();
  });

  it("shows verified zero as zero, not unavailable", () => {
    render(<PricingPlanCard plan={{ ...plan, id: "starter", name: "Free", priceMonthlyInr: 0 }} verified onEdit={vi.fn()} />);
    expect(screen.getByText("₹0.00")).toBeTruthy();
    expect(screen.queryByText(/30 days per payment/)).toBeNull();
  });

  it("never shows unverified prices or activates unverified editing", () => {
    const onEdit = vi.fn();
    render(<PricingPlanCard plan={plan} onEdit={onEdit} />);
    expect(screen.getByText("Price unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit Growth allowances" }));
    expect(onEdit).not.toHaveBeenCalled();
  });
});