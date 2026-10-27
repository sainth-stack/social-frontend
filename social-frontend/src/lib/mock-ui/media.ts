import { addMockMediaAsset } from "./social";

function dataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Mock UI: unable to read the file."));
    reader.onerror = () => reject(new Error("Mock UI: unable to read the file."));
    reader.onabort = () => reject(new Error("Mock UI: file reading was canceled."));
    reader.readAsDataURL(file);
  });
}

export async function handleMockMediaUpload(path: string, method: string, body: Record<string, unknown>, signal?: { readonly aborted?: boolean }) {
  const match = /^\/api\/v1\/workspaces\/mock-workspace\/social\/upload-(image|video)$/.exec(path);
  if (!match || method !== "POST") return undefined;
  const mediaType = match[1] as "image" | "video";
  const file = body.file;
  if (typeof File === "undefined" || !(file instanceof File)) throw new Error("Mock UI: choose one multipart media file.");
  const allowed = mediaType === "image" ? ["image/jpeg", "image/png", "image/webp"] : ["video/mp4", "video/webm"];
  if (!allowed.includes(file.type)) throw new Error(`Mock UI: choose ${mediaType === "image" ? "a JPEG, PNG, or WebP image" : "an MP4 or WebM video"}.`);
  const limit = mediaType === "image" ? 8 : 50;
  if (!file.size || file.size > limit * 1024 * 1024) throw new Error(`Mock UI: ${mediaType} files must be nonempty and ${limit} MiB or smaller.`);
  const url = typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : await dataUrl(file);
  if (signal?.aborted) {
    if (url.startsWith("blob:") && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
    throw new Error("Mock UI: upload canceled.");
  }
  const asset = addMockMediaAsset({ mediaType, source: "uploaded", url, mimeType: file.type, fileSizeBytes: file.size,
    prompt: `Offline demo upload: ${file.name}${mediaType === "video" ? " (draft-only)" : ""}. Stored in memory only; refresh removes this file.`,
    durationSeconds: null, soraVideoId: null, postId: null });
  return { [mediaType === "image" ? "imageUrl" : "videoUrl"]: asset.url, source: asset.source, assetId: asset.id };
}