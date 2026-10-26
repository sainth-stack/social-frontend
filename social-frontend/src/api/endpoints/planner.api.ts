import apiClient from "@/api/client";
import type { CopyEdit, ImageAction, PlannerRun, PlannerSelection, RevisionInput, RunCreate, RunItem, RunList, SchedulePreview, ScheduleResult, SlotEdit, SlotPreview } from "@/types/planner";

const base = (workspaceId: string) => `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/social/content-plan`;
const run = (workspaceId: string, runId: string) => `${base(workspaceId)}/runs/${encodeURIComponent(runId)}`;
const item = (workspaceId: string, runId: string, itemId: string) => `${run(workspaceId, runId)}/items/${encodeURIComponent(itemId)}`;

export const plannerApi = {
  async previewSlots(workspaceId: string, payload: PlannerSelection): Promise<SlotPreview> {
    return (await apiClient.post<SlotPreview>(`${base(workspaceId)}/slots/preview`, payload)).data;
  },
  async createRun(workspaceId: string, payload: RunCreate): Promise<PlannerRun> {
    return (await apiClient.post<PlannerRun>(`${base(workspaceId)}/runs`, payload)).data;
  },
  async listRuns(workspaceId: string, offset = 0, limit = 20): Promise<RunList> {
    return (await apiClient.get<RunList>(`${base(workspaceId)}/runs`, { params: { offset, limit } })).data;
  },
  async getRun(workspaceId: string, runId: string): Promise<PlannerRun> {
    return (await apiClient.get<PlannerRun>(run(workspaceId, runId))).data;
  },
  async cancelRun(workspaceId: string, runId: string): Promise<PlannerRun> {
    return (await apiClient.post<PlannerRun>(`${run(workspaceId, runId)}/cancel`)).data;
  },
  async retryRun(workspaceId: string, runId: string, itemIds: string[]): Promise<PlannerRun> {
    return (await apiClient.post<PlannerRun>(`${run(workspaceId, runId)}/retry`, { itemIds })).data;
  },
  async editCopy(workspaceId: string, runId: string, itemId: string, payload: CopyEdit): Promise<RunItem> {
    return (await apiClient.patch<RunItem>(`${item(workspaceId, runId, itemId)}/copy`, payload)).data;
  },
  async approveCopy(workspaceId: string, runId: string, itemId: string, payload: RevisionInput): Promise<RunItem> {
    return (await apiClient.post<RunItem>(`${item(workspaceId, runId, itemId)}/approve-copy`, payload)).data;
  },
  async regenerateText(workspaceId: string, runId: string, itemId: string, payload: RevisionInput & { requestId: string }): Promise<RunItem> {
    return (await apiClient.post<RunItem>(`${item(workspaceId, runId, itemId)}/regenerate-text`, payload, { timeout: 180_000 })).data;
  },
  async image(workspaceId: string, runId: string, itemId: string, payload: ImageAction): Promise<RunItem> {
    return (await apiClient.post<RunItem>(`${item(workspaceId, runId, itemId)}/image`, payload, { timeout: 600_000 })).data;
  },
  async imageIntent(workspaceId: string, runId: string, itemId: string, payload: RevisionInput & { intent: "text_only" | "required" }): Promise<RunItem> {
    return (await apiClient.patch<RunItem>(`${item(workspaceId, runId, itemId)}/image-intent`, payload)).data;
  },
  async attachImage(workspaceId: string, runId: string, itemId: string, payload: RevisionInput & { assetId: string }): Promise<RunItem> {
    return (await apiClient.post<RunItem>(`${item(workspaceId, runId, itemId)}/image-asset`, payload)).data;
  },
  async editSlot(workspaceId: string, runId: string, itemId: string, payload: SlotEdit): Promise<RunItem> {
    return (await apiClient.patch<RunItem>(`${item(workspaceId, runId, itemId)}/slot`, payload)).data;
  },
  async previewSchedule(workspaceId: string, runId: string, itemIds: string[]): Promise<SchedulePreview> {
    return (await apiClient.post<SchedulePreview>(`${run(workspaceId, runId)}/schedule/preview`, { itemIds })).data;
  },
  async confirmSchedule(workspaceId: string, runId: string, payload: { requestId: string; previewId: string; confirm: true }): Promise<ScheduleResult> {
    return (await apiClient.post<ScheduleResult>(`${run(workspaceId, runId)}/schedule/confirm`, payload)).data;
  },
  async retrySchedule(workspaceId: string, runId: string, payload: { requestId: string; itemIds: string[] }): Promise<ScheduleResult> {
    return (await apiClient.post<ScheduleResult>(`${run(workspaceId, runId)}/schedule/retry`, payload)).data;
  },
};