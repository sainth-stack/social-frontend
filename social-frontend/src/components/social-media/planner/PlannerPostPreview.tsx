"use client";

import { useEffect, useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import ResponsivePhonePreview from "@/components/social-media/ai-studio/ResponsivePhonePreview";
import FeedPostCard from "@/components/social-media/workflow/FeedPostCard";
import { Button } from "@/components/ui/button";
import type { RunItem } from "@/types/planner";
import { imageStageLabel } from "./planner-review";
import { formatPostBody } from "@/lib/socialCaption";

export function PlannerArtwork({ item, thumbnail = false }: { item: RunItem; thumbnail?: boolean }) {
  const url = item.post?.imageUrl;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (item.visualState === "processing") return <div role="status" className={`flex items-center justify-center gap-2 rounded-lg bg-muted p-4 text-xs text-muted-foreground ${thumbnail ? "size-24 shrink-0" : "min-h-64"}`}><Loader2 className="size-5 shrink-0 animate-spin motion-reduce:animate-none" /><span>{imageStageLabel(item)}</span></div>;
  if (!url || failed) return <div className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground ${thumbnail ? "size-24 shrink-0" : "min-h-48"}`}><ImageIcon className="size-5" /><span>{failed ? "Preview unavailable" : item.visualState === "failed" ? "Image failed" : item.imageIntent === "text_only" ? "Text only" : "No image yet"}</span>{failed && !thumbnail && <Button variant="ghost" onClick={() => setFailed(false)}>Reload preview</Button>}</div>;
  return <img src={url} alt={thumbnail ? "Post artwork thumbnail" : "Post artwork in feed preview"} className={thumbnail ? "size-24 shrink-0 rounded-lg border object-cover" : "max-h-96 w-full bg-muted object-contain"} onError={() => setFailed(true)} />;
}

export default function PlannerPostPreview({ item, accountName, caption, hashtags, firstComment, unsaved }: { item: RunItem; accountName: string; caption: string; hashtags: string; firstComment: string; unsaved: boolean }) {
  const platform = item.slot.platform;
  const body = formatPostBody(caption, hashtags ? hashtags.split("\n") : []);
  const commentLabel = platform === "linkedin" ? "First comment draft · Manual copy only" : `First comment · ${accountName}`;
  const showArtwork = item.post?.imageUrl || item.visualState === "processing" || item.visualState === "failed" || platform === "instagram";
  return <section aria-label="Live post preview" className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Feed preview</h3>{unsaved && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">Unsaved live copy</span>}</div>
    {(item.visualState === "stale" || unsaved && !!item.post?.imageUrl) && <p role="status" className="rounded-lg border p-3 text-xs text-muted-foreground">Artwork belongs to an older approved version. Save and approve your text before creating matching artwork.</p>}
    <ResponsivePhonePreview><FeedPostCard key={`${item.id}:${platform}`} platform={platform} displayName={accountName} body={body} firstComment={firstComment.replace(/\r\n?/g, "\n").trim()} commentLabel={commentLabel} mediaSlot={showArtwork ? <PlannerArtwork item={item} /> : null} /></ResponsivePhonePreview>
    <p className="text-xs text-muted-foreground">Illustrative feed layout. Your platform may format the final post differently.</p>
  </section>;
}