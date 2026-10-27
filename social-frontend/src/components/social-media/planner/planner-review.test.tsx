import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlannerImagePreview } from "./PlannerItemEditor";
import { imageStageLabel, itemLabel, mergePolledRun, runNeedsPolling, savedCopy, warningAcknowledgments, workspaceDate } from "./planner-review";
import { testItem, testRun, testWarning } from "./planner-test-fixtures";

vi.mock("@/api/endpoints/social-media.api", () => ({ default: {} }));

afterEach(cleanup);
describe("planner review state and artwork", () => {
  it("uses workspace today even across a browser-local day boundary", () => {
    expect(workspaceDate("Pacific/Kiritimati", new Date("2027-01-01T12:00:00Z"))).toBe("2027-01-02");
    expect(workspaceDate("America/Los_Angeles", new Date("2027-01-01T01:00:00Z"))).toBe("2026-12-31");
  });
  it("acknowledges aggregate slot fingerprints rather than individual warnings", () => {
    expect(warningAcknowledgments([{ slotId: "slot", warnings: [testWarning()], warningFingerprint: "aggregate" }])).toEqual([{ slotId: "slot", warningFingerprint: "aggregate" }]);
    expect(warningAcknowledgments([{ slotId: "slot", warnings: [], warningFingerprint: null }])).toEqual([]);
  });
  it("rejects obsolete revision and operation snapshots without hiding unrelated progress", () => {
    const saved = testItem({ revision: "new", imageRequestId: "new-request", imageUpdatedAt: "2027-01-01T01:00:00Z", imageStage: "save" });
    const incoming = testItem({ revision: "old", imageRequestId: "old-request" });
    const other = testItem({ id: "other", textState: "processing" });
    expect(mergePolledRun(testRun([saved]), testRun([incoming, other]), new Set(["item"])).items).toEqual([saved, other]);
    expect(mergePolledRun(testRun([saved]), testRun([{ ...saved, imageUpdatedAt: "2027-01-01T00:00:00Z", imageStage: "generate" }])).items[0]).toEqual(saved);
  });
  it("accepts actual saved-base stages in event order, not an invented percentage order", () => {
    const saved = testItem({ visualState: "processing", imageStage: "save", imageUpdatedAt: "2027-01-01T01:00:00Z" });
    const next = { ...saved, imageStage: "format" as const, imageUpdatedAt: "2027-01-01T01:01:00Z" };
    expect(mergePolledRun(testRun([saved]), testRun([next])).items[0]).toEqual(next);
    expect(imageStageLabel(next)).toBe("Formatting artwork");
    expect(runNeedsPolling(testRun([next]))).toBe(true);
  });
  it.each([
    { name: "external revision", changes: { revision: "external-revision" } },
    { name: "external image operation", changes: { imageRequestId: "external-request", imageOperationId: "external-operation" } },
  ])("accepts an older image timestamp for an unprotected $name", ({ changes }) => {
    const saved = testItem({ revision: "saved-revision", imageRequestId: "saved-request", imageOperationId: "saved-operation", imageUpdatedAt: "2027-01-01T02:00:00Z", imageStage: "ready" });
    const incoming = { ...saved, ...changes, imageUpdatedAt: "2027-01-01T01:00:00Z", imageStage: "generate" as const };
    expect(mergePolledRun(testRun([saved]), testRun([incoming])).items[0]).toEqual(incoming);
    expect(mergePolledRun(testRun([saved]), testRun([incoming]), new Set([saved.id])).items[0]).toEqual(saved);
  });
  it.each(["2027-01-01T01:00:00Z", null])("rejects same-operation image progress with an older or missing timestamp: %s", imageUpdatedAt => {
    const saved = testItem({ imageRequestId: "saved-request", imageOperationId: "saved-operation", imageUpdatedAt: "2027-01-01T02:00:00Z", imageStage: "save" });
    const incoming = { ...saved, imageUpdatedAt, imageStage: "generate" as const };
    expect(mergePolledRun(testRun([saved]), testRun([incoming])).items[0]).toEqual(saved);
  });
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