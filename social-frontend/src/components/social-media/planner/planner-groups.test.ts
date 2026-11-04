import { describe, expect, it } from "vitest";
import { groupImageProgress, groupPhase, groupRunItemsByDate, groupStatusLabel, itemNeedsImage, runImageBatchProgressWithPercent, runTextGenerationProgress } from "./planner-groups";
import { testItem, testRun } from "./planner-test-fixtures";

describe("planner date groups", () => {
  it("groups multiple platforms on the same date into one row", () => {
    const linkedin = testItem({ id: "li", copyApproved: false });
    linkedin.slot.date = "2026-11-05";
    linkedin.slot.platform = "linkedin";
    const facebook = testItem({ id: "fb", copyApproved: false });
    facebook.slot.date = "2026-11-05";
    facebook.slot.platform = "facebook";
    const later = testItem({ id: "later", copyApproved: true, visualState: "ready" });
    later.slot.date = "2026-11-06";
    const groups = groupRunItemsByDate([linkedin, facebook, later]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].items.map((item) => item.slot.platform)).toEqual(["linkedin", "facebook"]);
  });

  it("includes slots that are still generating without a saved post", () => {
    const pending = testItem({ id: "pending", post: null, generationState: "pending" });
    pending.slot.date = "2026-11-06";
    const ready = testItem({ id: "ready", copyApproved: false });
    ready.slot.date = "2026-11-05";
    const groups = groupRunItemsByDate([ready, pending]);
    expect(groups).toHaveLength(2);
    expect(groupStatusLabel(groups[1])).toBe("Generating");
  });

  it("derives text then image phases", () => {
    const item = testItem({ copyApproved: false });
    const group = { key: item.slot.date, date: item.slot.date, time: item.slot.time, timezone: item.slot.timezone, items: [item] };
    expect(groupPhase(group)).toBe("text");
    const approved = { ...group, items: [{ ...item, copyApproved: true, visualState: "not_requested" as const }] };
    expect(itemNeedsImage(approved.items[0])).toBe(true);
    expect(groupPhase(approved)).toBe("image");
  });

  it("tracks run-level generation progress", () => {
    const pending = testItem({ post: null, generationState: "pending" });
    const ready = testItem({ copyApproved: false });
    const progress = runTextGenerationProgress(testRun([ready, pending]));
    expect(progress).toMatchObject({ total: 2, saved: 1, inFlight: 1, percent: 50 });
  });

  it("tracks image batch progress per date and run", () => {
    const a = testItem({ copyApproved: true, visualState: "ready" });
    a.slot.date = "2026-11-05";
    const b = testItem({ copyApproved: true, visualState: "processing" });
    b.slot.date = "2026-11-05";
    const c = testItem({ copyApproved: true, visualState: "not_requested" });
    c.slot.date = "2026-11-05";
    const groups = groupRunItemsByDate([a, b, c]);
    const progress = groupImageProgress(groups[0]);
    expect(progress).toMatchObject({ total: 3, ready: 1, inFlight: 1, pending: 1, percent: 33 });
    expect(groupStatusLabel(groups[0])).toBe("In progress");
    const runProgress = runImageBatchProgressWithPercent(testRun([a, b, c]));
    expect(runProgress.total).toBe(3);
    expect(runProgress.inFlight).toBe(1);
  });
});
