import type { PlannerRun, RunItem } from "@/types/planner";

export const plannerPath = "/dashboard/content-studio/planner";
export const plannerPlatforms = ["facebook", "instagram", "linkedin"] as const;
export const plannerControl = "min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

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