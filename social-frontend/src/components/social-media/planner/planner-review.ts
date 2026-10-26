import type { PlannerRun, RunItem } from "@/types/planner";

export const plannerPath = "/dashboard/content-studio/planner";
export const plannerPlatforms = ["facebook", "instagram", "linkedin"] as const;
export const plannerControl = "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function slotReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
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