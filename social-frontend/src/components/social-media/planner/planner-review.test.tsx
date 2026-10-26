import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlannerImagePreview } from "./PlannerItemEditor";
import { itemLabel, runNeedsPolling, savedCopy } from "./planner-review";
import { testItem, testRun } from "./planner-test-fixtures";

afterEach(cleanup);
describe("planner review state and artwork", () => {
  it("never infers schedule state from a draft proposed date", () => {
    const item = testItem();
    expect(item.proposedAt).toBeTruthy();
    expect(itemLabel(item)).toBe("Needs text approval");
    expect(runNeedsPolling(testRun([item]))).toBe(false);
    expect(savedCopy(item)).toEqual({ caption: "Exact saved caption\nSecond line", hashtags: ["#Saved", "#Original"], firstComment: "Exact first comment" });
  });
  it("keeps uncertain dispatch visible and polling without calling it confirmed scheduled", () => {
    const item = testItem({ isScheduled: true, scheduleState: "uncertain" });
    expect(itemLabel(item)).toBe("Dispatch pending");
    expect(runNeedsPolling(testRun([item]))).toBe(true);
  });
  it("shows full uncropped artwork and an explicit recoverable image load failure", () => {
    render(<PlannerImagePreview url="https://images.test/full.jpg" state="ready" />);
    const image = screen.getByRole("img");
    expect(image.className).toContain("object-contain");
    fireEvent.error(image);
    expect(screen.getByRole("alert").textContent).toContain("Image preview could not load");
    expect(screen.queryByRole("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry preview loading" }));
    expect(screen.getByRole("img")).toBeTruthy();
  });
});