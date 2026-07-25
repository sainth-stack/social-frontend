"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { selectUser } from "@/features/auth/authSlice";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import type { CalendarPost, SocialPlatform } from "@/types/social-media.types";
import { PLATFORM_LABELS } from "@/types/social-media.types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildMonthGrid(cursor: Date): Date[] {
  const first = startOfMonth(cursor);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function statusClass(status: CalendarPost["status"]): string {
  if (status === "published") {
    return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  }
  if (status === "scheduled") {
    return "bg-primary/10 text-primary border-primary/20";
  }
  if (status === "failed") {
    return "bg-destructive/10 text-destructive border-destructive/20";
  }
  return "bg-muted text-muted-foreground border-border";
}

export default function CalendarPage() {
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | "all">("all");
  const [items, setItems] = useState<CalendarPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarPost | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await socialMediaApi.getCalendar(orgId, monthKey(cursor));
      setItems(data.items);
    } catch {
      setError("Failed to load calendar");
      toast.error("Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [orgId, cursor]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (platformFilter === "all") return items;
    return items.filter((p) => p.platforms.includes(platformFilter));
  }, [items, platformFilter]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, CalendarPost[]>();
    for (const post of filtered) {
      const at = post.scheduledAt ?? post.publishedAt;
      if (!at) continue;
      const d = new Date(at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    return map;
  }, [filtered]);

  const days = buildMonthGrid(cursor);
  const today = new Date();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scheduled and published posts at a glance.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/content-studio/generate">
            <Plus className="mr-1.5 h-4 w-4" /> New post
          </Link>
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="flex-col gap-4 space-y-0 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCursor((c) => addMonths(c, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="min-w-[160px] text-center text-base">
              {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </CardTitle>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="ml-2"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCcw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "instagram", "facebook", "linkedin", "x"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatformFilter(p)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition",
                  platformFilter === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {p === "all" ? "All" : PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {!orgId ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Sign in with a workspace to view the calendar.
            </p>
          ) : loading && items.length === 0 ? (
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="min-h-[96px] animate-pulse bg-card p-2">
                  <div className="h-3 w-6 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : error && items.length === 0 ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-8 text-center text-sm text-destructive">
              {error}
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => void load()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="grid grid-cols-7 border-b border-border bg-muted/40">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day) => {
                  const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                  const dayPosts = postsByDay.get(key) ?? [];
                  const inMonth = day.getMonth() === cursor.getMonth();
                  const isToday = isSameDay(day, today);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        const iso = new Date(
                          day.getFullYear(),
                          day.getMonth(),
                          day.getDate(),
                          10,
                          0,
                        ).toISOString();
                        router.push(
                          `/dashboard/content-studio/generate?scheduleAt=${encodeURIComponent(iso)}`,
                        );
                      }}
                      className={cn(
                        "min-h-[104px] border-b border-r border-border p-1.5 text-left transition hover:bg-muted/40",
                        !inMonth && "bg-muted/20 text-muted-foreground",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                            isToday && "bg-primary text-primary-foreground",
                          )}
                        >
                          {day.getDate()}
                        </span>
                        {dayPosts.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {dayPosts.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayPosts.slice(0, 3).map((post) => {
                          const platform = post.platforms[0];
                          return (
                            <div
                              key={post.id}
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(post);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.stopPropagation();
                                  setSelected(post);
                                }
                              }}
                              className="flex items-start gap-1 rounded-md border border-border/80 bg-card px-1.5 py-1 text-left hover:border-primary/40"
                            >
                              {platform && (
                                <PlatformIcon platform={platform} size="sm" className="!h-5 !w-5 shrink-0" />
                              )}
                              <span className="line-clamp-2 text-[10px] font-medium leading-tight">
                                {post.title || post.captionPreview || "Post"}
                              </span>
                            </div>
                          );
                        })}
                        {dayPosts.length > 3 && (
                          <p className="px-1 text-[10px] text-muted-foreground">
                            +{dayPosts.length - 3} more
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title || "Post"}</SheetTitle>
                <SheetDescription>
                  {selected.scheduledAt
                    ? new Date(selected.scheduledAt).toLocaleString()
                    : selected.publishedAt
                      ? `Published ${new Date(selected.publishedAt).toLocaleString()}`
                      : "No schedule"}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <Badge
                  variant="secondary"
                  className={cn("border capitalize", statusClass(selected.status))}
                >
                  {selected.status.replace("_", " ")}
                </Badge>
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {selected.captionPreview || "No caption preview"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.platforms.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1.5 text-xs capitalize text-muted-foreground"
                    >
                      <PlatformIcon platform={p} size="sm" />
                      {PLATFORM_LABELS[p]}
                    </span>
                  ))}
                </div>
                {selected.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.imageUrl}
                    alt=""
                    className="max-h-48 w-full rounded-lg border border-border object-cover"
                  />
                )}
                <div className="flex flex-col gap-2 pt-2">
                  <Button asChild variant="outline">
                    <Link href={`/dashboard/posts/${selected.id}`}>View details</Link>
                  </Button>
                  <Button asChild>
                    <Link href={`/dashboard/content-studio/generate?draftId=${selected.id}`}>
                      Open in AI Studio
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
