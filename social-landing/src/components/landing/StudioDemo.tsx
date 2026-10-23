"use client";

import { useId, useState } from "react";
import { ArrowDown, Check, LayoutDashboard } from "lucide-react";
import { platforms } from "@/content/site";
import { PlatformIcon } from "./Brand";

const samples = [
  {
    name: "Product launch",
    brief: "Introduce Northstar, a launch planning workspace for product teams. Explain the product clearly and invite readers to explore it.",
    caption: "Meet Northstar. Bring launch tasks, owners and release checklists into one shared workspace. Explore the product walkthrough to see how a sample launch comes together.",
    tags: "#Northstar #ProductLaunch #B2BSoftware",
    title: "One workspace. A clearer launch.",
    note: "INTRODUCING NORTHSTAR",
  },
  {
    name: "Practical tip",
    brief: "Share one practical launch planning tip for product teams. Focus on clear task ownership.",
    caption: "Give each launch task one owner, a due date and a clear next step. Start with your next release checklist and make the handoffs explicit.",
    tags: "#LaunchPlanning #ProductTeams",
    title: "Every task needs an owner.",
    note: "A PRACTICAL LAUNCH TIP",
  },
  {
    name: "Brand story",
    brief: "Explain why Northstar brings launch planning into one workspace. Keep the story concise and specific.",
    caption: "We are building Northstar around a simple idea: launch plans should make responsibilities clear. Tasks, owners and decisions belong together, where the whole team can review them.",
    tags: "#Northstar #BuildingSoftware",
    title: "Built around the handoff.",
    note: "WHY WE ARE BUILDING NORTHSTAR",
  },
] as const;

export function StudioDemo() {
  const [selected, setSelected] = useState(0);
  const previewId = useId();
  const sample = samples[selected] ?? samples[0];
  const platform = platforms.find((item) => item.id === "linkedin")!;

  return (
    <div className="preview-window overflow-hidden bg-background">
      <div className="window-heading flex items-center justify-between gap-2 border-b px-4 py-4 sm:px-5">
        <p className="text-sm font-semibold">Content Studio</p>
        <span className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground">Try a sample</span>
      </div>
      <div className="p-4 sm:p-5">
        <div role="group" aria-label="Choose a sample brief" className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1">
          {samples.map((item, index) => (
            <button key={item.name} type="button" aria-pressed={selected === index} aria-controls={previewId} onClick={() => setSelected(index)} className={`min-h-11 rounded-lg px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm ${selected === index ? "bg-background text-foreground shadow-card" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"}`}>
              {item.name}
            </button>
          ))}
        </div>
        <div id={previewId} aria-live="polite" aria-atomic="true">
          <details className="mt-3 rounded-xl border p-3">
            <summary className="text-xs font-semibold text-muted-foreground">Content brief · View sample input</summary>
            <p className="mt-2 text-sm leading-relaxed">{sample.brief}</p>
            <div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">Clear & direct</span><span className="rounded-full bg-surface px-2.5 py-1 text-xs text-muted-foreground">Northstar</span></div>
          </details>
          <div className="flex items-center justify-center gap-2 py-3 text-xs font-medium text-primary"><ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> Example draft</div>
          <div className="overflow-hidden rounded-2xl border">
            <div className="flex items-center gap-2.5 border-b px-4 py-3">
              <PlatformIcon name={platform.name} color={platform.color} size={25} />
              <p className="text-xs font-semibold">Northstar</p>
              <span className="ml-auto text-xs text-muted-foreground">{platform.name} preview</span>
            </div>
            <div role="img" aria-label="Illustrative Northstar software workspace showing launch tasks, owners and review states" className="studio-creative bg-primary-soft p-4 text-foreground sm:p-5">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground">{sample.note}</p>
              <p className="mt-2 text-2xl font-semibold leading-tight tracking-tight">{sample.title}</p>
              <div className="mt-4 overflow-hidden rounded-xl border bg-background shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-surface px-3 py-2">
                  <span className="flex items-center gap-2 text-xs font-semibold"><LayoutDashboard className="h-4 w-4 text-primary" aria-hidden="true" />Northstar</span>
                  <span className="text-xs text-muted-foreground">Release checklist</span>
                </div>
                <div className="p-2">
                  <div className="space-y-1">
                    {[
                      { task: "Product brief", owner: "Product", status: "Ready", tone: "bg-mint-soft text-mint-foreground" },
                      { task: "Release checks", owner: "Engineering", status: "In review", tone: "bg-amber-soft text-amber-foreground" },
                      { task: "Launch message", owner: "Marketing", status: "Draft", tone: "bg-primary-soft text-accent-foreground" },
                    ].map((item) => (
                      <div key={item.task} className="studio-task grid items-center gap-2 rounded-lg px-2 py-1.5">
                        <p className="text-xs font-medium">{item.task}<span className="sr-only"> · {item.owner}</span></p>
                        <span className={`justify-self-end rounded-full px-2 py-1 text-xs font-medium ${item.tone}`}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4">
              <details>
                <summary className="text-xs font-semibold text-primary">View caption & hashtags</summary>
                <p className="mt-3 text-sm leading-relaxed">{sample.caption}</p>
                <p className="mt-2 text-xs font-medium text-primary">{sample.tags}</p>
              </details>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />Sample creative</span><span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-mint-foreground" aria-hidden="true" />Editable draft</span></div>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Fictional Northstar sample copy and illustrative product UI, not live AI generation. Review every draft before publishing.</p>
      </div>
    </div>
  );
}