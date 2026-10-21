import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
};

export function PageHeader({ icon: Icon, title, description, className }: PageHeaderProps) {
  return (
    <div className={cn("flex gap-3", className)}>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/50 text-primary shadow-sm"
        aria-hidden
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={1.65} />
      </span>
      <div className="min-w-0 pt-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
