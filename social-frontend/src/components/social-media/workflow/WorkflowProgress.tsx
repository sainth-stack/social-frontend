"use client";

import { cn } from "@/lib/utils";

export type WorkflowStep = { id: string; label: string; complete?: boolean };

export function WorkflowProgress({ steps, activeStep, onStepChange }: {
  steps: readonly WorkflowStep[];
  activeStep: string;
  onStepChange: (id: string) => void;
}) {
  return <nav aria-label="Post workflow"><ol className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-card p-1">
    {steps.map((step, index) => <li key={step.id} className="min-w-0"><button type="button" aria-current={activeStep === step.id ? "step" : undefined} onClick={() => onStepChange(step.id)} className={cn("flex min-h-11 w-full flex-wrap items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", activeStep === step.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs">{step.complete ? "✓" : index + 1}</span>{step.label}
      {step.complete && <span className="sr-only">complete</span>}
    </button></li>)}
  </ol></nav>;
}