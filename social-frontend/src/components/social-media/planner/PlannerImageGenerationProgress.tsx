import type { GroupImageProgress } from "./planner-groups";
import PlannerProgressCard from "./PlannerProgressCard";

export default function PlannerImageGenerationProgress({
  progress,
  className,
}: {
  progress: GroupImageProgress;
  className?: string;
}) {
  if (!progress.inFlight && progress.ready >= progress.total) return null;
  if (progress.total === 0) return null;

  const detail =
    progress.failed > 0
      ? `${progress.failed} need attention · `
      : "";
  const inProgress = progress.inFlight > 0 ? `${progress.inFlight} in progress` : `${progress.pending} waiting`;

  return (
    <PlannerProgressCard
      className={className}
      title="Creating images"
      description={`${progress.ready} of ${progress.total} ready · ${progress.percent}%`}
      percent={progress.percent}
      detail={`${detail}${inProgress}. You can switch dates or channels while this runs.`}
    />
  );
}
