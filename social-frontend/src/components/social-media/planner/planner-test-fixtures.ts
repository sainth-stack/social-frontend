import type { PlannerRun, RunItem, SlotPreview } from "@/types/planner";

export function testItem(overrides: Partial<RunItem> = {}): RunItem {
  return {
    id: "item", slot: { slotId: "slot", date: "2027-01-02", time: "10:00", platform: "linkedin", accountId: "account", proposedAt: "2027-01-02T04:30:00Z", timezone: "Asia/Kolkata", utcOffsetMinutes: 330, reasons: [] },
    generationState: "created", error: null, postId: "post", revision: "revision", copyApproved: false, approvedRevision: null, approvedBy: null, approvedAt: null,
    visualState: "not_requested", visualRevision: null, imageOperationId: null, imageRequestId: null, textState: "idle", textRequestId: null, imageIntent: "optional", proposedAt: "2027-01-02T04:30:00Z", isScheduled: false, canSchedule: false, reasons: ["copy_not_approved"], scheduleState: null,
    post: { id: "post", workspaceId: "workspace", createdBy: "owner", title: "Saved post", status: "draft", scheduledAt: "2027-01-02T04:30:00Z", publishedAt: null, approvalStatus: "not_required", approvedBy: null, templateId: null, aiPrompt: null, imageUrl: null, imageSource: "none", createdAt: "", updatedAt: "", platforms: [{ id: "row", platform: "linkedin", socialAccountId: "account", caption: "Exact saved caption\nSecond line", hashtags: ["#Saved", "#Original"], firstComment: "Exact first comment", characterCount: 42, status: "pending", platformPostId: null, publishedAt: null, errorCode: null, errorMessage: null, retryCount: 0, nextRetryAt: null, reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, engagementRate: 0 }] },
    ...overrides,
  };
}
export function testRun(items = [testItem()]): PlannerRun {
  return { id: "run", requestId: "request", status: "completed", dispatchState: "accepted", prompt: "A complete saved plan brief", timezone: "Asia/Kolkata", createdAt: "2026-10-26T00:00:00Z", createdBy: "owner", cancelled: false, items };
}
export function testPreview(): SlotPreview {
  return { timezone: "Asia/Kolkata", selectedDateCount: 1, dateCap: 15, expectedTextUnits: 1, previewToken: "final-token", slots: [testItem().slot] };
}