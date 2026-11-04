"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { plannerApi } from "@/api/endpoints/planner.api";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import socialMediaApi from "@/api/endpoints/social-media.api";
import PlannerConflictDialog from "./PlannerConflictDialog";
import { PlannerArtwork } from "./PlannerPostPreview";
import type { ConflictAcknowledgment, ImageAction, PlannerRun, PlannerWarnings, RunItem, ScheduleOutcome, SchedulePreview, ScheduleResult, SlotEdit } from "@/types/planner";
import type { PlannerDateGroup } from "./planner-groups";
import PlannerDateReview from "./PlannerDateReview";
import PlannerGenerationProgress from "./PlannerGenerationProgress";
import PlannerImageGenerationProgress from "./PlannerImageGenerationProgress";
import PlannerRunReviewSkeleton from "./PlannerRunReviewSkeleton";
import { firstIncompleteGroupIndex, groupAllCopyApproved, groupIsGeneratingImages, groupIsWritingCopy, groupItemsPendingImage, groupPhase, groupReadyToSchedule, groupRunItemsByDate, groupStatusLabel, itemIsWritingCopy, runAllCopyApproved, runImageBatchProgressWithPercent, runIsGeneratingImages, runIsGeneratingText, runItemsPendingImage, runTextGenerationProgress } from "./planner-groups";
import { conflictSlot, displayTime, mergePolledRun, plannerError, plannerPath, runNeedsPolling, slotReasonLabel, warningAcknowledgments } from "./planner-review";

type Confirmation = { title: string; description: string; label: string; action: () => Promise<unknown> };

