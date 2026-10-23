import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { PricingPlan } from "@/types/admin";
import PricingPlanEditModal from "./PricingPlanEditModal";

const plan: PricingPlan = {
  id: "growth", name: "Pro", tagline: "Original tagline", priceMonthlyUsd: 99, priceAnnualUsd: 990, priceMonthlyInr: 749, isCustom: false,
  limits: { accounts: null, postsPerMonth: 100, aiTextGenerations: 300, aiImageGenerations: 50, aiVideoGenerations: 0, templates: null, brandVoice: true, approvalWorkflow: false },
};

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup(onSave = vi.fn().mockResolvedValue(undefined), extra = {}) {
  const onClose = vi.fn();
  const result = render(<PricingPlanEditModal plan={plan} onSave={onSave} onClose={onClose} {...extra} />);
  return { ...result, onSave, onClose };
}

function change(label: string, value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value } });
}

function review() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

describe("PricingPlanEditModal", () => {
  it("submits only changed allowances, preserving zero versus unlimited and boolean values", async () => {
    const { onSave, onClose } = setup();
    expect(screen.queryByLabelText(/price|tagline|accounts/i)).toBeNull();
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
    change("Posts / month", "0");
    change("AI image limit", "");
    change("Templates", "0");
    fireEvent.click(screen.getByRole("checkbox", { name: "Approval workflow" }));
    review();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/affect every workspace on the Pro plan/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledExactlyOnceWith({ limits: { postsPerMonth: 0, aiImageGenerations: null, templates: 0, approvalWorkflow: true } }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it.each(["-1", "1.5", "abc", "Infinity", "9007199254740992", "1e3"])("rejects invalid quota %s rather than silently treating it as unlimited", (value) => {
    const { onSave } = setup();
    change("Posts / month", value);
    review();
    const input = screen.getByRole("textbox", { name: "Posts / month" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(input);
    expect(screen.getByText("Enter a whole number of 0 or more, or leave blank for unlimited.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not submit semantically unchanged numbers", () => {
    const { onSave } = setup();
    change("Posts / month", "0100");
    review();
    expect(screen.queryByRole("button", { name: "Confirm and save" })).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("locks duplicate submissions and all close paths until the save completes", async () => {
    let resolve!: () => void;
    const onSave = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    const onClose = vi.fn();
    render(<PricingPlanEditModal plan={plan} onSave={onSave} onClose={onClose} />);
    change("Posts / month", "42");
    review();
    const confirm = screen.getByRole("button", { name: "Confirm and save" });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    expect(onSave).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "Back to editing" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.pointerDown(document.body);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => resolve());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("preserves failed drafts, reports inline errors and permits retry", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("Service unavailable")).mockResolvedValueOnce(undefined);
    const { onClose } = setup(onSave);
    change("AI text limit", "0");
    review();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Service unavailable");
    expect((screen.getByRole("textbox", { name: "AI text limit" }) as HTMLInputElement).value).toBe("0");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenNthCalledWith(2, { limits: { aiTextGenerations: 0 } });
  });

  it("confirms reset and cancel without losing a draft when keeping edits", () => {
    const { onClose } = setup();
    change("Templates", "5");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect((screen.getByRole("textbox", { name: "Templates" }) as HTMLInputElement).value).toBe("5");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect((screen.getByRole("textbox", { name: "Templates" }) as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
    change("Templates", "3");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("blocks edits and clean dismissal while externally saving", () => {
    const { onClose } = setup(undefined, { saving: true });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("has accessible editing, confirmation and validation states", async () => {
    setup();
    expect((await axe(screen.getByRole("dialog"), { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
    change("Posts / month", "-2");
    review();
    expect((await axe(screen.getByRole("dialog"), { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
    change("Posts / month", "2");
    review();
    expect((await axe(screen.getByRole("dialog"), { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});