import type { ImageAspectRatio, MediaType, StudioMode, VideoSeconds, VideoSize, SocialImageSource } from "@/types/social-media.types";

export type StudioMediaState = {
  mediaType: MediaType;
  imageUrl: string | null;
  videoUrl: string | null;
  imagePrompt: string;
  videoPrompt: string;
  imageStyle: string;
  imageAspectRatio: ImageAspectRatio;
  videoSize: VideoSize;
  videoDuration: VideoSeconds;
  studioMode: StudioMode;
  selectedImageTemplateId: string | null;
  selectedVideoTemplateId: string | null;
  mediaSource: SocialImageSource;
};

export const INITIAL_STUDIO_MEDIA: StudioMediaState = {
  mediaType: "none",
  imageUrl: null,
  videoUrl: null,
  imagePrompt: "",
  videoPrompt: "",
  imageStyle: "None",
  imageAspectRatio: "1024x1024",
  videoSize: "1280x720",
  videoDuration: "4",
  studioMode: "text",
  selectedImageTemplateId: null,
  selectedVideoTemplateId: null,
  mediaSource: "none",
};

export function isVideoMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("/social-video/") ||
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".webm")
  );
}

export function resolveDraftMedia(imageUrl: string | null | undefined): Pick<StudioMediaState, "mediaType" | "imageUrl" | "videoUrl"> {
  if (!imageUrl) {
    return { mediaType: "none", imageUrl: null, videoUrl: null };
  }
  if (isVideoMediaUrl(imageUrl)) {
    return { mediaType: "video", imageUrl: null, videoUrl: imageUrl };
  }
  return { mediaType: "image", imageUrl, videoUrl: null };
}

export function buildPersistMediaPayload(
  mediaType: MediaType,
  imageUrl: string | null,
  videoUrl: string | null,
  mediaSource: SocialImageSource,
): { imageUrl: string | null; imageSource: SocialImageSource } {
  if (mediaType === "video" && videoUrl) {
    return { imageUrl: videoUrl, imageSource: mediaSource };
  }
  if (mediaType === "image" && imageUrl) {
    return { imageUrl, imageSource: mediaSource };
  }
  return { imageUrl: null, imageSource: "none" };
}

export function mediaSourceFromApi(source: string): SocialImageSource {
  return source === "uploaded" ? "uploaded" : "ai_generated";
}
