import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import type { AxiosResponse } from "axios";
import { axe } from "vitest-axe";
import apiClient from "@/api/client";
import socialMediaApi from "@/api/endpoints/social-media.api";
import type { BrandVoice, GeneratedContent, GenerateImageResult, GenerateCreativeSetPayload, MediaAsset, SocialPost, StoredSlide } from "@/types/social-media.types";
import AIStudioPage, { parseGeneratedContent } from "./AIStudioPage";
import { formatPostBody } from "@/lib/socialCaption";
import bodyFixtures from "@/lib/socialCaption.fixtures.json";
import { copyFingerprint } from "./studioCreative";
import { getBreadcrumbs } from "@/lib/navigation";
import { dashboardNavSections, filterNavSections } from "@/components/layouts/nav-config";

const context = vi.hoisted(() => ({ token: "studio-0", params: new URLSearchParams(), push: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getStoredAccessToken: () => context.token }));
vi.mock("@/api/client", () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: context.push, replace: context.replace }), useSearchParams: () => context.params }));
vi.mock("next/dynamic", () => ({ default: () => () => <div>Planner workspace</div> }));
vi.mock("@/components/social-media/content-studio/PhoneFrame", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/social-media/content-studio/PlatformPreview", () => ({ default: ({ caption, firstComment, media }: { caption: string; firstComment?: string; media?: { url: string }[] }) => <div aria-label="Platform preview">{caption}{firstComment && <p aria-label="Preview first comment">{firstComment}</p>}{media?.map((asset) => <img key={asset.url} src={asset.url} alt="Platform artwork" />)}</div> }));
vi.mock("@/components/social-media/posts/ScheduleModal", () => ({ default: () => null }));
vi.mock("@/components/social-media/content-studio/TemplateUseModal", () => ({ templateApplyStorageKey: () => "studio-template" }));

const brand: BrandVoice = {
  id: "brand-1", orgId: "studio", brandName: "Acme", industry: "Retail", tagline: "Made for better days",
  targetAudience: "Small businesses", tones: ["Friendly"], wordsToUse: [], wordsToAvoid: [], ctaPhrases: [],
  sentenceLength: "medium", emojiUsage: "sometimes", primaryLanguage: "en", systemPromptOverride: null,
  logoUrl: null, primaryColor: null, accentColor: null, updatedAt: "2026-10-22T10:00:00Z",
};
const generated: GeneratedContent = {
  format: "single", prompt: "Share our latest business update",
  platforms: {
    linkedin: { caption: "A thoughtful update for your audience.", hashtags: ["acme"], characterCount: 38, firstComment: "" },
    facebook: { caption: "Fresh ideas for your community.", hashtags: [], characterCount: 30, firstComment: "" },
  },
};
const generatedImage: GenerateImageResult = { imageUrl: "https://example.test/studio-image.jpg", source: "ai_generated", width: 1200, height: 1200, format: "post", logoApplied: false };
const creativeSet = { creativeSetId: "set-1", status: "completed", items: ["linkedin", "facebook"].map((platform) => ({ platform, slideId: "single", imageUrl: generatedImage.imageUrl, assetId: `${platform}-asset`, blobKey: `social/studio/${platform}.jpg`, width: 1200, height: 1200, mimeType: "image/jpeg" })), errors: [], warnings: [] };
const mediaPage = { items: [], total: 0, page: 1, pageSize: 24, totalPages: 0, stats: { images: 0, videos: 0, totalBytes: 0 } };
const response = (data: unknown) => ({ data }) as AxiosResponse;
let session = 0;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unmocked fetch is forbidden"); }));
  vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(() => { throw new Error("Unmocked XHR is forbidden"); });
  const getRect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("aria-label") === "Mobile post preview" ? { ...getRect.call(this), width: 500 } : getRect.call(this);
  });
  context.token = `studio-${++session}`;
  context.params = new URLSearchParams();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  vi.mocked(apiClient.get).mockImplementation(async (url) => response(String(url).endsWith("/brand-voice") ? brand : String(url).endsWith("/brand-logos") ? { items: [] } : mediaPage));
  vi.mocked(apiClient.post).mockImplementation(async (url) => response(String(url).endsWith("/generate-creative-set") ? creativeSet : String(url).endsWith("/generate-image") ? generatedImage : generated));
  vi.mocked(apiClient.put).mockResolvedValue(response(brand));
  vi.mocked(apiClient.patch).mockResolvedValue(response({ id: "draft-1", workspaceId: "studio", platforms: [] }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear(); });

function renderStudio(initialTab: "generate" | "brand" | "media" = "generate", workspaceId = "studio", permission = "admin") {
  const store = configureStore({ reducer: {
    auth: () => ({ user: { id: "user", name: "Alex", workspaceId, plan: "growth", socialPermissionLevel: permission } }),
    socialAccounts: () => ({ accounts: ["linkedin", "facebook"].map((platform) => ({ id: `${platform}-account`, platform, isActive: true, isDefault: true, accountName: "Acme", tokenStatus: "active" })) }),
    socialPosts: () => ({ publishing: false }),
  } });
  return render(<><style>{".hidden { display: none; }"}</style><Provider store={store}><AIStudioPage initialTab={initialTab} /></Provider></>);
}

async function createCopy(user: ReturnType<typeof userEvent.setup>) {
  visitStep("Brief");
  fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Share our latest business update" } });
  await user.click(copyButton());
  return screen.findByRole("textbox", { name: "LinkedIn caption" });
}

function visitStep(name: "Brief" | "Text" | "Visuals" | "Finish") {
  const navigation = screen.getByRole("navigation", { name: "Post workflow" });
  fireEvent.click(within(navigation).getByRole("button", { name: new RegExp(name) }));
}

function copyButton() {
  visitStep("Brief");
  return screen.getByRole("button", { name: "Create copy" });
}

function imageChoice(name = "Add an image") {
  visitStep("Visuals");
  return screen.getByRole("switch", { name });
}

function visualButton() {
  visitStep("Visuals");
  return screen.getByRole("button", { name: "Generate approved visuals", hidden: true });
}

function writingOptions() {
  visitStep("Brief");
  const button = screen.getByRole("button", { name: /Writing options/ });
  if (button.getAttribute("aria-expanded") !== "true") fireEvent.click(button);
}

