"use client";

import { useId, useState, type ReactNode } from "react";
import { Hash, X } from "lucide-react";
import { FormField } from "./form-field";
import { cn } from "@/lib/utils";

export function TagInput({ value, onChange, label = "Hashtags", disabled = false, id: suppliedId, className, compact = false, helper }: { value: string[]; onChange: (value: string[]) => void; label?: string; disabled?: boolean; id?: string; className?: string; compact?: boolean; helper?: ReactNode | null }) {
  const generated = useId();
  const id = suppliedId ?? generated;
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const defaultHelper = compact ? null : "Type a tag and press Enter or Space. Paste several tags at once; use × to remove any tag.";
  const fieldHelper = helper !== undefined ? helper : defaultHelper;
  const add = (input: string) => {
    if (disabled) return;
    const additions = input.split(/[\s,]+/u).map(tag => tag.replace(/^#+/u, "")).filter(Boolean);
    const seen = new Set(value.map(tag => tag.replace(/^#+/u, "").toLocaleLowerCase()));
    const next = [...value];
    for (const tag of additions) {
      if (!seen.has(tag.toLocaleLowerCase())) { next.push(tag); seen.add(tag.toLocaleLowerCase()); }
    }
    if (next.length !== value.length) onChange(next);
    setNotice(additions.length && next.length === value.length ? "That hashtag is already added." : "");
    setDraft("");
  };
  return <FormField id={id} label={label} trailing={`${value.length} ${value.length === 1 ? "tag" : "tags"}`} helper={fieldHelper} className={compact ? "space-y-1.5" : undefined}>
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background p-1.5 transition-shadow focus-within:ring-2 focus-within:ring-ring/25", !compact && "min-h-12 gap-2 p-2", disabled && "cursor-not-allowed opacity-50", className)}>
      {value.map((tag, index) => {
        const tagLabel = tag.replace(/^#+/u, "");
        return (
          <span
            key={`${index}/${tag}`}
            className={cn(
              "inline-flex min-w-0 max-w-full items-center gap-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary",
              compact ? "py-0.5 pl-2 pr-0.5 text-xs" : "gap-1 py-1 pl-2.5 pr-1 text-sm",
            )}
          >
            {compact ? (
              <span className="break-all font-medium">#{tagLabel}</span>
            ) : (
              <>
                <Hash aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="break-all">{tagLabel}</span>
              </>
            )}
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove hashtag ${tagLabel}`}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none",
                compact ? "size-6" : "size-8",
              )}
              onClick={() => {
                onChange(value.filter((_, position) => position !== index));
                setNotice(`Removed ${tag}.`);
              }}
            >
              <X aria-hidden="true" className={compact ? "size-3" : "size-3.5"} />
            </button>
          </span>
        );
      })}
      <input
        id={id}
        disabled={disabled}
        value={draft}
        aria-describedby={`${id}-help ${id}-notice`}
        placeholder={value.length ? "Add…" : "Add hashtag…"}
        className={cn(
          "min-w-0 flex-1 basis-24 bg-transparent px-1.5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
          compact ? "min-h-8 text-xs" : "min-h-10 min-w-32 max-w-full basis-32 text-sm",
        )} onChange={event => setDraft(event.target.value)} onBlur={() => { if (draft.trim()) add(draft); }} onKeyDown={event => { if (event.nativeEvent.isComposing) return; if (["Enter", ",", " "].includes(event.key)) { event.preventDefault(); event.stopPropagation(); if (draft.trim()) add(draft); } }} onPaste={event => { const text = event.clipboardData.getData("text"); if (/[\s,]/u.test(text)) { event.preventDefault(); add(`${draft} ${text}`); } }} />
    </div>
    <span id={`${id}-notice`} role="status" className="sr-only">{notice}</span>
  </FormField>;
}