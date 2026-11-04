import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PlannerProgressCard({
  title,
  description,
  percent,
  detail,
  active = true,
  className,
}: {
  title: string;
  description: string;
  percent: number;
  detail: string;
  active?: boolean;
  className?: string;
}) {
  if (!active) return null;

  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("overflow-hidden rounded-xl border bg-muted/20 p-4 sm:p-5", className)}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
          <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-medium">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(percent, percent > 0 ? 8 : 4)}%` }}
              />
            </div>
            <p className="text-xs tabular-nums text-muted-foreground">{detail}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
