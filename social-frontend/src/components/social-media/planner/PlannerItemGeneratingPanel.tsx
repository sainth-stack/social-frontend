import { Loader2 } from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import { Skeleton } from "@/components/ui/skeleton";
import type { RunItem } from "@/types/planner";
import { itemIsWritingCopy } from "./planner-groups";
import { imageStageLabel } from "./planner-review";

function copyStatus(item: RunItem): string {
  if (item.textState === "processing" || item.generationState === "generating") return "Writing copy…";
  if (!item.post) return "Queued…";
  if (item.visualState === "processing") return imageStageLabel(item) || "Creating image…";
  return "Working…";
}

export default function PlannerItemGeneratingPanel({
  item,
  accountName,
  compact = false,
}: {
  item: RunItem;
  accountName: string;
  compact?: boolean;
}) {
  const writing = itemIsWritingCopy(item);
  const image = item.visualState === "processing";

  if (compact && image && item.post) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="flex items-start gap-3 rounded-lg border bg-muted/30 px-4 py-4 text-sm"
      >
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="font-medium capitalize">
            <span className="mr-1.5 inline-flex align-middle">
              <PlatformIcon platform={item.slot.platform} size="sm" />
            </span>
            {item.slot.platform} · {copyStatus(item)}
          </p>
          <p className="text-muted-foreground">
            This preview updates automatically. Select another channel above to review finished posts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2" aria-busy="true" aria-live="polite">
      <div className="space-y-4 rounded-lg border border-dashed bg-muted/20 p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
          <PlatformIcon platform={item.slot.platform} size="sm" />
          <span className="capitalize">{item.slot.platform}</span>
          <span className="text-muted-foreground">· {copyStatus(item)}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {writing
            ? `Writing copy for ${item.slot.date}. Usually a few seconds per channel.`
            : image
              ? "Creating your image. The preview will update when it is ready."
              : "Preparing this slot…"}
        </p>
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30 p-6">
        <Skeleton className="h-[280px] w-full max-w-[260px] rounded-2xl" />
        <p className="text-center text-xs text-muted-foreground">
          {writing ? "Preview appears when copy is saved" : "Preview appears when the image is ready"}
        </p>
      </div>
    </div>
  );
}
