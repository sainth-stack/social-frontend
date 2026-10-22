"use client";

import { createContext, useContext, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AIModelCatalog, AIModelOption, AIModelSelection } from "@/types/ai-models";

const defaults: AIModelSelection = {};
const AIModelContext = createContext<{
  selection: AIModelSelection;
  catalog?: AIModelCatalog;
  status: "loading" | "loaded" | "error";
  retry: () => void;
  select: (kind: keyof AIModelSelection, value: string) => void;
} | null>(null);

export function AIModelSelectionProvider({ orgId, children }: { orgId: string; children: ReactNode }) {
  const [scope, setScope] = useState({ orgId, selection: defaults });
  const [resource, setResource] = useState<{ orgId: string; catalog?: AIModelCatalog; status: "loading" | "loaded" | "error" }>({ orgId, status: "loading" });
  const [attempt, setAttempt] = useState(0);

  if (scope.orgId !== orgId) setScope({ orgId, selection: defaults });

  useEffect(() => {
    let active = true;
    setResource({ orgId, status: "loading" });
    void socialMediaApi.getAIModels(orgId).then(
      (catalog) => { if (active) setResource({ orgId, catalog, status: "loaded" }); },
      () => { if (active) setResource({ orgId, status: "error" }); },
    );
    return () => { active = false; };
  }, [orgId, attempt]);

  const selection = scope.orgId === orgId ? scope.selection : defaults;
  const current = resource.orgId === orgId ? resource : undefined;
  const value = useMemo(() => ({
    selection,
    catalog: current?.catalog,
    status: current?.status ?? "loading" as const,
    retry: () => setAttempt((value) => value + 1),
    select: (kind: keyof AIModelSelection, value: string) => setScope((previous) => ({
      orgId,
      selection: { ...(previous.orgId === orgId ? previous.selection : defaults), [kind]: value === "default" ? undefined : value },
    })),
  }), [selection, current, orgId]);

  return <AIModelContext.Provider value={value}>{children}</AIModelContext.Provider>;
}

export function useAIModelSelection(): AIModelSelection {
  return useContext(AIModelContext)?.selection ?? defaults;
}

function ModelSelect({ label, models, value, onChange, defaultId }: {
  label: string;
  models: AIModelOption[];
  value?: string;
  onChange: (value: string) => void;
  defaultId?: string | null;
}) {
  const id = useId();
  const selected = models.find((model) => model.id === value);
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-foreground">{label}</label>
      <Select value={value ?? "default"} onValueChange={onChange}>
        <SelectTrigger id={id} aria-describedby={`${id}-note`} className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Server default</SelectItem>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id}>{model.label} · {model.provider}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id={`${id}-note`} className="break-words text-xs text-muted-foreground">
        {selected
          ? `Region: ${selected.region}. ${selected.availability === "unknown" ? "Availability unknown; discovery unavailable or not permitted." : "Listed in regional catalog."} Invocation access not verified. Inference profiles may route across regions.`
          : `Uses server configuration${defaultId ? ` (${defaultId})` : ""}. Invocation access not verified.`}
        {selected?.warning ? ` ${selected.warning}` : ""}
      </p>
    </div>
  );
}

export function AIModelSelector() {
  const context = useContext(AIModelContext);
  if (!context) return null;
  const { catalog, selection, status, select, retry } = context;
  return (
    <section aria-label="AI model debug controls" className="space-y-2 rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">Debug models · This session only; workspace settings are unchanged.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <ModelSelect label="Text model" models={catalog?.textModels ?? []} value={selection.textModel} onChange={(value) => select("textModel", value)} defaultId={catalog?.defaultTextModelId} />
        <ModelSelect label="Image model" models={catalog?.imageModels ?? []} value={selection.imageModel} onChange={(value) => select("imageModel", value)} defaultId={catalog?.defaultImageModelId} />
      </div>
      {status === "loading" && <p role="status" className="text-xs text-muted-foreground">Loading model catalog. Server defaults remain available.</p>}
      {status === "error" && (
        <p role="alert" className="text-xs text-muted-foreground">
          Model catalog unavailable. You can still create using server defaults.{" "}
          <button type="button" onClick={retry} className="rounded-sm font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Retry</button>
        </p>
      )}
    </section>
  );
}