"use client";

import { useEffect, useState } from "react";
import { Heart, MessageCircle, MoreHorizontal, Send, Bookmark, ThumbsUp, Share2, Globe, ImageIcon, Loader2 } from "lucide-react";
import ResponsivePhonePreview from "@/components/social-media/ai-studio/ResponsivePhonePreview";
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
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [item.id]);
  const body = formatPostBody(caption, hashtags ? hashtags.split("\n") : []);
  const longCaption = body.length > 300;
  const commentPreview = firstComment && <div className="break-words border-t p-4 text-sm"><p className="mb-1 text-xs text-muted-foreground">{platform === "linkedin" ? "First comment draft · Manual copy only" : `First comment · ${accountName}`}</p><p className="whitespace-pre-wrap">{firstComment.replace(/\r\n?/g, "\n").trim()}</p></div>;
  const copy = <div className="space-y-2 break-words p-4 text-sm leading-relaxed"><p className="whitespace-pre-wrap">{longCaption && !expanded ? `${body.slice(0, 300).trimEnd()}…` : body}</p>{longCaption && <button type="button" className="inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "See less" : "See more"}</button>}</div>;
  return <section aria-label="Live post preview" className="min-w-0 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Feed preview</h3>{unsaved && <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">Unsaved live copy</span>}</div>{(item.visualState === "stale" || unsaved && !!item.post?.imageUrl) && <p role="status" className="rounded-lg border p-3 text-xs text-muted-foreground">Artwork belongs to an older approved version. Save and approve your text before creating matching artwork.</p>}<ResponsivePhonePreview><article className="min-w-0 bg-card text-card-foreground"><div className="border-b px-4 py-3 text-lg font-semibold capitalize">{platform === "instagram" ? "Instagram" : platform === "linkedin" ? "LinkedIn" : "Facebook"}</div><header className="flex items-center gap-3 p-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{accountName.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{accountName}</p><p className="flex items-center gap-1 text-xs text-muted-foreground">Post preview <Globe className="size-3" /></p></div><MoreHorizontal aria-hidden className="size-5" /></header>{platform !== "instagram" && copy}{(item.post?.imageUrl || item.visualState === "processing" || platform === "instagram") && <PlannerArtwork item={item} />}<div aria-hidden className="flex items-center gap-4 border-t px-4 py-3 text-muted-foreground">{platform === "instagram" ? <><Heart className="size-5" /><MessageCircle className="size-5" /><Send className="size-5" /><Bookmark className="ml-auto size-5" /></> : <><ThumbsUp className="size-5" /><MessageCircle className="size-5" /><Share2 className="size-5" /></>}</div>{platform === "instagram" && copy}{commentPreview}</article></ResponsivePhonePreview><p className="text-xs text-muted-foreground">Illustrative feed layout. Your platform may format the final post differently.</p></section>;
}