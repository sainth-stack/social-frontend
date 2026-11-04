import type { PlannerRun, RunItem } from "@/types/planner";
import { itemBusy, primaryStatus } from "./planner-review";

export type PlannerDateGroup = {
  key: string;
  date: string;
  time: string | null;
  timezone: string;
  items: RunItem[];
};

const platformOrder = { linkedin: 0, facebook: 1, instagram: 2 } as const;

export function groupRunItemsByDate(items: RunItem[]): PlannerDateGroup[] {
  const active = items.filter((item) => item.generationState !== "excluded");
  const map = new Map<string, RunItem[]>();
  for (const item of active) {
    const list = map.get(item.slot.date) ?? [];
    list.push(item);
    map.set(item.slot.date, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, groupItems]) => {
      const sorted = [...groupItems].sort(
        (a, b) => (platformOrder[a.slot.platform] ?? 9) - (platformOrder[b.slot.platform] ?? 9),
      );
      const time = sorted[0]?.slot.time ?? null;
      const timezone = sorted[0]?.slot.timezone ?? "UTC";
      return { key: date, date, time, timezone, items: sorted };
    });
}

export type RunTextGenerationProgress = {
  total: number;
  saved: number;
  inFlight: number;
  failed: number;
  percent: number;
};

export function runTextGenerationProgress(run: PlannerRun): RunTextGenerationProgress {
  const items = run.items.filter((item) => item.generationState !== "excluded");
  const saved = items.filter((item) => item.post && item.generationState === "created").length;
  const inFlight = items.filter(
    (item) => ["pending", "generating", "checkpointed"].includes(item.generationState) || item.textState === "processing",
  ).length;
  const failed = items.filter((item) => item.generationState === "failed" || item.textState === "uncertain").length;
  const total = items.length;
  const percent = total ? Math.min(100, Math.round((saved / total) * 100)) : 0;
  return { total, saved, inFlight, failed, percent };
}

export function runIsGeneratingText(run: PlannerRun): boolean {
  if (run.cancelled) return false;
  const progress = runTextGenerationProgress(run);
  if (progress.inFlight <= 0) return false;
  return ["queued", "running", "recovering", "partial"].includes(run.status) || progress.saved < progress.total;
}

export function itemIsWritingCopy(item: RunItem): boolean {
  if (item.generationState === "generating" || item.textState === "processing") return true;
  if (!item.post && ["pending", "checkpointed"].includes(item.generationState)) return true;
  return false;
}

export function groupIsWritingCopy(group: PlannerDateGroup): boolean {
  return group.items.some((item) => itemIsWritingCopy(item));
}

export type PlannerDatePhase = "text" | "image" | "done";

export function groupPhase(group: PlannerDateGroup): PlannerDatePhase {
  if (groupIsWritingCopy(group)) return "text";
  if (group.items.some((item) => !item.copyApproved)) return "text";
  if (group.items.some((item) => itemNeedsImage(item))) return "image";
  return "done";
}

export function itemNeedsImage(item: RunItem): boolean {
  if (item.imageIntent === "text_only") return false;
  if (item.visualState === "ready") return false;
  if (!item.copyApproved) return false;
  return true;
}

export function groupReadyToSchedule(group: PlannerDateGroup): boolean {
  return group.items.every((item) => item.canSchedule || item.isScheduled);
}

export function firstIncompleteGroupIndex(groups: PlannerDateGroup[]): number {
  const index = groups.findIndex((group) => groupPhase(group) !== "done" || !groupReadyToSchedule(group));
  return index === -1 ? Math.max(0, groups.length - 1) : index;
}

export function groupStatusLabel(group: PlannerDateGroup): string {
  if (groupIsWritingCopy(group)) return "Generating";
  if (groupIsGeneratingImages(group)) return "In progress";
  if (group.items.some((item) => item.generationState === "failed")) return "Needs retry";
  const phase = groupPhase(group);
  if (group.items.every((item) => item.isScheduled)) return "Scheduled";
  if (groupReadyToSchedule(group)) return "Ready";
  if (phase === "text") return "Review text";
  if (phase === "image") return "Add image";
  return "Needs attention";
}

export function groupHasAttention(group: PlannerDateGroup): boolean {
  return group.items.some((item) => primaryStatus(item) === "attention" || item.textState === "uncertain");
}

export type GroupImageProgress = {
  total: number;
  ready: number;
  inFlight: number;
  pending: number;
  failed: number;
  percent: number;
};

function imageScope(group: PlannerDateGroup): RunItem[] {
  return group.items.filter((item) => item.copyApproved && item.post && item.imageIntent !== "text_only");
}

export function groupImageProgress(group: PlannerDateGroup): GroupImageProgress {
  const scoped = imageScope(group);
  const ready = scoped.filter((item) => item.visualState === "ready").length;
  const inFlight = scoped.filter((item) => item.visualState === "processing").length;
  const failed = scoped.filter((item) => item.visualState === "failed").length;
  const pending = scoped.filter((item) => itemNeedsImage(item) && item.visualState !== "processing").length;
  const total = scoped.length;
  const percent = total ? Math.min(100, Math.round((ready / total) * 100)) : 100;
  return { total, ready, inFlight, pending, failed, percent };
}

export function groupIsGeneratingImages(group: PlannerDateGroup): boolean {
  return group.items.some((item) => item.visualState === "processing");
}

export function groupItemsPendingImage(group: PlannerDateGroup): RunItem[] {
  return group.items.filter(
    (item) => item.revision && itemNeedsImage(item) && item.visualState !== "processing",
  );
}

export function groupAllCopyApproved(group: PlannerDateGroup): boolean {
  return group.items.every((item) => item.copyApproved && !!item.post);
}

export function runImageBatchProgress(run: PlannerRun): GroupImageProgress {
  const groups = groupRunItemsByDate(run.items);
  return groups.reduce(
    (acc, group) => {
      const progress = groupImageProgress(group);
      return {
        total: acc.total + progress.total,
        ready: acc.ready + progress.ready,
        inFlight: acc.inFlight + progress.inFlight,
        pending: acc.pending + progress.pending,
        failed: acc.failed + progress.failed,
        percent: 0,
      };
    },
    { total: 0, ready: 0, inFlight: 0, pending: 0, failed: 0, percent: 0 },
  );
}

export function runImageBatchProgressWithPercent(run: PlannerRun): GroupImageProgress {
  const base = runImageBatchProgress(run);
  const percent = base.total ? Math.min(100, Math.round((base.ready / base.total) * 100)) : 100;
  return { ...base, percent };
}

export function runIsGeneratingImages(run: PlannerRun): boolean {
  return run.items.some((item) => item.visualState === "processing");
}

export function runAllCopyApproved(run: PlannerRun): boolean {
  const items = run.items.filter((item) => item.generationState !== "excluded");
  return items.length > 0 && items.every((item) => item.copyApproved && !!item.post);
}

export function runItemsPendingImage(run: PlannerRun): RunItem[] {
  return run.items.filter(
    (item) => item.generationState !== "excluded" && item.revision && itemNeedsImage(item) && item.visualState !== "processing",
  );
}