export default function PlannerRunReview({ workspaceId, runId, canEdit, canPublish }: { workspaceId: string; runId: string; canEdit: boolean; canPublish: boolean }) {
  const [run, setRun] = useState<PlannerRun | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [groupIndex, setGroupIndex] = useState(0);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [schedulePreview, setSchedulePreview] = useState<SchedulePreview | null>(null);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [previewRequest, setPreviewRequest] = useState("");
  const [pollPaused, setPollPaused] = useState(false);
  const [pollVersion, setPollVersion] = useState(0);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<{ rows: (PlannerWarnings & { slotId?: string })[]; proceed: (consent: ConflictAcknowledgment[]) => void } | null>(null);
  const [direction, setDirection] = useState("");
  const directionRef = useRef(direction);
  directionRef.current = direction;
  const protectedIds = useRef(new Set<string>());
  const mounted = useRef(true);
  const mutation = useRef(false);
  const sequence = useRef(0);
  const imageAttempts = useRef(new Map<string, ImageAction>());
  const latest = useRef(run);
  latest.current = run;
  const editorGuard = useRef<((action: () => void) => void) | null>(null);
  const registerEditorGuard = useCallback((guard: ((action: () => void) => void) | null) => { editorGuard.current = guard; }, []);

  useEffect(() => {
    if (!run) return;
    const groups = groupRunItemsByDate(run.items);
    if (!groups.length) return;
    setGroupIndex(firstIncompleteGroupIndex(groups));
  }, [run?.id]);

  useEffect(() => {
    if (!run || !activeItemId) return;
    const item = run.items.find((row) => row.id === activeItemId);
    if (item) setDirection(item.imageDirection ?? "");
  }, [run, activeItemId]);

  const load = useCallback(async (signal: AbortSignal) => {
    const request = ++sequence.current;
    if (mounted.current) setRefreshing(true);
    try {
      const value = await plannerApi.getRun(workspaceId, runId, signal);
      if (mounted.current && request === sequence.current) {
        setRun(current => mergePolledRun(current, value, protectedIds.current));
        if (!mutation.current) value.items.forEach(item => { const saved = latest.current?.items.find(row => row.id === item.id); if (saved && saved.revision === item.revision && saved.imageRequestId === item.imageRequestId && (!saved.imageUpdatedAt || !!item.imageUpdatedAt && item.imageUpdatedAt >= saved.imageUpdatedAt)) protectedIds.current.delete(item.id); });
        setFetchError("");
      }
      return true;
    } catch (err) { if (!signal.aborted && mounted.current && request === sequence.current) setFetchError(plannerError(err)); return false; }
    finally { if (mounted.current && request === sequence.current) setRefreshing(false); }
  }, [workspaceId, runId]);

  useEffect(() => {
    let active = true;
    void socialMediaApi.listAccounts(workspaceId).then(rows => { if (active) setAccountNames(Object.fromEntries(rows.map(row => [row.id, row.accountName]))); }).catch(() => undefined);
    return () => { active = false; };
  }, [workspaceId]);

  useEffect(() => {
    const reconnect = () => { if (document.visibilityState !== "hidden") { setPollPaused(false); setPollVersion(value => value + 1); } };
    window.addEventListener("online", reconnect);
    document.addEventListener("visibilitychange", reconnect);
    return () => { window.removeEventListener("online", reconnect); document.removeEventListener("visibilitychange", reconnect); };
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    let polls = 0;
    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "hidden") {
        const success = await load(controller.signal);
        failures = success ? 0 : failures + 1;
        polls++;
      }
      if (cancelled) return;
      if (failures >= 4 || polls >= 120) { setPollPaused(true); return; }
      timer = setTimeout(() => {
        if (!latest.current || mutation.current || runNeedsPolling(latest.current) || failures) void tick();
      }, failures || latest.current?.items.some(item => item.scheduleState === "uncertain") ? 30_000 : 3_000);
    };
    void tick();
    return () => { cancelled = true; mounted.current = false; controller.abort(); clearTimeout(timer); sequence.current++; };
  }, [load, pollVersion]);

  const act = async (action: () => Promise<unknown>, invalidatePreview = true): Promise<boolean> => {
    if (mutation.current) return false;
    mutation.current = true;
    sequence.current++;
    setBusy(true);
    setActionError("");
    setPollVersion(value => value + 1);
    if (invalidatePreview) setSchedulePreview(null);
    let success = false;
    try { await action(); success = true; }
    catch (err) { if (mounted.current) setActionError(plannerError(err)); }
    finally {
      mutation.current = false;
      sequence.current++;
      protectedIds.current.clear();
      if (mounted.current) { setBusy(false); setPollVersion(value => value + 1); }
    }
    return success;
  };
  const update = async (request: Promise<RunItem>, preserveImageProgress = false) => {
    const value = await request;
    if (mounted.current) {
      sequence.current++;
      protectedIds.current.add(value.id);
      setRun(previous => previous ? { ...previous, items: previous.items.map(row => row.id === value.id ? preserveImageProgress && row.revision === value.revision && row.imageRequestId === value.imageRequestId && row.imageUpdatedAt && value.imageUpdatedAt && row.imageUpdatedAt > value.imageUpdatedAt ? row : value : row) } : previous);
      if (value.error) setActionError(value.error);
    }
    return value;
  };
  const ask = (value: Confirmation) => setConfirmation(value);
  const regenerateText = async (item: RunItem) => {
    protectedIds.current.add(item.id);
    setRun(previous => previous ? { ...previous, items: previous.items.map(row => row.id === item.id ? { ...row, textState: "processing" } : row) } : previous);
    try {
      return await update(plannerApi.regenerateText(workspaceId, runId, item.id, { expectedRevision: item.revision!, requestId: crypto.randomUUID() }));
    } catch (err) {
      protectedIds.current.delete(item.id);
      if (mounted.current) setRun(previous => previous ? { ...previous, items: previous.items.map(row => row.id === item.id ? { ...row, textState: "uncertain" } : row) } : previous);
      throw err;
    }
  };
  const startImageRequest = async (item: RunItem, mode: ImageAction["mode"], options?: { creditsConfirmed?: boolean }) => {
    if (!item.revision) return;
    const key = `${item.id}/${item.revision}/${mode}/${mode === "retry" ? item.imageRequestId ?? "" : "new"}`;
    let payload = imageAttempts.current.get(key);
    if (!payload) {
      payload = {
        expectedRevision: item.revision,
        requestId: mode === "retry" ? item.imageRequestId ?? "" : crypto.randomUUID(),
        mode,
        creditsConfirmed: options?.creditsConfirmed ?? mode === "regenerate",
      };
      imageAttempts.current.set(key, payload);
    }
    if (!payload.requestId) {
      setActionError("Refresh the run to recover the image request ID before retrying. Do not start a new paid generation.");
      return;
    }
    const request = payload;
    if (mode !== "retry" && request.imageDirection === undefined) request.imageDirection = directionRef.current;
    protectedIds.current.add(item.id);
    setRun((previous) =>
      previous
        ? {
            ...previous,
            items: previous.items.map((row) =>
              row.id === item.id ? { ...row, visualState: "processing", imageStage: "queued", imageRequestId: request.requestId } : row,
            ),
          }
        : previous,
    );
    try {
      const value = await update(plannerApi.image(workspaceId, runId, item.id, request), true);
      if (value.visualState === "ready" || value.imageOperationId) imageAttempts.current.delete(key);
    } catch (err) {
      protectedIds.current.delete(item.id);
      throw new Error(
        `${plannerError(err)} The start response is uncertain. Refresh status or retry the same request; do not request new artwork until reconciled.`,
      );
    }
  };

  const image = (item: RunItem, mode: ImageAction["mode"]) => {
    if (!item.revision) return;
    ask({
      title: mode === "retry" ? "Retry image generation?" : mode === "regenerate" ? "Replace with a new image?" : "Generate image?",
      description:
        mode === "retry"
          ? "Uses your saved attempt and the same request ID. No new image credit if checkpoints can be reused."
          : mode === "regenerate"
            ? "Starts fresh artwork and may use another image credit. Your current image stays until the new one succeeds."
            : "Creates one hero image for this date, resized for each channel. Uses image allowance; does not schedule or publish.",
      label: mode === "retry" ? "Retry" : mode === "regenerate" ? "Confirm and generate" : "Generate",
      action: async () => startImageRequest(item, mode),
    });
  };

  const startImagesForDateGroup = (group: PlannerDateGroup, title: string) => {
    const pending = groupItemsPendingImage(group);
    if (!pending.length) return;
    const lead = pending[0];
    const channelCount = group.items.filter((item) => item.copyApproved && item.imageIntent !== "text_only").length;
    const needsRegenerate = group.items.some((item) => item.post?.imageUrl || item.imageOperationId);
    ask({
      title,
      description: `One hero image for this date, resized for ${channelCount} channel${channelCount === 1 ? "" : "s"}. Uses one image generation.`,
      label: "Generate image",
      action: async () => {
        await startImageRequest(
          lead,
          needsRegenerate ? "regenerate" : "generate",
          needsRegenerate ? { creditsConfirmed: true } : undefined,
        );
      },
    });
  };

  const promptGenerateAllForGroup = (group: PlannerDateGroup) => {
    startImagesForDateGroup(group, `Generate image for ${group.date}?`);
  };

  const promptGenerateAllForRun = () => {
    const current = latest.current ?? run!;
    const groups = groupRunItemsByDate(current.items);
    const dates = groups.filter((group) => groupItemsPendingImage(group).length);
    if (!dates.length) return;
    ask({
      title: "Generate images for this plan?",
      description: `One hero image per posting day (${dates.length} day${dates.length === 1 ? "" : "s"}), resized per channel.`,
      label: "Generate all",
      action: async () => {
        for (const group of dates) {
          const pending = groupItemsPendingImage(group);
          if (!pending.length) continue;
          const needsRegenerate = group.items.some((item) => item.post?.imageUrl || item.imageOperationId);
          await startImageRequest(
            pending[0],
            needsRegenerate ? "regenerate" : "generate",
            needsRegenerate ? { creditsConfirmed: true } : undefined,
          );
        }
      },
    });
  };
  const editSlot = (item: RunItem, payload: SlotEdit): Promise<boolean> => act(async () => {
    try { await update(plannerApi.editSlot(workspaceId, runId, item.id, payload)); }
    catch (err) {
      const slot = conflictSlot(err);
      if (!slot) throw err;
      setConflicts({ rows: [slot], proceed: consent => { void editSlot(item, { ...payload, conflictAcknowledgments: consent }); } });
      throw new Error("Review the other posts at this time before saving the proposed time.");
    }
  });
  const openSchedule = async (itemIds?: string[]) => {
    const ids = itemIds ?? run?.items.filter((item) => item.canSchedule && !item.isScheduled).map((item) => item.id) ?? [];
    if (!ids.length || editorDirty) return;
    await act(async () => {
      const value = await plannerApi.previewSchedule(workspaceId, runId, [...ids]);
      if (mounted.current) { setSchedulePreview(value); setPreviewRequest(crypto.randomUUID()); }
    });
  };
  const confirmSchedule = async (consent?: ConflictAcknowledgment[]) => {
    if (!schedulePreview || !canPublish || editorDirty) return;
    const warnings = schedulePreview.items.filter(item => item.warnings?.length);
    if (!consent && warnings.length) { setConflicts({ rows: warnings, proceed: acknowledged => { void confirmSchedule(acknowledged); } }); return; }
    const previewId = schedulePreview.previewId;
    await act(async () => {
      const value = await plannerApi.confirmSchedule(workspaceId, runId, { previewId, requestId: previewRequest, confirm: true, ...(consent?.length ? { conflictAcknowledgments: consent } : {}) });
      if (mounted.current) { setScheduleResult(value); setSchedulePreview(null); }
    }, false);
  };
  const retryDispatch = (itemIds: string[]) => ask({ title: "Retry confirmed scheduling dispatch?", description: "Retries delivery only for previously confirmed schedules. This does not regenerate text or images, or create a new post.", label: "Retry dispatch", action: async () => { const value = await plannerApi.retrySchedule(workspaceId, runId, { requestId: crypto.randomUUID(), itemIds }); if (mounted.current) setScheduleResult(value); } });
  const textOnly = (item: RunItem) => ask({ title: "Use text only?", description: "Removes the image requirement and attachment for this draft. Nothing is scheduled.", label: "Use text only", action: () => update(plannerApi.imageIntent(workspaceId, runId, item.id, { expectedRevision: item.revision!, intent: "text_only" })) });

  const guarded = (action: () => void) => {
    if (editorGuard.current) editorGuard.current(action);
    else action();
  };

  if (!run) return fetchError ? (
    <div className="space-y-4">
      <Link href={plannerPath} className="inline-flex min-h-11 items-center text-sm text-primary">← Content planner</Link>
      <div role="alert" className="rounded-lg border p-6"><p>{fetchError}</p><Button className="mt-4 min-h-11" onClick={() => { setPollPaused(false); setPollVersion(value => value + 1); }}>Retry</Button></div>
    </div>
  ) : (
    <PlannerRunReviewSkeleton />
  );

  const groups = groupRunItemsByDate(run.items);
  const textProgress = runTextGenerationProgress(run);
  const generatingText = runIsGeneratingText(run);
  const safeGroupIndex = groups.length ? Math.min(groupIndex, groups.length - 1) : 0;
  const currentGroup = groups[safeGroupIndex];
  const runImageProgress = runImageBatchProgressWithPercent(run);
  const generatingImages = runIsGeneratingImages(run);
  const allCopyApproved = runAllCopyApproved(run);
  const planPendingImages = runItemsPendingImage(run);
  const groupGeneratingImages = currentGroup ? groupIsGeneratingImages(currentGroup) : false;
  const groupPendingImages = currentGroup ? groupItemsPendingImage(currentGroup) : [];
  const activeItem =
    currentGroup?.items.find((item) => item.id === activeItemId) ??
    currentGroup?.items.find((item) => itemIsWritingCopy(item)) ??
    currentGroup?.items.find((item) => !item.copyApproved && !!item.post) ??
    currentGroup?.items.find((item) => item.imageIntent !== "text_only" && item.visualState !== "ready") ??
    currentGroup?.items[0];
  const activeItemIndex = currentGroup ? Math.max(0, currentGroup.items.findIndex((item) => item.id === activeItem?.id)) : 0;
  const failedIds = run.items.filter(item => ["failed", "pending", "checkpointed"].includes(item.generationState)).map(item => item.id);
  const pendingIds = run.items.filter(item => item.isScheduled && item.scheduleState !== "accepted").map(item => item.id);
  const running = ["queued", "running", "recovering"].includes(run.status) || (run.status === "partial" && generatingText);
  const scheduleBlocked = schedulePreview?.items.some(item => !["ready", "already_scheduled", "scheduled"].includes(item.outcome));
  const schedulableIds = run.items.filter((item) => item.canSchedule && !item.isScheduled).map((item) => item.id);
  const allReady = groups.length > 0 && groups.every((group) => groupReadyToSchedule(group));
  const phase = currentGroup ? groupPhase(currentGroup) : "text";
  const dayComplete = currentGroup ? phase === "done" && groupReadyToSchedule(currentGroup) && !groupIsWritingCopy(currentGroup) : false;

  const goToGroup = (index: number) => guarded(() => {
    setGroupIndex(index);
    setActiveItemId(null);
    setActionError("");
  });

  const maybePromptImagesForGroup = (groupKey: string) => {
    if (!mounted.current || !latest.current) return;
    const fresh = groupRunItemsByDate(latest.current.items).find((group) => group.key === groupKey);
    if (fresh && groupAllCopyApproved(fresh) && groupItemsPendingImage(fresh).length) promptGenerateAllForGroup(fresh);
  };

  const approveItem = (item: RunItem) => {
    if (!currentGroup) return;
    const groupKey = currentGroup.key;
    void act(async () => {
      await update(plannerApi.approveCopy(workspaceId, runId, item.id, { expectedRevision: item.revision! }));
    }).then((success) => {
      if (success) maybePromptImagesForGroup(groupKey);
    });
  };
  const approveAllInGroup = () => {
    if (!currentGroup) return;
    const groupKey = currentGroup.key;
    void act(async () => {
      for (const item of currentGroup.items) {
        if (!item.copyApproved && item.revision) {
          await update(plannerApi.approveCopy(workspaceId, runId, item.id, { expectedRevision: item.revision }));
        }
      }
    }).then((success) => {
      if (success) maybePromptImagesForGroup(groupKey);
    });
  };

  return <div className="mx-auto max-w-5xl space-y-6 pb-24" aria-busy={generatingText || generatingImages || busy}>
    <header className="space-y-3">
      <Link href={plannerPath} className="inline-flex min-h-11 items-center text-sm text-primary">← Content planner</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Approve your plan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {generatingText
              ? `Generating posts · ${textProgress.saved} of ${textProgress.total} saved · ${run.timezone}`
              : `${groups.length} posting ${groups.length === 1 ? "day" : "days"} · ${run.timezone} · ${run.status === "completed" ? "Ready to review" : run.status.replaceAll("_", " ")}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-11" disabled={busy || refreshing} onClick={() => { setPollPaused(false); setPollVersion((value) => value + 1); }}>
            {refreshing ? <><Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" aria-hidden />Syncing…</> : "Refresh"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" className="min-h-11" aria-label="More run actions">More</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && running && <DropdownMenuItem disabled={busy} onSelect={() => ask({ title: "Cancel remaining text generation?", description: "Saved drafts are kept. In-flight requests may still finish.", label: "Cancel generation", action: async () => { const value = await plannerApi.cancelRun(workspaceId, runId); if (mounted.current) setRun(value); } })}>Cancel generation</DropdownMenuItem>}
              {canEdit && !running && !!failedIds.length && <DropdownMenuItem disabled={busy} onSelect={() => ask({ title: "Retry failed slots?", description: "Only missing or failed slots are regenerated.", label: "Retry missing text", action: async () => { const value = await plannerApi.retryRun(workspaceId, runId, failedIds); if (mounted.current) setRun(value); } })}>Retry {failedIds.length} missing slots</DropdownMenuItem>}
              {canPublish && !!pendingIds.length && <DropdownMenuItem disabled={busy} onSelect={() => retryDispatch(pendingIds)}>Retry pending dispatch</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <p className="break-words text-sm text-muted-foreground">{run.prompt}</p>
    </header>
    {busy && (
      <p role="status" className="flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
        <Loader2 className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
        Saving your changes…
      </p>
    )}
    {(fetchError || actionError) && <div role="alert" className="space-y-2 rounded-lg border border-destructive p-4 text-sm text-destructive">{fetchError && <p>{fetchError}</p>}{actionError && <p>{actionError}</p>}</div>}
    {pollPaused && <p role="status" className="text-sm text-muted-foreground">Live updates paused. Tap Refresh.</p>}
    {generatingText && <PlannerGenerationProgress progress={textProgress} runStatus={run.status} />}
    {!generatingText && generatingImages && (
      <PlannerImageGenerationProgress progress={runImageProgress} />
    )}
    {!generatingText && !generatingImages && allCopyApproved && planPendingImages.length > 0 && canEdit && (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
        <p className="text-sm text-muted-foreground">Copy is approved. Add one image per posting day (resized per channel).</p>
        <Button className="min-h-11" disabled={busy || editorDirty} onClick={() => promptGenerateAllForRun()}>
          Generate images
        </Button>
      </div>
    )}
    {run.cancelled && <p role="status" className="rounded-lg border p-4 text-sm">Generation was cancelled. Saved drafts can still be reviewed.</p>}

    {groups.length > 0 && (
      <nav aria-label="Posting dates" className="flex gap-2 overflow-x-auto pb-1">
        {groups.map((group, index) => {
          const selected = index === safeGroupIndex;
          return (
            <button
              key={group.key}
              type="button"
              disabled={editorDirty && !selected}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                editorDirty && !selected && "opacity-50",
              )}
              onClick={() => goToGroup(index)}
            >
              <span className="block font-medium">{group.date}</span>
              <span className="text-xs text-muted-foreground">{groupStatusLabel(group)}</span>
            </button>
          );
        })}
      </nav>
    )}

    {!groups.length && !generatingText && <p className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">No drafts in this run yet.</p>}

    {currentGroup && activeItem && (
      <PlannerDateReview
        group={currentGroup}
        groupIndex={safeGroupIndex}
        groupCount={groups.length}
        activeItem={activeItem}
        activeItemIndex={activeItemIndex}
        accountName={accountNames[activeItem.slot.accountId ?? ""] ?? "Connected account"}
        workspaceId={workspaceId}
        canEdit={canEdit}
        busy={busy}
        error={actionError}
        dirty={editorDirty}
        imageDirection={direction}
        onImageDirectionChange={setDirection}
        onActiveItem={(itemId) => guarded(() => setActiveItemId(itemId))}
        onSave={async (payload) => act(async () => { await update(plannerApi.editCopy(workspaceId, runId, activeItem.id, payload)); })}
        onSlot={(payload) => editSlot(activeItem, payload)}
        onApproveItem={() => approveItem(activeItem)}
        onApproveAll={() => approveAllInGroup()}
        onRegenerateText={() => ask({ title: "Regenerate text?", description: "Uses text allowance for this channel. You will need to approve again.", label: "Regenerate", action: () => regenerateText(activeItem) })}
        onGenerateAllImages={() => currentGroup && promptGenerateAllForGroup(currentGroup)}
        groupGeneratingImages={groupGeneratingImages}
        groupPendingImageCount={groupPendingImages.length}
        onGenerate={() => image(activeItem, activeItem.imageOperationId || activeItem.post?.imageUrl ? "regenerate" : "generate")}
        onRetryImage={activeItem.imageOperationId && activeItem.imageRetryable && activeItem.visualState === "failed" ? () => image(activeItem, "retry") : undefined}
        onTextOnly={() => textOnly(activeItem)}
        onAttach={(assetId) => act(() => update(plannerApi.attachImage(workspaceId, runId, activeItem.id, { expectedRevision: activeItem.revision!, assetId })))}
        onNavigationGuard={registerEditorGuard}
        onDirtyChange={setEditorDirty}
      />
    )}

    {groups.length > 0 && (
      <footer className="mobile-action-bar flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4">
        <Button variant="outline" className="min-h-11" disabled={busy || editorDirty || safeGroupIndex <= 0} onClick={() => goToGroup(safeGroupIndex - 1)}>
          Previous day
        </Button>
        {safeGroupIndex < groups.length - 1 ? (
          <Button className="min-h-11" disabled={busy || editorDirty || !dayComplete} onClick={() => goToGroup(safeGroupIndex + 1)}>
            Next day
          </Button>
        ) : allReady && schedulableIds.length > 0 ? (
          <Button className="min-h-11" disabled={busy || editorDirty || !canPublish} onClick={() => void openSchedule(schedulableIds)}>
            Confirm schedule ({schedulableIds.length})
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Finish text and images for each day, then confirm schedule.</p>
        )}
      </footer>
    )}

    {!canPublish && allReady && <p className="text-sm text-muted-foreground">A publisher or admin must confirm the schedule after you finish review.</p>}
    {scheduleResult && <section aria-labelledby="schedule-results" className="space-y-3 rounded-xl border p-4"><h2 id="schedule-results" className="text-lg font-semibold">Scheduling outcomes</h2><ScheduleRows rows={scheduleResult.items} items={run.items} accountNames={accountNames} /><Link href="/dashboard/calendar" className="inline-flex min-h-11 items-center text-sm text-primary">View calendar →</Link></section>}
    <Dialog open={!!confirmation} onOpenChange={open => { if (!open && !busy) setConfirmation(null); }}><DialogContent><DialogHeader><DialogTitle>{confirmation?.title}</DialogTitle><DialogDescription>{confirmation?.description}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" className="min-h-11" onClick={() => setConfirmation(null)}>Cancel</Button><Button className="min-h-11" onClick={() => { const action = confirmation?.action; setConfirmation(null); if (action) void act(action); }}>{confirmation?.label}</Button></DialogFooter></DialogContent></Dialog>
    <PlannerConflictDialog rows={conflicts?.rows ?? null} onChangeTime={() => { setConflicts(null); setSchedulePreview(null); }} onContinue={() => { const current = conflicts; setConflicts(null); current?.proceed(warningAcknowledgments(current.rows)); }} />
    <Dialog open={!!schedulePreview && !conflicts} onOpenChange={open => { if (!open && !busy) setSchedulePreview(null); }}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Confirm schedule</DialogTitle><DialogDescription>These posts will be scheduled for their proposed times. Nothing publishes immediately.</DialogDescription></DialogHeader>{schedulePreview && <><ScheduleRows rows={schedulePreview.items} items={run.items} accountNames={accountNames} /><p className="text-xs text-muted-foreground">Valid until {displayTime(schedulePreview.expiresAt, run.timezone)} · {run.timezone}</p>{scheduleBlocked && <p role="alert" className="text-sm text-destructive">Fix blocked items before confirming.</p>}</>}{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}<DialogFooter><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setSchedulePreview(null)}>Back</Button><Button className="min-h-11" disabled={busy || !canPublish || !schedulePreview?.items.length || scheduleBlocked} onClick={() => void confirmSchedule()}>Confirm schedule</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function ScheduleRows({ rows, items = [], accountNames = {} }: { rows: ScheduleOutcome[]; items?: RunItem[]; accountNames?: Record<string, string> }) {
  return <ul className="space-y-3">{rows.map(row => { const item = items.find(value => value.id === row.itemId); return <li key={row.itemId} className="flex gap-3 rounded-lg border p-3 text-sm">{item && <PlannerArtwork item={item} thumbnail />}<div className="min-w-0 space-y-2"><p className="font-medium capitalize">{row.platform} · {row.outcome.replaceAll("_", " ")}</p><p className="break-words">{accountNames[row.accountId ?? ""] ?? "Connected account"} · {displayTime(row.proposedAt, row.timezone)} · {row.timezone}</p>{!!row.reasons.length && <p className="break-words text-destructive">{row.reasons.map(slotReasonLabel).join(" · ")}</p>}{!!row.warnings?.length && <p className="text-muted-foreground">Other posts share this time. Confirmation will ask for your consent.</p>}</div></li>; })}</ul>;
}