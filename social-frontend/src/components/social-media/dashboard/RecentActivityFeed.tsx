"use client";

import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  ChevronRight,
  Link2,
  PenLine,
  Send,
} from "lucide-react";

import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  activityChannelSummary,
  activityPlatforms,
  activityPostHref,
  activityLabel,
  activityPostTitle,
  activityVerb,
  activityVisualType,
  relativeActivityTime,
  type ActivityVisualType,
} from "@/lib/activity";
import { cn } from "@/lib/utils";
import type { SocialActivityItem } from "@/types/social-media.types";

const VISUAL_STYLES: Record<
  ActivityVisualType,
  { icon: React.ComponentType<{ className?: string }>; ring: string; iconClass: string }
> = {
  published: {
    icon: Send,
    ring: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  scheduled: {
    icon: CalendarClock,
    ring: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    iconClass: "text-sky-600 dark:text-sky-400",
  },
  connected: {
    icon: Link2,
    ring: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    iconClass: "text-violet-600 dark:text-violet-400",
  },
  failed: {
    icon: AlertCircle,
    ring: "bg-destructive/10 text-destructive",
    iconClass: "text-destructive",
  },
  generated: {
    icon: PenLine,
    ring: "bg-primary/10 text-primary",
    iconClass: "text-primary",
  },
};

function ActivityRow({ item }: { item: SocialActivityItem }) {
  const visual = activityVisualType(item);
  const style = VISUAL_STYLES[visual];
  const Icon = style.icon;
  const verb = activityVerb(item.action);
  const title = activityPostTitle(item);
  const channel = activityChannelSummary(item);
  const platforms = activityPlatforms(item);
  const href = activityPostHref(item);
  const fallback = !title ? activityLabel(item) : null;

  const inner = (
    <div className="flex gap-3 py-3.5">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          style.ring,
        )}
        aria-hidden
      >
        <Icon className={cn("h-4 w-4", style.iconClass)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge
                variant="secondary"
                className="h-5 rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-wide"
              >
                {verb}
              </Badge>
              {channel ? (
                <span className="text-[11px] text-muted-foreground">{channel}</span>
              ) : null}
            </div>
            {title ? (
              <p className="mt-1 truncate text-sm font-medium leading-snug text-foreground">
                {title}
              </p>
            ) : fallback ? (
              <p className="mt-1 text-sm leading-snug text-foreground">{fallback}</p>
            ) : null}
            {platforms.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {platforms.map((platform) => (
                  <PlatformIcon key={platform} platform={platform} size="sm" />
                ))}
              </div>
            ) : null}
          </div>
          <time
            className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
            dateTime={item.createdAt ?? undefined}
          >
            {relativeActivityTime(item.createdAt)}
          </time>
        </div>
      </div>
      {href ? (
        <ChevronRight
          className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/50"
          aria-hidden
        />
      ) : null}
    </div>
  );

  if (href) {
    return (
      <li>
        <Link
          href={href}
          className="group -mx-1 block rounded-lg px-1 transition-colors hover:bg-muted/50"
        >
          {inner}
        </Link>
      </li>
    );
  }

  return <li className="-mx-1 px-1">{inner}</li>;
}

type RecentActivityFeedProps = {
  items: SocialActivityItem[];
  loading?: boolean;
  className?: string;
};

export function RecentActivityFeed({ items, loading, className }: RecentActivityFeedProps) {
  if (loading) {
    return (
      <div className={cn("space-y-1", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center",
          className,
        )}
      >
        <p className="text-sm font-medium text-foreground">No activity yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a post or connect an account — updates will show up here.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href="/dashboard/content-studio/generate"
            className="text-sm font-medium text-primary hover:underline"
          >
            Open AI Studio
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href="/dashboard/accounts"
            className="text-sm font-medium text-primary hover:underline"
          >
            Connect accounts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul className={cn("divide-y divide-border/60", className)}>
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </ul>
  );
}
