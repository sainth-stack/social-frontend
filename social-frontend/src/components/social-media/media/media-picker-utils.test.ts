import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { httpsUrl, validateMediaFile } from "./media-picker-utils";

function file(type: string, size: number) {
  const result = new File(["x"], "private-filename", { type });
  Object.defineProperty(result, "size", { value: size });
  return result;
}

describe("media picker validation", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s at the 8 MiB boundary", type => {
    expect(validateMediaFile(file(type, 8 * 1024 * 1024), ["image"])).toBe("image");
    expect(validateMediaFile(file(type, 8 * 1024 * 1024 + 1), ["image"])).toMatch("8 MiB");
  });
  it.each(["video/mp4", "video/webm"])("accepts %s at the 50 MiB boundary", type => {
    expect(validateMediaFile(file(type, 50 * 1024 * 1024), ["video"])).toBe("video");
    expect(validateMediaFile(file(type, 50 * 1024 * 1024 + 1), ["video"])).toMatch("50 MiB");
  });
  it.each(["image/svg+xml", "image/gif", "video/quicktime", "text/plain", ""])("rejects unsupported MIME %s", type => {
    expect(validateMediaFile(file(type, 100), ["image", "video"])).toMatch("Choose a JPEG");
  });
  it("rejects empty and disallowed files", () => {
    expect(validateMediaFile(file("image/png", 0), ["image"])).toMatch("empty");
    expect(validateMediaFile(file("video/mp4", 1), ["image"])).toMatch("does not accept video");
    expect(validateMediaFile(file("image/png", 1), [])).toMatch("does not accept image");
  });
  it.each(["http://example.com/image.jpg", "javascript:alert(1)", "data:image/png;base64,eA==", "//example.com", "/image.png", "blob:https://example.com/id", "https://user:secret@example.com", "invalid", ""])("rejects unsafe URL %s", url => {
    expect(httpsUrl(url)).toBeUndefined();
  });
  it("accepts HTTPS URLs without altering signed query strings", () => {
    expect(httpsUrl("https://example.com/image.jpg?signature=a%2Bb&size=100")).toBe("https://example.com/image.jpg?signature=a%2Bb&size=100");
  });
});

describe.each([false, true])("media preview URLs with MOCK_UI_ENABLED=%s", enabled => {
  let mediaPreviewUrl: typeof import("./media-picker-utils").mediaPreviewUrl;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/lib/mock-ui/config", () => ({ MOCK_UI_ENABLED: enabled }));
    ({ mediaPreviewUrl } = await import("./media-picker-utils"));
  });

  afterEach(() => {
    vi.doUnmock("@/lib/mock-ui/config");
    vi.resetModules();
  });

  it("always permits HTTPS and preserves signed query strings", () => {
    const url = "https://media.example/image.jpg?signature=a%2Bb&size=100";
    expect(mediaPreviewUrl(url)).toBe(url);
  });

  it.each([
    "/mock-ui/sample.svg",
    "/mock-ui/nested/preview.png",
  ])("permits the local sample %s only in mock mode", url => {
    expect(mediaPreviewUrl(url)).toBe(enabled ? url : undefined);
  });

  it("permits same-origin blob URLs only in mock mode", () => {
    const url = `blob:${location.origin}/local-upload-id`;
    expect(mediaPreviewUrl(url)).toBe(enabled ? url : undefined);
  });

  it.each([
    "data:image/png;base64,eA==",
    "data:image/jpeg;base64,eA==",
    "data:image/webp;base64,eA==",
    "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'/%3E",
    "data:video/mp4;base64,eA==",
    "data:video/webm;base64,eA==",
    "DATA:IMAGE/PNG;BASE64,eA==",
  ])("permits the media data URL %s only in mock mode", url => {
    expect(mediaPreviewUrl(url)).toBe(enabled ? url : undefined);
  });

  it.each([
    "http://media.example/image.jpg",
    "javascript:alert(1)",
    "data:text/html;base64,PGgxPmhpPC9oMT4=",
    "data:text/html;charset=utf-8,%3Ch1%3Ehi%3C/h1%3E",
    "data:application/javascript;base64,eA==",
    "data:image/pngx;base64,eA==",
    "data:video/mp4x;base64,eA==",
    "data:image/png,eA==",
    "blob:https://other.example/upload-id",
    `blob:${location.origin}.other.example/upload-id`,
    `blob:${location.origin}@other.example/upload-id`,
    "blob:null/upload-id",
    "//media.example/image.jpg",
    "/image.png",
    "/mock-ui-other/sample.svg",
    "/mock-ui/../private.png",
    "/mock-ui/%2e%2e/private.png",
    "/mock-ui/sample.svg?redirect=private",
    "https://user:secret@media.example/image.jpg",
    "https://user@media.example/image.jpg",
    "invalid",
    "",
    null,
    undefined,
  ])("rejects unsafe or unsupported URL %s in either mode", url => {
    expect(mediaPreviewUrl(url)).toBeUndefined();
  });
});