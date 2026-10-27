import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { MediaAsset } from "@/types/social-media.types";
import MediaPicker, { type MediaPickerProps } from "./MediaPicker";

const api = vi.hoisted(() => ({
  uploadImage: vi.fn(), uploadVideo: vi.fn(), getMediaAsset: vi.fn(),
  getStockProviders: vi.fn(), searchStock: vi.fn(), importStock: vi.fn(),
}));
const get = vi.hoisted(() => vi.fn());
vi.mock("@/api/endpoints/social-media.api", () => ({ default: api, socialMediaApi: api }));
vi.mock("@/api/client", () => ({ default: { get } }));

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return { id: "asset", mediaType: "image", source: "uploaded", url: "https://media.example/saved.jpg", mimeType: "image/jpeg", fileSizeBytes: 1200, createdAt: "2026-10-27T00:00:00Z", ...overrides };
}
function stockItem(overrides: Record<string, unknown> = {}) {
  return { id: "photo-1", provider: "pexels", mediaType: "image", previewUrl: "https://images.example/preview.jpg", thumbnailUrl: "https://images.example/thumbnail.jpg", width: 1200, height: 800, creatorName: "Alex", creatorUrl: "https://www.pexels.com/@alex/", providerPageUrl: "https://www.pexels.com/photo/1/", licenseUrl: "https://www.pexels.com/license/", attributionText: "Photo by Alex on Pexels", ...overrides };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup(overrides: Partial<MediaPickerProps> = {}) {
  const props: MediaPickerProps = { workspaceId: "workspace", open: true, onOpenChange: vi.fn(), onSelect: vi.fn(), ...overrides };
  const view = render(<MediaPicker {...props} />);
  return { props, ...view, rerenderPicker: (next: Partial<MediaPickerProps>) => view.rerender(<MediaPicker {...props} {...next} />) };
}
function image() { return new File(["image"], "private-client-campaign.png", { type: "image/png" }); }
function paste(files: File[] = [], text = "") {
  return fireEvent.paste(screen.getByRole("region", { name: "Upload dropzone" }), { clipboardData: { files, getData: () => text } });
}
async function tab(name: string) {
  await userEvent.click(screen.getByRole("tab", { name }));
}
async function readyStock() {
  await tab("Stock");
  await waitFor(() => expect((screen.getByLabelText("Search stock") as HTMLInputElement).disabled).toBe(false));
}
async function searchStock(query = "mountains") {
  fireEvent.change(screen.getByLabelText("Search stock"), { target: { value: query } });
  fireEvent.click(screen.getByRole("button", { name: "Search stock media" }));
  await screen.findAllByRole("button", { name: /Preview stock/ });
}

beforeEach(() => {
  vi.resetAllMocks();
  api.uploadImage.mockResolvedValue({ imageUrl: "https://media.example/upload.jpg", assetId: "asset" });
  api.uploadVideo.mockResolvedValue({ videoUrl: "https://media.example/video.mp4", assetId: "video" });
  api.getMediaAsset.mockResolvedValue(asset());
  api.getStockProviders.mockResolvedValue({ items: [{ id: "pexels", name: "Pexels", available: true, mediaTypes: ["image", "video"] }] });
  api.searchStock.mockResolvedValue({ items: [stockItem()], page: 1, pageSize: 12, hasMore: true });
  api.importStock.mockResolvedValue(asset());
  get.mockResolvedValue({ data: { items: [asset()], total: 25, page: 1, pageSize: 12, totalPages: 3 } });
});
afterEach(cleanup);

describe("MediaPicker uploads and selection", () => {
  it("supports keyboard tabs, a keyboard-reachable native file input, Escape dismissal, and accessible semantics", async () => {
    const user = userEvent.setup();
    const { props } = setup();
    const input = screen.getByLabelText("Choose a media file");
    input.focus();
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("type")).toBe("file");
    screen.getByRole("tab", { name: "Upload or paste" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Your media" }).getAttribute("aria-selected")).toBe("true");
    await screen.findByRole("button", { name: "Choose image 1" });
    const result = await axe(screen.getByRole("dialog"), { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations).toEqual([]);
    await user.keyboard("{Escape}");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });
  it("renders an accessible controlled dialog only when open", () => {
    const view = setup({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    view.rerenderPicker({ open: true });
    expect(screen.getByRole("dialog", { name: "Choose media" })).toBeTruthy();
    expect(screen.getByRole("tablist", { name: "Media source" })).toBeTruthy();
    expect(screen.getByText(/Videos are draft-only/)).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
    expect(api.getStockProviders).not.toHaveBeenCalled();
  });
  it("uploads a pasted image and selects the canonical saved asset, not the upload URL", async () => {
    const { props } = setup();
    const file = image();
    expect(paste([file])).toBe(false);
    await waitFor(() => expect(props.onSelect).toHaveBeenCalledWith(asset()));
    expect(api.uploadImage).toHaveBeenCalledWith("workspace", file);
    expect(api.getMediaAsset).toHaveBeenCalledWith("workspace", "asset");
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });
  it("does not intercept text or URL paste and has no global clipboard listener", async () => {
    setup();
    expect(paste([], "https://example.com/private.png")).toBe(true);
    fireEvent.paste(document.body, { clipboardData: { files: [image()] } });
    expect(api.uploadImage).not.toHaveBeenCalled();
    expect(api.uploadVideo).not.toHaveBeenCalled();
  });
  it("ignores video paste and uploads a dropped video through the canonical asset lookup", async () => {
    const video = new File(["video"], "clip.webm", { type: "video/webm" });
    api.getMediaAsset.mockResolvedValue(asset({ id: "video", mediaType: "video", url: "https://media.example/video.webm" }));
    const { props } = setup();
    expect(paste([video])).toBe(true);
    const zone = screen.getByRole("region", { name: "Upload dropzone" });
    expect(fireEvent.dragOver(zone)).toBe(false);
    fireEvent.drop(zone, { dataTransfer: { files: [video] } });
    await waitFor(() => expect(props.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "video", mediaType: "video" })));
    expect(api.uploadVideo).toHaveBeenCalledWith("workspace", video);
    expect(api.getMediaAsset).toHaveBeenCalledWith("workspace", "video");
  });
  it("clears the labelled native file input and permits retrying the same file", async () => {
    api.uploadImage.mockRejectedValueOnce(new Error("Upload failed"));
    const { props } = setup();
    const input = screen.getByLabelText("Choose a media file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [image()] } });
    await screen.findByRole("alert");
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { files: [image()] } });
    await waitFor(() => expect(props.onSelect).toHaveBeenCalledTimes(1));
    expect(api.uploadImage).toHaveBeenCalledTimes(2);
    expect(input.accept).toBe("image/jpeg,image/png,image/webp,video/mp4,video/webm");
  });
  it.each([
    { mime: "image/png", size: 8 * 1024 * 1024 + 1, message: "8 MiB" },
    { mime: "video/mp4", size: 50 * 1024 * 1024 + 1, message: "50 MiB" },
    { mime: "image/svg+xml", size: 10, message: "JPEG" },
    { mime: "image/png", size: 0, message: "empty" },
  ])("rejects $mime with size $size before any request", ({ mime, size, message }) => {
    setup();
    const file = new File(["x"], "file", { type: mime });
    Object.defineProperty(file, "size", { value: size });
    fireEvent.drop(screen.getByRole("region", { name: "Upload dropzone" }), { dataTransfer: { files: [file] } });
    expect(screen.getByRole("alert").textContent).toContain(message);
    expect(api.uploadImage).not.toHaveBeenCalled();
    expect(api.uploadVideo).not.toHaveBeenCalled();
  });
  it("rejects multiple files instead of silently attaching only one", () => {
    setup();
    paste([image(), image()]);
    expect(screen.getByRole("alert").textContent).toContain("one file");
    expect(api.uploadImage).not.toHaveBeenCalled();
  });
  it("restricts upload acceptance to allowedTypes and omits the video reminder", () => {
    setup({ allowedTypes: ["image"] });
    fireEvent.drop(screen.getByRole("region", { name: "Upload dropzone" }), { dataTransfer: { files: [new File(["x"], "clip.mp4", { type: "video/mp4" })] } });
    expect(screen.getByRole("alert").textContent).toContain("does not accept video");
    expect((screen.getByLabelText("Choose a media file") as HTMLInputElement).accept).not.toContain("video/");
    expect(screen.queryByText(/Videos are draft-only/)).toBeNull();
  });
  it("does not fabricate an asset when upload returns no assetId", async () => {
    api.uploadImage.mockResolvedValue({ imageUrl: "https://media.example/orphan.png" });
    const { props } = setup();
    paste([image()]);
    expect((await screen.findByRole("alert")).textContent).toContain("saved media asset");
    expect(api.getMediaAsset).not.toHaveBeenCalled();
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });
  it.each([undefined, true, false])("closes only when onSelect returns success !== false (%s)", async result => {
    const onSelect = vi.fn().mockResolvedValue(result);
    const { props } = setup({ onSelect });
    paste([image()]);
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
    await waitFor(() => result === false ? expect(screen.getByText(/Media was not attached/)).toBeTruthy() : expect(props.onOpenChange).toHaveBeenCalledWith(false));
    if (result === false) expect(props.onOpenChange).not.toHaveBeenCalled();
  });
  it("keeps the picker open when onSelect rejects and allows retry", async () => {
    const { props } = setup({ onSelect: vi.fn().mockRejectedValue(new Error("Attachment failed")) });
    paste([image()]);
    expect((await screen.findByRole("alert")).textContent).toContain("Attachment failed");
    expect(props.onOpenChange).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Choose a media file") as HTMLInputElement).disabled).toBe(false);
  });
  it("locks duplicate upload operations immediately, keeps close available and reports live progress", async () => {
    const upload = deferred<{ assetId: string }>();
    api.uploadImage.mockReturnValue(upload.promise);
    const { props } = setup();
    paste([image()]);
    paste([image()]);
    fireEvent.drop(screen.getByRole("region", { name: "Upload dropzone" }), { dataTransfer: { files: [image()] } });
    expect(api.uploadImage).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Uploading media…").closest('[aria-live="polite"]')).toBeTruthy();
    expect((screen.getByLabelText("Choose a media file") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    await act(async () => upload.resolve({ assetId: "asset" }));
    expect(api.getMediaAsset).not.toHaveBeenCalled();
    expect(props.onSelect).not.toHaveBeenCalled();
  });
  it.each(["workspace", "context", "closed", "reopened", "allowedTypes"])("suppresses stale uploads after %s changes", async scope => {
    const upload = deferred<{ assetId: string }>();
    api.uploadImage.mockReturnValue(upload.promise);
    const view = setup({ contextKey: "slide-1" });
    paste([image()]);
    if (scope === "workspace") view.rerenderPicker({ workspaceId: "other" });
    if (scope === "context") view.rerenderPicker({ contextKey: "slide-2" });
    if (scope === "allowedTypes") view.rerenderPicker({ allowedTypes: ["video"] });
    if (scope === "closed" || scope === "reopened") view.rerenderPicker({ open: false });
    if (scope === "reopened") view.rerenderPicker({ open: true });
    await act(async () => upload.resolve({ assetId: "asset" }));
    expect(view.props.onSelect).not.toHaveBeenCalled();
    expect(api.getMediaAsset).not.toHaveBeenCalled();
  });
  it("suppresses a canonical asset read completed after a context switch", async () => {
    const saved = deferred<MediaAsset>();
    api.getMediaAsset.mockReturnValue(saved.promise);
    const view = setup({ contextKey: "first" });
    paste([image()]);
    await waitFor(() => expect(api.getMediaAsset).toHaveBeenCalled());
    view.rerenderPicker({ contextKey: "second" });
    await act(async () => saved.resolve(asset()));
    expect(view.props.onSelect).not.toHaveBeenCalled();
  });
  it("does not attach an upload after switching tabs, even if returning to Upload", async () => {
    const upload = deferred<{ assetId: string }>();
    api.uploadImage.mockReturnValue(upload.promise);
    const { props } = setup();
    paste([image()]);
    await tab("Your media");
    await tab("Upload or paste");
    await act(async () => upload.resolve({ assetId: "asset" }));
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(api.getMediaAsset).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Choose a media file") as HTMLInputElement).disabled).toBe(false);
  });
  it("does not close a new context after an already-started onSelect resolves", async () => {
    const selection = deferred<boolean>();
    const view = setup({ onSelect: vi.fn().mockReturnValue(selection.promise), contextKey: "first" });
    paste([image()]);
    await waitFor(() => expect(view.props.onSelect).toHaveBeenCalledTimes(1));
    view.rerenderPicker({ contextKey: "second" });
    await act(async () => selection.resolve(true));
    expect(view.props.onOpenChange).not.toHaveBeenCalled();
  });
  it("ignores errors from an operation after a context switch", async () => {
    const upload = deferred<{ assetId: string }>();
    api.uploadImage.mockReturnValue(upload.promise);
    const view = setup({ contextKey: "first" });
    paste([image()]);
    view.rerenderPicker({ contextKey: "second" });
    await act(async () => upload.reject(new Error("Old workspace failure")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(view.props.onSelect).not.toHaveBeenCalled();
  });
  it("disables uploads when no workspace or no allowed types are provided", () => {
    const view = setup({ workspaceId: "" });
    expect((screen.getByLabelText("Choose a media file") as HTMLInputElement).disabled).toBe(true);
    paste([image()]);
    expect(api.uploadImage).not.toHaveBeenCalled();
    view.rerenderPicker({ allowedTypes: [] });
    expect(screen.getByText("No media types are allowed here.")).toBeTruthy();
    expect((screen.getByLabelText("Choose a media file") as HTMLInputElement).disabled).toBe(true);
  });
});

describe("MediaPicker library", () => {
  it("loads paginated saved media, searches and resets the page when filters change", async () => {
    const { props } = setup({ initialQuery: "launch" });
    await tab("Your media");
    await screen.findByRole("button", { name: "Choose image 1" });
    expect(get).toHaveBeenLastCalledWith("/api/v1/workspaces/workspace/social/media-assets", expect.objectContaining({ params: { search: "launch", mediaType: undefined, page: 1, pageSize: 12 }, signal: expect.any(AbortSignal) }));
    fireEvent.click(screen.getByRole("button", { name: "Next media" }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ params: expect.objectContaining({ page: 2 }) })));
    fireEvent.change(screen.getByLabelText("Search your media"), { target: { value: "new search" } });
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ params: expect.objectContaining({ search: "new search", page: 1 }) })));
    fireEvent.click(screen.getByRole("button", { name: "Images" }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ params: expect.objectContaining({ mediaType: "image", page: 1 }) })));
    fireEvent.click(await screen.findByRole("button", { name: "Choose image 1" }));
    expect(props.onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use selected media" }));
    await waitFor(() => expect(props.onSelect).toHaveBeenCalledWith(asset()));
  });
  it("enforces allowed types even if the server returns mixed media", async () => {
    get.mockResolvedValue({ data: { items: [asset(), asset({ id: "video", mediaType: "video" })], total: 2, totalPages: 1 } });
    setup({ allowedTypes: ["image"] });
    await tab("Your media");
    await screen.findByRole("button", { name: "Choose image 1" });
    expect(screen.queryByRole("button", { name: "Choose video 2" })).toBeNull();
    expect(screen.queryByRole("button", { name: "All media" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Videos" })).toBeNull();
    expect(get).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ params: expect.objectContaining({ mediaType: "image" }) }));
  });
  it("renders no video elements until a specific saved video is chosen", async () => {
    get.mockResolvedValue({ data: { items: [asset({ mediaType: "video", url: "https://media.example/video.mp4", prompt: "sensitive client description" })], totalPages: 1 } });
    setup();
    await tab("Your media");
    const choose = await screen.findByRole("button", { name: "Choose video 1" });
    expect(document.querySelector("video")).toBeNull();
    fireEvent.click(choose);
    const preview = screen.getByLabelText("Selected video preview") as HTMLVideoElement;
    expect(preview.preload).toBe("none");
    expect(preview.controls).toBe(true);
    expect(document.body.textContent).not.toContain("sensitive client description");
  });
  it("does not expose prompts or private filenames in image alt text", async () => {
    get.mockResolvedValue({ data: { items: [asset({ prompt: "secret client data" })], totalPages: 1 } });
    setup();
    await tab("Your media");
    const thumbnail = await screen.findByRole("img", { name: "Saved media thumbnail" });
    expect(thumbnail.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(document.body.innerHTML).not.toContain("secret client data");
  });
  it("aborts library reads and ignores stale responses after a workspace change", async () => {
    const first = deferred<{ data: unknown }>();
    get.mockReturnValueOnce(first.promise);
    const view = setup();
    await tab("Your media");
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    const signal = get.mock.calls[0][1].signal as AbortSignal;
    view.rerenderPicker({ workspaceId: "other" });
    expect(signal.aborted).toBe(true);
    await act(async () => first.resolve({ data: { items: [asset()], totalPages: 1 } }));
    await tab("Your media");
    await screen.findByRole("button", { name: "Choose image 1" });
    expect(get).toHaveBeenLastCalledWith("/api/v1/workspaces/other/social/media-assets", expect.any(Object));
    expect(view.props.onSelect).not.toHaveBeenCalled();
  });
  it("aborts old search reads immediately and ignores late matching results", async () => {
    const first = deferred<{ data: unknown }>();
    get.mockReturnValueOnce(first.promise).mockResolvedValue({ data: { items: [], totalPages: 1 } });
    setup();
    await tab("Your media");
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    const signal = get.mock.calls[0][1].signal as AbortSignal;
    fireEvent.change(screen.getByLabelText("Search your media"), { target: { value: "updated" } });
    expect(signal.aborted).toBe(true);
    await act(async () => first.resolve({ data: { items: [asset()], totalPages: 1 } }));
    await screen.findByText(/No saved media matches/);
    expect(screen.queryByRole("button", { name: "Choose image 1" })).toBeNull();
  });
  it("shows an error with retry, then an honest empty state", async () => {
    get.mockRejectedValueOnce(new Error("failure")).mockResolvedValue({ data: { items: [], totalPages: 0 } });
    setup();
    await tab("Your media");
    await screen.findByText("Unable to load your media. Please try again.");
    fireEvent.click(screen.getByRole("button", { name: "Retry media" }));
    await screen.findByText(/No saved media matches/);
  });
  it("rejects insecure saved URLs before onSelect", async () => {
    get.mockResolvedValue({ data: { items: [asset({ url: "javascript:alert(1)" })], totalPages: 1 } });
    const { props } = setup();
    await tab("Your media");
    fireEvent.click(await screen.findByRole("button", { name: "Choose image 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Use selected media" }));
    expect((await screen.findByRole("alert")).textContent).toContain("HTTPS");
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("MediaPicker stock", () => {
  it("submits queries rather than searching on keystrokes, with safe attribution links", async () => {
    setup({ initialQuery: "forest" });
    await readyStock();
    expect((screen.getByLabelText("Search stock") as HTMLInputElement).value).toBe("forest");
    fireEvent.change(screen.getByLabelText("Search stock"), { target: { value: "mountains" } });
    expect(api.searchStock).not.toHaveBeenCalled();
    await searchStock();
    expect(api.getStockProviders).toHaveBeenCalledWith("workspace", expect.any(AbortSignal));
    expect(api.searchStock).toHaveBeenCalledWith("workspace", { query: "mountains", mediaType: "image", page: 1, pageSize: 12 }, expect.any(AbortSignal));
    expect(screen.getByRole("link", { name: "Alex" }).getAttribute("href")).toBe("https://www.pexels.com/@alex/");
    expect(screen.getByRole("link", { name: "Pexels" }).getAttribute("href")).toContain("/photo/1/");
    expect(screen.getByRole("link", { name: "License" }).getAttribute("href")).toContain("/license/");
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link.getAttribute("target")).toBe("_blank");
    }
  });
  it("previews before importing and passes only the provider ID/type, then selects the direct MediaAsset", async () => {
    const { props } = setup();
    await readyStock();
    await searchStock();
    fireEvent.click(screen.getByRole("button", { name: "Preview stock image 1" }));
    expect(api.importStock).not.toHaveBeenCalled();
    expect(props.onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Import and use media" }));
    await waitFor(() => expect(props.onSelect).toHaveBeenCalledWith(asset()));
    expect(api.importStock).toHaveBeenCalledWith("workspace", { provider: "pexels", id: "photo-1", mediaType: "image" });
    expect(api.getMediaAsset).not.toHaveBeenCalled();
  });
  it("paginates using the submitted query even when the draft query is changed", async () => {
    setup();
    await readyStock();
    await searchStock("forest");
    fireEvent.change(screen.getByLabelText("Search stock"), { target: { value: "draft query" } });
    fireEvent.click(screen.getByRole("button", { name: "Next stock" }));
    await waitFor(() => expect(api.searchStock).toHaveBeenLastCalledWith("workspace", expect.objectContaining({ query: "forest", page: 2 }), expect.any(AbortSignal)));
    await screen.findByRole("button", { name: /Preview stock/ });
    fireEvent.click(screen.getByRole("button", { name: "Previous stock" }));
    await waitFor(() => expect(api.searchStock).toHaveBeenLastCalledWith("workspace", expect.objectContaining({ page: 1 }), expect.any(AbortSignal)));
  });
  it("toggles video without auto-searching and does not download video grids", async () => {
    api.searchStock.mockResolvedValue({ items: [stockItem({ id: "video-1", mediaType: "video", previewUrl: "https://video.example/clip.mp4" })], page: 1, pageSize: 12, hasMore: false });
    setup();
    await readyStock();
    fireEvent.click(within(screen.getByRole("group", { name: "Stock media type" })).getByRole("button", { name: "Videos" }));
    expect(api.searchStock).not.toHaveBeenCalled();
    await searchStock();
    expect(api.searchStock).toHaveBeenLastCalledWith("workspace", expect.objectContaining({ mediaType: "video", page: 1 }), expect.any(AbortSignal));
    expect(document.querySelector("video")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preview stock video 1" }));
    const video = screen.getByLabelText("Selected stock video preview") as HTMLVideoElement;
    expect(video.preload).toBe("none");
    expect(video.controls).toBe(true);
    expect(video.poster).toBe("https://images.example/thumbnail.jpg");
    expect(video.autoplay).toBe(false);
  });
  it.each([{ providers: [] }, { providers: [{ id: "pexels", name: "Pexels", available: false, mediaTypes: ["image", "video"], reason: "missing_api_key" }] }])("handles missing provider configuration without errors, searches or fake assets ($providers)", async ({ providers }) => {
    api.getStockProviders.mockResolvedValue({ items: providers });
    const { props } = setup();
    await tab("Stock");
    await screen.findByText(/Stock media is not configured/);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(api.searchStock).not.toHaveBeenCalled();
    expect(api.importStock).not.toHaveBeenCalled();
    expect(props.onSelect).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Search stock media" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("supports a video-only configured provider and allowedTypes", async () => {
    api.getStockProviders.mockResolvedValue({ items: [{ id: "pexels", name: "Pexels", available: true, mediaTypes: ["video"] }] });
    setup({ allowedTypes: ["video"] });
    await readyStock();
    expect(screen.queryByRole("button", { name: "Photos" })).toBeNull();
    expect(screen.getByRole("button", { name: "Videos" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("does not render unsafe external links or image previews", async () => {
    api.searchStock.mockResolvedValue({ items: [stockItem({ creatorUrl: "javascript:alert(1)", providerPageUrl: "http://unsafe.example", licenseUrl: "data:text/html,hi", thumbnailUrl: "http://unsafe.example/thumb", previewUrl: "javascript:alert(1)" })], page: 1, hasMore: false });
    setup();
    await readyStock();
    await searchStock();
    fireEvent.click(screen.getByRole("button", { name: "Preview stock image 1" }));
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
  it("blocks duplicate imports and suppresses attach after switching tabs", async () => {
    const imported = deferred<MediaAsset>();
    api.importStock.mockReturnValue(imported.promise);
    const { props } = setup();
    await readyStock();
    await searchStock();
    fireEvent.click(screen.getByRole("button", { name: "Preview stock image 1" }));
    const button = screen.getByRole("button", { name: "Import and use media" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(api.importStock).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await tab("Your media");
    await act(async () => imported.resolve(asset()));
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });
  it.each(["close", "workspace", "context"])("suppresses imported media after %s changes", async change => {
    const imported = deferred<MediaAsset>();
    api.importStock.mockReturnValue(imported.promise);
    const view = setup({ contextKey: "first" });
    await readyStock();
    await searchStock();
    fireEvent.click(screen.getByRole("button", { name: "Preview stock image 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Import and use media" }));
    if (change === "close") fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    if (change === "workspace") view.rerenderPicker({ workspaceId: "other" });
    if (change === "context") view.rerenderPicker({ contextKey: "second" });
    await act(async () => imported.resolve(asset()));
    expect(view.props.onSelect).not.toHaveBeenCalled();
  });
  it("aborts stock searches on context changes and rejects late results", async () => {
    const search = deferred<unknown>();
    api.searchStock.mockReturnValue(search.promise);
    const view = setup({ contextKey: "first" });
    await readyStock();
    fireEvent.change(screen.getByLabelText("Search stock"), { target: { value: "forest" } });
    fireEvent.click(screen.getByRole("button", { name: "Search stock media" }));
    await waitFor(() => expect(api.searchStock).toHaveBeenCalled());
    const signal = api.searchStock.mock.calls[0][2] as AbortSignal;
    view.rerenderPicker({ contextKey: "second" });
    expect(signal.aborted).toBe(true);
    await act(async () => search.resolve({ items: [stockItem()], page: 1, hasMore: false }));
    await readyStock();
    expect(screen.queryByRole("button", { name: /Preview stock/ })).toBeNull();
  });
  it("aborts availability reads when dismissed and ignores late provider responses", async () => {
    const providers = deferred<{ items: [] }>();
    api.getStockProviders.mockReturnValue(providers.promise);
    const view = setup();
    await tab("Stock");
    const signal = api.getStockProviders.mock.calls[0][1] as AbortSignal;
    view.rerenderPicker({ open: false });
    expect(signal.aborted).toBe(true);
    await act(async () => providers.resolve({ items: [] }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("retries availability and stock search errors, and reports empty results honestly", async () => {
    api.getStockProviders.mockRejectedValueOnce(new Error("offline"));
    api.searchStock.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ items: [], page: 1, hasMore: false });
    setup();
    await tab("Stock");
    await screen.findByText(/Unable to check stock availability/);
    fireEvent.click(screen.getByRole("button", { name: "Retry availability" }));
    await waitFor(() => expect((screen.getByLabelText("Search stock") as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText("Search stock"), { target: { value: "forest" } });
    fireEvent.click(screen.getByRole("button", { name: "Search stock media" }));
    await screen.findByText(/Unable to search stock media/);
    fireEvent.click(screen.getByRole("button", { name: "Retry stock search" }));
    await screen.findByText(/No stock media matches/);
    expect(api.searchStock).toHaveBeenCalledTimes(2);
  });
  it("shows import failures without closing or creating placeholder assets", async () => {
    api.importStock.mockRejectedValue({ response: { data: { detail: "failed" } } });
    const { props } = setup();
    await readyStock();
    await searchStock();
    fireEvent.click(screen.getByRole("button", { name: "Preview stock image 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Import and use media" }));
    await screen.findByRole("alert");
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });
  it("requires a fresh explicit import after switching selected stock items", async () => {
    api.searchStock.mockResolvedValue({ items: [stockItem(), stockItem({ id: "photo-2", creatorName: "Robin" })], page: 1, hasMore: false });
    const { props } = setup();
    await readyStock();
    await searchStock();
    fireEvent.click(screen.getByRole("button", { name: "Preview stock image 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview stock image 2" }));
    expect(api.importStock).not.toHaveBeenCalled();
    expect(props.onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Import and use media" }));
    await waitFor(() => expect(api.importStock).toHaveBeenCalledWith("workspace", { provider: "pexels", id: "photo-2", mediaType: "image" }));
  });
});