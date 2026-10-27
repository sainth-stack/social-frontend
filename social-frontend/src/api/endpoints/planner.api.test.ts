import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "@/api/client";
import { plannerApi } from "./planner.api";
import type { PlannerSelection, RunCreate } from "@/types/planner";

vi.mock("@/api/client", () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const prefix = "/api/v1/workspaces/workspace/social/content-plan";
const selection: PlannerSelection = { timezone: "Asia/Kolkata", dates: ["2027-01-02", "2027-01-08"], platforms: ["linkedin"], accountIds: { linkedin: "account" }, overrides: [{ date: "2027-01-02", platform: "linkedin", time: "14:30" }] };
beforeEach(() => { vi.clearAllMocks(); for (const method of [apiClient.get, apiClient.post, apiClient.patch]) vi.mocked(method).mockResolvedValue({ data: { saved: true } }); });

describe("planner API canonical contract", () => {
  it("preserves aggregate warning consent at create, slot edit, preview and final confirmation", async () => {
    const conflictAcknowledgments = [{ slotId: "opaque-slot", warningFingerprint: "aggregate-not-individual" }];
    const create: RunCreate = { ...selection, conflictAcknowledgments, previewToken: "token", requestId: "once", prompt: "A useful complete brief", excludedSlotIds: [] };
    await plannerApi.createRun("workspace", create);
    expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/runs`, create);
    const slot = { date: "2027-01-02", time: "14:30", timezone: "Asia/Kolkata", conflictAcknowledgments };
    await plannerApi.editSlot("workspace", "run", "item", slot);
    expect(apiClient.patch).toHaveBeenLastCalledWith(`${prefix}/runs/run/items/item/slot`, slot);
    await plannerApi.previewSchedule("workspace", "run", ["item"], conflictAcknowledgments);
    expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/runs/run/schedule/preview`, { itemIds: ["item"], conflictAcknowledgments });
    await plannerApi.confirmSchedule("workspace", "run", { previewId: "preview", requestId: "final", confirm: true, conflictAcknowledgments });
    expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/runs/run/schedule/confirm`, { previewId: "preview", requestId: "final", confirm: true, conflictAcknowledgments });
  });
  it("aborts superseded reads and sends optional direction only to explicit image start", async () => {
    const controller = new AbortController();
    await plannerApi.getRun("workspace", "run", controller.signal);
    expect(apiClient.get).toHaveBeenLastCalledWith(`${prefix}/runs/run`, { signal: controller.signal });
    const payload = { expectedRevision: "rev", requestId: "new", mode: "generate" as const, creditsConfirmed: false, imageDirection: "An editorial portrait, warm daylight" };
    await plannerApi.image("workspace", "run", "item", payload);
    expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/runs/run/items/item/image/start`, payload);
  });
  it("previews exact selection and creates with the final token and explicit exclusions", async () => {
    await plannerApi.previewSlots("workspace", selection);
    expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/slots/preview`, selection);
    const payload: RunCreate = { ...selection, requestId: "create-once", previewToken: "final-token", prompt: "A useful complete brief", excludedSlotIds: ["blocked-slot"] };
    await plannerApi.createRun("workspace", payload);
    expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/runs`, payload);
  });
  it("loads durable history with pagination and retrieves a run without legacy jobs", async () => {
    await plannerApi.listRuns("workspace", 20, 10);
    expect(apiClient.get).toHaveBeenLastCalledWith(`${prefix}/runs`, { params: { offset: 20, limit: 10 } });
    await plannerApi.getRun("workspace", "run/one");
    expect(apiClient.get).toHaveBeenLastCalledWith(`${prefix}/runs/run%2Fone`);
  });
  it("approves only copy and preserves exact saved hashtag/comment edits", async () => {
    await plannerApi.approveCopy("workspace", "run", "item", { expectedRevision: "rev" });
    expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(`${prefix}/runs/run/items/item/approve-copy`, { expectedRevision: "rev" });
    const payload = { expectedRevision: "rev", caption: " Saved\ncaption ", hashtags: ["#Original", "#Two"], firstComment: " exact comment " };
    await plannerApi.editCopy("workspace", "run", "item", payload);
    expect(apiClient.patch).toHaveBeenLastCalledWith(`${prefix}/runs/run/items/item/copy`, payload);
  });
  it("sends image mode, revision, request ID and credit confirmation unchanged", async () => {
    for (const mode of ["generate", "retry", "regenerate"] as const) {
      const payload = { expectedRevision: "rev", requestId: mode === "retry" ? "existing" : "new", mode, creditsConfirmed: mode === "regenerate" };
      await plannerApi.image("workspace", "run", "item", payload);
      expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/runs/run/items/item/image/start`, payload);
    }
  });
  it("sends selected scheduling IDs then an explicit confirmation token", async () => {
    await plannerApi.previewSchedule("workspace", "run", ["two", "one"]);
    expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/runs/run/schedule/preview`, { itemIds: ["two", "one"] });
    await plannerApi.confirmSchedule("workspace", "run", { requestId: "schedule-once", previewId: "preview", confirm: true });
    expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/runs/run/schedule/confirm`, { requestId: "schedule-once", previewId: "preview", confirm: true });
    await plannerApi.retrySchedule("workspace", "run", { requestId: "retry", itemIds: ["pending"] });
    expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/runs/run/schedule/retry`, { requestId: "retry", itemIds: ["pending"] });
  });
  it("uses dedicated mutation endpoints without CTA overrides", async () => {
    await plannerApi.regenerateText("workspace", "run", "item", { expectedRevision: "rev", requestId: "text" });
    expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/runs/run/items/item/regenerate-text`, { expectedRevision: "rev", requestId: "text" }, { timeout: 180_000 });
    await plannerApi.imageIntent("workspace", "run", "item", { expectedRevision: "rev", intent: "text_only" });
    expect(apiClient.patch).toHaveBeenLastCalledWith(`${prefix}/runs/run/items/item/image-intent`, { expectedRevision: "rev", intent: "text_only" });
    await plannerApi.editSlot("workspace", "run", "item", { date: "2027-01-02", time: "09:00", timezone: "Asia/Kolkata", utcOffsetMinutes: 330 });
    expect(apiClient.patch).toHaveBeenLastCalledWith(`${prefix}/runs/run/items/item/slot`, { date: "2027-01-02", time: "09:00", timezone: "Asia/Kolkata", utcOffsetMinutes: 330 });
    await plannerApi.attachImage("workspace", "run", "item", { expectedRevision: "rev", assetId: "asset" });
    expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/runs/run/items/item/image-asset`, { expectedRevision: "rev", assetId: "asset" });
    await plannerApi.retryRun("workspace", "run", ["failed"]);
    expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/runs/run/retry`, { itemIds: ["failed"] });
    await plannerApi.cancelRun("workspace", "run");
    expect(apiClient.post).toHaveBeenLastCalledWith(`${prefix}/runs/run/cancel`);
  });
  it("does not replay paid operations or swallow HTTP failures", async () => {
    const error = new Error("Interrupted");
    vi.mocked(apiClient.post).mockRejectedValue(error);
    await expect(plannerApi.image("workspace", "run", "item", { expectedRevision: "rev", requestId: "same", mode: "retry", creditsConfirmed: false })).rejects.toBe(error);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });
});