async function attach(user: ReturnType<typeof userEvent.setup>, chosen = asset) {
  visitStep("Visuals");
  vi.spyOn(socialMediaApi, "uploadImage").mockResolvedValue({ imageUrl: chosen.url, assetId: chosen.id, source: "uploaded" });
  vi.spyOn(socialMediaApi, "uploadVideo").mockResolvedValue({ videoUrl: chosen.url, assetId: chosen.id, source: "uploaded" });
  vi.spyOn(socialMediaApi, "getMediaAsset").mockResolvedValue(chosen);
  await user.click(screen.getByRole("button", { name: "Add your media" }));
  await user.upload(screen.getByLabelText("Choose a media file"), new File(["media"], chosen.mediaType === "image" ? "photo.png" : "clip.mp4", { type: chosen.mimeType }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Choose media" })).toBeNull());
}

const asset: MediaAsset = { id: "manual-image", mediaType: "image", source: "uploaded", url: "https://example.test/manual.png", mimeType: "image/png", fileSizeBytes: 100, createdAt: "2026-10-27T00:00:00Z", provenance: { provider: "pexels", providerAssetId: "photo-1", creatorName: "Photo Creator", creatorUrl: "https://example.test/creator", providerPageUrl: "https://example.test/photo", licenseUrl: "https://example.test/license", attributionText: "Photo by Photo Creator on Pexels" } };

const savedPayload = () => vi.mocked(apiClient.post).mock.calls.filter(([url]) => String(url).endsWith("/posts")).at(-1)![1] as SocialPost;

describe("Studio shared media integration", () => {
  it("attaches before copy generation without AI image credits and saves asset identity and attribution for every channel", async () => {
    const user = userEvent.setup();
    renderStudio();
    await attach(user);
    expect(screen.getByRole("img", { name: "Attached media" }).getAttribute("src")).toBe(asset.url);
    expect(screen.getByText(asset.provenance!.attributionText)).toBeTruthy();
    expect(screen.getByRole("link", { name: "License" }).getAttribute("href")).toBe(asset.provenance!.licenseUrl);
    await createCopy(user);
    visitStep("Visuals");
    expect(screen.getByRole("img", { name: "Attached media" })).toBeTruthy();
    expect(apiClient.post).not.toHaveBeenCalledWith(expect.stringContaining("/generate-creative-set"), expect.anything(), expect.anything());
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    expect((screen.getByRole("button", { name: "Generate approved visuals" }) as HTMLButtonElement).disabled).toBe(true);
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ id: "saved", platforms: [] }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(savedPayload().platforms).toHaveLength(2));
    expect(savedPayload().imageUrl).toBe(asset.url);
    for (const platform of savedPayload().platforms) expect(platform.media).toEqual([{ assetId: asset.id, url: asset.url, mimeType: asset.mimeType, provenance: asset.provenance }]);
    expect(savedPayload().generationOptions).toMatchObject({ visualsStale: false, visualIntent: false });
    expect(savedPayload().generationOptions?.copyApproval).toBeTruthy();
    await attach(user, { ...asset, id: "replacement", url: "https://example.test/replacement.png" });
    expect(screen.getByRole("button", { name: "Approve copy" })).toBeTruthy();
    expect(screen.queryByText(/Visuals are out of date/)).toBeNull();
  });

  it("keeps attached media through copy regeneration and removes approval when detached", async () => {
    const user = userEvent.setup();
    renderStudio();
    await attach(user);
    await createCopy(user);
    await user.click(copyButton());
    await user.click(screen.getByRole("button", { name: "Generate again" }));
    visitStep("Visuals");
    expect(screen.getByRole("img", { name: "Attached media" }).getAttribute("src")).toBe(asset.url);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    await user.click(screen.getByRole("button", { name: "Remove attached media" }));
    expect(screen.getByRole("button", { name: "Approve copy" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Attached media" })).toBeNull();
  });

  it("replaces only current artwork with manual media and does not stale it when copy changes", async () => {
    const user = userEvent.setup();
    renderStudio();
    await createCopy(user);
    await user.click(imageChoice());
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    await user.click(visualButton());
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(expect.stringContaining("/generate-creative-set"), expect.anything(), expect.anything()));
    await attach(user);
    fireEvent.change(screen.getByLabelText("LinkedIn caption"), { target: { value: "Edited caption with manual artwork" } });
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ id: "saved", platforms: [] }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(savedPayload().generationOptions?.visualsStale).toBe(false));
    expect(savedPayload().generationOptions?.creativeRequest).toBeUndefined();
    expect(savedPayload().platforms.every(platform => platform.media?.[0].assetId === asset.id)).toBe(true);
  });

  it.each(["Carousel", "Thread"])("does not allow manual attachments for %s", async type => {
    const user = userEvent.setup();
    renderStudio();
    await user.click(screen.getByRole("button", { name: type }));
    expect((screen.getByRole("button", { name: "Add your media" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Carousel and Thread do not support manual attachments/)).toBeTruthy();
  });

  it("previews and saves video drafts while leaving publishing and scheduling disabled", async () => {
    const user = userEvent.setup();
    renderStudio();
    const video = { ...asset, id: "manual-video", mediaType: "video" as const, mimeType: "video/mp4", url: "https://example.test/clip.mp4" };
    await attach(user, video);
    expect(screen.getByLabelText("Attached draft video").getAttribute("src")).toBe(video.url);
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    visitStep("Finish");
    expect((screen.getByRole("button", { name: "Publish now" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Schedule" }) as HTMLButtonElement).disabled).toBe(true);
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ id: "saved", platforms: [] }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(savedPayload().platforms[0].media?.[0]).toMatchObject({ assetId: video.id, mimeType: "video/mp4", url: video.url }));
  });

  it("restores manual draft media with metadata instead of treating it as stale generated artwork", async () => {
    const user = userEvent.setup();
    context.params = new URLSearchParams({ draftId: "saved" });
    const media = { assetId: asset.id, url: asset.url, mimeType: asset.mimeType, provenance: asset.provenance };
    vi.spyOn(socialMediaApi, "getPost").mockResolvedValue({ id: "saved", imageUrl: asset.url, imageSource: "uploaded", format: "single", generationOptions: { visualIntent: false }, platforms: [{ platform: "linkedin", caption: "Saved copy", hashtags: [], media: [media] }] } as unknown as SocialPost);
    renderStudio();
    await screen.findByLabelText("LinkedIn caption");
    visitStep("Visuals");
    expect(screen.getByRole("img", { name: "Attached media" })).toBeTruthy();
    expect(screen.getByText(asset.provenance!.attributionText)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalled());
    expect(vi.mocked(apiClient.patch).mock.calls.at(-1)![1]).toMatchObject({ platforms: [{ media: [media] }], generationOptions: { visualsStale: false } });
  });

  it("reloads the library after adding media without navigating to Generate", async () => {
    const user = userEvent.setup();
    vi.spyOn(socialMediaApi, "uploadImage").mockResolvedValue({ imageUrl: asset.url, assetId: asset.id, source: "uploaded" });
    vi.spyOn(socialMediaApi, "getMediaAsset").mockResolvedValue(asset);
    const list = vi.spyOn(socialMediaApi, "listMediaAssets").mockResolvedValue({ ...mediaPage, items: [asset], total: 1 });
    renderStudio("media");
    await screen.findByText(asset.provenance!.attributionText);
    await user.click(screen.getByRole("button", { name: "Upload / paste / stock" }));
    await user.upload(screen.getByLabelText("Choose a media file"), new File(["image"], "photo.png", { type: "image/png" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Choose media" })).toBeNull());
    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("tab", { name: "Media Library" }).getAttribute("aria-selected")).toBe("true");
    expect(context.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Create copy" })).toBeNull();
  });
});

describe("Studio comment and publisher parity", () => {
  const withComments: GeneratedContent = { ...generated, platforms: {
    linkedin: { ...generated.platforms.linkedin!, hashtags: ["LinkedInOnly"], firstComment: "LinkedIn comment" },
    facebook: { ...generated.platforms.facebook!, hashtags: ["FacebookOnly"], firstComment: "Facebook comment" },
  } };
  const saveResult = () => vi.mocked(apiClient.post).mockResolvedValueOnce(response({ id: "saved", platforms: [] }));
  const lastPostPayload = () => vi.mocked(apiClient.post).mock.calls.filter(([url]) => String(url).endsWith("/posts")).at(-1)![1] as SocialPost;

  it.each([true, false])("defaults comment generation from workspace %s and allows overrides", async (autoFirstComment) => {
    const user = userEvent.setup();
    vi.spyOn(socialMediaApi, "getSettings").mockResolvedValue({ autoFirstComment } as Awaited<ReturnType<typeof socialMediaApi.getSettings>>);
    renderStudio();
    writingOptions();
    await waitFor(() => expect(screen.getByRole("switch", { name: "Generate first comment" }).getAttribute("aria-checked")).toBe(String(autoFirstComment)));
    await user.click(screen.getByRole("switch", { name: "Generate first comment" }));
    await createCopy(user);
    expect(apiClient.post).toHaveBeenCalledWith(expect.stringContaining("/generate"), expect.objectContaining({ includeComment: !autoFirstComment }), expect.anything());
    saveResult();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(lastPostPayload().generationOptions?.includeComment).toBe(!autoFirstComment));
  });

  it("keeps per-platform comments and hashtags, adds only visible shared edits, and copies the final body", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockResolvedValueOnce(response(withComments));
    renderStudio();
    await createCopy(user);
    expect((screen.getByLabelText("First comment") as HTMLTextAreaElement).value).toBe("LinkedIn comment");
    expect(screen.getByText(/LinkedIn · manual copy only/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    fireEvent.change(screen.getByLabelText("First comment"), { target: { value: "Edited\n\nComment  exactly" } });
    expect(screen.getByRole("button", { name: "Approve copy" })).toBeTruthy();
    const { caption, hashtags, expected } = bodyFixtures[1];
    fireEvent.change(screen.getByLabelText("LinkedIn caption"), { target: { value: caption } });
    fireEvent.change(screen.getByLabelText("LinkedIn hashtags"), { target: { value: hashtags.join("\n") } });
    const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(clipboard).toHaveBeenLastCalledWith(expected);
    await user.click(screen.getByRole("button", { name: "Copy first comment" }));
    expect(clipboard).toHaveBeenLastCalledWith("Edited\n\nComment  exactly");
    expect(screen.getByText(`${Array.from(expected).length} / 3000`)).toBeTruthy();
    await user.type(screen.getByLabelText("Additional shared hashtags"), "Manual{Enter}");
    saveResult();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(lastPostPayload().platforms).toHaveLength(2));
    expect(lastPostPayload().platforms[0]).toMatchObject({ caption, hashtags: [...hashtags, "Manual"], firstComment: "Edited\n\nComment  exactly" });
    expect(lastPostPayload().platforms[1]).toMatchObject({ hashtags: ["FacebookOnly", "Manual"], firstComment: "Facebook comment" });
    expect(formatPostBody(lastPostPayload().platforms[0].caption, lastPostPayload().platforms[0].hashtags)).toBe(`${expected} #Manual`);
  });

  it("shows and saves generated comments after enabling comments following a commentless generation", async () => {
    const user = userEvent.setup();
    vi.spyOn(socialMediaApi, "getSettings").mockResolvedValue({ autoFirstComment: false } as Awaited<ReturnType<typeof socialMediaApi.getSettings>>);
    vi.mocked(apiClient.post).mockResolvedValueOnce(response(generated));
    renderStudio();
    await createCopy(user);
    writingOptions();
    expect(screen.getByRole("switch", { name: "Generate first comment" }).getAttribute("aria-checked")).toBe("false");
    expect((screen.getByLabelText("First comment") as HTMLTextAreaElement).value).toBe("");
    expect(apiClient.post).toHaveBeenLastCalledWith(expect.stringContaining("/generate"), expect.objectContaining({ includeComment: false }), expect.anything());
    await user.click(screen.getByRole("switch", { name: "Generate first comment" }));
    await user.click(copyButton());
    vi.mocked(apiClient.post).mockResolvedValueOnce(response(withComments));
    await user.click(screen.getByRole("button", { name: "Generate again" }));
    await waitFor(() => expect((screen.getByLabelText("First comment") as HTMLTextAreaElement).value).toBe("LinkedIn comment"));
    expect(apiClient.post).toHaveBeenLastCalledWith(expect.stringContaining("/generate"), expect.objectContaining({ includeComment: true }), expect.anything());
    saveResult();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(lastPostPayload()).toMatchObject({
      generationOptions: { includeComment: true },
      platforms: [
        { platform: "linkedin", firstComment: "LinkedIn comment" },
        { platform: "facebook", firstComment: "Facebook comment" },
      ],
    }));
  });

  it("regenerates captions without overwriting edited comments or manual shared tags", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockResolvedValueOnce(response(withComments));
    renderStudio();
    await createCopy(user);
    fireEvent.change(screen.getByLabelText("First comment"), { target: { value: "Keep authored comment" } });
    await user.type(screen.getByLabelText("Additional shared hashtags"), "Manual{Enter}");
    await user.click(copyButton());
    vi.mocked(apiClient.post).mockResolvedValueOnce(response(generated));
    await user.click(screen.getByRole("button", { name: "Generate again" }));
    await screen.findByLabelText("First comment");
    expect((screen.getByLabelText("First comment") as HTMLTextAreaElement).value).toBe("Keep authored comment");
    expect(screen.getByRole("button", { name: "Remove hashtag Manual" })).toBeTruthy();
    saveResult();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(lastPostPayload().platforms[0]).toMatchObject({ firstComment: "Keep authored comment", hashtags: ["acme", "Manual"] }));
  });

  it.each([{ platform: "linkedin", limit: 3000 }, { platform: "facebook", limit: 2200 }, { platform: "instagram", limit: 2200 }] as const)("counts the final $platform body including tags with publisher Unicode limits", async ({ platform, limit }) => {
    context.params = new URLSearchParams({ draftId: "saved" });
    const caption = `${"a".repeat(limit - 5)}🚀`;
    vi.spyOn(socialMediaApi, "getPost").mockResolvedValue({ id: "saved", generationOptions: { includeComment: false }, platforms: [{ platform, caption, hashtags: ["#A"], firstComment: "Comment is not part of body count" }] } as SocialPost);
    renderStudio();
    await screen.findByLabelText(`${platform === "linkedin" ? "LinkedIn" : platform === "facebook" ? "Facebook" : "Instagram"} caption`);
    expect(screen.getByText(`${limit} / ${limit}`)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(`${platform === "linkedin" ? "LinkedIn" : platform === "facebook" ? "Facebook" : "Instagram"} caption`), { target: { value: `${caption}x` } });
    expect(screen.getByText(`${limit + 1} / ${limit}`)).toBeTruthy();
    expect(screen.getByRole("textbox", { name: `${platform === "linkedin" ? "LinkedIn" : platform === "facebook" ? "Facebook" : "Instagram"} caption` }).getAttribute("aria-invalid")).toBe("true");
  });

  it("passes the edited comment into preview and invalidates approval when its preference changes", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockResolvedValueOnce(response(withComments));
    renderStudio();
    await createCopy(user);
    fireEvent.change(screen.getByLabelText("First comment"), { target: { value: "Exact preview comment" } });
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    await user.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByLabelText("Preview first comment").textContent).toBe("Exact preview comment");
    await user.click(screen.getByRole("button", { name: "Hide preview" }));
    writingOptions();
    await user.click(screen.getByRole("switch", { name: "Generate first comment" }));
    visitStep("Text");
    expect(screen.getByRole("button", { name: "Approve copy" })).toBeTruthy();
  });

  it("restores exact comments and a false preference even when the workspace default is true", async () => {
    const user = userEvent.setup();
    context.params = new URLSearchParams({ draftId: "saved" });
    vi.spyOn(socialMediaApi, "getSettings").mockResolvedValue({ autoFirstComment: true } as Awaited<ReturnType<typeof socialMediaApi.getSettings>>);
    vi.spyOn(socialMediaApi, "getPost").mockResolvedValue({ id: "saved", generationOptions: { includeComment: false }, platforms: [
      { platform: "linkedin", caption: "Saved #inline\n\n\nCopy", hashtags: ["##Saved", "Saved"], firstComment: " Saved\n\ncomment " },
    ] } as SocialPost);
    renderStudio();
    await screen.findByLabelText("First comment");
    expect((screen.getByLabelText("First comment") as HTMLTextAreaElement).value).toBe(" Saved\n\ncomment ");
    writingOptions();
    expect(screen.getByRole("switch", { name: "Generate first comment" }).getAttribute("aria-checked")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalled());
    expect(vi.mocked(apiClient.patch).mock.calls.at(-1)![1]).toMatchObject({ generationOptions: { includeComment: false }, platforms: [{ caption: "Saved #inline\n\n\nCopy", hashtags: ["##Saved", "Saved"], firstComment: " Saved\n\ncomment " }] });
  });

  it("shares structured carousel comments across selected platforms and keeps them when generation is off", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ format: "carousel", platforms: {}, caption: "Carousel intro", firstComment: "Shared comment", hashtags: ["Carousel"], slides: [{ id: "one", headline: "One", body: "Body", imagePrompt: "Art" }, { id: "two", headline: "Two", body: "Body", imagePrompt: "Art" }] }));
    renderStudio();
    await user.click(screen.getByRole("button", { name: "Carousel" }));
    await createCopy(user);
    expect((screen.getByLabelText("First comment") as HTMLTextAreaElement).value).toBe("Shared comment");
    fireEvent.change(screen.getByLabelText("First comment"), { target: { value: "Shared edit" } });
    saveResult();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(lastPostPayload().platforms.map((platform) => platform.firstComment)).toEqual(["Shared edit", "Shared edit"]));
    expect(lastPostPayload().generationOptions?.includeComment).toBe(false);
  });

  it("reads top-level poll comments and keeps unsupported threads empty", () => {
    const structured = { format: "poll", prompt: "", platforms: {}, pollQuestion: "Question?", pollOptions: ["One", "Two"], caption: "Intro", firstComment: "Shared" };
    expect(parseGeneratedContent(structured, "poll", ["facebook", "linkedin"], 0).map((variation) => variation.firstComment)).toEqual(["Shared", "Shared"]);
    expect(parseGeneratedContent({ ...structured, tweets: [{ text: "Thread", characterCount: 6 }] }, "thread", ["x"], 0)[0].firstComment).toBe("");
  });
});

