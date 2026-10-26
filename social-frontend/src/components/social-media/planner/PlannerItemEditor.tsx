"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CopyEdit, RunItem, SlotEdit } from "@/types/planner";
import { displayTime, itemBusy, savedCopy } from "./planner-review";

export function PlannerImagePreview({ url, state }: { url: string | null | undefined; state: string }) {
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => { setFailed(false); setVersion(0); }, [url]);
  if (!url) return <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{state === "failed" ? "Image generation failed. Saved text is preserved; retry the existing image operation." : "No image attached. Instagram requires an image; Facebook and LinkedIn may use text only."}</p>;
  return <div className="space-y-3">{state !== "ready" && <p className="text-sm text-destructive">This attachment is not a current ready visual ({state.replaceAll("_", " ")}). Do not treat it as approved artwork.</p>}{failed ? <div role="alert" className="rounded-lg border border-destructive p-4 text-sm"><p>Image preview could not load. This is not a successful black-image preview.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => { setFailed(false); setVersion(value => value + 1); }}>Retry preview loading</Button><p className="mt-2 text-muted-foreground">If the URL expired, close this view and refresh the saved run. No image credits are used by reloading.</p></div> : <img key={`${url}/${version}`} src={url} alt="Full generated artwork for this saved post" className="max-h-96 w-full rounded-lg border bg-muted object-contain" onError={() => setFailed(true)} />}<a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-primary">Open full-size image</a></div>;
}

