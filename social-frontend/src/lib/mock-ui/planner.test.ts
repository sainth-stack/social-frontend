import { describe, expect, it } from "vitest";
import { handlePlannerMock } from "./planner";
import type { PlannerRun, SchedulePreview, ScheduleResult, SlotPreview } from "@/types/planner";

const base = "/api/v1/workspaces/mock-workspace/social/content-plan";
describe("offline planner mock module", () => {
  it("leaves unrelated mock routes untouched", () => {
    expect(handlePlannerMock("/api/v1/workspaces/mock-workspace/social/posts", "GET", {}, {})).toBeUndefined();
  });
  it.each([
    { platform: "facebook", choice: "text_only" },
    { platform: "linkedin", choice: "text_only" },
    { platform: "facebook", choice: "image" },
    { platform: "linkedin", choice: "image" },
  ])("blocks approved optional $platform copy until explicit $choice", ({ platform, choice }) => {
    const selection = { timezone: "UTC", dates: ["2099-01-02"], platforms: [platform], accountIds: { [platform]: "demo-account" }, overrides: [] };
    const preview = handlePlannerMock(`${base}/slots/preview`, "POST", {}, selection) as SlotPreview;
    const run = handlePlannerMock(`${base}/runs`, "POST", {}, { ...selection, previewToken: preview.previewToken, requestId: `choice-${platform}-${choice}`, prompt: "A demo useful brief", excludedSlotIds: [] }) as PlannerRun;
    const item = run.items[0];
    const runPath = `${base}/runs/${run.id}`;
    const itemPath = `${runPath}/items/${item.id}`;
    handlePlannerMock(`${itemPath}/approve-copy`, "POST", {}, { expectedRevision: item.revision });
    expect(item.copyApproved).toBe(true);
    expect(item.imageIntent).toBe("optional");
    expect(item.canSchedule).toBe(false);
    expect(item.reasons).toContain("Choose text only or generate a current planner image before publishing");
    expect((handlePlannerMock(runPath, "GET", {}, {}) as PlannerRun).items[0].canSchedule).toBe(false);
    const blockedPreview = handlePlannerMock(`${runPath}/schedule/preview`, "POST", {}, { itemIds: [item.id] }) as SchedulePreview;
    expect(blockedPreview.items[0].outcome).toBe("blocked");
    const blocked = handlePlannerMock(`${runPath}/schedule/confirm`, "POST", {}, { requestId: `blocked-${platform}-${choice}`, previewId: blockedPreview.previewId, confirm: true }) as ScheduleResult;
    expect(blocked.items[0].outcome).toBe("blocked");
    expect(item.isScheduled).toBe(false);
    if (choice === "text_only") {
      handlePlannerMock(`${itemPath}/image-intent`, "PATCH", {}, { expectedRevision: item.revision, intent: "text_only" });
      expect(item.post?.imageUrl).toBeNull();
    } else {
      handlePlannerMock(`${itemPath}/image`, "POST", {}, { expectedRevision: item.revision, requestId: "image", mode: "generate" });
      expect(item.visualState).toBe("ready");
      expect(item.visualRevision).toBe(item.revision);
    }
    expect(item.canSchedule).toBe(true);
    const ready = handlePlannerMock(`${runPath}/schedule/preview`, "POST", {}, { itemIds: [item.id] }) as SchedulePreview;
    expect(ready.items[0].outcome).toBe("ready");
    const scheduled = handlePlannerMock(`${runPath}/schedule/confirm`, "POST", {}, { requestId: `resolved-${platform}-${choice}`, previewId: ready.previewId, confirm: true }) as ScheduleResult;
    expect(scheduled.items[0].outcome).toBe("scheduled");
  });
  it.each(["facebook", "linkedin"])("rejects stale optional %s images after copy changes", platform => {
    const selection = { timezone: "UTC", dates: ["2099-01-02"], platforms: [platform], accountIds: { [platform]: "demo-account" }, overrides: [] };
    const preview = handlePlannerMock(`${base}/slots/preview`, "POST", {}, selection) as SlotPreview;
    const run = handlePlannerMock(`${base}/runs`, "POST", {}, { ...selection, previewToken: preview.previewToken, requestId: `stale-${platform}`, prompt: "A demo useful brief", excludedSlotIds: [] }) as PlannerRun;
    const item = run.items[0];
    const itemPath = `${base}/runs/${run.id}/items/${item.id}`;
    handlePlannerMock(`${itemPath}/approve-copy`, "POST", {}, { expectedRevision: item.revision });
    handlePlannerMock(`${itemPath}/image`, "POST", {}, { expectedRevision: item.revision, requestId: "image", mode: "generate" });
    item.imageIntent = "optional";
    handlePlannerMock(`${itemPath}/copy`, "PATCH", {}, { expectedRevision: item.revision, caption: "Changed saved copy", hashtags: [] });
    handlePlannerMock(`${itemPath}/approve-copy`, "POST", {}, { expectedRevision: item.revision });
    expect(item.visualState).toBe("stale");
    expect(item.canSchedule).toBe(false);
    expect(item.reasons).toContain("Choose text only or generate a current planner image before publishing");
  });
  it("simulates the separate copy, image and final schedule journey without external requests", () => {
    const selection = { timezone: "Asia/Kolkata", dates: ["2099-01-02"], platforms: ["instagram"], accountIds: { instagram: "demo-account" }, overrides: [] };
    const preview = handlePlannerMock(`${base}/slots/preview`, "POST", {}, selection) as SlotPreview;
    expect(preview.slots[0].proposedAt).toBe("2099-01-02T04:30:00.000Z");
    const run = handlePlannerMock(`${base}/runs`, "POST", {}, { ...selection, previewToken: preview.previewToken, requestId: "mock-test-create", prompt: "A demo useful brief", excludedSlotIds: [] }) as PlannerRun;
    const item = run.items[0];
    const itemPath = `${base}/runs/${run.id}/items/${item.id}`;
    expect(item.copyApproved).toBe(false);
    expect(item.isScheduled).toBe(false);
    expect(item.post?.imageUrl).toBeNull();
    expect(() => handlePlannerMock(`${itemPath}/image`, "POST", {}, { expectedRevision: item.revision, requestId: "image", mode: "generate" })).toThrow(/approve saved text/);
    handlePlannerMock(`${itemPath}/approve-copy`, "POST", {}, { expectedRevision: item.revision });
    expect(item.post?.imageUrl).toBeNull();
    expect(item.canSchedule).toBe(false);
    expect(() => handlePlannerMock(`${itemPath}/image-intent`, "PATCH", {}, { expectedRevision: item.revision, intent: "text_only" })).toThrow(/Instagram requires an image/);
    handlePlannerMock(`${itemPath}/image`, "POST", {}, { expectedRevision: item.revision, requestId: "image", mode: "generate", creditsConfirmed: false });
    expect(item.canSchedule).toBe(true);
    expect(item.isScheduled).toBe(false);
    const schedule = handlePlannerMock(`${base}/runs/${run.id}/schedule/preview`, "POST", {}, { itemIds: [item.id] }) as SchedulePreview;
    expect(schedule.items[0].outcome).toBe("ready");
    expect(item.isScheduled).toBe(false);
    const result = handlePlannerMock(`${base}/runs/${run.id}/schedule/confirm`, "POST", {}, { requestId: "schedule", previewId: schedule.previewId, confirm: true }) as ScheduleResult;
    expect(result.items[0].outcome).toBe("scheduled");
    expect(item.isScheduled).toBe(true);
    const duplicate = handlePlannerMock(`${base}/runs`, "POST", {}, { ...selection, previewToken: preview.previewToken, requestId: "mock-test-create", prompt: "A demo useful brief", excludedSlotIds: [] }) as PlannerRun;
    expect(duplicate.id).toBe(run.id);
  });
});