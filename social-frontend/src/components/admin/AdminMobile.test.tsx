import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { AdminFilters, AdminTableView } from "./AdminMobile";

afterEach(cleanup);

describe("Admin mobile presentation", () => {
  it("collapses advanced filters by default and keeps active counts visible when closed", () => {
    const view = render(<AdminFilters activeCount={2}><label>Status<input defaultValue="Active" /></label></AdminFilters>);
    const toggle = screen.getByRole("button", { name: "Advanced filters · 2 active" });
    const panel = view.container.querySelector(`[id="${toggle.getAttribute("aria-controls")}"]`)!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(panel.className).toContain("hidden sm:block");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Suspended" } });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect((screen.getByLabelText("Status") as HTMLInputElement).value).toBe("Suspended");
    expect(screen.getByRole("button", { name: "Advanced filters · 2 active" })).toBeTruthy();
  });

  it("updates the indicator without resetting expansion or unmounting controls", () => {
    const view = render(<AdminFilters activeCount={0}><input aria-label="Workspace scope" /></AdminFilters>);
    const toggle = screen.getByRole("button", { name: "Advanced filters · None active" });
    fireEvent.click(toggle);
    view.rerender(<AdminFilters activeCount={1}><input aria-label="Workspace scope" /></AdminFilters>);
    expect(screen.getByRole("button", { name: "Advanced filters · 1 active" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByLabelText("Workspace scope")).toHaveLength(1);
  });

  it("keeps one set of labelled data and actions with desktop table semantics", async () => {
    const view = render(<AdminTableView><table aria-label="Records"><thead><tr><th>Identity</th><th>Actions</th></tr></thead><tbody><tr><td data-label="Identity">Ada</td><td data-label="Actions"><button>Change plan</button></td></tr></tbody></table></AdminTableView>);
    expect(screen.getAllByRole("button", { name: "Change plan" })).toHaveLength(1);
    expect(screen.getByRole("table", { name: "Records" })).toBeTruthy();
    expect(view.container.firstElementChild?.className).toContain("max-md:[&_td]:before:content-[attr(data-label)]");
    expect((await axe(view.container)).violations).toEqual([]);
  });
});