"use client";

import { useId, useState, type ReactNode } from "react";
import { Globe, MessageCircle, Repeat2, Send, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLATFORM_LABELS, type CarouselSlide, type SocialPlatform, type SocialPostMedia, type StoredTweet } from "@/types/social-media.types";

type FeedPostCardProps = {
  platform: SocialPlatform;
  displayName: string;
  handle?: string;
  pictureUrl?: string | null;
  body: string;
  caption?: string;
  hashtags?: string[];
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

const FEED_PLATFORMS = new Set<SocialPlatform>(["linkedin", "facebook"]);

function firstCommentDelivery(platform: SocialPlatform): { headline: string; detail: string } | null {
  if (platform === "linkedin") {
    return {
      headline: "LinkedIn · manual copy only",
      detail: "manual copy only, not published automatically",
    };
  }
  if (platform === "x") {
    return { headline: "First comment", detail: "unsupported, manual copy only" };
  }
  if (platform === "facebook" || platform === "instagram") {
    return {
      headline: `${PLATFORM_LABELS[platform]} · automatic delivery`,
      detail: "automatic delivery after publishing",
    };
  }
  return null;
}

function FeedActions({ platform }: { platform: SocialPlatform }) {
  if (platform === "linkedin") {
    return (
      <div className="flex items-center justify-around border-t border-border/70 px-1 py-2 text-[11px] font-semibold text-muted-foreground">
        {[
          { label: "Like", Icon: ThumbsUp },
          { label: "Comment", Icon: MessageCircle },
          { label: "Repost", Icon: Repeat2 },
          { label: "Send", Icon: Send },
        ].map(({ label, Icon }) => (
          <span key={label} className="inline-flex items-center gap-1 px-1">
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {label}
          </span>
        ))}
      </div>
    );
  }
  if (platform === "facebook") {
    return (
      <div className="flex items-center justify-around border-t border-border/70 py-2 text-[11px] font-semibold text-muted-foreground">
        {["Like", "Comment", "Share"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    );
  }
  return null;
}

export default function FeedPostCard({
  platform,
  displayName,
  handle,
  pictureUrl,
  body,
  caption,
  hashtags,
  firstComment,
  commentLabel,
  imageUrl,
  videoUrl,
  slides,
  media,
  tweets,
  pollOptions,
  mediaSlot,
}: FeedPostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const bodyId = useId();
  const feedStyle = FEED_PLATFORMS.has(platform);
  const splitCopy = feedStyle && caption !== undefined && hashtags !== undefined;
  const captionText = splitCopy ? caption : body;
  const longCaption = captionText.length > (feedStyle ? 210 : 300);
  const visibleCaption =
    captionText && longCaption && !expanded ? `${captionText.slice(0, feedStyle ? 210 : 300)}…` : captionText;

  const entries = slides?.length
    ? slides.map((slide) => ({ key: `slide:${slide.id}`, slide, asset: media?.find((asset) => asset.slideId === slide.id) }))
    : media?.map((asset, index) => ({ key: `media:${index}`, slide: undefined, asset })) ?? [];
  const activeIndex = Math.max(0, entries.findIndex((entry) => entry.key === selection));
  const entry = entries[activeIndex];
  const url = entry ? entry.asset?.url || entry.slide?.imageUrl : videoUrl || imageUrl;
  const video = entry ? entry.asset?.mimeType?.startsWith("video/") : Boolean(videoUrl);

  const copyBlock = (
    <>
      <div className={cn(feedStyle ? "px-3 pt-1" : "p-4")}>
        <p
          id={bodyId}
          className={cn(
            "whitespace-pre-wrap break-words leading-snug",
            feedStyle ? "text-[13px] text-foreground" : "text-sm leading-relaxed",
          )}
        >
          {visibleCaption || (splitCopy && hashtags.length > 0 ? null : <span className="text-muted-foreground">Your post will appear here.</span>)}
        </p>
        {splitCopy && hashtags.length > 0 ? (
          <p className={cn("mt-1.5 break-words text-[13px] leading-snug", platform === "linkedin" ? "text-[#0a66c2]" : "text-[#1877f2]")}>
            {hashtags.map((tag) => `#${tag.replace(/^#+/, "")}`).join(" ")}
          </p>
        ) : null}
      </div>
      {longCaption && captionText ? (
        <button
          type="button"
          className={cn(
            "mb-2 min-h-9 px-3 text-left text-xs font-semibold",
            platform === "linkedin" ? "text-muted-foreground hover:underline" : "text-primary",
            !feedStyle && "mx-4 mb-3",
          )}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "See less" : "See more"}
        </button>
      ) : null}
    </>
  );

  const artwork =
    mediaSlot !== undefined ? (
      mediaSlot
    ) : entries.length > 0 || url ? (
      <div className="min-w-0 bg-muted/20">
        {url ? (
          video ? (
            <video src={url} controls preload="none" aria-label={`${PLATFORM_LABELS[platform]} video preview`} className="block max-h-80 w-full" />
          ) : (
            <img
              src={url}
              alt={entry?.slide?.headline || `${PLATFORM_LABELS[platform]} artwork ${activeIndex + 1}`}
              width={entry?.asset?.width ?? undefined}
              height={entry?.asset?.height ?? undefined}
              className={cn("block w-full", feedStyle ? "max-h-72 object-cover" : "h-auto max-h-96 object-contain")}
            />
          )
        ) : (
          <div className="space-y-3 break-words p-8">
            <p className="text-center text-sm text-muted-foreground">Slide {activeIndex + 1} artwork not generated</p>
            {!entry?.slide?.renderedAsset && (
              <>
                {entry?.slide?.headline && <p className="whitespace-pre-wrap text-lg font-semibold">{entry.slide.headline}</p>}
                {entry?.slide?.body && <p className="whitespace-pre-wrap text-sm">{entry.slide.body}</p>}
              </>
            )}
          </div>
        )}
        {entries.length > 1 && (
          <nav aria-label="Preview slides" className="flex flex-wrap items-center justify-center gap-2 p-3">
            {entries.map((entry, index) => (
              <Button
                key={entry.key}
                type="button"
                size="sm"
                className="min-h-11 min-w-11"
                variant={activeIndex === index ? "default" : "outline"}
                aria-label={`Show slide ${index + 1}`}
                aria-pressed={activeIndex === index}
                onClick={() => setSelection(entry.key)}
              >
                {index + 1}
              </Button>
            ))}
          </nav>
        )}
      </div>
    ) : null;

  const header = feedStyle ? (
    <header className="flex min-w-0 items-start gap-2 px-3 pb-1 pt-2">
      {pictureUrl ? (
        <img src={pictureUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" />
      ) : (
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {(displayName[0] || "Y").toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="truncate text-[13px] font-semibold leading-tight">{displayName}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <span>Now</span>
          <span aria-hidden>·</span>
          <Globe className="size-3 shrink-0" aria-hidden />
        </p>
      </div>
    </header>
  ) : (
    <header className="flex min-w-0 items-center gap-3 border-b border-border p-4">
      {pictureUrl ? (
        <img src={pictureUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
      ) : (
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
          {(displayName[0] || "Y").toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold">{displayName}</p>
        {handle && <p className="break-words text-xs text-muted-foreground">@{handle}</p>}
        <p className="text-xs text-muted-foreground">{PLATFORM_LABELS[platform]} · Preview</p>
      </div>
    </header>
  );

  return (
    <article aria-label={`${PLATFORM_LABELS[platform]} post preview`} className={cn("min-w-0 bg-card text-card-foreground", feedStyle && "text-[13px]")}>
      {header}
      {tweets?.length ? (
        <ol aria-label="Thread preview" className="divide-y divide-border">
          {tweets.map((tweet, index) => (
            <li key={index} className="space-y-2 break-words p-4">
              <span className="text-xs text-muted-foreground">
                Tweet {index + 1} of {tweets.length}
              </span>
              <p className="whitespace-pre-wrap text-sm">{tweet.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <>
          {platform !== "instagram" && copyBlock}
          {artwork}
          {platform === "instagram" && copyBlock}
          {pollOptions?.some(Boolean) && (
            <section aria-label="Poll preview" className="space-y-2 p-4">
              <p className="text-xs font-medium text-muted-foreground">Poll options</p>
              <ul className="space-y-2">
                {pollOptions.filter(Boolean).map((option, index) => (
                  <li key={index} className="whitespace-pre-wrap break-words rounded-lg border border-border p-3 text-sm">
                    {option}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <FeedActions platform={platform} />
        </>
      )}
      {firstComment ? (
        <section aria-label="First comment preview" className="space-y-1 border-t border-border/70 bg-muted/20 px-3 py-2">
          <p className="break-words text-[10px] font-medium text-muted-foreground">
            {commentLabel ?? firstCommentDelivery(platform)?.headline ?? "First comment"}
          </p>
          {firstCommentDelivery(platform)?.detail ? (
            <p className="break-words text-[10px] text-muted-foreground">{firstCommentDelivery(platform)!.detail}</p>
          ) : null}
          <p className="whitespace-pre-wrap break-words text-[12px] leading-snug">{firstComment}</p>
        </section>
      ) : null}
    </article>
  );
}
