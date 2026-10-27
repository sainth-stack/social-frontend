"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormInput, FormTextarea } from "@/components/ui/form-field";
import { TagInput } from "@/components/ui/tag-input";
import { DatePicker } from "@/components/ui/date-picker";
import { formatPostBody } from "@/lib/socialCaption";
import { FirstCommentDelivery } from "@/components/social-media/FirstCommentDelivery";
import MediaPicker from "@/components/social-media/media/MediaPicker";
import type { CopyEdit, RunItem, SlotEdit } from "@/types/planner";
import { displayTime, itemBusy, savedCopy, workspaceDate } from "./planner-review";
import PlannerPostPreview from "./PlannerPostPreview";

export function PlannerImagePreview({ url, state }: { url: string | null | undefined; state: string }) {
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => { setFailed(false); setVersion(0); }, [url]);
  if (!url) return <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{state === "failed" ? "Image generation failed. Saved text is preserved. Review the error before choosing retry or new artwork." : state === "processing" ? "Image work is in progress. You can close this view and return later." : "No image attached. Instagram requires an image; Facebook and LinkedIn may use text only."}</p>;
  return <div className="space-y-3">{state !== "ready" && <p className="text-sm text-destructive">This attachment is not a current ready visual ({state.replaceAll("_", " ")}). Do not treat it as approved artwork.</p>}{failed ? <div role="alert" className="rounded-lg border border-destructive p-4 text-sm"><p>Image preview could not load. This is not a successful black-image preview.</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => { setFailed(false); setVersion(value => value + 1); }}>Retry preview loading</Button><p className="mt-2 text-muted-foreground">If the URL expired, close this view and refresh the saved run. No image credits are used by reloading.</p></div> : <img key={`${url}/${version}`} src={url} alt="Full generated artwork for this saved post" className="max-h-96 w-full rounded-lg border bg-muted object-contain" onError={() => setFailed(true)} />}<a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-primary">Open full-size image</a></div>;
}

