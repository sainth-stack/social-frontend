"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, History, Pencil, RefreshCcw, RotateCcw, Save, Square, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { PlatformIcon } from "@/components/platform-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { selectUser } from "@/features/auth/authSlice";
import { selectSocialAccounts } from "@/features/social-media/socialAccountsSelectors";
import { fetchSocialAccounts } from "@/features/social-media/socialAccountsThunks";
import { cn } from "@/lib/utils";
import { contentPlanDayCap, planDisplayName } from "@/lib/plans";
import {
  clearContentPlanHistory,
  loadContentPlanHistory,
  postIdsFromHistoryEntry,
  removeContentPlanHistoryEntry,
  saveContentPlanHistoryRun,
  type ContentPlanHistoryEntry,
} from "@/lib/contentPlanHistory";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { CalendarPost, SocialPlatform, SocialPost, SocialPostStatus } from "@/types/social-media.types";
import { PLATFORM_LABELS } from "@/types/social-media.types";

const PLAN_PUBLISHABLE: SocialPlatform[] = ["facebook", "instagram"];

async function deletePlannerPostFromApi(
  orgId: string,
  postId: string,
  status: SocialPostStatus,
): Promise<void> {
  if (status === "scheduled") {
    await socialMediaApi.cancelSchedule(orgId, postId);
    await socialMediaApi.deletePost(orgId, postId);
    return;
  }
  if (status === "published") {
    await socialMediaApi.archivePost(orgId, postId);
    await socialMediaApi.deletePost(orgId, postId);
    return;
  }
  if (status === "draft" || status === "failed" || status === "archived") {
    await socialMediaApi.deletePost(orgId, postId);
    return;
  }
  throw new Error(`Cannot delete a post while it is ${status.replace("_", " ")}`);
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string | { message?: string } } } })
    ?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && typeof detail.message === "string") {
    return detail.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function extractPlanError(err: unknown, fallback: string): string {
  const resp = (err as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const detail = resp?.data?.detail;
  if (resp?.status === 402 && detail && typeof detail === "object") {
    const d = detail as { message?: string };
    return d.message || "Plan limit reached — upgrade or wait until next month.";
  }
  return extractErrorMessage(err, fallback);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function calendarPostFromSocial(post: SocialPost): CalendarPost {
  const p0 = post.platforms[0];
  return {
    id: post.id,
    title: post.title,
    status: post.status,
    scheduledAt: post.scheduledAt,
    publishedAt: post.publishedAt,
    platforms: post.platforms.map((p) => p.platform),
    captionPreview: (p0?.caption || post.title || "").slice(0, 500),
    imageUrl: post.imageUrl,
  };
}

type DayBucket = {
  key: string;
  date: Date;
  weekday: string;
  dayNum: number;
  posts: CalendarPost[];
};

export function ContentPlannerSection({ orgId }: { orgId: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const accounts = useAppSelector(selectSocialAccounts);
  const planCap = contentPlanDayCap(user?.plan);

  const [viewDays, setViewDays] = useState<7 | 15 | 30>(() => planCap);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planTargetDate, setPlanTargetDate] = useState<string | null>(null);
  const [planFormDays, setPlanFormDays] = useState<7 | 15 | 30>(() => planCap);
  const [planPrompt, setPlanPrompt] = useState("");
  const [planTone, setPlanTone] = useState("");
  const [planCta, setPlanCta] = useState("");
  const [generateImages, setGenerateImages] = useState(true);
  const [skipFilledDays, setSkipFilledDays] = useState(true);
  const [planPlatforms, setPlanPlatforms] = useState<SocialPlatform[]>([]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [planHistory, setPlanHistory] = useState<ContentPlanHistoryEntry[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const pollAbortRef = useRef(false);

  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);
  const [fullPost, setFullPost] = useState<SocialPost | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [regenPrompt, setRegenPrompt] = useState("");
  const [regenTone, setRegenTone] = useState("");
  const [regenCta, setRegenCta] = useState("");
  const [regenCaption, setRegenCaption] = useState(true);
  const [regenImage, setRegenImage] = useState(true);
  const [savingPost, setSavingPost] = useState(false);
  const [regeneratingPostId, setRegeneratingPostId] = useState<string | null>(null);
  const [loadingPost, setLoadingPost] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<CalendarPost | null>(null);
  const [historyEntryToClear, setHistoryEntryToClear] = useState<ContentPlanHistoryEntry | null>(null);
  const [historyRunToDeletePosts, setHistoryRunToDeletePosts] = useState<ContentPlanHistoryEntry | null>(null);
  const [clearAllHistoryOpen, setClearAllHistoryOpen] = useState(false);

  const [planProgress, setPlanProgress] = useState<{ current: number; total: number; message: string } | null>(
    null,
  );
  const [items, setItems] = useState<CalendarPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPlanAccount = useMemo(
    () =>
      accounts.some(
        (a) => a.isActive && PLAN_PUBLISHABLE.includes(a.platform),
      ),
    [accounts],
  );

  const connectedPlanPlatforms = useMemo(
    () =>
      [
        ...new Set(
          accounts
            .filter((a) => a.isActive && PLAN_PUBLISHABLE.includes(a.platform))
            .map((a) => a.platform),
        ),
      ] as SocialPlatform[],
    [accounts],
  );

  useEffect(() => {
    setPlanPlatforms((prev) => {
      const kept = prev.filter((p) => connectedPlanPlatforms.includes(p));
      if (kept.length > 0) return kept;
      return connectedPlanPlatforms;
    });
  }, [connectedPlanPlatforms]);

  useEffect(() => {
    if (!orgId) return;
    void dispatch(fetchSocialAccounts({ orgId }));
  }, [dispatch, orgId]);

  useEffect(() => {
    if (viewDays > planCap) setViewDays(planCap);
  }, [viewDays, planCap]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const months = new Set<string>([monthKey(now)]);
      const end = new Date(now);
      end.setDate(end.getDate() + viewDays + 2);
      months.add(monthKey(end));
      const results = await Promise.all(
        [...months].map((m) => socialMediaApi.getCalendar(orgId, m)),
      );
      const merged = results
        .flatMap((r) => r.items)
        .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
      setItems(merged);
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to load planner"));
    } finally {
      setLoading(false);
    }
  }, [orgId, viewDays]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedPost || !orgId) {
      setFullPost(null);
      return;
    }
    let cancelled = false;
    setLoadingPost(true);
    void socialMediaApi
      .getPost(orgId, selectedPost.id)
      .then((post) => {
        if (cancelled) return;
        setFullPost(post);
        const cap = post.platforms[0]?.caption || "";
        setEditCaption(cap);
        setEditSchedule(toDatetimeLocalValue(post.scheduledAt));
        setRegenPrompt(post.aiPrompt || cap.slice(0, 200) || "");
      })
      .catch(() => {
        if (!cancelled) {
          setEditCaption(selectedPost.captionPreview || "");
          setEditSchedule(toDatetimeLocalValue(selectedPost.scheduledAt));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPost(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, selectedPost]);

  const dayBuckets = useMemo((): DayBucket[] => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const buckets: DayBucket[] = [];
    for (let i = 0; i < viewDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      buckets.push({
        key,
        date: d,
        weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
        dayNum: d.getDate(),
        posts: [],
      });
    }
    for (const post of items) {
      const at = post.scheduledAt ?? post.publishedAt;
      if (!at) continue;
      const dt = new Date(at);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      const bucket = buckets.find((b) => b.key === key);
      if (bucket) bucket.posts.push(post);
    }
    for (const b of buckets) {
      b.posts.sort((a, c) => {
        const ta = new Date(a.scheduledAt ?? a.publishedAt ?? 0).getTime();
        const tc = new Date(c.scheduledAt ?? c.publishedAt ?? 0).getTime();
        return ta - tc;
      });
    }
    return buckets;
  }, [items, viewDays]);

  const scheduledInWindow = dayBuckets.reduce((n, b) => n + b.posts.length, 0);
  const planDayOptions = ([7, 15, 30] as const).filter((d) => d <= planCap);

  const openGenerateDialog = (targetDate: string | null = null) => {
    setPlanTargetDate(targetDate);
    setPlanFormDays(targetDate ? 1 : viewDays);
    setPlanDialogOpen(true);
  };

  const openHistory = () => {
    if (orgId) setPlanHistory(loadContentPlanHistory(orgId));
    setHistoryOpen(true);
  };

  const togglePlanPlatform = (platform: SocialPlatform) => {
    setPlanPlatforms((prev) => {
      if (prev.includes(platform)) {
        if (prev.length <= 1) {
          toast.error("Select at least one platform");
          return prev;
        }
        return prev.filter((p) => p !== platform);
      }
      return [...prev, platform];
    });
  };

  const stopPlan = async () => {
    pollAbortRef.current = true;
    const jobId = activeJobId;
    if (orgId && jobId && !jobId.startsWith("sync-")) {
      try {
        await socialMediaApi.cancelContentPlanJob(orgId, jobId);
      } catch {
        /* still stop UI polling */
      }
    }
    setPlanning(false);
    setPlanProgress(null);
    setActiveJobId(null);
    toast.message("Stopping… posts already created stay on your calendar.");
    void load();
  };

  const finishPlanRun = async (
    result: NonNullable<Awaited<ReturnType<typeof socialMediaApi.getContentPlanJob>>["result"]>,
    jobId: string,
    meta: { prompt: string; platforms: SocialPlatform[] },
  ) => {
    if (result.calendarItems?.length) {
      setItems((prev) => {
        const ids = new Set(result.calendarItems.map((p) => p.id));
        return [...result.calendarItems, ...prev.filter((p) => !ids.has(p.id))];
      });
    }
    saveContentPlanHistoryRun(orgId, {
      jobId,
      prompt: meta.prompt,
      platforms: meta.platforms,
      result,
    });
    await load();
    toast.success(result.message || `Planned ${result.days} day(s)`);
    if (result.errors?.length) {
      toast.message(result.errors.slice(0, 2).join(" · "));
    }
    setPlanDialogOpen(false);
    setPlanTargetDate(null);
  };

  const generatePlan = async () => {
    if (!orgId) return;
    if (!planPrompt.trim() || planPrompt.trim().length < 10) {
      toast.error("Describe your campaign (at least 10 characters)");
      return;
    }
    if (!hasPlanAccount) {
      toast.error("Connect Facebook or Instagram first");
      return;
    }
    if (planPlatforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }

    const days = planTargetDate ? 1 : planFormDays;
    pollAbortRef.current = false;
    setPlanning(true);
    setPlanProgress({ current: 0, total: days, message: "Starting…" });
    setError(null);
    const promptSnapshot = planPrompt.trim();
    const platformsSnapshot = [...planPlatforms];
    try {
      const { jobId } = await socialMediaApi.startContentPlanJob(orgId, {
        days: days as 1 | 7 | 15 | 30,
        prompt: promptSnapshot,
        tone: planTone.trim() || undefined,
        cta: planCta.trim() || undefined,
        autoSchedule: true,
        generateImages,
        skipFilledDays: planTargetDate ? false : skipFilledDays,
        targetDate: planTargetDate || undefined,
        platforms: platformsSnapshot,
      });
      setActiveJobId(jobId);

      const deadline = Date.now() + 20 * 60 * 1000;
      let result = null;
      while (Date.now() < deadline) {
        if (pollAbortRef.current) {
          for (let i = 0; i < 8 && !result; i++) {
            await new Promise((r) => setTimeout(r, 1500));
            const status = await socialMediaApi.getContentPlanJob(orgId, jobId);
            if (status.status === "completed" && status.result) {
              result = status.result;
              break;
            }
          }
          if (result) {
            await finishPlanRun(result, jobId, {
              prompt: promptSnapshot,
              platforms: platformsSnapshot,
            });
          }
          return;
        }
        const status = await socialMediaApi.getContentPlanJob(orgId, jobId);
        if (status.status === "running" && status.progress) {
          setPlanProgress(status.progress);
        }
        if (status.status === "completed" && status.result) {
          result = status.result;
          break;
        }
        if (status.status === "failed") {
          throw new Error(status.error || "Content plan failed");
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!result) {
        throw new Error("Still running — refresh the planner in a minute.");
      }

      await finishPlanRun(result, jobId, {
        prompt: promptSnapshot,
        platforms: platformsSnapshot,
      });
    } catch (err) {
      if (!pollAbortRef.current) {
        const message = extractPlanError(err, "Failed to generate plan");
        setError(message);
        toast.error(message);
      }
    } finally {
      setPlanning(false);
      setPlanProgress(null);
      setActiveJobId(null);
      pollAbortRef.current = false;
    }
  };

  const applyPostUpdate = (post: SocialPost) => {
    const cal = calendarPostFromSocial(post);
    setItems((prev) => prev.map((p) => (p.id === cal.id ? cal : p)));
    setSelectedPost(cal);
    setFullPost(post);
    setEditCaption(post.platforms[0]?.caption || "");
    setEditSchedule(toDatetimeLocalValue(post.scheduledAt));
  };

  const confirmDeletePost = async () => {
    if (!orgId || !postToDelete) return;
    setDeletingPostId(postToDelete.id);
    try {
      let status: SocialPostStatus = postToDelete.status;
      if (fullPost?.id === postToDelete.id) {
        status = fullPost.status;
      } else {
        try {
          const fresh = await socialMediaApi.getPost(orgId, postToDelete.id);
          status = fresh.status;
        } catch {
          /* use calendar status */
        }
      }
      await deletePlannerPostFromApi(orgId, postToDelete.id, status);
      setItems((prev) => prev.filter((p) => p.id !== postToDelete.id));
      if (selectedPost?.id === postToDelete.id) {
        setSelectedPost(null);
        setFullPost(null);
      }
      toast.success("Post deleted");
      setPostToDelete(null);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not delete post"));
    } finally {
      setDeletingPostId(null);
    }
  };

  const confirmRemoveHistoryEntry = () => {
    if (!orgId || !historyEntryToClear) return;
    removeContentPlanHistoryEntry(orgId, historyEntryToClear.id);
    setPlanHistory((prev) => prev.filter((e) => e.id !== historyEntryToClear.id));
    setHistoryEntryToClear(null);
    toast.success("Removed from history");
  };

  const confirmClearAllHistory = () => {
    if (!orgId) return;
    clearContentPlanHistory(orgId);
    setPlanHistory([]);
    setClearAllHistoryOpen(false);
    toast.success("History cleared");
  };

  const confirmDeleteHistoryRunPosts = async () => {
    if (!orgId || !historyRunToDeletePosts) return;
    const ids = postIdsFromHistoryEntry(historyRunToDeletePosts);
    if (ids.length === 0) {
      toast.message("No posts linked to this run");
      setHistoryRunToDeletePosts(null);
      return;
    }
    setDeletingPostId("bulk");
    let deleted = 0;
    try {
      for (const postId of ids) {
        let status: SocialPostStatus = "draft";
        try {
          const post = await socialMediaApi.getPost(orgId, postId);
          status = post.status;
        } catch {
          continue;
        }
        try {
          await deletePlannerPostFromApi(orgId, postId, status);
          deleted += 1;
        } catch {
          /* skip */
        }
      }
      setItems((prev) => prev.filter((p) => !ids.includes(p.id)));
      if (selectedPost && ids.includes(selectedPost.id)) {
        setSelectedPost(null);
        setFullPost(null);
      }
      await load();
      toast.success(`Deleted ${deleted} of ${ids.length} post(s) from this run`);
    } finally {
      setDeletingPostId(null);
      setHistoryRunToDeletePosts(null);
    }
  };

  const savePostEdits = async () => {
    if (!orgId || !fullPost) return;
    const platform = fullPost.platforms[0];
    if (!platform) return;
    setSavingPost(true);
    try {
      const scheduledAt = editSchedule ? new Date(editSchedule).toISOString() : null;
      const updated = await socialMediaApi.updatePost(orgId, fullPost.id, {
        scheduledAt,
        platforms: [
          {
            platform: platform.platform,
            socialAccountId: platform.socialAccountId,
            caption: editCaption.trim(),
            hashtags: platform.hashtags,
            firstComment: platform.firstComment,
          },
        ],
      });
      applyPostUpdate(updated);
      toast.success("Post saved");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not save post"));
    } finally {
      setSavingPost(false);
    }
  };

  const handleRegeneratePost = async () => {
    if (!orgId || !fullPost) return;
    if (!regenCaption && !regenImage) {
      toast.error("Choose caption and/or image to regenerate");
      return;
    }
    setRegeneratingPostId(fullPost.id);
    try {
      const updated = await socialMediaApi.regeneratePostContent(orgId, fullPost.id, {
        prompt: regenPrompt.trim() || undefined,
        regenerateCaption: regenCaption,
        regenerateImage: regenImage,
        tone: regenTone.trim() || undefined,
        cta: regenCta.trim() || undefined,
      });
      applyPostUpdate(updated);
      toast.success("Post updated");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Regenerate failed"));
    } finally {
      setRegeneratingPostId(null);
    }
  };

  const canSubmitPlan =
    planPrompt.trim().length >= 10 &&
    hasPlanAccount &&
    planPlatforms.length > 0 &&
    !planning;

  return (
    <>
      <Card className="shadow-soft">
        <CardHeader className="flex-col gap-4 space-y-0">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-base">Content planner</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Generate a multi-day plan or fill one day at a time. Click any post to edit, reschedule, or
                regenerate.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-border p-0.5">
                {planDayOptions.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setViewDays(d)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition",
                      viewDays === d
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {d}d view
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={openHistory}>
                <History className="mr-1.5 h-4 w-4" />
                History
              </Button>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || planning}>
                <RefreshCcw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => openGenerateDialog(null)} disabled={!hasPlanAccount || planning}>
                <Wand2 className="mr-1.5 h-4 w-4" />
                Generate plan
              </Button>
            </div>
          </div>
          {!hasPlanAccount && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              Connect Facebook or Instagram to generate and schedule posts.
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            {scheduledInWindow} scheduled in next {viewDays} days
            {planCap < 30 ? ` · ${planDisplayName(user?.plan)} up to ${planCap} days per run` : ""}
          </p>
        </CardHeader>
        <CardContent>
          {planning && planProgress && (
            <div className="mb-4 space-y-2 rounded-xl border border-border bg-muted/40 px-4 py-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">{planProgress.message}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {planProgress.current}/{planProgress.total || planFormDays}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => void stopPlan()}
                  >
                    <Square className="mr-1 h-3 w-3 fill-current" />
                    Stop
                  </Button>
                </div>
              </div>
              <Progress
                value={
                  planProgress.total
                    ? Math.min(100, (planProgress.current / planProgress.total) * 100)
                    : 0
                }
              />
              <p className="text-[10px] text-muted-foreground">
                Running in background — Stop cancels remaining days; finished posts stay scheduled.
              </p>
            </div>
          )}
          {loading && !planning ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: Math.min(viewDays, 8) }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-muted/30" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
              {error}
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => void load()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {dayBuckets.map((bucket, index) => (
                <DayCard
                  key={bucket.key}
                  bucket={bucket}
                  index={index}
                  onPostClick={setSelectedPost}
                  onDeletePost={(post) => setPostToDelete(post)}
                  onGenerateDay={() => openGenerateDialog(bucket.key)}
                  canGenerate={hasPlanAccount && !planning}
                  deletingPostId={deletingPostId}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={planDialogOpen} onOpenChange={(o) => !planning && setPlanDialogOpen(o)}>
        <DialogContent className="gap-0 p-0 w-[calc(100vw-2rem)] max-w-[42rem] sm:max-w-2xl">
          <DialogHeader className="border-b border-border px-6 py-4 text-left">
            <DialogTitle className="text-lg">
              {planTargetDate ? "Generate for one day" : "Generate content plan"}
            </DialogTitle>
            <DialogDescription>
              {planTargetDate
                ? `Create and schedule one post for ${planTargetDate}.`
                : "One flagship-quality post per day from your brief. Fill Brand Profile for best voice and CTAs."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            {!planTargetDate && (
              <div className="space-y-1.5">
                <Label>How many days</Label>
                <div className="flex flex-wrap gap-2">
                  {planDayOptions.map((d) => (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={planFormDays === d ? "default" : "outline"}
                      onClick={() => setPlanFormDays(d)}
                      disabled={planning}
                    >
                      {d} days
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="plan-brief">What should we post about?</Label>
            <Textarea
              id="plan-brief"
              rows={8}
              value={planPrompt}
              onChange={(e) => setPlanPrompt(e.target.value)}
              placeholder="Campaign goal, product, audience, angles you want…"
              disabled={planning}
              className="resize-y text-sm min-h-[120px]"
            />
              <p className="text-[10px] text-muted-foreground">{planPrompt.trim().length}/16000 · min 10</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="plan-tone">Tone</Label>
                <Input
                  id="plan-tone"
                  value={planTone}
                  onChange={(e) => setPlanTone(e.target.value)}
                  placeholder="Professional, playful…"
                  disabled={planning}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-cta">Call to action</Label>
                <Input
                  id="plan-cta"
                  value={planCta}
                  onChange={(e) => setPlanCta(e.target.value)}
                  placeholder="Book a demo, shop now…"
                  disabled={planning}
                />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-3 space-y-2">
              <p className="text-xs font-medium text-foreground">Platforms</p>
              <p className="text-[10px] text-muted-foreground">
                Each day rotates across selected accounts (not Instagram-only unless you choose it).
              </p>
              <div className="flex flex-wrap gap-3">
                {connectedPlanPlatforms.map((platform) => (
                  <label key={platform} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={planPlatforms.includes(platform)}
                      onCheckedChange={() => togglePlanPlatform(platform)}
                      disabled={planning}
                    />
                    <PlatformIcon platform={platform} size="sm" />
                    {PLATFORM_LABELS[platform]}
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-3 space-y-2">
              <p className="text-xs font-medium text-foreground">Options</p>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={generateImages}
                  onCheckedChange={(v) => setGenerateImages(!!v)}
                  disabled={planning}
                />
                Generate images (Bedrock)
              </label>
              {!planTargetDate && (
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={skipFilledDays}
                    onCheckedChange={(v) => setSkipFilledDays(!!v)}
                    disabled={planning}
                  />
                  Skip days that already have a post
                </label>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-border px-6 py-4">
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)} disabled={planning}>
              Cancel
            </Button>
            <Button onClick={() => void generatePlan()} disabled={!canSubmitPlan}>
              {planning ? (
                <>
                  <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" /> Working…
                </>
              ) : (
                <>
                  <Wand2 className="mr-1.5 h-4 w-4" />
                  {planTargetDate ? "Generate this day" : `Generate ${planFormDays} days`}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border px-6 py-4 text-left">
            <DialogTitle className="text-lg">Plan history</DialogTitle>
            <DialogDescription>
              Recent runs on this browser — posts remain on your calendar after each run.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(60vh,420px)] overflow-y-auto px-6 py-4">
            {planHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed plans yet.</p>
            ) : (
              <ul className="space-y-3">
                {planHistory.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-1">
                        {entry.platforms.map((p) => (
                          <PlatformIcon key={p} platform={p} size="sm" />
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={() => setHistoryEntryToClear(entry)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    <p className="mt-1 font-medium line-clamp-2">{entry.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {entry.promptPreview}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {entry.days} post(s) · {entry.scheduledCount} scheduled
                      {entry.errors.length ? ` · ${entry.errors.length} note(s)` : ""}
                    </p>
                    {postIdsFromHistoryEntry(entry).length > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-xs text-destructive hover:text-destructive"
                        disabled={deletingPostId === "bulk"}
                        onClick={() => setHistoryRunToDeletePosts(entry)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete posts from this run
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter className="border-t border-border px-6 py-4 flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={planHistory.length === 0}
              onClick={() => setClearAllHistoryOpen(true)}
            >
              Clear all history
            </Button>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedPost} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          {selectedPost && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-left">
                  <PlatformIcon platform={selectedPost.platforms[0] ?? "instagram"} size="sm" />
                  {selectedPost.scheduledAt
                    ? new Date(selectedPost.scheduledAt).toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })
                    : "Draft post"}
                </SheetTitle>
                <SheetDescription className="text-left">
                  Edit caption and time, or regenerate with a custom brief.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto py-2">
                {selectedPost.imageUrl ? (
                  <div className="overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedPost.imageUrl}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <Label htmlFor="edit-caption">Caption</Label>
                  <Textarea
                    id="edit-caption"
                    rows={6}
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    disabled={loadingPost || savingPost}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-schedule">Schedule</Label>
                  <Input
                    id="edit-schedule"
                    type="datetime-local"
                    value={editSchedule}
                    onChange={(e) => setEditSchedule(e.target.value)}
                    disabled={loadingPost || savingPost}
                  />
                </div>

                <div className="rounded-lg border border-border p-3 space-y-3">
                  <p className="text-xs font-semibold">Regenerate with AI</p>
                  <Textarea
                    rows={3}
                    value={regenPrompt}
                    onChange={(e) => setRegenPrompt(e.target.value)}
                    placeholder="Optional: angle for this day (defaults to saved brief)"
                    className="text-sm"
                    disabled={!!regeneratingPostId}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={regenTone}
                      onChange={(e) => setRegenTone(e.target.value)}
                      placeholder="Tone (optional)"
                      disabled={!!regeneratingPostId}
                    />
                    <Input
                      value={regenCta}
                      onChange={(e) => setRegenCta(e.target.value)}
                      placeholder="CTA (optional)"
                      disabled={!!regeneratingPostId}
                    />
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={regenCaption}
                        onCheckedChange={(v) => setRegenCaption(!!v)}
                        disabled={!!regeneratingPostId}
                      />
                      New caption
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox
                        checked={regenImage}
                        onCheckedChange={(v) => setRegenImage(!!v)}
                        disabled={!!regeneratingPostId}
                      />
                      New image
                    </label>
                  </div>
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => void handleRegeneratePost()}
                    disabled={regeneratingPostId === selectedPost.id}
                  >
                    {regeneratingPostId === selectedPost.id ? (
                      <>
                        <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" /> Regenerating…
                      </>
                    ) : (
                      <>
                        <RotateCcw className="mr-1.5 h-4 w-4" /> Regenerate
                      </>
                    )}
                  </Button>
                </div>

                <Badge variant="secondary" className="capitalize">
                  {selectedPost.status.replace("_", " ")}
                </Badge>
              </div>

              <SheetFooter className="flex-col gap-2 sm:flex-col">
                <Button className="w-full" onClick={() => void savePostEdits()} disabled={savingPost || loadingPost}>
                  {savingPost ? (
                    <>
                      <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-4 w-4" /> Save changes
                    </>
                  )}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    router.push(`/dashboard/content-studio/generate?draftId=${selectedPost.id}`);
                    setSelectedPost(null);
                  }}
                >
                  <Pencil className="mr-1.5 h-4 w-4" /> Open in AI Studio
                </Button>
                <Button variant="ghost" className="w-full" asChild>
                  <Link href={`/dashboard/posts/${selectedPost.id}`}>Full post details</Link>
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={!!deletingPostId || loadingPost}
                  onClick={() => setPostToDelete(selectedPost)}
                >
                  {deletingPostId === selectedPost.id ? (
                    <>
                      <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" /> Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-1.5 h-4 w-4" /> Delete post
                    </>
                  )}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!postToDelete} onOpenChange={(o) => !o && setPostToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this planned post?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the post from your calendar and Posts list. Scheduled posts are unscheduled
              first. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDeletePost()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!historyEntryToClear} onOpenChange={(o) => !o && setHistoryEntryToClear(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from history?</AlertDialogTitle>
            <AlertDialogDescription>
              This only clears the log on this browser. Calendar posts are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveHistoryEntry}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearAllHistoryOpen} onOpenChange={setClearAllHistoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all plan history?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes every run from this browser&apos;s history. Your scheduled posts stay as they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearAllHistory}>Clear all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!historyRunToDeletePosts}
        onOpenChange={(o) => !o && setHistoryRunToDeletePosts(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all posts from this plan run?</AlertDialogTitle>
            <AlertDialogDescription>
              Deletes up to {historyRunToDeletePosts ? postIdsFromHistoryEntry(historyRunToDeletePosts).length : 0}{" "}
              post(s) created in that run (draft/scheduled; published posts are archived then removed).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDeleteHistoryRunPosts()}
            >
              Delete posts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DayCard({
  bucket,
  index,
  onPostClick,
  onDeletePost,
  onGenerateDay,
  canGenerate,
  deletingPostId,
}: {
  bucket: DayBucket;
  index: number;
  onPostClick: (post: CalendarPost) => void;
  onDeletePost: (post: CalendarPost) => void;
  onGenerateDay: () => void;
  canGenerate: boolean;
  deletingPostId: string | null;
}) {
  const empty = bucket.posts.length === 0;

  return (
    <div
      className={cn(
        "flex min-h-[168px] flex-col rounded-xl border p-3",
        empty ? "border-dashed border-border bg-muted/15" : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Day {index + 1}
          </p>
          <p className="text-sm font-semibold">
            {bucket.weekday}, {bucket.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
        </div>
        {!empty && (
          <Badge variant="secondary" className="text-[10px]">
            {bucket.posts.length}
          </Badge>
        )}
      </div>

      {empty ? (
        <div className="mt-auto pt-4">
          <p className="text-xs text-muted-foreground">No post scheduled</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 w-full text-xs"
            disabled={!canGenerate}
            onClick={onGenerateDay}
          >
            <Calendar className="mr-1 h-3.5 w-3.5" />
            Generate this day
          </Button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {bucket.posts.map((post) => {
            const platform = post.platforms[0] ?? "instagram";
            return (
              <div
                key={post.id}
                className="relative rounded-lg border border-border/80 bg-background transition hover:border-primary/50 hover:bg-muted/30"
              >
                <button
                  type="button"
                  onClick={() => onPostClick(post)}
                  className="w-full p-2.5 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <PlatformIcon platform={platform} size="sm" />
                    <span className="text-[11px] font-medium">{PLATFORM_LABELS[platform]}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {post.captionPreview || post.title}
                  </p>
                  <p className="mt-1.5 text-[10px] font-medium text-primary">Edit · Regenerate</p>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  disabled={deletingPostId === post.id}
                  aria-label="Delete post"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePost(post);
                  }}
                >
                  {deletingPostId === post.id ? (
                    <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
