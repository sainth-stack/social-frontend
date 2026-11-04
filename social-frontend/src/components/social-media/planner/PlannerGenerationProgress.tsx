import type { RunTextGenerationProgress } from "./planner-groups";
import PlannerProgressCard from "./PlannerProgressCard";

export default function PlannerGenerationProgress({
  progress,
  runStatus,
  className,
}: {
  progress: RunTextGenerationProgress;
  runStatus: string;
  className?: string;
}) {
  const active = progress.inFlight > 0 || progress.saved < progress.total;
  if (!active) return null;

  const statusLabel =
    runStatus === "queued"
      ? "Starting generation…"
      : progress.saved === 0
        ? "Writing your first posts…"
        : `Saved ${progress.saved} of ${progress.total} posts`;

  return (
    <PlannerProgressCard
      className={className}
      title="Generating copy"
      description={`${statusLabel} · ${progress.percent}%`}
      percent={progress.percent}
      detail={`${progress.saved} of ${progress.total} saved${progress.failed > 0 ? ` · ${progress.failed} need attention` : ""}. Drafts appear below as they finish.`}
    />
  );
}
