"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { plannerApi } from "@/api/endpoints/planner.api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ImageAction, PlannerRun, RunItem, ScheduleOutcome, SchedulePreview, ScheduleResult } from "@/types/planner";
import PlannerItemEditor from "./PlannerItemEditor";
import { displayTime, itemBusy, itemLabel, plannerControl, plannerError, plannerPath, runNeedsPolling, savedCopy } from "./planner-review";

type Confirmation = { title: string; description: string; label: string; action: () => Promise<unknown> };

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
  const [previewRequest, setPreviewRequest] = useState("");
  const [pollPaused, setPollPaused] = useState(false);
  const [pollVersion, setPollVersion] = useState(0);
  const mounted = useRef(true);
  const mutation = useRef(false);
  const sequence = useRef(0);
  const imageAttempts = useRef(new Map<string, ImageAction>());
  const latest = useRef(run);
  latest.current = run;

  const load = useCallback(async () => {
    if (mutation.current) return true;
    const request = ++sequence.current;
    if (mounted.current) setRefreshing(true);
    try {
      const value = await plannerApi.getRun(workspaceId, runId);
      if (mounted.current && request === sequence.current) { setRun(value); setFetchError(""); }
      return true;
    } catch (err) { if (mounted.current && request === sequence.current) setFetchError(plannerError(err)); return false; }
    finally { if (mounted.current) setRefreshing(false); }
  }, [workspaceId, runId]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    let polls = 0;
    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState !== "hidden") {
        const success = await load();
        failures = success ? 0 : failures + 1;
        polls++;
      }
      if (cancelled) return;
      if (failures >= 4 || polls >= 120) { setPollPaused(true); return; }
      timer = setTimeout(() => {
        if (!latest.current || runNeedsPolling(latest.current) || failures) void tick();
      }, failures || latest.current?.items.some(item => item.scheduleState === "uncertain") ? 30_000 : 8_000);
    };
    void tick();
    return () => { cancelled = true; mounted.current = false; clearTimeout(timer); sequence.current++; };
  }, [load, pollVersion]);

  const act = async (action: () => Promise<unknown>, invalidatePreview = true): Promise<boolean> => {
    if (mutation.current) return false;
    mutation.current = true;
    sequence.current++;
    setBusy(true);
    setActionError("");
    if (invalidatePreview) setSchedulePreview(null);
    let success = false;
    try { await action(); success = true; }
    catch (err) { if (mounted.current) setActionError(plannerError(err)); }
    finally {
      mutation.current = false;
      if (mounted.current) { setBusy(false); setPollVersion(value => value + 1); }
    }
    return success;
  };
  const update = async (request: Promise<RunItem>) => {
    const value = await request;
    if (mounted.current) {
      setRun(previous => previous ? { ...previous, items: previous.items.map(row => row.id === value.id ? value : row) } : previous);
      if (value.error) setActionError(value.error);
    }
    return value;
  };
  const ask = (value: Confirmation) => setConfirmation(value);
  const regenerateText = async (item: RunItem) => {
    try {
      return await update(plannerApi.regenerateText(workspaceId, runId, item.id, { expectedRevision: item.revision!, requestId: crypto.randomUUID() }));
    } catch (err) {
      if (mounted.current) setRun(previous => previous ? { ...previous, items: previous.items.map(row => row.id === item.id ? { ...row, textState: "uncertain" } : row) } : previous);
      throw err;
    }
  };
  const image = (item: RunItem, mode: ImageAction["mode"]) => {
    if (!item.revision) return;
    const key = `${item.id}/${item.revision}/${mode}`;
    let payload = imageAttempts.current.get(key);
    if (!payload) {
      payload = { expectedRevision: item.revision, requestId: mode === "retry" ? item.imageRequestId ?? "" : crypto.randomUUID(), mode, creditsConfirmed: mode === "regenerate" };
      imageAttempts.current.set(key, payload);
    }
    if (!payload.requestId) { setActionError("Refresh the run to recover the image request ID before retrying. Do not start a new paid generation."); return; }
    const request = payload;
    ask({ title: mode === "retry" ? "Retry this image operation?" : mode === "regenerate" ? "Generate new artwork?" : "Generate an image?", description: mode === "retry" ? "Reuses the current request ID and any saved creative checkpoints. Missing artwork may still require an image allowance unit; this is not a request for new artwork." : mode === "regenerate" ? "This intentionally starts new artwork and may consume another image credit. The current attachment is replaced only after success." : "Uses image allowance separately from text. It does not schedule or publish. Review the full artwork after generation.", label: mode === "retry" ? "Retry existing image" : mode === "regenerate" ? "Confirm new artwork credits" : "Generate image", action: async () => {
      const value = await update(plannerApi.image(workspaceId, runId, item.id, request));
      if (value.visualState === "ready") imageAttempts.current.delete(key);
    } });
  };
  const openSchedule = async () => {
    if (!selected.length) return;
    await act(async () => {
      const value = await plannerApi.previewSchedule(workspaceId, runId, [...selected]);
      if (mounted.current) { setSchedulePreview(value); setPreviewRequest(crypto.randomUUID()); }
    });
  };
  const confirmSchedule = async () => {
    if (!schedulePreview || !canPublish) return;
    const previewId = schedulePreview.previewId;
    await act(async () => {
      const value = await plannerApi.confirmSchedule(workspaceId, runId, { previewId, requestId: previewRequest, confirm: true });
      if (mounted.current) { setScheduleResult(value); setSelected([]); setSchedulePreview(null); }
    }, false);
  };
  const retryDispatch = (itemIds: string[]) => ask({ title: "Retry confirmed scheduling dispatch?", description: "Retries delivery only for previously confirmed schedules. This does not regenerate text or images, or create a new post.", label: "Retry dispatch", action: async () => { const value = await plannerApi.retrySchedule(workspaceId, runId, { requestId: crypto.randomUUID(), itemIds }); if (mounted.current) setScheduleResult(value); } });

  if (!run) return <div className="space-y-4"><Link href={plannerPath} className="inline-flex min-h-11 items-center text-sm text-primary">← Planner setup and history</Link>{fetchError ? <div role="alert" className="rounded-lg border p-6"><p>{fetchError}</p><Button className="mt-4 min-h-11" onClick={() => { setPollPaused(false); setPollVersion(value => value + 1); }}>Retry saved run</Button></div> : <div role="status" className="animate-pulse space-y-4 rounded-xl bg-muted p-8"><h1 className="text-xl font-semibold">Loading saved plan…</h1><div className="h-20 rounded bg-background" /><div className="h-20 rounded bg-background" /></div>}</div>;

  const editorItems = run.items.filter(item => item.generationState !== "excluded");
  const editorIndex = editorItems.findIndex(item => item.id === editorId);
  const editor = editorItems[editorIndex];
  const failedIds = run.items.filter(item => ["failed", "pending", "checkpointed"].includes(item.generationState)).map(item => item.id);
  const pendingIds = run.items.filter(item => item.isScheduled && item.scheduleState !== "accepted").map(item => item.id);
  const visible = run.items.filter(item => filter === "all" || (filter === "needs_review" && !!item.post && !item.copyApproved) || (filter === "approved" && item.copyApproved) || (filter === "image_needed" && item.imageIntent === "required" && item.visualState !== "ready") || (filter === "ready" && item.canSchedule && !item.isScheduled) || (filter === "scheduled" && item.isScheduled));
  const running = ["queued", "running", "recovering"].includes(run.status);
  const scheduleBlocked = schedulePreview?.items.some(item => !["ready", "already_scheduled", "scheduled"].includes(item.outcome));

  return <div className="mx-auto max-w-6xl space-y-6 pb-6">
    <header className="space-y-3"><Link href={plannerPath} className="inline-flex min-h-11 items-center text-sm text-primary">← Planner setup and history</Link><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-2xl font-semibold">Review your plan</h1><p className="mt-2 text-sm text-muted-foreground">{run.timezone} · <span className="capitalize">{run.status}</span> · {run.items.filter(item => item.post).length} / {run.items.filter(item => item.generationState !== "excluded").length} saved drafts</p></div><Button variant="outline" className="min-h-11" disabled={busy || refreshing} onClick={() => { setPollPaused(false); setPollVersion(value => value + 1); }}>{refreshing ? "Refreshing…" : "Refresh saved run"}</Button></div><p className="break-words text-sm text-muted-foreground">{run.prompt}</p></header>
    {(fetchError || actionError) && <div role="alert" className="space-y-2 rounded-lg border border-destructive p-4 text-sm text-destructive">{fetchError && <p>Refresh failed: {fetchError}. Previously loaded content is retained.</p>}{actionError && <p>{actionError}</p>}</div>}
    {pollPaused && <p role="status" className="text-sm text-muted-foreground">Automatic refresh paused. Use Refresh saved run to reconnect.</p>}
    {running && <div role="status" className="rounded-lg border bg-muted/30 p-4 text-sm">Text generation is {run.status}. Saved drafts appear below. You can leave and reopen this run; nothing is scheduled automatically.{run.dispatchState !== "accepted" && <p className="mt-2">Generation dispatch: {run.dispatchState}. This is not a publishing result.</p>}</div>}
    {run.cancelled && <p role="status" className="rounded-lg border p-4 text-sm">Generation cancelled. Already saved drafts remain reviewable. No successful drafts are regenerated by retrying missing slots.</p>}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[["Needs review", run.items.filter(item => item.post && !item.copyApproved).length], ["Approved", run.items.filter(item => item.copyApproved).length], ["Image needed", run.items.filter(item => item.imageIntent === "required" && item.visualState !== "ready").length], ["Ready", run.items.filter(item => item.canSchedule && !item.isScheduled).length], ["Scheduled", run.items.filter(item => item.isScheduled && item.scheduleState === "accepted").length]].map(([label, count]) => <div key={label} className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{count}</p></div>)}</div>
    <div className="flex flex-wrap items-end justify-between gap-3"><label className="space-y-2 text-sm">Filter posts<select value={filter} className={plannerControl} onChange={event => setFilter(event.target.value)}>{[["all", "All items"], ["needs_review", "Needs review"], ["approved", "Approved text"], ["image_needed", "Image needed"], ["ready", "Ready"], ["scheduled", "Scheduled"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="flex flex-wrap gap-2">{canEdit && running && <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => ask({ title: "Cancel remaining text generation?", description: "Already saved drafts are kept. Any in-flight paid request may finish before cancellation takes effect.", label: "Cancel generation", action: async () => { const value = await plannerApi.cancelRun(workspaceId, runId); if (mounted.current) setRun(value); } })}>Cancel remaining generation</Button>}{canEdit && !running && !!failedIds.length && <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => ask({ title: "Retry failed or missing slots?", description: "Only failed, missing and checkpointed slots are requested. Saved drafts are not regenerated. New text attempts may use text allowance; uncertain paid attempts cannot be blindly replayed.", label: "Retry missing text", action: async () => { const value = await plannerApi.retryRun(workspaceId, runId, failedIds); if (mounted.current) setRun(value); } })}>Retry {failedIds.length} missing text slots</Button>}{canPublish && !!pendingIds.length && <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => retryDispatch(pendingIds)}>Retry {pendingIds.length} pending dispatches</Button>}</div></div>
    {!visible.length && <p className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">{run.items.length ? "No items match this filter." : "No draft items yet. The saved run will refresh while generation is queued."}</p>}
    <div className="space-y-4">{visible.map(item => {
      const disabled = busy || itemBusy(item) || item.isScheduled || !canEdit || !item.revision;
      return <Card key={item.id}><CardContent className="space-y-4 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold capitalize">{item.slot.date} · {item.slot.platform}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{item.slot.time ?? "Unresolved time"} · {item.slot.timezone} · Account {item.slot.accountId ?? "unavailable"}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize">{itemLabel(item)}</span></div>
        <p className="whitespace-pre-wrap break-words text-sm">{savedCopy(item).caption || (item.generationState === "excluded" ? "Explicitly excluded during setup." : "Text is not yet available.")}</p>
        <p className="text-xs text-muted-foreground">Text {item.copyApproved ? "approved" : "not approved"} · Image {item.visualState.replaceAll("_", " ")} · {item.imageIntent === "required" ? "Image required" : item.imageIntent === "text_only" ? "Text only" : "Image optional"}</p>
        {item.error && <p role="alert" className="text-sm text-destructive">{item.error}</p>}{!!item.reasons.length && !item.isScheduled && <p className="break-words text-sm text-destructive">Not ready: {item.reasons.join(" · ").replaceAll("_", " ")}</p>}{item.textState === "uncertain" && <p className="text-sm text-destructive">Text attempt uncertain. Refresh and reconcile before another paid attempt.</p>}
        <div className="flex flex-wrap gap-2">
          {item.generationState !== "excluded" && <Button variant="outline" className="min-h-11" disabled={busy || running} onClick={() => { setActionError(""); setEditorId(item.id); }}>View</Button>}
          {item.post && <>
            <Button className="min-h-11" disabled={disabled || item.copyApproved} onClick={() => void act(() => update(plannerApi.approveCopy(workspaceId, runId, item.id, { expectedRevision: item.revision! })))}>{item.copyApproved ? "Text approved" : "Approve text"}</Button>
            <Button variant="outline" className="min-h-11" disabled={disabled || item.textState === "uncertain"} onClick={() => ask({ title: "Regenerate saved text?", description: "Uses text allowance and replaces the saved copy only after success. Current text approval and image binding will be invalidated. No image is generated.", label: "Regenerate text", action: () => regenerateText(item) })}>Regenerate text</Button>
            {!item.imageOperationId ? <Button variant="outline" className="min-h-11" disabled={disabled || !item.copyApproved} onClick={() => image(item, "generate")}>Generate image</Button> : <>
              {item.visualState !== "ready" && <Button variant="outline" className="min-h-11" disabled={disabled || !item.copyApproved || !item.imageRequestId || item.visualState === "stale"} onClick={() => image(item, "retry")}>Retry image</Button>}
              <Button variant="outline" className="min-h-11" disabled={disabled || !item.copyApproved} onClick={() => image(item, "regenerate")}>Regenerate image</Button>
            </>}
            {item.slot.platform !== "instagram" && <Button variant="ghost" className="min-h-11" disabled={disabled || item.imageIntent === "text_only"} onClick={() => ask({ title: "Use text only?", description: "This explicitly removes the image requirement and attachment for this Facebook or LinkedIn draft. Instagram always requires an image.", label: "Use text only", action: () => update(plannerApi.imageIntent(workspaceId, runId, item.id, { expectedRevision: item.revision!, intent: "text_only" })) })}>Use text only</Button>}
          </>}
        </div>
        {canEdit && item.post && !item.isScheduled && <label className="flex min-h-11 items-center gap-3 border-t pt-3 text-sm"><input type="checkbox" className="size-5 accent-primary" checked={selected.includes(item.id)} disabled={busy || !!schedulePreview} onChange={event => { setSelected(values => event.target.checked ? [...values, item.id] : values.filter(value => value !== item.id)); setScheduleResult(null); }} />Select for final schedule review{!item.canSchedule && " (currently blocked)"}</label>}
      </CardContent></Card>;
    })}</div>
    {!canPublish && <p className="text-sm text-muted-foreground">{canEdit ? "Editor access: approve text, create images and preview selected schedules. A publisher or admin must confirm scheduling." : "Viewer access: saved plans are read-only. An editor can change content and a publisher can schedule."} Server permission and readiness checks remain authoritative.</p>}
    {scheduleResult && <section aria-labelledby="schedule-results" className="space-y-3 rounded-xl border p-4"><h2 id="schedule-results" className="text-lg font-semibold">Scheduling outcomes</h2><ScheduleRows rows={scheduleResult.items} /><p className="text-sm text-muted-foreground">Dispatch pending is not confirmed delivery. Fix blocked items and preview them again. Saved schedule states remain visible after reload.</p><Link href="/dashboard/calendar" className="inline-flex min-h-11 items-center text-sm text-primary">View calendar →</Link></section>}
    {canEdit && <div className="mobile-action-bar flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4"><p className="text-sm"><strong>{selected.length}</strong> explicitly selected · {run.timezone}</p><Button className="min-h-11" disabled={busy || !selected.length} onClick={() => void openSchedule()}>Review selected schedule</Button></div>}
    {editor && <PlannerItemEditor key={editor.id} item={editor} canEdit={canEdit} busy={busy} error={actionError} index={editorIndex} total={editorItems.length} onClose={() => setEditorId(null)} onMove={direction => setEditorId(editorItems[editorIndex + direction].id)} onSave={payload => act(() => update(plannerApi.editCopy(workspaceId, runId, editor.id, payload)))} onSlot={payload => act(() => update(plannerApi.editSlot(workspaceId, runId, editor.id, payload)))} />}
    <Dialog open={!!confirmation} onOpenChange={open => { if (!open && !busy) setConfirmation(null); }}><DialogContent><DialogHeader><DialogTitle>{confirmation?.title}</DialogTitle><DialogDescription>{confirmation?.description}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" className="min-h-11" onClick={() => setConfirmation(null)}>Cancel</Button><Button className="min-h-11" onClick={() => { const action = confirmation?.action; setConfirmation(null); if (action) void act(action); }}>{confirmation?.label}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!schedulePreview} onOpenChange={open => { if (!open && !busy) setSchedulePreview(null); }}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Confirm selected schedules</DialogTitle><DialogDescription>Only the explicitly selected items below are included. Review exact account, date and timezone. This schedules future publishing; it does not publish now.</DialogDescription></DialogHeader>{schedulePreview && <><ScheduleRows rows={schedulePreview.items} /><p className="text-xs text-muted-foreground">Preview expires {displayTime(schedulePreview.expiresAt, run.timezone)} · {run.timezone}</p>{scheduleBlocked && <p role="alert" className="text-sm text-destructive">At least one selected item is blocked or pending. Nothing is silently excluded. Return to review, fix the items, or explicitly change the selection.</p>}</>}{actionError && <p role="alert" className="text-sm text-destructive">{actionError} Retrying this confirmation reuses its request ID.</p>}<DialogFooter><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setSchedulePreview(null)}>Back to review</Button><Button className="min-h-11" disabled={busy || !canPublish || !schedulePreview?.items.length || scheduleBlocked} onClick={() => void confirmSchedule()}>Confirm schedule</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function ScheduleRows({ rows }: { rows: ScheduleOutcome[] }) {
  return <ul className="space-y-3">{rows.map(row => <li key={row.itemId} className="space-y-2 rounded-lg border p-3 text-sm"><p className="font-medium capitalize">{row.platform} · {row.outcome.replaceAll("_", " ")}</p><p className="break-words">Account {row.accountId ?? "unavailable"} · {displayTime(row.proposedAt, row.timezone)} · {row.timezone}</p>{!!row.reasons.length && <p className="break-words text-destructive">{row.reasons.join(" · ").replaceAll("_", " ")}</p>}</li>)}</ul>;
}