export default function PlannerItemEditor({ item, canEdit, busy, error, onClose, onSave, onSlot, onMove, index, total, accountName = "Connected account", workspaceId, onAttach, onApprove }: {
  item: RunItem; canEdit: boolean; busy: boolean; error: string; onClose: () => void;
  onSave: (payload: CopyEdit) => Promise<boolean>; onSlot: (payload: SlotEdit) => Promise<boolean>;
  onMove: (direction: number) => void; index: number; total: number;
  accountName?: string; workspaceId?: string; onAttach?: (assetId: string) => Promise<boolean>; onApprove?: () => void;
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
  const [mediaOpen, setMediaOpen] = useState(false);
  const previous = useRef({ copy: initial, date: item.slot.date, time: item.slot.time ?? "" });
  const saved = savedCopy(item);
  const copyDirty = caption !== saved.caption || hashtags !== saved.hashtags.join("\n") || firstComment !== saved.firstComment;
  const slotDirty = date !== item.slot.date || time !== (item.slot.time ?? "") || offset !== "";
  const dirty = copyDirty || slotDirty;
  const bodyLength = Array.from(formatPostBody(caption, hashtags ? hashtags.split("\n") : [])).length;
  const bodyLimit = item.slot.platform === "linkedin" ? 3000 : 2200;
  const bodyOverflow = bodyLength > bodyLimit;
  const disabled = !canEdit || item.isScheduled || itemBusy(item) || busy;

  useEffect(() => {
    const old = previous.current;
    const next = savedCopy(item);
    if (caption === old.copy.caption && hashtags === old.copy.hashtags.join("\n") && firstComment === old.copy.firstComment) {
      setCaption(next.caption); setHashtags(next.hashtags.join("\n")); setFirstComment(next.firstComment);
    }
    if (date === old.date && time === old.time) { setDate(item.slot.date); setTime(item.slot.time ?? ""); }
    previous.current = { copy: next, date: item.slot.date, time: item.slot.time ?? "" };
  }, [item, caption, hashtags, firstComment, date, time]);

  useEffect(() => { setMediaOpen(false); }, [workspaceId, item.id, item.revision]);

  useEffect(() => {
    if (!dirty) return;
    const previousUrl = location.href;
    const previousState: unknown = history.state;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const navigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (target?.getAttribute("target") === "_blank") return;
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

  const leave = (action: () => void) => { if (busy && dirty) return; if (dirty) setDiscard(() => action); else action(); };
  const save = async () => {
    if (!item.revision) return;
    const parsed = hashtags === "" ? [] : hashtags.split("\n");
    if (await onSave({ expectedRevision: item.revision, caption, hashtags: parsed, firstComment })) {
      setHashtags(parsed.join("\n"));
    }
  };

  return <>
    <Dialog open onOpenChange={open => { if (!open) leave(onClose); }}><DialogContent className="flex h-dvh max-h-dvh w-full max-w-6xl flex-col overflow-hidden rounded-none p-4 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)] sm:rounded-xl" onInteractOutside={event => { if (dirty) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Review your post</DialogTitle><DialogDescription>{accountName} · {item.slot.date} · {item.slot.time} · {item.slot.timezone} · Post {index + 1} of {total}</DialogDescription></DialogHeader>
      <div className="flex gap-2 md:hidden"><Button className="min-h-11" variant={tab === "copy" ? "default" : "outline"} onClick={() => setTab("copy")}>Copy</Button><Button className="min-h-11" variant={tab === "preview" ? "default" : "outline"} onClick={() => setTab("preview")}>Preview</Button></div>
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 items-start gap-6 overflow-y-auto overscroll-contain pr-1 md:grid-cols-2">
        <div className={`${tab !== "copy" ? "hidden md:block" : ""} min-w-0 space-y-4`}>
          <fieldset disabled={disabled || !item.post || !item.revision} className="min-w-0 space-y-5">
            <FormTextarea label="Caption" rows={12} value={caption} maxLength={10000} trailing={`${bodyLength.toLocaleString()} / ${bodyLimit.toLocaleString()}`} error={bodyOverflow ? "Your post is over the platform limit, including hashtags. Shorten it before approval or scheduling." : undefined} helper="Paragraph spacing is preserved. The count includes hashtags and the blank line before them." className="min-h-72 max-h-128 resize-none overflow-y-auto [field-sizing:content]" onChange={event => setCaption(event.target.value)} />
            <TagInput value={hashtags ? hashtags.split("\n") : []} disabled={disabled || !item.post || !item.revision} onChange={values => setHashtags(values.join("\n"))} />
            <FormTextarea label="First comment" trailing="Optional" rows={4} value={firstComment} maxLength={10000} placeholder="Add a conversation starter or supporting detail…" helper="Keep extra context here without adding it to your caption." className="min-h-28 max-h-64 resize-none overflow-y-auto [field-sizing:content]" onChange={event => setFirstComment(event.target.value)} />
            {!!firstComment.trim() && <FirstCommentDelivery platform={item.slot.platform} state={copyDirty ? null : item.post?.platforms.find(row => row.platform === item.slot.platform)?.firstCommentState} />}
            <div className="space-y-3 rounded-lg bg-muted/40 p-3"><p className="text-xs leading-relaxed text-muted-foreground">{copyDirty ? "Save your edits, then approve the updated text before creating artwork." : item.copyApproved ? "Text approved. You can choose an image or create artwork next. Editing this text will require approval again." : "Happy with your post? Approve the text before creating artwork. This does not schedule or publish it."}</p>{!copyDirty && !item.copyApproved && item.post && item.revision && onApprove && <Button className="min-h-11" onClick={onApprove}>Approve text</Button>}</div>
          </fieldset>
          <details open={!item.post} className="rounded-lg border px-3"><summary className="cursor-pointer py-3 text-sm font-medium">Posting date and time</summary><fieldset disabled={disabled} className="min-w-0 space-y-3 pb-3"><legend className="pb-3 text-xs text-muted-foreground">Timezone: {item.slot.timezone}</legend><DatePicker mode="single" label="Date" today={workspaceDate(item.slot.timezone)} value={date} disabled={disabled} onValueChange={value => { setDate(value); setOffset(""); }} /><FormInput label="Time" type="time" value={time} onChange={event => { setTime(event.target.value); setOffset(""); }} />{(item.slot.reasons.includes("ambiguous_local_time_choose_utc_offset") || error.toLowerCase().includes("offset")) && <FormInput label="UTC offset minutes (daylight saving)" type="number" min={-840} max={840} value={offset} onChange={event => setOffset(event.target.value)} />}<Button variant="outline" className="min-h-11" disabled={!slotDirty || !date || !time || date < workspaceDate(item.slot.timezone)} onClick={async () => { if (await onSlot({ date, time, timezone: item.slot.timezone, ...(offset === "" ? {} : { utcOffsetMinutes: Number(offset) }) })) setOffset(""); }}>Save proposed time</Button></fieldset></details>
          {onAttach && <div className="space-y-2"><Button variant="outline" className="min-h-11" disabled={disabled || dirty || !item.copyApproved || !item.revision || !workspaceId} onClick={() => setMediaOpen(true)}>Choose from media</Button><p className="text-xs text-muted-foreground">After approving saved text, upload or paste an image, choose stock, or reuse your library. No image generation credits are used. Planner supports images only; save videos through the Studio media library as drafts, not scheduled posts.</p></div>}
          {item.post?.imageUrl && <details><summary className="cursor-pointer py-3 text-sm text-primary">Inspect full artwork</summary><PlannerImagePreview url={item.post.imageUrl} state={copyDirty ? "stale" : item.visualState} /></details>}
        </div>
        <div className={`${tab !== "preview" ? "hidden md:block" : ""} min-w-0 space-y-4`}><PlannerPostPreview item={item} accountName={accountName} caption={caption} hashtags={hashtags} firstComment={firstComment} unsaved={copyDirty} /><p className="text-xs text-muted-foreground">{item.isScheduled ? "Scheduled" : "Proposed, not scheduled"}: {displayTime(item.proposedAt, item.slot.timezone)}</p></div>
      </div>
      {(error || item.error) && <p role="alert" className="text-sm text-destructive">{error || item.error}</p>}
      <DialogFooter className="shrink-0 flex-row flex-wrap border-t bg-background pt-3 pb-safe"><Button variant="secondary" className="min-h-11" disabled={busy && dirty} onClick={() => leave(onClose)}>Back to run</Button><Button variant="outline" className="min-h-11" disabled={busy && dirty || index === 0} onClick={() => leave(() => onMove(-1))}>Previous item</Button><Button variant="outline" className="min-h-11" disabled={busy && dirty || index >= total - 1} onClick={() => leave(() => onMove(1))}>Next item</Button>{canEdit && <Button className="min-h-11" disabled={disabled || !copyDirty || !caption.trim() || !item.revision} onClick={() => void save()}>{busy && copyDirty ? "Saving…" : "Save copy"}</Button>}</DialogFooter>
    </DialogContent></Dialog>
    <MediaPicker workspaceId={workspaceId ?? ""} open={mediaOpen && canEdit && !item.isScheduled && !dirty && item.copyApproved} onOpenChange={setMediaOpen} allowedTypes={["image"]} contextKey={`${item.id}/${item.revision}`} onSelect={asset => {
      if (disabled || dirty || !item.copyApproved || !item.revision || asset.mediaType !== "image" || !onAttach) return false;
      return onAttach(asset.id);
    }} />
    <Dialog open={!!discard} onOpenChange={open => { if (!open) setDiscard(null); }}><DialogContent><DialogHeader><DialogTitle>Discard unsaved changes?</DialogTitle><DialogDescription>Your saved copy and artwork will remain unchanged.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" className="min-h-11" onClick={() => setDiscard(null)}>Keep editing</Button><Button className="min-h-11" onClick={() => { const action = discard; setDiscard(null); action?.(); }}>Discard changes</Button></DialogFooter></DialogContent></Dialog>
  </>;
}