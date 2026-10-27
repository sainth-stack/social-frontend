import { afterEach, describe, expect, it, vi } from "vitest";
import { handlePlannerMock } from "./planner";
import { handleSocialMock } from "./social";
import type { MediaAssetListResponse } from "@/types/social-media.types";
import type { PlannerRun, SchedulePreview, ScheduleResult, SlotPreview } from "@/types/planner";

const base = "/api/v1/workspaces/mock-workspace/social/content-plan";
afterEach(() => vi.useRealTimers());

function draft(account: string, requestId: string, consent = false) {
  const selection = { timezone: "UTC", dates: ["2099-01-03"], platforms: ["linkedin"], accountIds: { linkedin: account }, overrides: [] };
  const preview = handlePlannerMock(`${base}/slots/preview`, "POST", {}, selection) as SlotPreview;
  const conflictAcknowledgments = consent ? preview.slots.flatMap(slot => slot.warningFingerprint ? [{ slotId: slot.slotId, warningFingerprint: slot.warningFingerprint }] : []) : [];
  const run = handlePlannerMock(`${base}/runs`, "POST", {}, { ...selection, previewToken: preview.previewToken, requestId, prompt: "An explicit demo planner brief", excludedSlotIds: [], conflictAcknowledgments }) as PlannerRun;
  const item = run.items[0];
  const path = `${base}/runs/${run.id}`;
  const itemPath = `${path}/items/${item.id}`;
  handlePlannerMock(`${itemPath}/approve-copy`, "POST", {}, { expectedRevision: item.revision });
  handlePlannerMock(`${itemPath}/image-intent`, "PATCH", {}, { expectedRevision: item.revision, intent: "text_only" });
  return { run, item, path, itemPath };
}

function schedule(path: string, itemId: string, requestId: string, consent = false) {
  const preview = handlePlannerMock(`${path}/schedule/preview`, "POST", {}, { itemIds: [itemId] }) as SchedulePreview;
  const conflictAcknowledgments = consent ? preview.items.flatMap(row => row.slotId && row.warningFingerprint ? [{ slotId: row.slotId, warningFingerprint: row.warningFingerprint }] : []) : [];
  return handlePlannerMock(`${path}/schedule/confirm`, "POST", {}, { requestId, previewId: preview.previewId, confirm: true, conflictAcknowledgments }) as ScheduleResult;
}

describe("offline planner mock module", () => {
  it("allows deliberate simultaneous posts only after independent current generation and final consent", () => {
    const first = draft("collision-account", "collision-first");
    expect(schedule(first.path, first.item.id, "collision-schedule-first").items[0].outcome).toBe("scheduled");
    expect(() => draft("collision-account", "collision-second")).toThrow(/Review other posts/);
    const second = draft("collision-account", "collision-second", true);
    expect(schedule(second.path, second.item.id, "collision-schedule-no-consent").items[0].reasons).toContain("conflict_acknowledgment_required");
    expect(second.item.isScheduled).toBe(false);
    expect(schedule(second.path, second.item.id, "collision-schedule-second", true).items[0].outcome).toBe("scheduled");
    expect(first.item.isScheduled).toBe(true);
    expect(first.item.postId).not.toBe(second.item.postId);
  });
  it("requires a fresh preview when another conflict appears after final review", () => {
    const first = draft("snapshot-account", "snapshot-first");
    const second = draft("snapshot-account", "snapshot-second");
    const preview = handlePlannerMock(`${second.path}/schedule/preview`, "POST", {}, { itemIds: [second.item.id] }) as SchedulePreview;
    schedule(first.path, first.item.id, "snapshot-first-scheduled");
    const result = handlePlannerMock(`${second.path}/schedule/confirm`, "POST", {}, { requestId: "snapshot-stale-confirm", previewId: preview.previewId, confirm: true }) as ScheduleResult;
    expect(result.items[0].reasons).toContain("conflict_snapshot_changed_preview_again");
    expect(schedule(second.path, second.item.id, "snapshot-new-confirm", true).items[0].outcome).toBe("scheduled");
  });
  it("returns queued image state, replays active starts and retries, and preserves chosen owned media", () => {
    const value = draft("async-image-account", "async-image");
    const request = { expectedRevision: value.item.revision, requestId: "async-image-request", mode: "generate", imageDirection: "Bright editorial artwork" };
    const queued = handlePlannerMock(`${value.itemPath}/image/start`, "POST", {}, request) as typeof value.item;
    expect(queued.visualState).toBe("processing");
    expect(queued.imageStage).toBe("queued");
    const operationId = queued.imageOperationId;
    handlePlannerMock(`${value.itemPath}/image/start`, "POST", {}, request);
    handlePlannerMock(`${value.itemPath}/image/start`, "POST", {}, { ...request, mode: "retry" });
    expect(value.item.imageOperationId).toBe(operationId);
    expect(() => handlePlannerMock(`${value.itemPath}/image/start`, "POST", {}, { ...request, imageDirection: "Changed direction" })).toThrow(/direction changed/);
    const media = handleSocialMock("/api/v1/workspaces/mock-workspace/social/media-assets", "GET", { mediaType: "image" }, {}) as MediaAssetListResponse;
    handlePlannerMock(`${value.itemPath}/image-asset`, "POST", {}, { expectedRevision: value.item.revision, assetId: media.items[0].id });
    handlePlannerMock(value.path, "GET", {}, {});
    expect(value.item.visualState).toBe("ready");
    expect(value.item.post?.imageUrl).toBe(media.items[0].url);
    expect(() => handlePlannerMock(`${value.itemPath}/image-asset`, "POST", {}, { expectedRevision: value.item.revision, assetId: "foreign-image" })).toThrow();
  });
  it("allows today with a future time but never moves past dates into future slots", () => {
    vi.setSystemTime(new Date("2027-01-01T10:00:00Z"));
    const selection = { timezone: "UTC", dates: ["2026-12-31", "2027-01-01"], platforms: ["linkedin"], accountIds: { linkedin: "date-account" }, postingTime: "11:00", overrides: [] };
    const result = handlePlannerMock(`${base}/slots/preview`, "POST", {}, selection) as SlotPreview;
    expect(result.slots[0].date).toBe("2026-12-31");
    expect(result.slots[0].reasons).toContain("past_date");
    expect(result.slots[1].reasons).toEqual([]);
  });
  it("leaves unrelated mock routes untouched", () => {
    expect(handlePlannerMock("/api/v1/workspaces/mock-workspace/social/posts", "GET", {}, {})).toBeUndefined();
  });
  it.each([
    { platform: "facebook", choice: "text_only" },
    { platform: "linkedin", choice: "text_only" },
    { platform: "facebook", choice: "image" },
    { platform: "linkedin", choice: "image" },
  ])("blocks approved optional $platform copy until explicit $choice", ({ platform, choice }) => {
    const selection = { timezone: "UTC", dates: ["2099-01-02"], platforms: [platform], accountIds: { [platform]: `demo-${platform}-${choice}` }, overrides: [] };
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
    const selection = { timezone: "UTC", dates: ["2099-01-02"], platforms: [platform], accountIds: { [platform]: `demo-stale-${platform}` }, overrides: [] };
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