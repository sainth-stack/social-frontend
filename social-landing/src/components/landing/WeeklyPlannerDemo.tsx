"use client";

import { useId, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Check, ChevronRight, Clock3, PencilLine, RotateCcw } from "lucide-react";
import { businesses, buildPlan, goals, type Business, type Goal } from "@/content/planner";
import { platforms, SIGNUP_URL } from "@/content/site";
import { PlatformIcon } from "./Brand";

const available = platforms.filter((p) => p.status === "available");

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`planner-channel ${active ? "border-primary bg-primary-soft text-accent-foreground" : "bg-background text-muted-foreground hover:border-primary"}`}
    >
      {children}
    </button>
  );
}

export function WeeklyPlannerDemo() {
  const id = useId();
  const [business, setBusiness] = useState<Business>("software");
  const [goal, setGoal] = useState<Goal>("awareness");
  const [channels, setChannels] = useState<string[]>(["instagram", "facebook"]);
  const [applied, setApplied] = useState({ business: "software" as Business, goal: "awareness" as Goal, channels: ["instagram", "facebook"] });
  const [dayIdx, setDayIdx] = useState(2);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [times, setTimes] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"apply" | "reset" | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const plan = useMemo(() => buildPlan(applied.business, applied.goal), [applied]);
  const day = plan[dayIdx]!;
  const caption = edits[dayIdx] ?? day.caption;
  const hasEdits = Object.keys(edits).length > 0 || Object.keys(times).length > 0;
  const platformFor = (i: number) => available.find((p) => p.id === applied.channels[i % applied.channels.length])!;

  const toggle = (id: string) => setChannels((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const apply = (force = false) => {
    if (channels.length === 0) return setError("Select at least one channel to preview your week.");
    setError("");
    if (hasEdits && !force) return setConfirm("apply");
    setConfirm(null);
    setEdits({});
    setTimes({});
    setApplied({ business, goal, channels: [...channels] });
    setAnnouncement(`Sample week updated for ${businesses.find(item => item.id === business)?.label}.`);
  };

  const reset = (force = false) => {
    if (hasEdits && !force) return setConfirm("reset");
    setBusiness("software"); setGoal("awareness"); setChannels(["instagram", "facebook"]);
    setApplied({ business: "software", goal: "awareness", channels: ["instagram", "facebook"] });
    setEdits({}); setTimes({}); setDayIdx(2); setError(""); setConfirm(null);
    setAnnouncement("Sample reset to the original software startup plan.");
  };

  const p = platformFor(dayIdx);
  const pending = business !== applied.business || goal !== applied.goal || channels.join() !== applied.channels.join();
  const businessLabel = businesses.find(item => item.id === applied.business)!.label;
  const goalLabel = goals.find(item => item.id === applied.goal)!.label;

  return (
    <section id="weekly-planner" className="section-y planner-section" aria-labelledby={`${id}-heading`}>
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Weekly content planning</p>
          <h2 id={`${id}-heading`} className="section-heading mt-4">Your next seven days.<br />One clear content plan.</h2>
          <p className="section-intro mt-4">Choose your business, set a goal and explore a sample week. Pick a day to make the caption and timing your own.</p>
        </div>

        <p className="sr-only" role="status">{announcement}</p>
        <div className="planner-shell mt-10">
          <div className="planner-topbar">
            <div className="flex items-center gap-3"><span className="planner-app-icon"><CalendarDays className="size-5" aria-hidden="true" /></span><div><h3 className="text-sm font-semibold">Your content week</h3><p className="text-xs text-muted-foreground">A little structure. Room for your voice.</p></div></div>
            <span className="planner-sample-badge">Interactive sample</span>
          </div>
          <div className="planner-controls">
            <label className="text-sm font-semibold">Your business<select value={business} onChange={event => setBusiness(event.target.value as Business)} className="planner-select">{businesses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="text-sm font-semibold">Your goal<select value={goal} onChange={event => setGoal(event.target.value as Goal)} className="planner-select">{goals.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <fieldset className="planner-channel-field">
              <legend className="mb-2 text-sm font-semibold">Channels</legend>
              <div className="flex flex-wrap gap-2">{available.map((c) => <Chip key={c.id} active={channels.includes(c.id)} onClick={() => toggle(c.id)}>{c.name}</Chip>)}</div>
            </fieldset>
            <div className="planner-apply-row"><p className="text-xs text-muted-foreground">{pending ? "Settings changed. Preview your week to apply them." : "Fictional sample · No account needed · Nothing will be published"}</p><button type="button" onClick={() => apply()} className="btn btn-primary">Preview my week <ArrowRight className="size-4" aria-hidden="true" /></button></div>
          </div>

          {(error || confirm) && (
            <div role="alert" className="flex flex-wrap items-center gap-3 border-b bg-amber-soft px-5 py-3 text-sm text-amber-foreground md:px-7">
              {error || "You have sample edits. Discard them to continue?"}
              {confirm && (
                <span className="flex gap-2">
                  <button className="btn btn-outline min-h-9 px-3 text-sm" onClick={() => confirm === "reset" ? reset(true) : apply(true)}>Discard edits</button>
                  <button className="btn min-h-9 px-3 text-sm underline" onClick={() => setConfirm(null)}>Keep editing</button>
                </span>
              )}
            </div>
          )}

          <div className="planner-week-heading">
            <div><h3 className="text-base font-semibold">Your sample week <span className="ml-2 text-xs font-normal text-muted-foreground">7 posts</span></h3><p className="mt-1 text-xs text-muted-foreground">{businessLabel} <span aria-hidden="true">/</span> {goalLabel}</p></div>
            <button type="button" onClick={() => reset()} className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Reset sample</button>
          </div>

          <div className="planner-workbench">
          <div className="planner-schedule">
          <p className="planner-schedule-hint">Pick a day to edit <ArrowRight className="size-3.5" aria-hidden="true" /></p>
          <div role="group" aria-label="Days of the week" className="planner-days">
            {plan.map((d, i) => (
              <button
                key={d.day}
                type="button"
                aria-pressed={dayIdx === i}
                aria-controls={`${id}-detail`}
                onClick={() => setDayIdx(i)}
                onKeyDown={event => {
                  const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
                  if (!keys.includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === "Home" ? 0 : event.key === "End" ? 6 : (i + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : 6)) % 7;
                  setDayIdx(next);
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
                }}
                className="planner-day"
              >
                <span className="planner-day-copy"><span className="planner-day-label">{d.day} <span>{d.angle}</span></span><span className="planner-day-idea">{d.idea}</span><span className="planner-day-meta">{platformFor(i).name} <span aria-hidden="true">·</span> {times[i] ?? d.time}{(edits[i] !== undefined || times[i] !== undefined) && <span className="planner-edited">Edited</span>}</span></span>
                <ChevronRight className="planner-day-chevron size-4" aria-hidden="true" />
              </button>
            ))}
          </div>
          </div>

          <div id={`${id}-detail`} role="region" aria-label={`${day.day} sample post`} className="planner-editor">
            <div className="planner-editor-heading"><div className="flex items-center gap-2"><PencilLine className="size-4 text-primary" aria-hidden="true" /><h3 className="text-sm font-semibold">{day.day}’s draft</h3></div><span className="planner-draft-state"><span className="size-1.5 rounded-full bg-primary" />Sample draft</span></div>
            <div className="planner-post-context"><PlatformIcon name={p.name} color={p.color} size={32} /><div><p className="text-sm font-semibold">{day.angle}</p><p className="text-xs text-muted-foreground">{p.name} · {businessLabel}</p></div></div>
            <div className="planner-hook"><p className="text-xs font-medium text-muted-foreground">Hook</p><p className="mt-2 text-2xl font-semibold tracking-tight">{day.hook}</p></div>
              <div className="mt-5 flex items-center justify-between gap-2"><label htmlFor={`${id}-caption`} className="text-sm font-semibold">Caption (editable)</label><span className="text-xs text-muted-foreground">{caption.length} characters</span></div>
              <textarea
                id={`${id}-caption`}
                value={caption}
                onChange={(e) => setEdits((s) => ({ ...s, [dayIdx]: e.target.value }))}
                rows={5}
                aria-describedby={`${id}-edit-note`}
                className="planner-caption"
              />
              <div className="planner-hashtags" aria-label="Suggested hashtags">{day.hashtags.map(tag => <span key={tag}>{tag}</span>)}</div>
              <div className="planner-editor-footer"><label htmlFor={`${id}-time`} className="text-xs font-semibold text-muted-foreground"><span className="mb-2 flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />Example time</span><input id={`${id}-time`} value={times[dayIdx] ?? day.time} onChange={(e) => setTimes((s) => ({ ...s, [dayIdx]: e.target.value }))} className="planner-time" /></label><p id={`${id}-edit-note`} className="flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="size-3.5 shrink-0 text-mint-foreground" aria-hidden="true" />Edits stay in this sample</p></div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Example timing only, not a recommended posting time. Review every draft before publishing.</p>
            </div>
          </div>
          <div className="planner-conversion"><div><p className="text-sm font-semibold">Make next week your own.</p><p className="mt-1 text-xs text-muted-foreground">Sign up to generate a plan for your business. This demo is not live AI.</p></div><a href={SIGNUP_URL} className="btn btn-primary">Create my own plan <ArrowRight className="size-4" aria-hidden="true" /></a></div>
        </div>
      </div>
    </section>
  );
}
