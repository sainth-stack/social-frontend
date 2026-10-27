import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "./date-picker";

afterEach(cleanup);

describe("DatePicker", () => {
  it("supports a labelled single date, workspace cutoff, close on selection and clear", async () => {
    const user = userEvent.setup();
    function Single() {
      const [value, setValue] = useState("");
      return <DatePicker mode="single" label="Posting date" helper="Uses the workspace timezone." today="2028-02-28" value={value} onValueChange={setValue} />;
    }
    render(<Single />);
    const trigger = screen.getByLabelText("Posting date");
    await user.click(trigger);
    expect((screen.getByRole("button", { name: /February 27th, 2028/ }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: /February 29th, 2028/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger.textContent).toContain(new Date("2028-02-29T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }));
    expect(screen.getByText("1 date selected")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear date" }));
    expect(trigger.textContent).toContain("Choose a date");
  });

  it("disables portalled calendars, clear and removable chips without resetting dates", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const field = (disabled: boolean) => <fieldset disabled={disabled}><DatePicker mode="multiple" today="2028-02-28" start="" end="" dates={["2028-02-29"]} cap={2} onChange={onChange} disabled={disabled} /></fieldset>;
    const { rerender } = render(field(false));
    await user.click(screen.getByRole("button", { name: "1 date selected" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    rerender(field(true));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByRole("button", { name: "Remove 2028-02-29" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Clear dates" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Remove 2028-02-29" }));
    expect(onChange).not.toHaveBeenCalled();
    rerender(field(false));
    expect(screen.getByText("1 / 2 dates selected")).toBeTruthy();
  });

  it("shows a completion footer for an unfinished range and enforces the inclusive cap", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker mode="range" today="2028-02-28" start="2028-02-28" end="" dates={[]} cap={2} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /Choose an end date/ }));
    expect(screen.getByText("Choose an end date to complete the range.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /February 29th, 2028/ }));
    expect(onChange).toHaveBeenLastCalledWith("2028-02-28", "2028-02-29", []);
    onChange.mockClear();
    await user.click(screen.getByRole("button", { name: /March 1st, 2028/ }));
    expect(onChange.mock.calls.every(([start, end]) => !end || end === start)).toBe(true);
  });
});