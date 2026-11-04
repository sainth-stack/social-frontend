"use client";

import FeedPostCard from "@/components/social-media/workflow/FeedPostCard";
import { formatPostBody, formatTagsForDisplay, sanitizeCaptionAndHashtags } from "@/lib/socialCaption";
import { PLATFORM_LABELS, type CarouselSlide, type SocialPlatform, type SocialPostMedia, type StoredTweet } from "@/types/social-media.types";

export type PreviewAccount = {
  accountName?: string | null;
  accountPictureUrl?: string | null;
  handle?: string | null;
};

type PlatformPreviewProps = {
  platform: SocialPlatform;
  caption: string;
  hashtags: string[];
  firstComment?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  brandName?: string;
  account?: PreviewAccount | null;
  slides?: CarouselSlide[];
  pollOptions?: string[];
  media?: SocialPostMedia[];
  tweets?: StoredTweet[];
};

export default function PlatformPreview({ platform, caption, hashtags, brandName = "Your Brand", account, ...props }: PlatformPreviewProps) {
  const rawName = (account?.accountName || brandName || "Your Brand").trim();
  const displayName = rawName.replace(/^@/, "") || "Your Brand";
  const handle = (account?.handle || "").trim().replace(/^@/, "") || (rawName.startsWith("@") ? rawName.slice(1) : displayName.toLowerCase().replace(/[^a-z0-9_]+/g, "")) || "yourbrand";
  const commentLabel = platform === "linkedin"
    ? "LinkedIn first comment"
    : platform === "x"
      ? "First comment"
      : `${PLATFORM_LABELS[platform]} first comment`;

  const cleaned = sanitizeCaptionAndHashtags(caption, hashtags);
  const body = formatPostBody(caption, hashtags);
  const tagLine = formatTagsForDisplay(hashtags);
  const feedStyle = platform === "linkedin" || platform === "facebook";
  let previewCaption = cleaned.caption;
  let previewHashtags = cleaned.hashtags;
  if (feedStyle) {
    if (tagLine && body.endsWith(`\n\n${tagLine}`)) {
      previewCaption = body.slice(0, body.length - tagLine.length - 2);
    } else if (tagLine && body === tagLine) {
      previewCaption = "";
    } else {
      previewCaption = body;
      previewHashtags = [];
    }
    if (tagLine) {
      previewHashtags = tagLine.split(/\s+/).filter(Boolean).map((tag) => tag.replace(/^#+/, ""));
    }
  }

  return (
    <FeedPostCard
      key={platform}
      {...props}
      platform={platform}
      displayName={displayName}
      handle={handle}
      pictureUrl={account?.accountPictureUrl}
      body={body}
      caption={previewCaption}
      hashtags={previewHashtags}
      commentLabel={commentLabel}
    />
  );
}
