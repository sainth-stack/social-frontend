"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, List, Plus, RefreshCcw } from "lucide-react";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { isVideoMediaUrl } from "@/components/social-media/content-studio/shared/studioMediaHelpers";
import { formatPostDate, PostChannels, PostStatusBadge } from "@/components/social-media/posts/post-presentation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { selectUser } from "@/features/auth/authSlice";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { PLATFORM_LABELS, type CalendarPost, type SocialPlatform } from "@/types/social-media.types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const dayKey = (date: Date) => `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
const postTime = (post: CalendarPost) => post.scheduledAt ?? post.publishedAt;
const fullDate = (date: Date) => date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

function monthDays(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  return Array.from({ length: 42 }, (_, index) => new Date(cursor.getFullYear(), cursor.getMonth(), index + 1 - first.getDay()));
}

export default function CalendarPage() {
  const user = useAppSelector(selectUser);
  return <CalendarWorkspace key={user?.workspaceId ?? "none"} workspaceId={user?.workspaceId ?? ""} />;
}

function CalendarWorkspace({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [view, setView] = useState<"month" | "agenda">("month");
  const [platform, setPlatform] = useState<SocialPlatform | "all">("all");
  const [payload, setPayload] = useState<{ month: string; items: CalendarPost[] } | null>(null);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarPost | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const requestId = useRef(0);
  const dateButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const month = monthKey(cursor);
  const days = useMemo(() => monthDays(cursor), [cursor]);
  const items = payload?.month === month ? payload.items : [];
  const loaded = payload?.month === month;
  const today = dayKey(new Date());
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  useEffect(() => {
    if (window.matchMedia?.("(max-width: 767px)").matches) setView("agenda");
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await socialMediaApi.getCalendar(workspaceId, month);
      if (id === requestId.current) setPayload({ month, items: data.items });
    } catch {
      if (id === requestId.current) setError("We couldn’t load this month’s calendar. Please try again.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [workspaceId, month]);

  useEffect(() => {
    setSelected(null);
    setSelectedDay(null);
    setFocusIndex(days.findIndex((day) => dayKey(day) === today) >= 0 ? days.findIndex((day) => dayKey(day) === today) : days.findIndex((day) => day.getDate() === 1));
    void load();
    return () => { requestId.current += 1; };
  }, [load, days, today]);

  const filtered = useMemo(() => items.filter((post) => platform === "all" || post.platforms.includes(platform)).sort((a, b) => new Date(postTime(a) ?? 0).getTime() - new Date(postTime(b) ?? 0).getTime()), [items, platform]);
  const byDay = useMemo(() => {
    const grouped = new Map<string, CalendarPost[]>();
    for (const post of filtered) {
      const at = postTime(post);
      if (!at || Number.isNaN(new Date(at).getTime())) continue;
      const key = dayKey(new Date(at));
      grouped.set(key, [...(grouped.get(key) ?? []), post]);
    }
    return grouped;
  }, [filtered]);

  const createForDay = (day: Date) => {
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10).toISOString();
    router.push(`/dashboard/content-studio/generate?scheduleAt=${encodeURIComponent(at)}`);
  };
  const moveMonth = (delta: number) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader icon={CalendarDays} title="Content calendar" description="See your publishing plan, find a gap, and make your next move." />
        <Button asChild><Link href="/dashboard/content-studio/generate"><Plus className="mr-2 h-4 w-4" />Create a post</Link></Button>
      </header>

      <section aria-label="This month at a glance" className="grid grid-cols-3 gap-3">
        {[{ label: "Posts on calendar", count: filtered.length, icon: CalendarDays }, { label: "Scheduled", count: filtered.filter((post) => post.status === "scheduled").length, icon: Clock }, { label: "Published", count: filtered.filter((post) => post.status === "published").length, icon: CheckCircle2 }].map(({ label, count, icon: Icon }) => <Card key={label} className="shadow-soft"><CardContent className="p-3 sm:p-4"><div className="flex items-center justify-between gap-2"><h2 className="text-xs text-muted-foreground">{label}</h2><Icon className="hidden h-4 w-4 text-primary sm:block" /></div><p className="mt-2 text-2xl font-semibold tabular-nums">{loaded ? count : "—"}</p><p className="mt-1 text-xs text-muted-foreground">{monthLabel}</p></CardContent></Card>)}
      </section>

      <Card className="min-w-0 shadow-soft">
        <div className="space-y-4 border-b border-border p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <h2 aria-live="polite" className="min-w-36 text-center text-sm font-semibold sm:min-w-44 sm:text-base">{monthLabel}</h2>
              <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</Button>
              <div role="group" aria-label="Calendar view" className="flex rounded-lg border border-border p-1">{(["month", "agenda"] as const).map((value) => <Button key={value} size="sm" variant={view === value ? "secondary" : "ghost"} aria-pressed={view === value} onClick={() => setView(value)} className="h-7 capitalize">{value === "month" ? <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> : <List className="mr-1.5 h-3.5 w-3.5" />}{value}</Button>)}</div>
              <Button variant="outline" size="icon" aria-label="Refresh calendar" disabled={loading || !workspaceId} onClick={() => void load()}><RefreshCcw className={cn("h-4 w-4", loading && "motion-safe:animate-spin")} /></Button>
            </div>
          </div>
          <div aria-label="Filter calendar by channel" className="flex flex-wrap gap-2">{(["all", "instagram", "facebook", "linkedin", "x"] as const).map((value) => <Button key={value} size="sm" variant={platform === value ? "secondary" : "ghost"} aria-pressed={platform === value} onClick={() => setPlatform(value)} className="h-8 text-xs">{value === "all" ? "All channels" : PLATFORM_LABELS[value]}</Button>)}</div>
        </div>

        <CardContent className="min-w-0 p-3 sm:p-5" aria-busy={loading}>
          {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />{error}{loaded ? " Your previous calendar is still visible." : ""}</span><Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>Try again</Button></div>}
          {!workspaceId ? <p className="py-12 text-center text-sm text-muted-foreground">Select a workspace to view its calendar.</p> : loading && !loaded ? <div role="status" aria-label="Loading calendar" className={cn("grid gap-2", view === "month" ? "grid-cols-7" : "grid-cols-1")}>{Array.from({ length: view === "month" ? 35 : 5 }, (_, index) => <Skeleton key={index} className={cn("rounded-lg", view === "month" ? "h-24" : "h-20")} />)}</div> : loaded ? (
            <>
              {filtered.length === 0 && <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-5 sm:flex-row sm:items-center"><div><h3 className="text-sm font-semibold">{platform === "all" ? "A fresh month of possibilities" : "No posts for this channel"}</h3><p className="mt-1 text-xs text-muted-foreground">{platform === "all" ? "Pick a day to start filling your publishing calendar." : "Try another channel or create your next post."}</p></div><Button size="sm" variant="outline" asChild><Link href="/dashboard/content-studio/generate">Create a post<ArrowRight className="ml-2 h-3.5 w-3.5" /></Link></Button></div>}
              {view === "month" ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <div role="grid" aria-label={monthLabel} className="min-w-2xl">
                    <div role="row" className="grid grid-cols-7 border-b border-border bg-muted/40">{WEEKDAYS.map((day) => <div role="columnheader" key={day} className="px-3 py-3 text-xs font-medium text-muted-foreground">{day}</div>)}</div>
                    {Array.from({ length: 6 }, (_, week) => <div role="row" key={week} className="grid grid-cols-7">{days.slice(week * 7, week * 7 + 7).map((day, offset) => {
                      const index = week * 7 + offset;
                      const key = dayKey(day);
                      const dayPosts = byDay.get(key) ?? [];
                      return <div role="gridcell" key={key} aria-label={fullDate(day)} className={cn("min-h-36 min-w-0 border-b border-r border-border p-2", day.getMonth() !== cursor.getMonth() && "bg-muted/25")}>
                        <div className="mb-2 flex items-center justify-between"><button ref={(node) => { dateButtons.current[index] = node; }} type="button" tabIndex={focusIndex === index ? 0 : -1} aria-current={key === today ? "date" : undefined} aria-label={`Create a post for ${fullDate(day)}`} onFocus={() => setFocusIndex(index)} onClick={() => createForDay(day)} onKeyDown={(event) => { const shifts: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -offset, End: 6 - offset }; if (!(event.key in shifts)) return; event.preventDefault(); const next = Math.max(0, Math.min(41, index + shifts[event.key])); setFocusIndex(next); dateButtons.current[next]?.focus(); }} className={cn("flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", key === today && "bg-primary text-primary-foreground hover:bg-primary", day.getMonth() !== cursor.getMonth() && "text-muted-foreground")}>{day.getDate()}</button>{dayPosts.length > 0 && <span className="text-xs text-muted-foreground">{dayPosts.length}</span>}</div>
                        <div className="space-y-1.5">{dayPosts.slice(0, 2).map((post) => <button type="button" key={post.id} onClick={() => setSelected(post)} className={cn("block w-full min-w-0 rounded-md border border-border border-l-2 bg-card p-2 text-left shadow-soft transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", post.status === "published" ? "border-l-success" : post.status === "failed" ? "border-l-destructive" : "border-l-primary")}><span className="block text-xs text-muted-foreground">{formatPostDate(postTime(post), true)}</span><span className="mt-1 block truncate text-xs font-medium">{post.title || post.captionPreview || "Untitled post"}</span><span className="sr-only">{post.status.replaceAll("_", " ")}</span></button>)}{dayPosts.length > 2 && <button type="button" onClick={() => setSelectedDay(day)} className="rounded px-1 py-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">+{dayPosts.length - 2} more<span className="sr-only"> on {fullDate(day)}</span></button>}</div>
                      </div>;
                    })}</div>)}
                  </div>
                </div>
              ) : <div className="space-y-5">{[...byDay.entries()].map(([key, dayPosts]) => <section key={key} aria-label={fullDate(new Date(postTime(dayPosts[0])!))}><div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{fullDate(new Date(postTime(dayPosts[0])!))}</h3><Button variant="ghost" size="sm" aria-label={`Add a post on ${key}`} onClick={() => createForDay(new Date(postTime(dayPosts[0])!))}><Plus className="h-4 w-4" /></Button></div><ul className="space-y-2">{dayPosts.map((post) => <li key={post.id}><CalendarPostRow post={post} onSelect={() => setSelected(post)} /></li>)}</ul></section>)}</div>}
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Posts with a scheduled date · Times shown in {timezone}. Calendar totals reflect the selected month and channel.</p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Sheet open={Boolean(selected || selectedDay)} onOpenChange={(open) => { if (!open) { setSelected(null); setSelectedDay(null); } }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle className="break-words pr-5">{selected ? selected.title || "Untitled post" : selectedDay ? fullDate(selectedDay) : "Post details"}</SheetTitle><SheetDescription>{selected ? formatPostDate(postTime(selected)) : "Everything planned for this day."}</SheetDescription></SheetHeader>
          {selected ? <div className="mt-5 space-y-5"><PostStatusBadge status={selected.status} /><PostChannels platforms={selected.platforms} /><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{selected.captionPreview || "No caption preview available."}</p>{selected.imageUrl && (isVideoMediaUrl(selected.imageUrl) ? <video src={selected.imageUrl} controls preload="metadata" className="max-h-64 w-full rounded-xl" /> : <img src={selected.imageUrl} alt="Post media" className="max-h-64 w-full rounded-xl object-contain" />)}<div className="flex flex-col gap-2"><Button asChild variant="outline"><Link href={`/dashboard/posts/${selected.id}`}>View post details</Link></Button><Button asChild><Link href={`/dashboard/content-studio/generate?draftId=${selected.id}`}>Open in AI Studio</Link></Button></div></div> : selectedDay ? <div className="mt-5 space-y-3">{(byDay.get(dayKey(selectedDay)) ?? []).map((post) => <CalendarPostRow key={post.id} post={post} onSelect={() => setSelected(post)} />)}<Button className="w-full" variant="outline" onClick={() => createForDay(selectedDay)}><Plus className="mr-2 h-4 w-4" />Add a post</Button></div> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CalendarPostRow({ post, onSelect }: { post: CalendarPost; onSelect: () => void }) {
  return <button type="button" onClick={onSelect} className="flex w-full min-w-0 flex-wrap items-center gap-3 rounded-xl border border-border p-4 text-left transition hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 flex-1"><span className="block text-xs text-muted-foreground">{formatPostDate(postTime(post), true)}</span><span className="mt-1 block break-words text-sm font-medium">{post.title || "Untitled post"}</span><span className="mt-2 block"><PostChannels platforms={post.platforms} /></span></span><PostStatusBadge status={post.status} /></button>;
}