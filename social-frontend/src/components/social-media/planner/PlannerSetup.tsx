"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { plannerApi } from "@/api/endpoints/planner.api";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormInput, FormTextarea } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/ui/form-select";
import { contentPlanDayCap } from "@/lib/plans";
import type { ConflictAcknowledgment, PlannerPlatform, PlannerSelection, PlannerSlot, RunCreate, RunList, SlotOverride, SlotPreview } from "@/types/planner";
import type { SocialAccount, SocialSettings } from "@/types/social-media.types";
import { conflictSlot, displayTime, plannerError, plannerPath, plannerPlatforms, slotReasonLabel, warningAcknowledgments, workspaceDate } from "./planner-review";
import PlannerConflictDialog from "./PlannerConflictDialog";
import PlannerDatePicker, { dateCount } from "./PlannerDatePicker";

export default function PlannerSetup({ workspaceId, canEdit, plan }: { workspaceId: string; canEdit: boolean; plan?: string }) {
  const router = useRouter();
  const [settings, setSettings] = useState<SocialSettings | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [history, setHistory] = useState<RunList | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [offset, setOffset] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("Professional");
  const [includeComment, setIncludeComment] = useState<boolean | null>(null);
  const [mode, setMode] = useState("range");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<PlannerPlatform[]>([]);
  const [accountIds, setAccountIds] = useState<Record<string, string>>({});
  const [postingTime, setPostingTime] = useState("");
  const [overrides, setOverrides] = useState<SlotOverride[]>([]);
  const [preview, setPreview] = useState<SlotPreview | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<PlannerSlot[] | null>(null);
  const active = useRef(true);
  const lock = useRef(false);
  const createAttempt = useRef<{ key: string; payload: RunCreate } | null>(null);
  const cap = contentPlanDayCap(plan);

  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    setLoadError("");
    void Promise.all([socialMediaApi.getSettings(workspaceId), socialMediaApi.listAccounts(workspaceId)]).then(([value, rows]) => {
      if (!current) return;
      setSettings(value);
      setAccounts(rows);
      const available = rows.filter(row => row.isActive && !["expired", "disconnected"].includes(row.tokenStatus));
      setAccountIds(Object.fromEntries(plannerPlatforms.map(platform => [platform, available.find(row => row.platform === platform && row.isDefault)?.id ?? available.find(row => row.platform === platform)?.id ?? ""])));
    }).catch(err => { if (current) setLoadError(plannerError(err)); });
    return () => { current = false; };
  }, [workspaceId, loadVersion]);
  useEffect(() => {
    let current = true;
    setHistoryError("");
    setHistory(null);
    void plannerApi.listRuns(workspaceId, offset).then(value => { if (current) setHistory(value); }).catch(err => { if (current) setHistoryError(plannerError(err)); });
    return () => { current = false; };
  }, [workspaceId, offset, historyVersion]);

  const invalidate = () => { setPreview(null); setExcluded([]); setConflicts(null); setError(""); createAttempt.current = null; };
  const selection = (): PlannerSelection => ({ timezone: settings!.timezone, ...(mode === "dates" ? { dates: [...dates].sort() } : { startDate, endDate }), platforms, accountIds: Object.fromEntries(platforms.map(platform => [platform, accountIds[platform]])), ...(postingTime ? { postingTime } : {}), overrides });
  const previewSlots = async () => {
    if (lock.current || !settings) return;
    const today = workspaceDate(settings.timezone);
    if (mode === "dates" ? dates.some(date => date < today) || dates.length > cap : startDate < today || endDate < startDate || dateCount(startDate, endDate) > cap) { setError(`Choose today or future dates, up to ${cap} dates.`); return; }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await plannerApi.previewSlots(workspaceId, selection());
      if (active.current) { setPreview(value); setExcluded([]); createAttempt.current = null; }
    } catch (err) { if (active.current) setError(plannerError(err)); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  };
  const create = async (consent?: ConflictAcknowledgment[]) => {
    if (lock.current || !preview?.previewToken || !settings || !canEdit) return;
    const warnings = preview.slots.filter(slot => !excluded.includes(slot.slotId) && slot.warnings?.length);
    if (!consent && warnings.length) { setConflicts(warnings); return; }
    const input = { ...selection(), previewToken: preview.previewToken, prompt, tone, includeComment: includeComment ?? !!settings.autoFirstComment, excludedSlotIds: excluded, ...(consent?.length ? { conflictAcknowledgments: consent } : {}) };
    const key = JSON.stringify(input);
    if (createAttempt.current?.key !== key) createAttempt.current = { key, payload: { ...input, requestId: crypto.randomUUID() } };
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const run = await plannerApi.createRun(workspaceId, createAttempt.current.payload);
      if (active.current) router.push(`${plannerPath}/${encodeURIComponent(run.id)}`);
    } catch (err) { if (active.current) { const slot = conflictSlot(err); if (slot) { setPreview(value => value ? { ...value, previewToken: "", slots: value.slots.map(row => row.slotId === slot.slotId ? slot : row) } : value); setError("Other posts changed. Review dates again before generating drafts."); createAttempt.current = null; } else setError(plannerError(err)); } }
    finally { lock.current = false; if (active.current) setBusy(false); }
  };
  const overrideSlot = (date: string, platform: PlannerPlatform, time: string, utcOffsetMinutes?: number | null) => {
    setConflicts(null);
    setOverrides(rows => [...rows.filter(row => row.date !== date || row.platform !== platform), { date, platform, time, accountId: accountIds[platform], utcOffsetMinutes }]);
    setPreview(value => value ? { ...value, previewToken: "" } : value);
    createAttempt.current = null;
  };
  const blocked = preview?.slots.filter(slot => slot.reasons.length && !excluded.includes(slot.slotId)) ?? [];
  const includedCount = preview?.slots.filter(slot => !excluded.includes(slot.slotId)).length ?? 0;

  return <div className="mx-auto max-w-6xl space-y-6 pb-6">
    <header className="space-y-2"><Link href="/dashboard/content-studio" className="inline-flex min-h-11 items-center text-sm text-primary">← Content Studio</Link><h1 className="font-display text-2xl font-semibold">Content planner</h1><p className="text-sm text-muted-foreground">Plan exact dates. Generate text first, review every post, then explicitly confirm scheduling.</p></header>
    {!canEdit && <p role="status" className="rounded-lg border p-4 text-sm">Viewer access: open saved runs below. An editor can create and review plans; a publisher confirms scheduling.</p>}
    {loadError ? <div role="alert" className="rounded-lg border border-destructive p-4"><p>{loadError}</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => setLoadVersion(value => value + 1)}>Retry workspace details</Button></div> : !settings ? <div role="status" className="animate-pulse rounded-xl bg-muted p-8">Loading workspace timezone and accounts…</div> : <>
      <div className="rounded-lg border bg-muted/40 p-4 text-sm"><strong>Workspace timezone: {settings.timezone}</strong><p className="mt-1 text-muted-foreground">Choose up to {cap} dates, starting today. Your workspace posting times and blackout dates apply.</p></div>
      <fieldset disabled={busy || !canEdit} className="min-w-0 space-y-6 disabled:opacity-70">
        <Card><CardHeader><CardTitle>1. Brief and channels</CardTitle></CardHeader><CardContent className="space-y-4">
          <FormTextarea label="What should this plan cover?" value={prompt} minLength={10} maxLength={8000} rows={4} helper="Share your audience, topics, key messages, and any facts to include." onChange={event => { setPrompt(event.target.value); createAttempt.current = null; }} placeholder="What would your audience find useful?" />
          <FormSelect label="Tone" options={["Professional", "Friendly", "Bold", "Playful", "Inspiring"].map(value => ({ value, label: value }))} value={tone} onValueChange={setTone} disabled={busy || !canEdit} />
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3"><label className="flex min-h-11 items-center gap-3 text-sm font-medium"><Checkbox checked={includeComment ?? !!settings.autoFirstComment} disabled={busy || !canEdit} onCheckedChange={value => { setIncludeComment(value === true); createAttempt.current = null; }} />Generate first comment</label><p className="text-xs leading-relaxed text-muted-foreground">Create an editable conversation starter with each post. Facebook and Instagram support automatic comments; LinkedIn comments are saved for manual copying. Changing this does not remove existing comments.</p></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{plannerPlatforms.map(platform => {
            const rows = accounts.filter(row => row.platform === platform && row.isActive && !["expired", "disconnected"].includes(row.tokenStatus));
            return <div key={platform} className="min-w-0 space-y-2 rounded-lg border p-3"><label className="flex min-h-11 items-center gap-3 text-sm font-medium capitalize"><Checkbox className="size-5" checked={platforms.includes(platform)} disabled={busy || !canEdit || !rows.length} onCheckedChange={checked => { setPlatforms(values => checked === true ? [...values, platform] : values.filter(value => value !== platform)); invalidate(); }} />{platform}</label>{rows.length ? <FormSelect label={`${platform} account`} value={accountIds[platform] ?? ""} options={rows.map(row => ({ value: row.id, label: `${row.accountName}${row.isDefault ? " (default)" : ""}` }))} disabled={busy || !canEdit} onValueChange={value => { setAccountIds(values => ({ ...values, [platform]: value })); setOverrides([]); invalidate(); }} /> : <Link href="/dashboard/accounts" className="inline-flex min-h-11 items-center text-sm text-primary">Connect an account</Link>}</div>;
          })}</div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>2. Dates and posting times</CardTitle></CardHeader><CardContent className="space-y-4">
          <div role="group" aria-label="Date selection" className="flex flex-wrap gap-2">{[["range", "Date range"], ["dates", "Individual dates"]].map(([value, label]) => <Button key={value} variant={mode === value ? "default" : "outline"} className="min-h-11" aria-pressed={mode === value} onClick={() => { setMode(value); setOverrides([]); invalidate(); }}>{label}</Button>)}</div>
          <PlannerDatePicker mode={mode} start={startDate} end={endDate} dates={dates} today={workspaceDate(settings.timezone)} cap={cap} disabled={busy || !canEdit} onChange={(start, end, selected) => { setStartDate(start); setEndDate(end); setDates(selected); setOverrides([]); invalidate(); }} />
          <FormInput label="Posting time (optional)" type="time" value={postingTime} onChange={event => { setPostingTime(event.target.value); invalidate(); }} />
          <p className="text-sm text-muted-foreground">Leave blank to use workspace times. Preview lists blocked slots instead of silently moving dates. You can correct each time below.</p>
          <Button className="min-h-11" disabled={!platforms.length || (mode === "dates" ? !dates.length : !startDate || !endDate)} onClick={() => void previewSlots()}>{busy ? "Checking dates…" : "Review dates"}</Button>
        </CardContent></Card>
        {preview && <Card><CardHeader><CardTitle>3. Review exact slots</CardTitle></CardHeader><CardContent className="space-y-4">
          <p className="text-sm">{preview.selectedDateCount} dates · {includedCount} drafts · {preview.timezone}</p>
          {!preview.previewToken && <p role="status" className="text-sm text-primary">Times changed. Review dates again before generating drafts.</p>}
          <div className="space-y-3">{preview.slots.map(slot => {
            const override = overrides.find(value => value.date === slot.date && value.platform === slot.platform);
            return <div key={slot.slotId} className="rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium capitalize">{slot.date} · {slot.platform}</p><p className="break-words text-sm text-muted-foreground">{accounts.find(row => row.id === slot.accountId)?.accountName ?? (slot.accountId ? "Connected account" : "No account")} · {displayTime(slot.proposedAt, slot.timezone)}</p></div><label className="flex min-h-11 items-center gap-3 text-sm"><Checkbox className="size-5" checked={excluded.includes(slot.slotId)} disabled={busy || !canEdit} onCheckedChange={checked => setExcluded(values => checked === true ? [...values, slot.slotId] : values.filter(value => value !== slot.slotId))} />Exclude this slot</label></div>
              <details className="mt-3" open={slot.reasons.length > 0}><summary className="cursor-pointer py-3 text-sm text-primary">Adjust this posting time</summary><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><FormInput label={`Time for ${slot.date} ${slot.platform}`} type="time" value={override?.time ?? slot.time ?? ""} onChange={event => overrideSlot(slot.date, slot.platform, event.target.value, override?.utcOffsetMinutes ?? slot.utcOffsetMinutes)} />{slot.reasons.includes("ambiguous_local_time_choose_utc_offset") && <FormInput label="UTC offset minutes (daylight saving)" type="number" min={-840} max={840} value={override?.utcOffsetMinutes ?? ""} onChange={event => overrideSlot(slot.date, slot.platform, override?.time ?? slot.time ?? "", event.target.value === "" ? null : Number(event.target.value))} />}</div></details>
              {!!slot.warnings?.length && <p className="text-sm text-muted-foreground">{slot.warnings.length} other post(s) at this time. You can review and keep both.</p>}
              {!!slot.reasons.length && <p className="mt-3 text-sm text-destructive">Blocked: {slot.reasons.map(slotReasonLabel).join(" · ")}. Correct and preview again, or explicitly exclude.</p>}
            </div>;
          })}</div>
          <p className="text-sm text-muted-foreground">Generate text uses your plan’s text allowance. It does not create images, schedule, or publish. Images are a separate action after text approval.</p>
          {blocked.length > 0 && <p className="text-sm text-destructive">{blocked.length} blocked slots must be corrected or explicitly excluded.</p>}
          <div className="flex flex-wrap gap-3"><Button variant="outline" className="min-h-11" onClick={() => void previewSlots()}>Review dates again</Button><Button className="min-h-11" disabled={!preview.previewToken || !!blocked.length || !includedCount || prompt.trim().length < 10} onClick={() => void create()}>{busy ? "Saving plan…" : `Generate ${includedCount} drafts`}</Button></div>
        </CardContent></Card>}
      </fieldset>
      {error && <p role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">{error}</p>}
    </>}
    <PlannerConflictDialog rows={conflicts} onChangeTime={() => setConflicts(null)} onContinue={() => { const consent = warningAcknowledgments(conflicts ?? []); setConflicts(null); void create(consent); }} />
    <section aria-labelledby="planner-history" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="planner-history" className="text-lg font-semibold">Saved plan history</h2><Button variant="outline" className="min-h-11" onClick={() => setHistoryVersion(value => value + 1)}>Refresh history</Button></div>
      {historyError ? <p role="alert" className="text-sm text-destructive">{historyError}</p> : !history ? <p role="status" className="animate-pulse rounded-lg bg-muted p-6">Loading saved runs…</p> : !history.items.length ? <p className="rounded-lg border p-6 text-sm text-muted-foreground">No saved runs yet. Generate your first text plan above. Saved runs can be reopened after reload.</p> : <ul className="space-y-3">{history.items.map(run => <li key={run.id}><Link href={`${plannerPath}/${encodeURIComponent(run.id)}`} className="block rounded-lg border p-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex flex-wrap justify-between gap-2"><strong className="break-words">{run.prompt.slice(0, 140)}</strong><span className="text-sm capitalize">{run.status.replaceAll("_", " ")}</span></div><p className="mt-2 text-sm text-muted-foreground">{displayTime(run.createdAt, run.timezone)} · {run.items.length} slots · {run.timezone}</p></Link></li>)}</ul>}
      <div className="flex items-center justify-between gap-3"><Button variant="outline" className="min-h-11" disabled={!offset || !history} onClick={() => setOffset(value => Math.max(0, value - 20))}>Previous runs</Button><span className="text-sm text-muted-foreground">{history ? `${history.total} saved runs` : ""}</span><Button variant="outline" className="min-h-11" disabled={!history || offset + 20 >= history.total} onClick={() => setOffset(value => value + 20)}>More runs</Button></div>
    </section>
  </div>;
}