export default function PlannerItemEditor({ item, canEdit, busy, error, onClose, onSave, onSlot, onMove, index, total }: {
  item: RunItem; canEdit: boolean; busy: boolean; error: string; onClose: () => void;
  onSave: (payload: CopyEdit) => Promise<boolean>; onSlot: (payload: SlotEdit) => Promise<boolean>;
  onMove: (direction: number) => void; index: number; total: number;
}) {
  const initial = savedCopy(item);
  const [caption, setCaption] = useState(initial.caption);
  const [hashtags, setHashtags] = useState(initial.hashtags.join("\n"));
  const [firstComment, setFirstComment] = useState(initial.firstComment);
  const [date, setDate] = useState(item.slot.date);
  const [time, setTime] = useState(item.slot.time ?? "");
  const [offset, setOffset] = useState("");
  const [tab, setTab] = useState("copy");
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  const saved = savedCopy(item);
  const copyDirty = caption !== saved.caption || hashtags !== saved.hashtags.join("\n") || firstComment !== saved.firstComment;
  const slotDirty = date !== item.slot.date || time !== (item.slot.time ?? "") || offset !== "";
  const dirty = copyDirty || slotDirty;
  const disabled = !canEdit || item.isScheduled || itemBusy(item) || busy;

  useEffect(() => {
    if (!dirty && !busy) return;
    const previousUrl = location.href;
    const previousState: unknown = history.state;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (target && (busy || !window.confirm("Discard unsaved planner edits and leave?"))) { event.preventDefault(); event.stopPropagation(); }
    };
    const popstate = (event: PopStateEvent) => {
      if (location.href === previousUrl) return;
      if (busy || !window.confirm("Discard unsaved planner edits and leave?")) {
        event.stopImmediatePropagation();
        history.pushState(previousState, "", previousUrl);
      }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("popstate", popstate, true);
    document.addEventListener("click", navigation, true);
    return () => { window.removeEventListener("beforeunload", unload); window.removeEventListener("popstate", popstate, true); document.removeEventListener("click", navigation, true); };
  }, [dirty, busy]);

  const leave = (action: () => void) => { if (busy) return; if (dirty) setDiscard(() => action); else action(); };
  const save = async () => {
    if (!item.revision) return;
    const parsed = hashtags === "" ? [] : hashtags.split("\n");
    if (await onSave({ expectedRevision: item.revision, caption, hashtags: parsed, firstComment })) {
      setHashtags(parsed.join("\n"));
    }
  };

  return <>
    <Dialog open onOpenChange={open => { if (!open) leave(onClose); }}><DialogContent className="max-w-5xl" onInteractOutside={event => { if (busy || dirty) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Review saved {item.slot.platform} post</DialogTitle><DialogDescription>{item.slot.date} · {item.slot.time} · {item.slot.timezone} · Item {index + 1} of {total}. Copy approval is separate from team publishing approval.</DialogDescription></DialogHeader>
      <div className="flex gap-2 md:hidden"><Button className="min-h-11" variant={tab === "copy" ? "default" : "outline"} onClick={() => setTab("copy")}>Copy</Button><Button className="min-h-11" variant={tab === "preview" ? "default" : "outline"} onClick={() => setTab("preview")}>Preview</Button></div>
      <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
        <div className={`${tab !== "copy" ? "hidden md:block" : ""} min-w-0 space-y-4`}>
          <fieldset disabled={disabled} className="min-w-0 space-y-4"><label className="block space-y-2 text-sm font-medium">Caption<Textarea rows={7} value={caption} maxLength={10000} onChange={event => setCaption(event.target.value)} /></label><label className="block space-y-2 text-sm font-medium">Hashtags (one saved value per line)<Textarea rows={3} value={hashtags} onChange={event => setHashtags(event.target.value)} /></label><label className="block space-y-2 text-sm font-medium">First comment<Textarea rows={3} value={firstComment} maxLength={10000} onChange={event => setFirstComment(event.target.value)} /></label><p className="text-xs text-muted-foreground">Saving changed copy clears text approval and makes older artwork stale. Whitespace and saved hashtag values are not silently rewritten.</p><Button className="min-h-11" disabled={!copyDirty || !caption.trim() || !item.revision} onClick={() => void save()}>Save copy</Button></fieldset>
          <fieldset disabled={disabled} className="min-w-0 space-y-3 rounded-lg border p-3"><legend className="px-1 text-sm font-medium">Exact proposed time · {item.slot.timezone}</legend><label className="block space-y-2 text-sm">Date<Input type="date" className="min-h-11" value={date} onChange={event => setDate(event.target.value)} /></label><label className="block space-y-2 text-sm">Time<Input type="time" className="min-h-11" value={time} onChange={event => { setTime(event.target.value); setOffset(""); }} /></label><label className="block space-y-2 text-sm">UTC offset minutes (if ambiguous)<Input className="min-h-11" type="number" min={-840} max={840} value={offset} onChange={event => setOffset(event.target.value)} /></label><Button variant="outline" className="min-h-11" disabled={!slotDirty || !date || !time} onClick={async () => { if (await onSlot({ date, time, timezone: item.slot.timezone, ...(offset === "" ? {} : { utcOffsetMinutes: Number(offset) }) })) setOffset(""); }}>Save proposed time</Button></fieldset>
        </div>
        <div className={`${tab !== "preview" ? "hidden md:block" : ""} min-w-0 space-y-4`}><h3 className="text-sm font-semibold">Exact saved copy</h3>{copyDirty && <p className="text-sm text-primary">Unsaved changes are not shown in this saved-content preview.</p>}<div className="space-y-4 rounded-lg border p-4"><p className="whitespace-pre-wrap break-words text-sm">{saved.caption}</p><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{saved.hashtags.join(" ")}</p>{saved.firstComment && <div className="border-t pt-3"><h4 className="mb-2 text-xs font-semibold">Saved first comment</h4><p className="whitespace-pre-wrap break-words text-sm">{saved.firstComment}</p></div>}</div><PlannerImagePreview url={item.post?.imageUrl} state={item.visualState} /><p className="text-xs text-muted-foreground">Proposed, not scheduled: {displayTime(item.proposedAt, item.slot.timezone)} · {item.slot.timezone}</p></div>
      </div>
      {(error || item.error) && <p role="alert" className="text-sm text-destructive">{error || item.error}</p>}
      <DialogFooter><Button variant="outline" className="min-h-11" disabled={busy || index === 0} onClick={() => leave(() => onMove(-1))}>Previous item</Button><Button variant="outline" className="min-h-11" disabled={busy || index >= total - 1} onClick={() => leave(() => onMove(1))}>Next item</Button><Button variant="secondary" className="min-h-11" disabled={busy} onClick={() => leave(onClose)}>Back to run</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!discard} onOpenChange={open => { if (!open) setDiscard(null); }}><DialogContent><DialogHeader><DialogTitle>Discard unsaved changes?</DialogTitle><DialogDescription>Your saved copy and artwork will remain unchanged.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" className="min-h-11" onClick={() => setDiscard(null)}>Keep editing</Button><Button className="min-h-11" onClick={() => { const action = discard; setDiscard(null); action?.(); }}>Discard changes</Button></DialogFooter></DialogContent></Dialog>
  </>;
}