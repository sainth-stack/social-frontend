import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormSelect } from "./form-select";

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

const options = [{ value: "professional", label: "Professional" }, { value: "friendly", label: "Friendly" }, { value: "unavailable", label: "Unavailable", disabled: true }];

describe("FormSelect", () => {
  it("associates labels and helper text and supports controlled keyboard selection", async () => {
    const user = userEvent.setup();
    function Field() {
      const [value, setValue] = useState("professional");
      return <FormSelect label="Tone" value={value} onValueChange={setValue} options={options} helper="Choose the writing voice." />;
    }
    render(<Field />);
    const trigger = screen.getByRole("combobox", { name: "Tone" });
    expect(screen.getByLabelText("Tone")).toBe(trigger);
    expect(document.getElementById(trigger.getAttribute("aria-describedby")!)?.textContent).toBe("Choose the writing voice.");
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("option", { name: "Unavailable" }).getAttribute("aria-disabled")).toBe("true");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(trigger.textContent).toContain("Friendly");
  });

  it("closes a portalled menu when disabled and preserves the controlled value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const field = (disabled: boolean) => <fieldset disabled={disabled}><FormSelect label="Account" options={options} value="friendly" onValueChange={onValueChange} disabled={disabled} /></fieldset>;
    const { rerender } = render(field(false));
    screen.getByRole("combobox").focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("listbox")).toBeTruthy();
    rerender(field(true));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect((screen.getByRole("combobox") as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("combobox"));
    expect(onValueChange).not.toHaveBeenCalled();
    rerender(field(false));
    expect(screen.getByRole("combobox").textContent).toContain("Friendly");
  });

  it("does not clear a saved value when options are temporarily unavailable", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<FormSelect label="Account" value="saved-account" onValueChange={onValueChange} options={[]} disabled />);
    expect(screen.getByRole("combobox").textContent).toContain("saved-account");
    rerender(<FormSelect label="Account" value="saved-account" onValueChange={onValueChange} options={[{ value: "saved-account", label: "Editorial" }]} />);
    expect(screen.getByRole("combobox").textContent).toContain("Editorial");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});