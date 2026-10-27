import type { SocialPost } from "@/types/social-media.types";

export type PlannerPlatform = "facebook" | "instagram" | "linkedin";
export type ConflictAcknowledgment = { slotId: string; warningFingerprint: string };
export type PlannerWarning = { code: "scheduled_post_conflict"; postId: string; accountId: string; accountName: string; status: string; scheduledAt: string; localDate: string; localTime: string; timezone: string; utcOffsetMinutes: number; excerpt: string; fingerprint: string };
export type PlannerWarnings = { warnings?: PlannerWarning[]; warningFingerprint?: string | null; acknowledgmentRequired?: boolean };
export type SlotOverride = { date: string; platform: PlannerPlatform; time: string; accountId?: string | null; utcOffsetMinutes?: number | null };
export type PlannerSelection = {
  timezone: string;
  dates?: string[];
  startDate?: string;
  endDate?: string;
  weekdays?: number[];
  platforms: PlannerPlatform[];
  accountIds: Record<string, string>;
  postingTime?: string;
  overrides: SlotOverride[];
  conflictAcknowledgments?: ConflictAcknowledgment[];
};
export type PlannerSlot = PlannerWarnings & {
  slotId: string; date: string; time: string | null; platform: PlannerPlatform;
  accountId: string | null; proposedAt: string | null; timezone: string;
  utcOffsetMinutes: number | null; reasons: string[];
};
export type SlotPreview = { timezone: string; selectedDateCount: number; dateCap: number; expectedTextUnits: number; previewToken: string; slots: PlannerSlot[] };
export type RunCreate = PlannerSelection & { requestId: string; previewToken: string; prompt: string; tone?: string; includeComment?: boolean; excludedSlotIds: string[] };
export type RevisionInput = { expectedRevision: string };
export type CopyEdit = RevisionInput & { caption: string; hashtags: string[]; firstComment: string };
export type ImageAction = RevisionInput & { requestId: string; mode: "generate" | "retry" | "regenerate"; creditsConfirmed: boolean; imageDirection?: string | null };
export type SlotEdit = { date: string; time: string; timezone: string; utcOffsetMinutes?: number | null; conflictAcknowledgments?: ConflictAcknowledgment[] };
export type RunItem = {
  id: string; slot: PlannerSlot; generationState: string; error: string | null; postId: string;
  post: (Omit<SocialPost, "orgId"> & { workspaceId?: string; orgId?: string }) | null;
  revision: string | null; copyApproved: boolean; approvedRevision: string | null;
  approvedBy: string | null; approvedAt: string | null; visualState: string; visualRevision: string | null;
  imageOperationId: string | null; imageRequestId: string | null; textState: string; textRequestId: string | null;
  imageStage?: "queued" | "concept" | "generate" | "format" | "save" | "ready" | "failed" | null;
  imageError?: { code: string; stage: string; message: string } | null;
  imageRetryable?: boolean; imageUpdatedAt?: string | null; imageDirection?: string | null; imageWarnings?: string[];
  imageIntent: string; proposedAt: string | null; isScheduled: boolean; canSchedule: boolean;
  reasons: string[]; scheduleState: string | null;
};
export type PlannerRun = { id: string; requestId: string; status: string; dispatchState: string; prompt: string; includeComment?: boolean; timezone: string; createdAt: string; createdBy: string; cancelled: boolean; items: RunItem[] };
export type RunList = { items: PlannerRun[]; total: number };
export type ScheduleOutcome = PlannerWarnings & { slotId?: string; itemId: string; postId: string; revision: string | null; proposedAt: string | null; timezone: string; platform: string; accountId: string | null; outcome: "ready" | "scheduled" | "already_scheduled" | "blocked" | "dispatch_pending" | "failed"; reasons: string[] };
export type SchedulePreview = { previewId: string; expiresAt: string; items: ScheduleOutcome[] };
export type ScheduleResult = { requestId: string; items: ScheduleOutcome[] };