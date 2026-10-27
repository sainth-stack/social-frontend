import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlannerDatePicker, { dateCount } from "./PlannerDatePicker";

afterEach(cleanup);

function Picker({ mode = "range", today = "2028-02-28", cap = 3 }: { mode?: string; today?: string; cap?: number }) {
  const [selection, setSelection] = useState({ start: "", end: "", dates: [] as string[] });
  return <PlannerDatePicker {...selection} mode={mode} today={today} cap={cap} onChange={(start, end, dates) => setSelection({ start, end, dates })} />;
}

describe("planner calendar", () => {
  it("counts leap-day and month/year ranges inclusively without browser DST drift", () => {
    expect(dateCount("2028-02-28", "2028-03-01")).toBe(3);
    expect(dateCount("2027-12-31", "2028-01-01")).toBe(2);
    expect(dateCount("2027-03-13", "2027-03-15")).toBe(3);
    expect(dateCount("", "2027-01-01")).toBe(0);
    expect(dateCount("2027-01-02", "2027-01-01")).toBe(0);
  });
  it("disables yesterday while allowing workspace today and leap day", async () => {
    const user = userEvent.setup();
    render(<Picker />);
    await user.click(screen.getByRole("button", { name: "Choose your date range" }));
    expect((screen.getByRole("button", { name: /February 27th, 2028/ }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: /February 28th, 2028/ }));
    await user.click(screen.getByRole("button", { name: /February 29th, 2028/ }));
    expect(screen.getByText("2 / 3 dates selected")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", { name: /February 29th, 2028/ }), { key: "Escape" });
    await user.click(screen.getByRole("button", { name: "Clear dates" }));
    expect(screen.getByText("0 / 3 dates selected")).toBeTruthy();
  });
  it("supports capped individual selection, toggling, removal and month navigation", async () => {
    const user = userEvent.setup();
    render(<Picker mode="dates" cap={2} />);
    await user.click(screen.getByRole("button", { name: "Choose individual dates" }));
    await user.click(screen.getByRole("button", { name: /February 28th, 2028/ }));
    await user.click(screen.getByRole("button", { name: /February 29th, 2028/ }));
    expect(screen.getByText("2 / 2 dates selected")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /next month/i }));
    expect((screen.getByRole("button", { name: /March 3rd, 2028/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole("button", { name: /next month/i }), { key: "Escape" });
    await user.click(screen.getByRole("button", { name: "Remove 2028-02-28" }));
    expect(screen.getByText("1 / 2 dates selected")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove 2028-02-28" })).toBeNull();
  });
});