"use client";

import { useId, useState } from "react";
import { Hash, X } from "lucide-react";
import { FormField } from "./form-field";
import { cn } from "@/lib/utils";

export function TagInput({ value, onChange, label = "Hashtags", disabled = false, id: suppliedId, className }: { value: string[]; onChange: (value: string[]) => void; label?: string; disabled?: boolean; id?: string; className?: string }) {
  const generated = useId();
  const id = suppliedId ?? generated;
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
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
  return <FormField id={id} label={label} trailing={`${value.length} ${value.length === 1 ? "tag" : "tags"}`} helper="Type a tag and press Enter or Space. Paste several tags at once; use × to remove any tag.">
    <div className={cn("flex min-h-12 min-w-0 flex-wrap items-center gap-2 rounded-lg border border-input bg-background p-2 transition-shadow focus-within:ring-2 focus-within:ring-ring/25", disabled && "cursor-not-allowed opacity-50", className)}>
      {value.map((tag, index) => <span key={`${index}/${tag}`} className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-primary/15 bg-primary/5 py-1 pl-2.5 pr-1 text-sm text-primary"><Hash aria-hidden="true" className="size-3.5 shrink-0" /><span className="break-all">{tag.replace(/^#+/u, "")}</span><button type="button" disabled={disabled} aria-label={`Remove hashtag ${tag.replace(/^#+/u, "")}`} className="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none" onClick={() => { onChange(value.filter((_, position) => position !== index)); setNotice(`Removed ${tag}.`); }}><X aria-hidden="true" className="size-3.5" /></button></span>)}
      <input id={id} disabled={disabled} value={draft} aria-describedby={`${id}-help ${id}-notice`} placeholder="Add a hashtag…" className="min-h-10 min-w-32 max-w-full flex-1 basis-32 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed" onChange={event => setDraft(event.target.value)} onBlur={() => { if (draft.trim()) add(draft); }} onKeyDown={event => { if (event.nativeEvent.isComposing) return; if (["Enter", ",", " "].includes(event.key)) { event.preventDefault(); event.stopPropagation(); if (draft.trim()) add(draft); } }} onPaste={event => { const text = event.clipboardData.getData("text"); if (/[\s,]/u.test(text)) { event.preventDefault(); add(`${draft} ${text}`); } }} />
    </div>
    <span id={`${id}-notice`} role="status" className="sr-only">{notice}</span>
  </FormField>;
}