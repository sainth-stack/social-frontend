import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FormInput, FormTextarea } from "./form-field";

afterEach(cleanup);
describe("shared form fields", () => {
  it("connects labels, guidance, and errors without duplicate generated ids", () => {
    render(<><FormInput label="Posting time" helper="Uses your workspace timezone." /><FormTextarea label="Caption" error="Enter your caption." trailing="0 characters" /></>);
    const input = screen.getByLabelText("Posting time");
    const caption = screen.getByLabelText("Caption");
    expect(input.id).not.toBe(caption.id);
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toContain("workspace timezone");
    expect(caption.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Enter your caption.");
  });
});