describe("AIStudioPage", () => {
  const carouselSlides: StoredSlide[] = ["a", "b", "c"].map((id) => ({ id, headline: `Headline ${id}`, body: `Body ${id}`, imagePrompt: `Artwork ${id}` }));
  const carouselResponse: GeneratedContent = { format: "carousel", platforms: {}, prompt: "Useful carousel", caption: "## Intro\n**Useful** content 🚀", slides: carouselSlides, hashtags: ["Useful"] };
  const exportsFor = (request: GenerateCreativeSetPayload) => (request.slides ?? [{ id: "single" }]).flatMap((slide) => request.platforms.map((platform) => ({ ...creativeSet.items[0], platform, slideId: slide.id, imageUrl: `https://example.test/${platform}/${slide.id}.jpg`, assetId: `${platform}-${slide.id}`, blobKey: `social/studio/${platform}/${slide.id}.jpg` })));

  it("routes Planner to its dedicated workspace and preserves other Studio tabs", async () => {
    const user = userEvent.setup();
    renderStudio();
    const caption = await createCopy(user);
    await user.click(screen.getByRole("tab", { name: "Content Planner" }));
    expect(context.push).toHaveBeenCalledWith("/dashboard/content-studio/planner");
    expect(screen.queryByText("Planner workspace")).toBeNull();
    expect((caption as HTMLTextAreaElement).value).toBe(generated.platforms.linkedin!.caption);
    await user.click(screen.getByRole("tab", { name: "Brand Profile" }));
    await screen.findByLabelText("Default call to action");
    await user.click(screen.getByRole("tab", { name: "Create" }));
    expect((screen.getByLabelText("LinkedIn caption") as HTMLTextAreaElement).value).toBe(generated.platforms.linkedin!.caption);
  });

  it("redirects old planner deep links without mounting the legacy planner or dropping other parameters", async () => {
    context.params = new URLSearchParams({ tab: "planner", topic: "Saved brief" });
    renderStudio();
    await waitFor(() => expect(context.replace).toHaveBeenCalledWith("/dashboard/content-studio/planner?topic=Saved+brief"));
    expect(screen.queryByText("Planner workspace")).toBeNull();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("labels planner navigation and durable review breadcrumbs without exposing run IDs", () => {
    const nav = dashboardNavSections.flatMap((section) => section.items);
    expect(nav.find((item) => item.label === "Content Planner")).toMatchObject({ href: "/dashboard/content-studio/planner", minPermission: "editor" });
    expect(filterNavSections(dashboardNavSections, null).flatMap((section) => section.items).some((item) => item.label === "Content Planner")).toBe(false);
    expect(getBreadcrumbs("/dashboard/content-studio/planner/run-123")).toEqual([
      { label: "Dashboard", href: "/dashboard" }, { label: "AI Studio", href: "/dashboard/content-studio" },
      { label: "Content Planner", href: "/dashboard/content-studio/planner" }, { label: "Plan review", href: undefined },
    ]);
  });

  it("omits template CTA overrides from new copy and artwork while retaining Brand default CTA", async () => {
    context.params = new URLSearchParams({ templateId: "legacy-template" });
    sessionStorage.setItem("studio-template", JSON.stringify({ templateId: "legacy-template", name: "Legacy", topic: "Share our latest business update", suggestedCta: "Old manual CTA", platforms: ["linkedin", "facebook"], generateImage: true }));
    const user = userEvent.setup();
    renderStudio();
    visitStep("Visuals");
    await user.click(screen.getByRole("button", { name: /Advanced settings/ }));
    expect(screen.queryByLabelText("Call to action")).toBeNull();
    await user.click(copyButton());
    await user.click(await screen.findByRole("button", { name: "Approve copy" }));
    await user.click(visualButton());
    await screen.findByRole("link", { name: "Download" });
    const requests = vi.mocked(apiClient.post).mock.calls.map((call) => call[1]);
    expect(requests).toHaveLength(2);
    requests.forEach((request) => expect(request).not.toHaveProperty("cta"));
    await user.click(screen.getByRole("tab", { name: "Brand Profile" }));
    expect(await screen.findByLabelText("Default call to action")).toBeTruthy();
  });

  it("preserves hidden legacy CTA approval on restore but omits it from new artwork and clears it on intentional new copy", async () => {
    const user = userEvent.setup();
    const first = renderStudio();
    await user.click(imageChoice());
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ id: "saved", platforms: [] }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(context.replace).toHaveBeenCalled());
    const saved = vi.mocked(apiClient.post).mock.calls[1][1] as SocialPost;
    const content = JSON.parse(saved.generationOptions!.copyApproval!.fingerprint).content;
    saved.generationOptions = { ...saved.generationOptions, cta: "Legacy saved CTA", copyApproval: { version: 1, fingerprint: copyFingerprint({ ...content, cta: "Legacy saved CTA" }) } };
    first.unmount();
    context.params = new URLSearchParams({ draftId: "saved" });
    vi.spyOn(socialMediaApi, "getPost").mockResolvedValue({ ...saved, id: "saved" });
    renderStudio();
    await screen.findByRole("button", { name: "Copy approved" });
    await user.click(visualButton());
    await screen.findByRole("link", { name: "Download" });
    expect(vi.mocked(apiClient.post).mock.calls.at(-1)![1]).not.toHaveProperty("cta");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalled());
    expect(vi.mocked(apiClient.patch).mock.calls.at(-1)![1]).toMatchObject({ generationOptions: { cta: "Legacy saved CTA" } });
    await user.click(copyButton());
    await user.click(screen.getByRole("button", { name: "Generate again" }));
    await screen.findByRole("button", { name: "Approve copy" });
    expect(vi.mocked(apiClient.post).mock.calls.at(-1)![1]).not.toHaveProperty("cta");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(vi.mocked(apiClient.patch).mock.calls.at(-1)![1]).toMatchObject({ generationOptions: { cta: "" } }));
  });

  it("polls processing artwork using only GET with the original request ID", async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.click(imageChoice());
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ ...creativeSet, status: "processing", items: [] }));
    const status = vi.spyOn(socialMediaApi, "getCreativeSetStatus").mockResolvedValue(creativeSet as Awaited<ReturnType<typeof socialMediaApi.getCreativeSetStatus>>);
    const generateVisuals = visualButton();
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(generateVisuals); });
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(status).toHaveBeenCalledExactlyOnceWith("studio", (vi.mocked(apiClient.post).mock.calls[1][1] as GenerateCreativeSetPayload).requestId, expect.any(AbortSignal));
    expect(apiClient.post).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("img", { name: "LinkedIn artwork" })).toBeTruthy();
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("bounds processing polling and resumes status checks without replaying POST", async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.click(imageChoice());
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    const processing = { ...creativeSet, status: "processing", items: [] } as Awaited<ReturnType<typeof socialMediaApi.getCreativeSetStatus>>;
    vi.mocked(apiClient.post).mockResolvedValueOnce(response(processing));
    const status = vi.spyOn(socialMediaApi, "getCreativeSetStatus").mockResolvedValue(processing);
    const generateVisuals = visualButton();
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(generateVisuals); });
    await act(async () => { await vi.advanceTimersByTimeAsync(610_000); });
    expect(status).toHaveBeenCalledTimes(60);
    expect(screen.getByText(/Artwork is still processing/)).toBeTruthy();
    status.mockResolvedValue(creativeSet as Awaited<ReturnType<typeof socialMediaApi.getCreativeSetStatus>>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Check visual status" })); });
    expect(status).toHaveBeenCalledTimes(61);
    expect(apiClient.post).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("img", { name: "LinkedIn artwork" })).toBeTruthy();
  });

  it.each(["unmount", "session"])("ignores pending status results after %s and aborts on unmount", async (change) => {
    const user = userEvent.setup();
    const view = renderStudio();
    await user.click(imageChoice());
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ ...creativeSet, status: "processing", items: [] }));
    let resolve!: (value: Awaited<ReturnType<typeof socialMediaApi.getCreativeSetStatus>>) => void;
    const status = vi.spyOn(socialMediaApi, "getCreativeSetStatus").mockImplementation(() => new Promise((done) => { resolve = done; }));
    const generateVisuals = visualButton();
    vi.useFakeTimers();
    await act(async () => { fireEvent.click(generateVisuals); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    const signal = status.mock.calls[0][2]!;
    if (change === "unmount") { view.unmount(); expect(signal.aborted).toBe(true); renderStudio("generate", "new-workspace"); }
    else context.token = "new-session";
    await act(async () => { resolve(creativeSet as Awaited<ReturnType<typeof socialMediaApi.getCreativeSetStatus>>); });
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it("requires explicit credit consent for unavailable retries and new artwork", async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.click(imageChoice());
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ ...creativeSet, status: "failed", items: [], errors: [{ code: "CREATIVE_RETRY_UNAVAILABLE", message: "New artwork requires a new requestId" }] }));
    await user.click(visualButton());
    expect((await screen.findByRole("button", { name: "Retry visuals" }) as HTMLButtonElement).disabled).toBe(true);
    const original = vi.mocked(apiClient.post).mock.calls[1][1] as GenerateCreativeSetPayload;
    await user.click(screen.getByRole("button", { name: "Regenerate visuals" }));
    expect(screen.getByText(/may consume additional image credits/)).toBeTruthy();
    expect(apiClient.post).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(apiClient.post).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Regenerate visuals" }));
    await user.click(screen.getByRole("button", { name: "Confirm new artwork credits" }));
    await screen.findByRole("link", { name: "Download" });
    expect((vi.mocked(apiClient.post).mock.calls[2][1] as GenerateCreativeSetPayload).requestId).not.toBe(original.requestId);
  });

  it("shows an actionable neutral preview failure rather than a black image and blocks publishing", async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.click(imageChoice());
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    await user.click(visualButton());
    fireEvent.error(await screen.findByRole("img", { name: "LinkedIn artwork" }));
    expect(screen.getByText(/Image preview unavailable/)).toBeTruthy();
    expect(screen.queryByRole("img", { name: "LinkedIn artwork" })).toBeNull();
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Copy approved" })).toBeTruthy();
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it.each([2, 3, 8])("sends the accessible %i-slide selection and Professional emoji-off defaults", async (count) => {
    const user = userEvent.setup();
    renderStudio();
    writingOptions();
    expect(screen.getByRole("radio", { name: "Professional" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: "Emojis" }).getAttribute("aria-checked")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Carousel" }));
    expect((screen.getByLabelText("Slide count") as HTMLSelectElement).value).toBe("3");
    expect(Array.from((screen.getByLabelText("Slide count") as HTMLSelectElement).options).map((option) => option.value)).toEqual(["2", "3", "4", "5", "6", "7", "8"]);
    fireEvent.change(screen.getByLabelText("Slide count"), { target: { value: String(count) } });
    expect(imageChoice("Add slide images").getAttribute("aria-checked")).toBe("true");
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Useful carousel for our customers" } });
    vi.mocked(apiClient.post).mockResolvedValueOnce(response(carouselResponse));
    await user.click(copyButton());
    await screen.findByRole("textbox", { name: "LinkedIn caption" });
    expect(apiClient.post).toHaveBeenCalledWith(expect.stringContaining("/generate"), expect.objectContaining({ format: "carousel", slideCount: count, tone: "Professional", includeEmojis: false }), { timeout: 120_000 });
    expect((screen.getByRole("textbox", { name: "LinkedIn caption" }) as HTMLTextAreaElement).value).toBe("Intro\nUseful content");
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves coordinated carousel exports in platform/slide order and forces new artwork after text edits", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockImplementation(async (url, payload) => response(String(url).endsWith("/generate-creative-set") ? { ...creativeSet, items: exportsFor(payload as GenerateCreativeSetPayload) } : String(url).endsWith("/posts") ? { id: "saved", workspaceId: "studio", platforms: [] } : carouselResponse));
    renderStudio();
    await user.click(screen.getByRole("button", { name: "Carousel" }));
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Useful carousel for customers" } });
    await user.click(copyButton());
    await user.click(await screen.findByRole("button", { name: "Approve copy" }));
    await user.click(visualButton());
    await screen.findByRole("img", { name: "LinkedIn slide 1 artwork" });
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(false);
    const firstRequest = vi.mocked(apiClient.post).mock.calls.find(([url]) => String(url).endsWith("/generate-creative-set"))![1] as GenerateCreativeSetPayload;
    expect(firstRequest.slides).toEqual(carouselSlides);
    fireEvent.change(screen.getByLabelText("Slide 2 body"), { target: { value: "Edited slide body" } });
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    await user.click(screen.getByRole("button", { name: "Regenerate visuals" }));
    await user.click(screen.getByRole("button", { name: "Confirm new artwork credits" }));
    await waitFor(() => expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(false));
    const requests = vi.mocked(apiClient.post).mock.calls.filter(([url]) => String(url).endsWith("/generate-creative-set")).map((call) => call[1] as GenerateCreativeSetPayload);
    expect(requests[1].requestId).not.toBe(requests[0].requestId);
    expect(requests[1].slides?.[1].body).toBe("Edited slide body");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(context.replace).toHaveBeenCalled());
    const saved = vi.mocked(apiClient.post).mock.calls.find(([url]) => String(url).endsWith("/posts"))![1] as { format: string; slides: StoredSlide[]; platforms: { caption: string; media: { slideId: string; url: string; assetId: string; blobKey: string }[] }[]; generationOptions: unknown };
    expect(saved.format).toBe("carousel");
    expect(saved.slides[1].body).toBe("Edited slide body");
    expect(saved.platforms.every((platform) => platform.caption === "Intro\nUseful content")).toBe(true);
    expect(saved.platforms[0].media.map((asset) => asset.slideId)).toEqual(["a", "b", "c"]);
    expect(saved.platforms[1].media[0].url).toContain("facebook/a");
    expect(saved.generationOptions).toMatchObject({ tone: "Professional", includeEmojis: false, slideCount: 3, visualsStale: false, copyApproval: { version: 1, fingerprint: expect.any(String) } });
  });

  it("retries a partial set with the identical request and preserves valid artwork on retry failure", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    vi.mocked(apiClient.post).mockImplementation(async (url, payload) => {
      if (!String(url).endsWith("/generate-creative-set")) return response(carouselResponse);
      attempts += 1;
      if (attempts === 2) throw new Error("Temporary export failure");
      const items = exportsFor(payload as GenerateCreativeSetPayload);
      return response({ ...creativeSet, status: attempts === 1 ? "partial" : "completed", items: attempts === 1 ? items.slice(0, 1) : items });
    });
    renderStudio();
    await user.click(screen.getByRole("button", { name: "Carousel" }));
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Useful carousel for customers" } });
    await user.click(copyButton());
    await user.click(await screen.findByRole("button", { name: "Approve copy" }));
    await user.click(visualButton());
    await screen.findByRole("img", { name: "LinkedIn slide 1 artwork" });
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Retry visuals" }));
    await screen.findByText("Temporary export failure");
    expect(screen.getByRole("img", { name: "LinkedIn slide 1 artwork" }).getAttribute("src")).toContain("linkedin/a");
    await user.click(screen.getByRole("button", { name: "Retry visuals" }));
    await waitFor(() => expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(false));
    const requests = vi.mocked(apiClient.post).mock.calls.filter(([url]) => String(url).endsWith("/generate-creative-set")).map((call) => call[1]);
    expect(requests).toHaveLength(3);
    expect(requests[1]).toEqual(requests[0]);
    expect(requests[2]).toEqual(requests[0]);
  });

  it.each(["partial", "failed"])("never saves old artwork into a changed request with a %s result, including after retry", async (status) => {
    const user = userEvent.setup();
    let attempts = 0;
    vi.mocked(apiClient.post).mockImplementation(async (url, payload) => {
      if (String(url).endsWith("/posts")) return response({ id: "saved", platforms: [] });
      if (!String(url).endsWith("/generate-creative-set")) return response(carouselResponse);
      attempts += 1;
      const items = exportsFor(payload as GenerateCreativeSetPayload).map((item) => ({ ...item, imageUrl: item.imageUrl.replace("example.test/", attempts === 1 ? "example.test/old/" : "example.test/new/") }));
      return response({ ...creativeSet, status: attempts === 1 || attempts === 4 ? "completed" : status, items: attempts === 1 || attempts === 4 ? items : status === "failed" ? [] : items.slice(attempts === 2 ? 0 : 1, attempts === 2 ? 1 : 2) });
    });
    renderStudio();
    await user.click(screen.getByRole("button", { name: "Carousel" }));
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Useful carousel for customers" } });
    await user.click(copyButton());
    await user.click(await screen.findByRole("button", { name: "Approve copy" }));
    await user.click(visualButton());
    await screen.findByRole("img", { name: "LinkedIn slide 1 artwork" });
    fireEvent.change(screen.getByLabelText("Slide 1 body"), { target: { value: "Changed artwork copy" } });
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    await user.click(screen.getByRole("button", { name: "Regenerate visuals" }));
    await user.click(screen.getByRole("button", { name: "Confirm new artwork credits" }));
    await screen.findByText(/Some visuals are missing/);
    await user.click(screen.getByRole("button", { name: "Retry visuals" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(4));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(context.replace).toHaveBeenCalled());
    const saved = vi.mocked(apiClient.post).mock.calls.find(([url]) => String(url).endsWith("/posts"))![1] as { imageUrl: string | null; platforms: { media: { url: string }[] }[]; generationOptions: { visualsStale: boolean } };
    const urls = saved.platforms.flatMap((platform) => platform.media.map((media) => media.url));
    expect(urls).toHaveLength(status === "failed" ? 0 : 2);
    expect(urls.every((url) => url.includes("/new/"))).toBe(true);
    expect(saved.imageUrl === null || saved.imageUrl.includes("/new/")).toBe(true);
    expect(saved.generationOptions.visualsStale).toBe(true);
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Retry visuals" }));
    await waitFor(() => expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(false));
    const requests = vi.mocked(apiClient.post).mock.calls.filter(([url]) => String(url).endsWith("/generate-creative-set")).map((call) => call[1] as GenerateCreativeSetPayload);
    expect(requests[1].requestId).not.toBe(requests[0].requestId);
    expect(requests[2]).toEqual(requests[1]);
    expect(requests[3]).toEqual(requests[1]);
  });

  it.each(["partial", "completed-missing-facebook"])("blocks every publishing entry point for a %s single-image set until a complete retry", async (status) => {
    const user = userEvent.setup();
    let attempts = 0;
    vi.mocked(apiClient.post).mockImplementation(async (url) => {
      if (!String(url).endsWith("/generate-creative-set")) return response(generated);
      attempts += 1;
      return response({ ...creativeSet, status: attempts > 1 || status === "completed-missing-facebook" ? "completed" : status, items: attempts === 1 && status === "completed-missing-facebook" ? creativeSet.items.slice(0, 1) : creativeSet.items });
    });
    renderStudio();
    await user.click(imageChoice());
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Share our latest business update" } });
    await user.click(copyButton());
    await user.click(await screen.findByRole("button", { name: "Approve copy" }));
    await user.click(visualButton());
    await screen.findByRole("button", { name: "Retry visuals" });
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
    visitStep("Finish");
    expect((screen.getByRole("button", { name: "Schedule" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Publish now" }) as HTMLButtonElement).disabled).toBe(true);
    visitStep("Visuals");
    await user.click(screen.getByRole("button", { name: "Retry visuals" }));
    await waitFor(() => expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("restores incomplete carousel drafts with options, slide copy and partial platform exports", async () => {
    context.params = new URLSearchParams({ draftId: "draft-1" });
    const draft = { id: "draft-1", workspaceId: "studio", format: "carousel", slides: carouselSlides, generationOptions: { tone: "Luxury", includeEmojis: true, includeHashtags: false, length: "Short", slideCount: 8 }, platforms: [{ platform: "linkedin", caption: "Saved intro", hashtags: [], media: [{ ...creativeSet.items[0], url: "https://example.test/saved-a.jpg", slideId: "a" }] }] };
    vi.spyOn(socialMediaApi, "getPost").mockResolvedValue(draft as unknown as SocialPost);
    const user = userEvent.setup();
    renderStudio();
    await screen.findByLabelText("Slide 3 body");
    writingOptions();
    expect((screen.getByLabelText("Slide count") as HTMLSelectElement).value).toBe("8");
    expect(screen.getByRole("radio", { name: "Luxury" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: "Emojis" }).getAttribute("aria-checked")).toBe("true");
    visitStep("Text");
    expect((screen.getByRole("textbox", { name: "LinkedIn caption" }) as HTMLTextAreaElement).value).toBe("Saved intro");
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalled());
    expect(vi.mocked(apiClient.patch).mock.calls[0][1]).toMatchObject({ format: "carousel", slides: carouselSlides, generationOptions: { tone: "Luxury", slideCount: 8 }, platforms: [{ media: [expect.objectContaining({ slideId: "a", url: "https://example.test/saved-a.jpg" })] }] });
  });

  it("edits and copies individual structured tweets and blocks both publishing and scheduling", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ format: "thread", platforms: {}, tweets: [{ text: "1/2 **First** 🚀", characterCount: 16 }, { text: "2/2 Second", characterCount: 10 }] }));
    renderStudio();
    await user.click(screen.getByRole("button", { name: "Thread" }));
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Useful thread for our audience" } });
    await user.click(copyButton());
    const first = await screen.findByRole("textbox", { name: "Tweet 1 of 2" });
    expect((first as HTMLTextAreaElement).value).toBe("First");
    fireEvent.change(first, { target: { value: "Edited first tweet" } });
    await user.click(screen.getByRole("button", { name: "Copy tweet 1" }));
    expect(await navigator.clipboard.readText()).toBe("Edited first tweet");
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
    visitStep("Finish");
    expect((screen.getByRole("button", { name: "Schedule" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Publish now" }) as HTMLButtonElement).disabled).toBe(true);
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ id: "thread", workspaceId: "studio", platforms: [] }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(context.replace).toHaveBeenCalled());
    expect(vi.mocked(apiClient.post).mock.calls[1][1]).toMatchObject({ format: "thread", tweets: [{ text: "Edited first tweet" }, { text: "Second" }], platforms: [expect.objectContaining({ platform: "x", caption: "" })] });
  });

  it("ignores late generation after leaving a workspace", async () => {
    let resolve!: (value: AxiosResponse) => void;
    vi.mocked(apiClient.post).mockImplementation(() => new Promise((done) => { resolve = done; }));
    const user = userEvent.setup();
    const old = renderStudio();
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Old workspace business update" } });
    await user.click(copyButton());
    old.unmount();
    renderStudio("generate", "different-workspace");
    await act(async () => resolve(response(generated)));
    expect(screen.queryByRole("textbox", { name: "LinkedIn caption" })).toBeNull();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("navigates the single-page workspace explicitly and focuses the requested heading", async () => {
    const user = userEvent.setup();
    renderStudio();
    for (const [step, heading] of [["Text", "Review your text"], ["Visuals", "Choose your visuals"], ["Finish", "Finish your post"], ["Brief", "Your creative brief"]] as const) {
      visitStep(step);
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: heading }));
    }
    expect(apiClient.post).not.toHaveBeenCalled();
    const caption = await createCopy(user);
    fireEvent.change(caption, { target: { value: "Keep my edits while navigating" } });
    visitStep("Brief");
    visitStep("Finish");
    visitStep("Text");
    expect((screen.getByLabelText("LinkedIn caption") as HTMLTextAreaElement).value).toBe("Keep my edits while navigating");
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("jumps between brief, content and preview on mobile without losing edited copy", async () => {
    const user = userEvent.setup();
    renderStudio();
    const caption = await createCopy(user);
    fireEvent.change(caption, { target: { value: "Preserved mobile copy" } });
    expect(screen.getByRole("button", { name: "Preview" }).getAttribute("aria-expanded")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByRole("button", { name: "Hide preview" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("Platform preview").textContent).toContain("Preserved mobile copy");
    await user.click(screen.getByRole("button", { name: "Hide preview" }));
    visitStep("Brief");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Your creative brief" }));
    visitStep("Text");
    expect((screen.getByRole("textbox", { name: "LinkedIn caption" }) as HTMLTextAreaElement).value).toBe("Preserved mobile copy");
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("keeps publishing actions in Finish and requires confirmation without side effects on opening", async () => {
    const user = userEvent.setup();
    renderStudio();
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    expect(screen.queryByRole("button", { name: "Publish now" })).toBeNull();
    visitStep("Finish");
    expect((screen.getByRole("button", { name: "Schedule" }) as HTMLButtonElement).disabled).toBe(false);
    await user.click(screen.getByRole("button", { name: "Publish now" }));
    expect(screen.getByRole("dialog", { name: "Publish this post now?" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit for team review" })).toBeNull();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("returns to section navigation when opening Brand from a deeply scrolled brief", async () => {
    const user = userEvent.setup();
    renderStudio();
    const navigation = screen.getByRole("tablist", { name: "Studio sections" });
    vi.spyOn(navigation, "getBoundingClientRect").mockReturnValue({ ...navigation.getBoundingClientRect(), top: -300 });
    await user.click(screen.getByRole("button", { name: "Brand" }));
    await screen.findByRole("textbox", { name: "Business name" });
    expect(navigation.scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
    expect(screen.getByRole("tab", { name: "Brand Profile" }).getAttribute("aria-selected")).toBe("true");
  });

  it("provides a clear empty workspace and visible keyboard-accessible preferences", async () => {
    const user = userEvent.setup();
    renderStudio();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Your creative brief" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Your next great post starts here" })).toBeNull();
    expect(screen.getByRole("button", { name: /Writing options/ }).getAttribute("aria-expanded")).toBe("false");
    writingOptions();
    const friendly = screen.getByRole("radio", { name: "Friendly" });
    friendly.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Luxury" }).getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Luxury" }));
  });

  it("generates all selected channels in one API call and lets users edit copy", async () => {
    const user = userEvent.setup();
    renderStudio();
    const caption = await createCopy(user);
    expect((caption as HTMLTextAreaElement).value).toBe(generated.platforms.linkedin!.caption);
    fireEvent.change(caption, { target: { value: "Our edited update" } });
    expect((caption as HTMLTextAreaElement).value).toBe("Our edited update");
    const calls = vi.mocked(apiClient.post).mock.calls.filter(([url]) => String(url).endsWith("/generate"));
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({ platforms: ["linkedin", "facebook"], tone: "Professional", includeEmojis: false, slideCount: 3 });
    expect(calls[0][2]).toEqual({ timeout: 120_000 });
    await user.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByLabelText("Platform preview").textContent).toBe("Our edited update");
  });

  it("uses server defaults for copy and image generation without loading a model catalog", async () => {
    const user = userEvent.setup();
    renderStudio();
    expect(screen.queryByRole("combobox", { name: /model/i })).toBeNull();
    await user.click(imageChoice());
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Share our latest business update" } });
    await user.click(copyButton());
    await screen.findByRole("textbox", { name: "LinkedIn caption" });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    await user.click(visualButton());
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    expect(apiClient.post).toHaveBeenNthCalledWith(1,
      "/api/v1/workspaces/studio/social/generate",
      expect.objectContaining({ platforms: ["linkedin", "facebook"] }),
      { timeout: 120_000 },
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(2,
      "/api/v1/workspaces/studio/social/generate-creative-set",
      expect.objectContaining({ requestId: expect.any(String), mode: "create", format: "post", platforms: ["linkedin", "facebook"], caption: expect.stringContaining(generated.platforms.linkedin!.caption), textOverlay: true }),
      { timeout: 600_000 },
    );
    expect((await screen.findByRole("link", { name: "Download" })).getAttribute("href")).toBe(generatedImage.imageUrl);
    expect(vi.mocked(apiClient.get).mock.calls.some(([url]) => String(url).endsWith("/ai-models"))).toBe(false);
  });

  it("does not allow image-only generation to bypass copy approval", async () => {
    const user = userEvent.setup();
    renderStudio();
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Share our latest business update" } });
    await user.click(imageChoice());
    const visualButton = screen.getByRole("button", { name: "Generate approved visuals" });
    expect((visualButton as HTMLButtonElement).disabled).toBe(true);
    await user.click(visualButton);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("requires approval for text-only publishing and invalidates it on non-preview channel edits", async () => {
    const user = userEvent.setup();
    renderStudio();
    await createCopy(user);
    const publish = screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    expect(publish.disabled).toBe(false);
    await user.click(screen.getByRole("button", { name: "Facebook" }));
    expect(screen.getByRole("button", { name: "Copy approved" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Facebook caption"), { target: { value: "Edited community copy" } });
    expect(publish.disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    expect(publish.disabled).toBe(false);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it.each(["Hashtags", "Emojis", "Add an image"])("invalidates approval when %s options change", async (name) => {
    const user = userEvent.setup();
    renderStudio();
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    if (name === "Add an image") visitStep("Visuals"); else writingOptions();
    await user.click(screen.getByRole("switch", { name }));
    visitStep("Text");
    expect(screen.queryByRole("button", { name: "Copy approved" })).toBeNull();
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends all approved channel copy and art direction, without paid calls during approval", async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.click(imageChoice());
    fireEvent.change(screen.getByLabelText("Visual art direction (optional)"), { target: { value: "Watercolor desk lamp, warm light; avoid people" } });
    await createCopy(user);
    expect((visualButton() as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(visualButton());
    await screen.findByRole("link", { name: "Download" });
    const request = vi.mocked(apiClient.post).mock.calls[1][1] as GenerateCreativeSetPayload;
    expect(request.caption).toContain(generated.platforms.linkedin!.caption);
    expect(request.caption).toContain(generated.platforms.facebook!.caption);
    expect(request.style).toBe("Watercolor desk lamp, warm light; avoid people");
    expect(request.brief).toContain(request.style);
    fireEvent.change(screen.getByLabelText("Visual art direction (optional)"), { target: { value: "Minimal illustration" } });
    expect((screen.getByRole("button", { name: "Regenerate visuals" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Copy approved" })).toBeNull();
  });

  it("can remove artwork and approve text-only content without a visual dead end", async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.click(imageChoice());
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    await user.click(visualButton());
    await screen.findByRole("link", { name: "Download" });
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("switch", { name: "Add an image" }).getAttribute("aria-checked")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(false);
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it("invalidates approval after version selection, even when switching back", async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.click(screen.getAllByRole("button", { name: "Facebook" })[0]);
    writingOptions();
    await user.selectOptions(screen.getByLabelText("Versions"), "2");
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    await user.click(screen.getByRole("button", { name: "B" }));
    expect(screen.queryByRole("button", { name: "Copy approved" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "A" }));
    expect(screen.queryByRole("button", { name: "Copy approved" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    visitStep("Brief");
    await user.click(screen.getAllByRole("button", { name: "Facebook" })[0]);
    visitStep("Text");
    expect(screen.queryByRole("button", { name: "Copy approved" })).toBeNull();
    expect((screen.getByRole("button", { name: "Approve copy" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps approved copy after visual failure and can explicitly switch to text only", async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.click(imageChoice());
    const caption = await createCopy(user);
    fireEvent.change(caption, { target: { value: "Keep this exact approved copy" } });
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("Artwork unavailable"));
    await user.click(visualButton());
    await screen.findByText("Artwork unavailable");
    expect((screen.getByLabelText("LinkedIn caption") as HTMLTextAreaElement).value).toBe("Keep this exact approved copy");
    expect(screen.getByRole("button", { name: "Copy approved" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Text only" }));
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("locks mutations during a visual request and ignores its result after unmount", async () => {
    const user = userEvent.setup();
    const original = renderStudio();
    await user.click(imageChoice());
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    let resolve!: (value: AxiosResponse) => void;
    vi.mocked(apiClient.post).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    await user.click(visualButton());
    expect((screen.getByLabelText("LinkedIn caption") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Facebook" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Copy approved" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Text only" }) as HTMLButtonElement).disabled).toBe(true);
    original.unmount();
    renderStudio("generate", "different-workspace");
    await act(async () => resolve(response(creativeSet)));
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it("restores an exact saved approval but rejects it when resumed copy was changed", async () => {
    const user = userEvent.setup();
    const first = renderStudio();
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ id: "saved", platforms: [] }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(context.replace).toHaveBeenCalled());
    const saved = vi.mocked(apiClient.post).mock.calls[1][1] as SocialPost;
    expect(saved.generationOptions?.copyApproval?.fingerprint).toEqual(expect.any(String));
    first.unmount();
    context.params = new URLSearchParams({ draftId: "saved" });
    vi.spyOn(socialMediaApi, "getPost").mockResolvedValue({ ...saved, id: "saved" });
    const resumed = renderStudio();
    await screen.findByRole("textbox", { name: "LinkedIn caption" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy approved" })).toBeTruthy());
    resumed.unmount();
    vi.mocked(socialMediaApi.getPost).mockResolvedValue({ ...saved, id: "saved", platforms: saved.platforms.map((platform) => ({ ...platform, caption: "Changed outside Studio" })) });
    renderStudio();
    await screen.findByRole("textbox", { name: "LinkedIn caption" });
    expect(screen.queryByRole("button", { name: "Copy approved" })).toBeNull();
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not start overlapping caption or image generation", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockReturnValue(new Promise(() => {}));
    renderStudio();
    await user.type(screen.getByLabelText("What do you want to post?"), "A short business update");
    await user.click(copyButton());
    visitStep("Text");
    expect(screen.getByRole("status", { name: "Generating content" })).toBeTruthy();
    await user.click(imageChoice());
    expect((visualButton() as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "More post actions" }) as HTMLButtonElement).disabled).toBe(true);
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("saves edited multi-channel copy through the existing draft flow", async () => {
    const user = userEvent.setup();
    renderStudio();
    const caption = await createCopy(user);
    await user.clear(caption);
    await user.type(caption, "Ready for review");
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ id: "saved-post", workspaceId: "studio", platforms: [] }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(context.replace).toHaveBeenCalledWith("/dashboard/content-studio/generate?draftId=saved-post"));
    expect(apiClient.post).toHaveBeenLastCalledWith(expect.stringContaining("/posts"), expect.objectContaining({ status: "draft", platforms: expect.arrayContaining([expect.objectContaining({ platform: "linkedin", caption: "Ready for review" }), expect.objectContaining({ platform: "facebook" })]) }));
  });

  it("confirms regeneration and retains edited content if the API fails", async () => {
    const user = userEvent.setup();
    renderStudio();
    const caption = await createCopy(user);
    await user.clear(caption);
    await user.type(caption, "Keep this edited caption");
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("Generation unavailable"));
    await user.click(copyButton());
    expect(screen.getByRole("dialog", { name: "Replace your current copy?" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Generate again" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    visitStep("Text");
    expect((screen.getByRole("textbox", { name: "LinkedIn caption" }) as HTMLTextAreaElement).value).toBe("Keep this edited caption");
  });

  it("preserves composer state and reuses brand/logo reads across visited tabs", async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.type(screen.getByLabelText("What do you want to post?"), "Keep this brief");
    await user.click(screen.getByRole("tab", { name: /Brand Profile/ }));
    await screen.findByLabelText("Business name");
    await user.click(screen.getByRole("tab", { name: "Create" }));
    expect((screen.getByLabelText("What do you want to post?") as HTMLTextAreaElement).value).toBe("Keep this brief");
    expect(vi.mocked(apiClient.get).mock.calls.filter(([url]) => String(url).endsWith("/brand-voice"))).toHaveLength(1);
    expect(vi.mocked(apiClient.get).mock.calls.filter(([url]) => String(url).endsWith("/brand-logos"))).toHaveLength(1);
  });

  it("keeps the workspace brief intact when cancelling a reset", async () => {
    const user = userEvent.setup();
    renderStudio();
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "More post actions" }));
    await user.click(screen.getByRole("menuitem", { name: "New post" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("textbox", { name: "LinkedIn caption" })).toBeTruthy();
  });

  it("prefills an idea without requesting generation automatically", () => {
    context.params = new URLSearchParams({ topic: "Tell a customer story" });
    renderStudio();
    expect((screen.getByLabelText("What do you want to post?") as HTMLTextAreaElement).value).toBe("Tell a customer story");
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("validates brand colors before saving", async () => {
    const user = userEvent.setup();
    renderStudio("brand");
    const primary = await screen.findByRole("textbox", { name: "Primary" });
    await user.type(primary, "oops");
    expect(primary.getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByRole("button", { name: "Save brand profile" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Enter a six-digit hex color.")).toBeTruthy();
  });

  it("paginates media using the existing endpoint and resets pagination on search", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue(response({ ...mediaPage, total: 30, totalPages: 2, stats: { images: 30, videos: 0, totalBytes: 2048 } }));
    renderStudio("media");
    await user.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith(expect.stringContaining("/media-assets"), expect.objectContaining({ params: expect.objectContaining({ page: 2, pageSize: 24 }) })));
    fireEvent.change(screen.getByRole("textbox", { name: "Search assets" }), { target: { value: "launch" } });
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith(expect.stringContaining("/media-assets"), expect.objectContaining({ params: expect.objectContaining({ page: 1, search: "launch" }) })));
    expect(screen.getByText("2.0 KB")).toBeTruthy();
    expect(screen.queryByText(/5 GB/)).toBeNull();
  });

  it("shows actionable media load failures", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("Library unavailable"));
    renderStudio("media");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("ignores old media results while a new search is debouncing", async () => {
    let resolveOld!: (value: AxiosResponse) => void;
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValue(response(mediaPage));
    renderStudio("media");
    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    fireEvent.change(screen.getByRole("textbox", { name: "Search assets" }), { target: { value: "new search" } });
    await act(async () => resolveOld(response({ ...mediaPage, items: [{ id: "old", prompt: "Obsolete result", mediaType: "image", fileSizeBytes: 10, url: "https://example.test/old.png" }], total: 1 })));
    expect(screen.queryByText("Obsolete result")).toBeNull();
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No assets found")).toBeTruthy();
  });

  it("passes automated accessibility checks in the empty composer", async () => {
    const { container } = renderStudio();
    await waitFor(() => expect(screen.getByText("Written in the Acme voice")).toBeTruthy());
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it.each(["brand", "media"] as const)("passes automated accessibility checks in the %s workspace", async (tab) => {
    const { container } = renderStudio(tab);
    if (tab === "brand") await screen.findByLabelText("Business name");
    else await screen.findByText("No assets found");
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});

describe("guided Studio safety", () => {
  it.each(["brand-voice", "brand-logos", "settings"])("locks resumed edits until delayed %s hydration establishes a clean baseline", async (endpoint) => {
    const user = userEvent.setup();
    context.params = new URLSearchParams({ draftId: "saved" });
    vi.spyOn(socialMediaApi, "getPost").mockResolvedValue({ id: "saved", platforms: [{ platform: "linkedin", caption: "Saved copy", hashtags: [] }] } as unknown as SocialPost);
    const get = vi.mocked(apiClient.get).getMockImplementation()!;
    let resolve!: (value: AxiosResponse) => void;
    vi.mocked(apiClient.get).mockImplementation((...args) => String(args[0]).endsWith(`/${endpoint}`) ? new Promise((done) => { resolve = done; }) : get(...args));
    renderStudio();
    const caption = await screen.findByLabelText("LinkedIn caption");
    expect(screen.getByText("Loading draft…")).toBeTruthy();
    expect(caption.matches(":disabled")).toBe(true);
    expect((screen.getByRole("button", { name: "Save draft" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(caption, "Must not be accepted");
    expect((caption as HTMLTextAreaElement).value).toBe("Saved copy");
    visitStep("Brief");
    expect(screen.getByLabelText("What do you want to post?").matches(":disabled")).toBe(true);
    await act(async () => { resolve(response(endpoint === "brand-voice" ? brand : endpoint === "brand-logos" ? { items: [] } : { autoFirstComment: true })); });
    await screen.findByText("Saved draft");
    visitStep("Text");
    expect(caption.matches(":disabled")).toBe(false);
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(caption, { target: { value: "Edited after hydration" } });
    expect(screen.getByText("Unsaved content")).toBeTruthy();
    const edited = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(edited);
    expect(edited.defaultPrevented).toBe(true);
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it.each(["resumed", "newly saved"])("keeps leave guards when all text in a %s draft is cleared and clears them when restored", async (mode) => {
    const user = userEvent.setup();
    if (mode === "resumed") {
      context.params = new URLSearchParams({ draftId: "saved" });
      vi.spyOn(socialMediaApi, "getPost").mockResolvedValue({ id: "saved", platforms: [{ platform: "linkedin", caption: "Saved copy", hashtags: [] }] } as unknown as SocialPost);
    }
    renderStudio();
    if (mode === "newly saved") {
      await user.click(screen.getByRole("button", { name: "Facebook" }));
      await user.click(screen.getByRole("button", { name: "Write myself" }));
      fireEvent.change(screen.getByLabelText("LinkedIn caption"), { target: { value: "Saved copy" } });
      vi.mocked(apiClient.post).mockResolvedValueOnce(response({ id: "saved", platforms: [] }));
      await user.click(screen.getByRole("button", { name: "Save draft" }));
    }
    await screen.findByText("Saved draft");
    const caption = screen.getByLabelText("LinkedIn caption");
    fireEvent.change(caption, { target: { value: "" } });
    expect(screen.getByText("Unsaved content")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save draft" }) as HTMLButtonElement).disabled).toBe(true);
    const cleared = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleared);
    expect(cleared.defaultPrevented).toBe(true);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const link = document.createElement("a");
    link.href = "/dashboard/posts";
    document.body.append(link);
    expect(fireEvent.click(link)).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    link.remove();
    fireEvent.change(caption, { target: { value: "Saved copy" } });
    expect(screen.getByText("Saved draft")).toBeTruthy();
    const restored = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(restored);
    expect(restored.defaultPrevented).toBe(false);
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(apiClient.post).toHaveBeenCalledTimes(mode === "resumed" ? 0 : 1);
  });

  it("creates manual channel copy, approves and revisits every stage without any AI calls", async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.click(screen.getByRole("button", { name: "Write myself" }));
    fireEvent.change(screen.getByLabelText("LinkedIn caption"), { target: { value: "Written by me" } });
    expect((screen.getByRole("button", { name: "Approve text and continue" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Facebook" }));
    fireEvent.change(screen.getByLabelText("Facebook caption"), { target: { value: "Written for my community" } });
    await user.click(screen.getByRole("button", { name: "Approve text and continue" }));
    expect(screen.getByRole("heading", { name: "Choose your visuals" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy approved" })).toBeTruthy();
    for (const step of ["Brief", "Finish", "Text", "Visuals"] as const) visitStep(step);
    expect(screen.getByRole("button", { name: "Copy approved" })).toBeTruthy();
    expect(apiClient.post).not.toHaveBeenCalled();
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ id: "manual-draft", platforms: [] }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(savedPayload().platforms.map((platform) => platform.caption)).toEqual(["Written by me", "Written for my community"]));
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Saved draft")).toBeTruthy();
  });

  it("never infers image intent from promotional copy or words requesting a photo", async () => {
    const user = userEvent.setup();
    renderStudio();
    await user.click(screen.getByRole("button", { name: "Promotional" }));
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "A photo poster announcing our new product" } });
    visitStep("Visuals");
    expect(screen.getByRole("switch", { name: "Add an image" }).getAttribute("aria-checked")).toBe("false");
    expect(apiClient.post).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Generate approved visuals" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("requires inline reapproval of changed visuals without generating on approval or navigation", async () => {
    const user = userEvent.setup();
    renderStudio();
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve text and continue" }));
    const approvedCalls = vi.mocked(apiClient.post).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Generate image" }));
    fireEvent.change(screen.getByLabelText("Visual art direction (optional)"), { target: { value: "Minimal illustration" } });
    expect(screen.getByText(/Changing visual setup resets approval/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Generate approved visuals" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Approve copy" }));
    expect(apiClient.post).toHaveBeenCalledTimes(approvedCalls);
    visitStep("Finish");
    visitStep("Visuals");
    expect(screen.getByRole("button", { name: "Copy approved" })).toBeTruthy();
    expect(apiClient.post).toHaveBeenCalledTimes(approvedCalls);
    await user.click(screen.getByRole("button", { name: "Generate approved visuals" }));
    await screen.findByRole("link", { name: "Download" });
    expect(apiClient.post).toHaveBeenCalledTimes(approvedCalls + 1);
  });

  it("keeps failed-save edits and guards leaving content, clearing the guard only after an explicit save", async () => {
    const user = userEvent.setup();
    renderStudio();
    const caption = await createCopy(user);
    fireEvent.change(caption, { target: { value: "Do not lose this edit" } });
    const leaving = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error("Offline save"));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Save failed · your edits are still here")).toBeTruthy();
    expect((screen.getByLabelText("LinkedIn caption") as HTMLTextAreaElement).value).toBe("Do not lose this edit");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const link = document.createElement("a");
    link.href = "/dashboard/posts";
    document.body.append(link);
    expect(fireEvent.click(link)).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    link.remove();
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ id: "saved", platforms: [] }));
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Saved draft");
    const afterSave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterSave);
    expect(afterSave.defaultPrevented).toBe(false);
  });

  it("does not persist a brief-only draft or call AI when selecting a manual path", async () => {
    const user = userEvent.setup();
    renderStudio();
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Only an idea" } });
    expect((screen.getByRole("button", { name: "Save draft" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Write myself" }));
    expect((screen.getByRole("button", { name: "Save draft" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("Unsaved content")).toBeNull();
    const untouched = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(untouched);
    expect(untouched.defaultPrevented).toBe(false);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("keeps viewers read-only and editors in a draft/team-review handoff", async () => {
    const user = userEvent.setup();
    const viewer = renderStudio("generate", "studio", "viewer");
    expect(screen.getByText(/Read-only workspace/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Write myself" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Create copy" }) as HTMLButtonElement).closest("fieldset")?.disabled).toBe(true);
    viewer.unmount();
    vi.spyOn(socialMediaApi, "getSettings").mockResolvedValue({ autoFirstComment: false, approvalRequired: true, usage: { approvalWorkflow: true } } as Awaited<ReturnType<typeof socialMediaApi.getSettings>>);
    renderStudio("generate", "studio", "editor");
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve text and continue" }));
    visitStep("Finish");
    expect((screen.getByRole("button", { name: "Publish now" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Schedule" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Submit for team review" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/Text approval is not team approval/)).toBeTruthy();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("calls publishing only after explicit final confirmation", async () => {
    const user = userEvent.setup();
    const publish = vi.spyOn(socialMediaApi, "publishNow").mockResolvedValue({ id: "saved", platforms: [] } as unknown as SocialPost);
    renderStudio();
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "Approve text and continue" }));
    visitStep("Finish");
    await user.click(screen.getByRole("button", { name: "Publish now" }));
    expect(publish).not.toHaveBeenCalled();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ id: "saved", platforms: [] }));
    await user.click(screen.getByRole("button", { name: "Confirm publish now" }));
    await waitFor(() => expect(publish).toHaveBeenCalledExactlyOnceWith("studio", "saved"));
    expect(apiClient.post).toHaveBeenCalledTimes(2);
  });

  it("preserves unavailable saved account bindings and blocks finishing without blocking drafts", async () => {
    const user = userEvent.setup();
    context.params = new URLSearchParams({ draftId: "saved" });
    vi.spyOn(socialMediaApi, "getPost").mockResolvedValue({ id: "saved", platforms: [{ platform: "linkedin", socialAccountId: "old-account", caption: "Saved destination", hashtags: [] }] } as unknown as SocialPost);
    renderStudio();
    await screen.findByLabelText("LinkedIn caption");
    await user.click(screen.getByRole("button", { name: "Approve text and continue" }));
    visitStep("Finish");
    expect(screen.getByText(/Connect or select an active account/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Publish now" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalled());
    expect(vi.mocked(apiClient.patch).mock.calls.at(-1)![1]).toMatchObject({ platforms: [{ socialAccountId: "old-account" }] });
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});

describe("studio API request reuse", () => {
  it("shares in-flight and fresh requests within the same workspace", async () => {
    await Promise.all([socialMediaApi.getBrandVoice("one"), socialMediaApi.getBrandVoice("one")]);
    await socialMediaApi.getBrandVoice("one");
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    await socialMediaApi.getBrandVoice("two");
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures or reuse data between authenticated sessions", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("Offline"));
    await expect(socialMediaApi.getBrandVoice("one")).rejects.toThrow("Offline");
    await socialMediaApi.getBrandVoice("one");
    context.token = "a-different-session";
    await socialMediaApi.getBrandVoice("one");
    expect(apiClient.get).toHaveBeenCalledTimes(3);
  });

  it("revalidates expired reads", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    await socialMediaApi.getBrandVoice("one");
    now.mockReturnValue(32_000);
    await socialMediaApi.getBrandVoice("one");
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it("ignores late mutation results from a previous authenticated session", async () => {
    await socialMediaApi.getBrandVoice("one");
    let resolveSave!: (value: AxiosResponse) => void;
    vi.mocked(apiClient.put).mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    const pending = socialMediaApi.saveBrandVoice("one", brand);
    context.token = "next-session";
    const nextBrand = { ...brand, brandName: "Next session brand" };
    vi.mocked(apiClient.get).mockResolvedValueOnce(response(nextBrand));
    await socialMediaApi.getBrandVoice("one");
    resolveSave(response(brand));
    await pending;
    expect((await socialMediaApi.getBrandVoice("one")).brandName).toBe("Next session brand");
  });

  it("uses successful brand saves without another GET and preserves the logo cache", async () => {
    await socialMediaApi.getBrandVoice("one");
    await socialMediaApi.listBrandLogos("one");
    await socialMediaApi.saveBrandVoice("one", { ...brand, brandName: "Updated brand", logoUrl: undefined });
    await socialMediaApi.getBrandVoice("one");
    await socialMediaApi.listBrandLogos("one");
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    vi.mocked(apiClient.delete).mockResolvedValueOnce(response({ items: [] }));
    await socialMediaApi.deleteBrandLogo("one", "logo");
    await socialMediaApi.listBrandLogos("one");
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it("does not let an older brand response overwrite a successful save", async () => {
    let resolve!: (value: AxiosResponse) => void;
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const old = socialMediaApi.getBrandVoice("one");
    await act(async () => {});
    const saved = { ...brand, brandName: "Updated" };
    vi.mocked(apiClient.put).mockResolvedValueOnce(response(saved));
    await socialMediaApi.saveBrandVoice("one", saved);
    resolve(response(brand));
    await old;
    expect((await socialMediaApi.getBrandVoice("one")).brandName).toBe("Updated");
  });

  it("invalidates logo reads after uploads and seeds logo mutation results", async () => {
    await socialMediaApi.listBrandLogos("one");
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ logoUrl: "https://example.test/logo.png", id: "logo" }));
    await socialMediaApi.uploadLogo("one", new File(["logo"], "logo.png", { type: "image/png" }));
    await socialMediaApi.listBrandLogos("one");
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    vi.mocked(apiClient.post).mockResolvedValueOnce(response({ items: [] }));
    await socialMediaApi.setDefaultBrandLogo("one", "logo");
    await socialMediaApi.listBrandLogos("one");
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });
});