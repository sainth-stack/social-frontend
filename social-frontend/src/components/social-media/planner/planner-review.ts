import type { ConflictAcknowledgment, PlannerRun, PlannerSlot, PlannerWarnings, RunItem } from "@/types/planner";

export const plannerPath = "/dashboard/content-studio/planner";
export const plannerPlatforms = ["facebook", "instagram", "linkedin"] as const;
export const plannerControl = "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function slotReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    past_date: "Choose today or a future date in your workspace timezone",
    conflict_acknowledgment_required: "Review the other posts at this time before continuing",
    conflict_snapshot_changed_preview_again: "Other posts at this time changed. Review the schedule again",
    copy_not_approved: "Review and approve the text",
    image_required: "Add a current image",
    past_slot: "This posting time has already passed. Choose a later time or date",
    time_in_past: "This posting time has already passed. Choose a later time or date",
    slot_occupied: "This account already has a scheduled or publishing post at this exact time",
    slot_reserved: "This account and time are reserved by another scheduling operation",
    blackout_date: "This date is blocked in workspace schedule settings",
    posting_day_disabled: "No default posting time is enabled for this weekday. Enter a time",
    missing_time: "Choose a posting time",
    account_disconnected: "Reconnect or select an active account",
    account_missing: "Select a connected account",
    workspace_timezone_changed: "The workspace timezone changed. Refresh the planner",
    ambiguous_local_time_choose_utc_offset: "This time occurs twice due to daylight saving. Choose its UTC offset",
    nonexistent_local_time: "This local time does not exist due to daylight saving. Choose another time",
    invalid_utc_offset: "The UTC offset does not match this local time",
  };
  return labels[reason] ?? reason.replaceAll("_", " ");
}

export function plannerError(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string") return detail.message;
  if (detail && typeof detail === "object" && "code" in detail && typeof detail.code === "string") return slotReasonLabel(detail.code);
  if (Array.isArray(detail)) return detail.map(row => typeof row?.msg === "string" ? row.msg : "Invalid planner input").join("; ");
  return error instanceof Error ? error.message : "The request failed. Saved content is preserved. Refresh before retrying an uncertain operation.";
}

export function savedCopy(item: RunItem) {
  const copy = item.post?.platforms.find(row => row.platform === item.slot.platform);
  return { caption: copy?.caption ?? "", hashtags: copy?.hashtags ?? [], firstComment: copy?.firstComment ?? "" };
}

export function runNeedsPolling(run: PlannerRun): boolean {
  return ["queued", "running", "recovering"].includes(run.status)
    || run.items.some(item => ["processing", "generating", "running"].includes(item.visualState) || ["processing", "generating", "running"].includes(item.textState) || (item.isScheduled && item.scheduleState !== "accepted"));
}

export function itemBusy(item: RunItem): boolean {
  return [item.visualState, item.textState, item.generationState].some(state => ["processing", "generating", "running"].includes(state));
}

export function itemLabel(item: RunItem): string {
  if (item.isScheduled && item.scheduleState !== "accepted") return "Dispatch pending";
  if (item.isScheduled) return "Scheduled";
  if (item.generationState === "excluded") return "Excluded";
  if (!item.post) return item.generationState.replaceAll("_", " ");
  if (!item.copyApproved) return "Needs text approval";
  if (item.canSchedule) return "Ready";
  if (item.imageIntent === "required" && item.visualState !== "ready") return "Image needed";
  return "Needs attention";
}

export function displayTime(value: string | null, timezone: string): string {
  if (!value) return "Time not resolved";
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value)); }
  catch { return value; }
}

export function conflictSlot(error: unknown): PlannerSlot | null {
  const detail = (error as { response?: { data?: { detail?: { code?: string; slot?: PlannerSlot } } } })?.response?.data?.detail;
  return detail?.code === "conflict_acknowledgment_required" && detail.slot ? detail.slot : null;
}

export function warningAcknowledgments(rows: (PlannerWarnings & { slotId?: string })[]): ConflictAcknowledgment[] {
  return rows.flatMap(row => row.slotId && row.warningFingerprint && row.warnings?.length ? [{ slotId: row.slotId, warningFingerprint: row.warningFingerprint }] : []);
}

export function workspaceDate(timezone: string, value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function imageStageLabel(item: RunItem): string {
  const labels = { queued: "Image queued", concept: "Preparing concept", generate: "Generating artwork", format: "Formatting artwork", save: "Saving artwork", ready: "Image ready", failed: "Image failed" };
  return item.imageStage ? labels[item.imageStage] : item.visualState === "processing" ? "Preparing image" : "";
}

export function mergePolledRun(current: PlannerRun | null, incoming: PlannerRun, protectedIds: Set<string> = new Set()): PlannerRun {
  if (!current || current.id !== incoming.id) return incoming;
  return { ...incoming, items: incoming.items.map(item => {
    const saved = current.items.find(row => row.id === item.id);
    if (!saved) return item;
    if (protectedIds.has(item.id) && (saved.revision !== item.revision || saved.imageRequestId !== item.imageRequestId || saved.textState === "processing")) return saved;
    if (saved.revision === item.revision && saved.imageRequestId === item.imageRequestId && saved.imageUpdatedAt && (!item.imageUpdatedAt || saved.imageUpdatedAt > item.imageUpdatedAt)) return saved;
    return item;
  }) };
}