import type { MediaAssetType } from "@/types/social-media.types";
import { MOCK_UI_ENABLED } from "@/lib/mock-ui/config";

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm"];

export function validateMediaFile(file: File, allowedTypes: readonly MediaAssetType[]): MediaAssetType | string {
  const mediaType = IMAGE_MIME_TYPES.includes(file.type) ? "image" : VIDEO_MIME_TYPES.includes(file.type) ? "video" : null;
  if (!mediaType) return "Choose a JPEG, PNG, WebP, MP4, or WebM file.";
  if (!allowedTypes.includes(mediaType)) return `This picker does not accept ${mediaType} files.`;
  if (!file.size) return "The file is empty. Choose another file.";
  const limit = mediaType === "image" ? 8 : 50;
  if (file.size > limit * 1024 * 1024) return `${mediaType === "image" ? "Images" : "Videos"} must be ${limit} MiB or smaller.`;
  return mediaType;
}

export function httpsUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function mediaPreviewUrl(value: string | null | undefined): string | undefined {
  const secure = httpsUrl(value);
  if (secure || !value || !MOCK_UI_ENABLED) return secure;
  if (/^\/mock-ui\/[a-zA-Z0-9_/-]+\.(svg|png|jpg|jpeg|webp|mp4|webm)$/.test(value) && !value.includes("..")) return value;
  if (typeof location !== "undefined" && value.startsWith(`blob:${location.origin}/`)) return value;
  if (/^data:(image\/(png|jpeg|webp|svg\+xml)|video\/(mp4|webm));(base64|charset=utf-8),/i.test(value)) return value;
  return undefined;
}