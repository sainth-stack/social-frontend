"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { plannerApi } from "@/api/endpoints/planner.api";
import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/ui/form-select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import socialMediaApi from "@/api/endpoints/social-media.api";
import type { ConflictAcknowledgment, ImageAction, PlannerRun, PlannerWarnings, RunItem, ScheduleOutcome, SchedulePreview, ScheduleResult, SlotEdit } from "@/types/planner";
import PlannerItemEditor from "./PlannerItemEditor";
import { conflictSlot, displayTime, imageStageLabel, itemBusy, itemLabel, mergePolledRun, plannerError, plannerPath, runNeedsPolling, savedCopy, slotReasonLabel, warningAcknowledgments } from "./planner-review";
import PlannerConflictDialog from "./PlannerConflictDialog";
import { PlannerArtwork } from "./PlannerPostPreview";

type Confirmation = { title: string; description: string; label: string; action: () => Promise<unknown>; image?: boolean };

export default function PlannerRunReview({ workspaceId, runId, canEdit, canPublish }: { workspaceId: string; runId: string; canEdit: boolean; canPublish: boolean }) {
  const [run, setRun] = useState<PlannerRun | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [schedulePreview, setSchedulePreview] = useState<SchedulePreview | null>(null);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
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
  const image = (item: RunItem, mode: ImageAction["mode"]) => {
    if (!item.revision) return;
    const key = `${item.id}/${item.revision}/${mode}/${mode === "retry" ? item.imageRequestId ?? "" : "new"}`;
    setDirection(item.imageDirection ?? "");
    let payload = imageAttempts.current.get(key);
    if (!payload) {
      payload = { expectedRevision: item.revision, requestId: mode === "retry" ? item.imageRequestId ?? "" : crypto.randomUUID(), mode, creditsConfirmed: mode === "regenerate" };
      imageAttempts.current.set(key, payload);
    }
    if (!payload.requestId) { setActionError("Refresh the run to recover the image request ID before retrying. Do not start a new paid generation."); return; }
    const request = payload;
    ask({ title: mode === "retry" ? "Retry this image operation?" : mode === "regenerate" ? "Generate new artwork?" : "Generate an image?", description: mode === "retry" ? "Reuses the current request ID and saved creative checkpoints. An uncertain attempt without saved artwork cannot be automatically repeated." : mode === "regenerate" ? "This intentionally starts new artwork and may consume another image credit. The current attachment is replaced only after success." : "Uses image allowance separately from text. It does not schedule or publish. Review the artwork after generation.", label: mode === "retry" ? "Retry existing image" : mode === "regenerate" ? "Confirm new artwork credits" : "Generate image", image: mode !== "retry", action: async () => {
      if (mode !== "retry" && request.imageDirection === undefined) request.imageDirection = directionRef.current;
      protectedIds.current.add(item.id);
      setRun(previous => previous ? { ...previous, items: previous.items.map(row => row.id === item.id ? { ...row, visualState: "processing", imageStage: "queued", imageRequestId: request.requestId } : row) } : previous);
      try {
        const value = await update(plannerApi.image(workspaceId, runId, item.id, request), true);
        if (value.visualState === "ready" || value.imageOperationId) imageAttempts.current.delete(key);
      } catch (err) {
        protectedIds.current.delete(item.id);
        throw new Error(`${plannerError(err)} The start response is uncertain. Refresh status or retry the same request; do not request new artwork until reconciled.`);
      }
    } });
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
  const openSchedule = async (itemIds = selected) => {
    if (!itemIds.length) return;
    await act(async () => {
      const value = await plannerApi.previewSchedule(workspaceId, runId, [...itemIds]);
      if (mounted.current) { setSchedulePreview(value); setPreviewRequest(crypto.randomUUID()); }
    });
  };
  const confirmSchedule = async (consent?: ConflictAcknowledgment[]) => {
    if (!schedulePreview || !canPublish) return;
    const warnings = schedulePreview.items.filter(item => item.warnings?.length);
    if (!consent && warnings.length) { setConflicts({ rows: warnings, proceed: acknowledged => { void confirmSchedule(acknowledged); } }); return; }
    const previewId = schedulePreview.previewId;
    await act(async () => {
      const value = await plannerApi.confirmSchedule(workspaceId, runId, { previewId, requestId: previewRequest, confirm: true, ...(consent?.length ? { conflictAcknowledgments: consent } : {}) });
      if (mounted.current) { setScheduleResult(value); setSchedulePreview(null); if (!value.items.some(row => row.outcome === "blocked")) setSelected([]); }
    }, false);
  };
  const retryDispatch = (itemIds: string[]) => ask({ title: "Retry confirmed scheduling dispatch?", description: "Retries delivery only for previously confirmed schedules. This does not regenerate text or images, or create a new post.", label: "Retry dispatch", action: async () => { const value = await plannerApi.retrySchedule(workspaceId, runId, { requestId: crypto.randomUUID(), itemIds }); if (mounted.current) setScheduleResult(value); } });

  if (!run) return <div className="space-y-4"><Link href={plannerPath} className="inline-flex min-h-11 items-center text-sm text-primary">← Planner setup and history</Link>{fetchError ? <div role="alert" className="rounded-lg border p-6"><p>{fetchError}</p><Button className="mt-4 min-h-11" onClick={() => { setPollPaused(false); setPollVersion(value => value + 1); }}>Retry saved run</Button></div> : <div role="status" className="animate-pulse space-y-4 rounded-xl bg-muted p-8"><h1 className="text-xl font-semibold">Loading saved plan…</h1><div className="h-20 rounded bg-background" /><div className="h-20 rounded bg-background" /></div>}</div>;

  const editorItems = run.items.filter(item => item.generationState !== "excluded");
  const editorIndex = editorItems.findIndex(item => item.id === editorId);
  const editor = editorItems[editorIndex];
  const failedIds = run.items.filter(item => ["failed", "pending", "checkpointed"].includes(item.generationState)).map(item => item.id);
  const pendingIds = run.items.filter(item => item.isScheduled && item.scheduleState !== "accepted").map(item => item.id);
  const visible = run.items.filter(item => filter === "all" || (filter === "needs_review" && !!item.post && !item.copyApproved) || (filter === "approved" && item.copyApproved) || (filter === "image_needed" && item.imageIntent === "required" && item.visualState !== "ready") || (filter === "ready" && item.canSchedule && !item.isScheduled) || (filter === "scheduled" && item.isScheduled)).sort((a, b) => a.slot.date.localeCompare(b.slot.date));
  const running = ["queued", "running", "recovering"].includes(run.status);
  const scheduleBlocked = schedulePreview?.items.some(item => !["ready", "already_scheduled", "scheduled"].includes(item.outcome));

  return <div className="mx-auto max-w-6xl space-y-6 pb-6">
    <header className="space-y-3"><Link href={plannerPath} className="inline-flex min-h-11 items-center text-sm text-primary">← Planner setup and history</Link><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-2xl font-semibold">Review your plan</h1><p className="mt-2 text-sm text-muted-foreground">{run.timezone} · <span className="capitalize">{run.status}</span> · {run.items.filter(item => item.post).length} / {run.items.filter(item => item.generationState !== "excluded").length} saved drafts</p></div><Button variant="outline" className="min-h-11" disabled={busy || refreshing} onClick={() => { setPollPaused(false); setPollVersion(value => value + 1); }}>{refreshing ? "Refreshing…" : "Refresh saved run"}</Button></div><p className="break-words text-sm text-muted-foreground">{run.prompt}</p></header>
    {(fetchError || actionError) && <div role="alert" className="space-y-2 rounded-lg border border-destructive p-4 text-sm text-destructive">{fetchError && <p>Refresh failed: {fetchError}. Previously loaded content is retained.</p>}{actionError && <p>{actionError}</p>}</div>}
    {pollPaused && <p role="status" className="text-sm text-muted-foreground">Automatic refresh paused. Use Refresh saved run to reconnect.</p>}
    {running && <div role="status" className="rounded-lg border bg-muted/30 p-4 text-sm">Text generation is {run.status}. Saved drafts appear below. You can leave and reopen this run; nothing is scheduled automatically.{run.dispatchState !== "accepted" && <p className="mt-2">Generation dispatch: {run.dispatchState}. This is not a publishing result.</p>}</div>}
    {run.cancelled && <p role="status" className="rounded-lg border p-4 text-sm">Generation cancelled. Already saved drafts remain reviewable. No successful drafts are regenerated by retrying missing slots.</p>}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[["Needs review", run.items.filter(item => item.post && !item.copyApproved).length], ["Approved", run.items.filter(item => item.copyApproved).length], ["Image needed", run.items.filter(item => item.imageIntent === "required" && item.visualState !== "ready").length], ["Ready", run.items.filter(item => item.canSchedule && !item.isScheduled).length], ["Scheduled", run.items.filter(item => item.isScheduled && item.scheduleState === "accepted").length]].map(([label, count]) => <div key={label} className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{count}</p></div>)}</div>
    <div className="flex flex-wrap items-end justify-between gap-3"><FormSelect label="Filter posts" value={filter} disabled={busy} className="w-full sm:w-56" onValueChange={setFilter} options={[["all", "All items"], ["needs_review", "Needs review"], ["approved", "Approved text"], ["image_needed", "Image needed"], ["ready", "Ready"], ["scheduled", "Scheduled"]].map(([value, label]) => ({ value, label }))} /><div className="flex flex-wrap gap-2">{canEdit && running && <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => ask({ title: "Cancel remaining text generation?", description: "Already saved drafts are kept. Any in-flight paid request may finish before cancellation takes effect.", label: "Cancel generation", action: async () => { const value = await plannerApi.cancelRun(workspaceId, runId); if (mounted.current) setRun(value); } })}>Cancel remaining generation</Button>}{canEdit && !running && !!failedIds.length && <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => ask({ title: "Retry failed or missing slots?", description: "Only failed, missing and checkpointed slots are requested. Saved drafts are not regenerated. New text attempts may use text allowance; uncertain paid attempts cannot be blindly replayed.", label: "Retry missing text", action: async () => { const value = await plannerApi.retryRun(workspaceId, runId, failedIds); if (mounted.current) setRun(value); } })}>Retry {failedIds.length} missing text slots</Button>}{canPublish && !!pendingIds.length && <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => retryDispatch(pendingIds)}>Retry {pendingIds.length} pending dispatches</Button>}</div></div>
    {!visible.length && <p className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">{run.items.length ? "No items match this filter." : "No draft items yet. The saved run will refresh while generation is queued."}</p>}
    <div className="space-y-4">{visible.map((item, index) => {
      const disabled = busy || itemBusy(item) || item.isScheduled || !canEdit || !item.revision;
      const needsImage = item.copyApproved && item.imageIntent !== "text_only" && item.visualState !== "ready";
      const name = accountNames[item.slot.accountId ?? ""] ?? item.slot.warnings?.[0]?.accountName ?? "Connected account";
      return <section key={item.id} className="space-y-3">{(index === 0 || visible[index - 1].slot.date !== item.slot.date) && <h2 className="text-sm font-semibold">{item.slot.date}</h2>}<Card><CardContent className="space-y-3 p-4 sm:p-5"><div className="flex gap-4"><PlannerArtwork item={item} thumbnail /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="flex items-center gap-2 font-semibold capitalize"><PlatformIcon platform={item.slot.platform} size="sm" />{item.slot.platform}</h3><p className="mt-1 break-words text-sm text-muted-foreground">{name} · {item.slot.time ?? "Choose a time"}</p></div><span role={itemBusy(item) ? "status" : undefined} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{itemBusy(item) ? imageStageLabel(item) || "Saving text…" : itemLabel(item)}</span></div><p className={`mt-3 whitespace-pre-wrap break-words text-sm ${expanded.includes(item.id) ? "" : "line-clamp-3"}`}>{savedCopy(item).caption || (item.generationState === "excluded" ? "Excluded during setup." : "Text is not yet available.")}</p>{item.post && <Button variant="link" className="min-h-11 px-0" aria-expanded={expanded.includes(item.id)} onClick={() => setExpanded(values => values.includes(item.id) ? values.filter(value => value !== item.id) : [...values, item.id])}>{expanded.includes(item.id) ? "Show less text" : "Expand text"}</Button>}</div></div>
        {item.error && <p role="alert" className="text-sm text-destructive">{item.error}</p>}{item.imageError && item.visualState === "failed" && <p role="alert" className="text-sm text-destructive">{item.imageError.message} · {item.imageError.stage}</p>}{!!item.reasons.length && !item.isScheduled && <p className="break-words text-xs text-muted-foreground">Next: {item.reasons.map(slotReasonLabel).join(" · ")}</p>}{item.textState === "uncertain" && <p className="text-sm text-destructive">Text attempt uncertain. Refresh before another paid attempt.</p>}{!!item.imageWarnings?.length && <p className="text-xs text-muted-foreground">Artwork may have low visibility. Inspect it before scheduling.</p>}
        <div className="flex flex-wrap items-center gap-2">
          {item.generationState !== "excluded" && <Button variant="outline" className="min-h-11" onClick={() => { setActionError(""); setEditorId(item.id); }}>View</Button>}
          {item.post && <>
            {!item.copyApproved ? <Button className="min-h-11" disabled={disabled} onClick={() => setEditorId(item.id)}>Review text</Button> : needsImage ? <Button className="min-h-11" disabled={disabled || !!item.imageOperationId && !item.imageRetryable && item.visualState !== "stale"} onClick={() => image(item, !item.imageOperationId ? "generate" : item.visualState === "stale" ? "regenerate" : "retry")}>{itemBusy(item) ? imageStageLabel(item) : item.imageRetryable ? "Retry image" : item.visualState === "stale" ? "Create matching artwork" : "Generate image"}</Button> : !item.isScheduled && <Button className="min-h-11" disabled={busy || !canEdit} onClick={() => { const values = selected.includes(item.id) ? selected : [...selected, item.id]; setSelected(values); void openSchedule(values); }}>Review schedule</Button>}
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="min-h-11" aria-label={`More actions for ${name}`}>More</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
              <DropdownMenuItem disabled={disabled || item.copyApproved} onSelect={() => void act(() => update(plannerApi.approveCopy(workspaceId, runId, item.id, { expectedRevision: item.revision! })))}>Approve text</DropdownMenuItem>
              <DropdownMenuItem disabled={disabled || item.textState === "uncertain"} onSelect={() => ask({ title: "Regenerate saved text?", description: "Uses text allowance and replaces the saved copy only after success. Text approval and image binding will be invalidated.", label: "Regenerate text", action: () => regenerateText(item) })}>Regenerate text</DropdownMenuItem>
              {!item.imageOperationId && item.imageIntent === "text_only" && <DropdownMenuItem disabled={disabled || !item.copyApproved} onSelect={() => image(item, "generate")}>Add an image</DropdownMenuItem>}
              {(item.imageOperationId || item.post.imageUrl) && <DropdownMenuItem disabled={disabled || !item.copyApproved} onSelect={() => image(item, "regenerate")}>Regenerate image</DropdownMenuItem>}
              {item.imageOperationId && item.imageRetryable && item.visualState === "failed" && <DropdownMenuItem disabled={disabled || !item.copyApproved} onSelect={() => image(item, "retry")}>Retry saved image operation</DropdownMenuItem>}
              {item.slot.platform !== "instagram" && <DropdownMenuItem disabled={disabled || item.imageIntent === "text_only"} onSelect={() => ask({ title: "Use text only?", description: "Removes the image requirement and attachment for this draft. Nothing is scheduled.", label: "Use text only", action: () => update(plannerApi.imageIntent(workspaceId, runId, item.id, { expectedRevision: item.revision!, intent: "text_only" })) })}>Use text only</DropdownMenuItem>}
            </DropdownMenuContent></DropdownMenu>
          </>}
        </div>
        {canEdit && item.post && !item.isScheduled && <div className="border-t pt-3"><label className="flex min-h-11 items-center gap-3 text-sm"><Checkbox className="size-5" checked={selected.includes(item.id)} disabled={busy || !!schedulePreview} aria-describedby={!item.canSchedule ? `schedule-unavailable-${item.id}` : undefined} onCheckedChange={checked => { setSelected(values => checked === true ? [...values, item.id] : values.filter(value => value !== item.id)); setScheduleResult(null); }} />Include in schedule</label>{!item.canSchedule && <p id={`schedule-unavailable-${item.id}`} className="pl-8 text-xs text-muted-foreground">Not ready to schedule. Resolve the review steps above before confirming.</p>}</div>}
      </CardContent></Card></section>;
    })}</div>
    {!canPublish && <p className="text-sm text-muted-foreground">{canEdit ? "Editor access: approve text, create images and preview selected schedules. A publisher or admin must confirm scheduling." : "Viewer access: saved plans are read-only. An editor can change content and a publisher can schedule."} Server permission and readiness checks remain authoritative.</p>}
    {scheduleResult && <section aria-labelledby="schedule-results" className="space-y-3 rounded-xl border p-4"><h2 id="schedule-results" className="text-lg font-semibold">Scheduling outcomes</h2><ScheduleRows rows={scheduleResult.items} items={run.items} accountNames={accountNames} /><p className="text-sm text-muted-foreground">Dispatch pending is not confirmed delivery. Fix blocked items and preview them again. Saved schedule states remain visible after reload.</p><Link href="/dashboard/calendar" className="inline-flex min-h-11 items-center text-sm text-primary">View calendar →</Link></section>}
    {canEdit && <div className="mobile-action-bar flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4"><p className="text-sm"><strong>{selected.length}</strong> explicitly selected · {run.items.filter(item => selected.includes(item.id) && item.canSchedule && !item.isScheduled).length} ready · {run.timezone}</p><Button className="min-h-11" disabled={busy || !selected.length} onClick={() => void openSchedule()}>Review selected schedule</Button></div>}
    {editor && <PlannerItemEditor key={editor.id} item={editor} canEdit={canEdit} busy={busy} error={actionError} index={editorIndex} total={editorItems.length} accountName={accountNames[editor.slot.accountId ?? ""]} workspaceId={workspaceId} onClose={() => setEditorId(null)} onMove={direction => setEditorId(editorItems[editorIndex + direction].id)} onSave={payload => act(() => update(plannerApi.editCopy(workspaceId, runId, editor.id, payload)))} onSlot={payload => editSlot(editor, payload)} onApprove={() => void act(() => update(plannerApi.approveCopy(workspaceId, runId, editor.id, { expectedRevision: editor.revision! })))} onAttach={assetId => act(() => update(plannerApi.attachImage(workspaceId, runId, editor.id, { expectedRevision: editor.revision!, assetId })))} />}
    <Dialog open={!!confirmation} onOpenChange={open => { if (!open && !busy) setConfirmation(null); }}><DialogContent><DialogHeader><DialogTitle>{confirmation?.title}</DialogTitle><DialogDescription>{confirmation?.description}</DialogDescription></DialogHeader>{confirmation?.image && <label className="space-y-2 text-sm">Image direction (optional)<Textarea maxLength={1500} rows={3} value={direction} onChange={event => setDirection(event.target.value)} placeholder="Clean editorial artwork by default. Describe a subject or a different style." /></label>}<DialogFooter><Button variant="outline" className="min-h-11" onClick={() => setConfirmation(null)}>Cancel</Button><Button className="min-h-11" onClick={() => { const action = confirmation?.action; setConfirmation(null); if (action) void act(action); }}>{confirmation?.label}</Button></DialogFooter></DialogContent></Dialog>
    <PlannerConflictDialog rows={conflicts?.rows ?? null} onChangeTime={() => { setConflicts(null); setSchedulePreview(null); }} onContinue={() => { const current = conflicts; setConflicts(null); current?.proceed(warningAcknowledgments(current.rows)); }} />
    <Dialog open={!!schedulePreview && !conflicts} onOpenChange={open => { if (!open && !busy) setSchedulePreview(null); }}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Confirm selected schedules</DialogTitle><DialogDescription>Review the exact account, date and timezone for each selected post. Nothing publishes now.</DialogDescription></DialogHeader>{schedulePreview && <><ScheduleRows rows={schedulePreview.items} items={run.items} accountNames={accountNames} /><p className="text-xs text-muted-foreground">Review valid until {displayTime(schedulePreview.expiresAt, run.timezone)} · {run.timezone}</p>{scheduleBlocked && <p role="alert" className="text-sm text-destructive">At least one selected item needs attention. Return to review and fix it or change the selection. Nothing is silently excluded.</p>}</>}{actionError && <p role="alert" className="text-sm text-destructive">{actionError} Retrying this confirmation reuses its request ID.</p>}<DialogFooter><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setSchedulePreview(null)}>Back to review</Button><Button className="min-h-11" disabled={busy || !canPublish || !schedulePreview?.items.length || scheduleBlocked} onClick={() => void confirmSchedule()}>Confirm schedule</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function ScheduleRows({ rows, items = [], accountNames = {} }: { rows: ScheduleOutcome[]; items?: RunItem[]; accountNames?: Record<string, string> }) {
  return <ul className="space-y-3">{rows.map(row => { const item = items.find(value => value.id === row.itemId); return <li key={row.itemId} className="flex gap-3 rounded-lg border p-3 text-sm">{item && <PlannerArtwork item={item} thumbnail />}<div className="min-w-0 space-y-2"><p className="font-medium capitalize">{row.platform} · {row.outcome.replaceAll("_", " ")}</p><p className="break-words">{accountNames[row.accountId ?? ""] ?? "Connected account"} · {displayTime(row.proposedAt, row.timezone)} · {row.timezone}</p>{!!row.reasons.length && <p className="break-words text-destructive">{row.reasons.map(slotReasonLabel).join(" · ")}</p>}{!!row.warnings?.length && <p className="text-muted-foreground">Other posts share this time. Confirmation will ask for your consent.</p>}</div></li>; })}</ul>;
}