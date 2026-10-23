"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
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
      className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${active ? "border-primary bg-primary-soft text-accent-foreground" : "bg-background hover:border-primary"}`}
    >
      {children}
    </button>
  );
}

export function WeeklyPlannerDemo() {
  const [business, setBusiness] = useState<Business>("cafe");
  const [goal, setGoal] = useState<Goal>("awareness");
  const [channels, setChannels] = useState<string[]>(["instagram", "facebook"]);
  const [applied, setApplied] = useState({ business: "cafe" as Business, goal: "awareness" as Goal, channels: ["instagram", "facebook"] });
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
    setBusiness("cafe"); setGoal("awareness"); setChannels(["instagram", "facebook"]);
    setApplied({ business: "cafe", goal: "awareness", channels: ["instagram", "facebook"] });
    setEdits({}); setTimes({}); setDayIdx(2); setError(""); setConfirm(null);
    setAnnouncement("Sample reset to the original café plan.");
  };

  const p = platformFor(dayIdx);

  return (
    <section id="weekly-planner" className="section-y bg-lilac">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Weekly content planning</p>
          <h2 className="section-heading mt-4">A week of content, built around your business.</h2>
          <p className="section-intro mt-4">Choose a business and a goal. Explore a seven-day plan, edit the captions and see how each post fits your schedule.</p>
        </div>

        <p className="sr-only" role="status">{announcement}</p>
        <div className="planner-shell mt-10">
          <div className="planner-controls">
            <label className="text-sm font-semibold">Your business<select value={business} onChange={event => setBusiness(event.target.value as Business)} className="planner-select">{businesses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="text-sm font-semibold">Your goal<select value={goal} onChange={event => setGoal(event.target.value as Goal)} className="planner-select">{goals.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <fieldset className="col-span-2">
              <legend className="mb-2 text-sm font-semibold">Channels</legend>
              <div className="flex flex-wrap gap-2">{available.map((c) => <Chip key={c.id} active={channels.includes(c.id)} onClick={() => toggle(c.id)}>{c.name}</Chip>)}</div>
            </fieldset>
            <div className="col-span-2 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">A sample plan. No account needed to explore.</p><button type="button" onClick={() => apply()} className="btn btn-primary">Preview my week</button></div>
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

          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 md:px-7">
            <p className="text-sm text-muted-foreground">Interactive sample — sign up to generate a plan for your business.</p>
            <button type="button" onClick={() => reset()} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary"><RotateCcw className="h-4 w-4" />Reset sample</button>
          </div>

          <div role="group" aria-label="Days of the week" className="planner-days">
            {plan.map((d, i) => (
              <button
                key={d.day}
                type="button"
                aria-pressed={dayIdx === i}
                aria-controls="planner-day-detail"
                onClick={() => setDayIdx(i)}
                className="planner-day"
              >
                <p className="text-xs font-bold uppercase tracking-wide">{d.day}</p>
                <p className="mt-1 text-[11px] font-semibold text-accent-foreground">{d.angle}</p>
                <p className="mt-1.5 text-sm leading-snug">{d.idea}</p>
              </button>
            ))}
          </div>

          <div id="planner-day-detail" role="region" aria-label={`${day.day} sample post`} className="grid gap-6 border-t bg-surface p-5 md:p-7 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-accent-foreground">{day.angle}</span>
                <span className="text-sm font-semibold">{day.day}</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-muted-foreground">Hook</p>
              <p className="mt-1 font-display text-xl font-bold">{day.hook}</p>
              <label htmlFor="caption" className="mt-4 block text-sm font-semibold text-muted-foreground">Caption (editable)</label>
              <textarea
                id="caption"
                value={caption}
                onChange={(e) => setEdits((s) => ({ ...s, [dayIdx]: e.target.value }))}
                rows={4}
                className="mt-1 w-full rounded-xl border bg-background p-3 text-base leading-relaxed focus:border-primary"
              />
              <p className="mt-2 text-sm font-medium text-primary">{day.hashtags.join(" ")}</p>
            </div>
            <div className="grid content-start gap-4">
              <div className="rounded-xl border bg-background p-4">
                <p className="text-sm font-semibold text-muted-foreground">Platform</p>
                <div className="mt-2 flex items-center gap-3"><PlatformIcon name={p.name} color={p.color} size={32} /><span className="font-semibold">{p.name}</span></div>
                <label htmlFor="time" className="mt-4 block text-sm font-semibold text-muted-foreground">Example time</label>
                <input id="time" value={times[dayIdx] ?? day.time} onChange={(e) => setTimes((s) => ({ ...s, [dayIdx]: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border px-3" />
              </div>
              <a href={SIGNUP_URL} className="btn btn-primary">Create my own plan</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
