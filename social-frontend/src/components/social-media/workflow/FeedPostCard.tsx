"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PLATFORM_LABELS, type CarouselSlide, type SocialPlatform, type SocialPostMedia, type StoredTweet } from "@/types/social-media.types";

type FeedPostCardProps = {
  platform: SocialPlatform;
  displayName: string;
  handle?: string;
  pictureUrl?: string | null;
  body: string;
  firstComment?: string | null;
  commentLabel?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  slides?: CarouselSlide[];
  media?: SocialPostMedia[];
  tweets?: StoredTweet[];
  pollOptions?: string[];
  mediaSlot?: ReactNode;
};

export default function FeedPostCard({ platform, displayName, handle, pictureUrl, body, firstComment, commentLabel, imageUrl, videoUrl, slides, media, tweets, pollOptions, mediaSlot }: FeedPostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const bodyId = useId();
  const entries = slides?.length
    ? slides.map(slide => ({ key: `slide:${slide.id}`, slide, asset: media?.find(asset => asset.slideId === slide.id) }))
    : media?.map((asset, index) => ({ key: `media:${index}`, slide: undefined, asset })) ?? [];
  const activeIndex = Math.max(0, entries.findIndex(entry => entry.key === selection));
  const entry = entries[activeIndex];
  const url = entry ? entry.asset?.url || entry.slide?.imageUrl : videoUrl || imageUrl;
  const video = entry ? entry.asset?.mimeType?.startsWith("video/") : Boolean(videoUrl);
  const longCaption = body.length > 300;
  const copy = <>
    <p id={bodyId} className="whitespace-pre-wrap break-words p-4 text-sm leading-relaxed">{body ? longCaption && !expanded ? `${body.slice(0, 300)}…` : body : <span className="text-muted-foreground">Your post will appear here.</span>}</p>
    {longCaption && <Button type="button" variant="ghost" size="sm" className="mx-4 mb-3 min-h-11" aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded(value => !value)}>{expanded ? "See less" : "See more"}</Button>}
  </>;
  const artwork = mediaSlot !== undefined ? mediaSlot : entries.length > 0 || url ? <div className="min-w-0 bg-muted/30">
    {url ? video ? <video src={url} controls preload="none" aria-label={`${PLATFORM_LABELS[platform]} video preview`} className="block max-h-96 w-full" /> : <img src={url} alt={entry?.slide?.headline || `${PLATFORM_LABELS[platform]} artwork ${activeIndex + 1}`} width={entry?.asset?.width ?? undefined} height={entry?.asset?.height ?? undefined} className="block h-auto w-full object-contain" /> : <div className="space-y-3 break-words p-8">
      <p className="text-center text-sm text-muted-foreground">Slide {activeIndex + 1} artwork not generated</p>
      {!entry?.slide?.renderedAsset && <>
        {entry?.slide?.headline && <p className="whitespace-pre-wrap text-lg font-semibold">{entry.slide.headline}</p>}
        {entry?.slide?.body && <p className="whitespace-pre-wrap text-sm">{entry.slide.body}</p>}
      </>}
    </div>}
    {entries.length > 1 && <nav aria-label="Preview slides" className="flex flex-wrap items-center justify-center gap-2 p-3">{entries.map((entry, index) => <Button key={entry.key} type="button" size="sm" className="min-h-11 min-w-11" variant={activeIndex === index ? "default" : "outline"} aria-label={`Show slide ${index + 1}`} aria-pressed={activeIndex === index} onClick={() => setSelection(entry.key)}>{index + 1}</Button>)}</nav>}
  </div> : null;

  return <article aria-label={`${PLATFORM_LABELS[platform]} post preview`} className="min-w-0 bg-card text-card-foreground">
    <header className="flex min-w-0 items-center gap-3 border-b border-border p-4">
      {pictureUrl ? <img src={pictureUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" /> : <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{(displayName[0] || "Y").toUpperCase()}</span>}
      <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{displayName}</p>{handle && <p className="break-words text-xs text-muted-foreground">@{handle}</p>}<p className="text-xs text-muted-foreground">{PLATFORM_LABELS[platform]} · Preview</p></div>
    </header>
    {tweets?.length ? <ol aria-label="Thread preview" className="divide-y divide-border">{tweets.map((tweet, index) => <li key={index} className="space-y-2 break-words p-4"><span className="text-xs text-muted-foreground">Tweet {index + 1} of {tweets.length}</span><p className="whitespace-pre-wrap text-sm">{tweet.text}</p></li>)}</ol> : <>
      {platform !== "instagram" && copy}
      {artwork}
      {platform === "instagram" && copy}
      {pollOptions?.some(Boolean) && <section aria-label="Poll preview" className="space-y-2 p-4"><p className="text-xs font-medium text-muted-foreground">Poll options</p><ul className="space-y-2">{pollOptions.filter(Boolean).map((option, index) => <li key={index} className="whitespace-pre-wrap break-words rounded-lg border border-border p-3 text-sm">{option}</li>)}</ul></section>}
    </>}
    {firstComment && <section aria-label="First comment preview" className="space-y-2 border-t border-border p-4"><p className="break-words text-xs font-medium text-muted-foreground">{commentLabel}</p><p className="whitespace-pre-wrap break-words text-sm">{firstComment}</p></section>}
  </article>;
}