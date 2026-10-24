import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import type { AxiosResponse } from "axios";
import { axe } from "vitest-axe";
import apiClient from "@/api/client";
import socialMediaApi from "@/api/endpoints/social-media.api";
import type { BrandVoice, GeneratedContent, GenerateImageResult, GenerateCreativeSetPayload, SocialPost, StoredSlide } from "@/types/social-media.types";
import AIStudioPage from "./AIStudioPage";

const context = vi.hoisted(() => ({ token: "studio-0", params: new URLSearchParams(), push: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getStoredAccessToken: () => context.token }));
vi.mock("@/api/client", () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: context.push, replace: context.replace }), useSearchParams: () => context.params }));
vi.mock("next/dynamic", () => ({ default: () => () => <div>Planner workspace</div> }));
vi.mock("@/components/social-media/content-studio/PhoneFrame", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/social-media/content-studio/PlatformPreview", () => ({ default: ({ caption, media }: { caption: string; media?: { url: string }[] }) => <div aria-label="Platform preview">{caption}{media?.map((asset) => <img key={asset.url} src={asset.url} alt="Platform artwork" />)}</div> }));
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
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderStudio(initialTab: "generate" | "brand" | "media" = "generate", workspaceId = "studio") {
  const store = configureStore({ reducer: {
    auth: () => ({ user: { id: "user", name: "Alex", workspaceId, plan: "growth" } }),
    socialAccounts: () => ({ accounts: [{ id: "account", platform: "linkedin", isActive: true, isDefault: true, accountName: "Acme" }] }),
    socialPosts: () => ({ publishing: false }),
  } });
  return render(<><style>{".hidden { display: none; }"}</style><Provider store={store}><AIStudioPage initialTab={initialTab} /></Provider></>);
}

async function createCopy(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Share our latest business update" } });
  await user.click(screen.getByRole("button", { name: "Create post" }));
  return screen.findByRole("textbox", { name: "LinkedIn caption" });
}

describe("AIStudioPage", () => {
  const carouselSlides: StoredSlide[] = ["a", "b", "c"].map((id) => ({ id, headline: `Headline ${id}`, body: `Body ${id}`, imagePrompt: `Artwork ${id}` }));
  const carouselResponse: GeneratedContent = { format: "carousel", platforms: {}, prompt: "Useful carousel", caption: "## Intro\n**Useful** content 🚀", slides: carouselSlides, hashtags: ["Useful"] };
  const exportsFor = (request: GenerateCreativeSetPayload) => (request.slides ?? [{ id: "single" }]).flatMap((slide) => request.platforms.map((platform) => ({ ...creativeSet.items[0], platform, slideId: slide.id, imageUrl: `https://example.test/${platform}/${slide.id}.jpg`, assetId: `${platform}-${slide.id}`, blobKey: `social/studio/${platform}/${slide.id}.jpg` })));

  it.each([2, 3, 8])("sends the accessible %i-slide selection and Professional emoji-off defaults", async (count) => {
    const user = userEvent.setup();
    renderStudio();
    expect(screen.getByRole("radio", { name: "Professional" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: "Emojis" }).getAttribute("aria-checked")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Carousel" }));
    expect((screen.getByLabelText("Slide count") as HTMLSelectElement).value).toBe("3");
    expect(Array.from((screen.getByLabelText("Slide count") as HTMLSelectElement).options).map((option) => option.value)).toEqual(["2", "3", "4", "5", "6", "7", "8"]);
    fireEvent.change(screen.getByLabelText("Slide count"), { target: { value: String(count) } });
    await user.click(screen.getByRole("switch", { name: "Add slide images" }));
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Useful carousel for our customers" } });
    vi.mocked(apiClient.post).mockResolvedValueOnce(response(carouselResponse));
    await user.click(screen.getByRole("button", { name: "Create post" }));
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
    await user.click(screen.getByRole("button", { name: "Create post + image" }));
    await screen.findByRole("img", { name: "LinkedIn slide 1 artwork" });
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(false);
    const firstRequest = vi.mocked(apiClient.post).mock.calls.find(([url]) => String(url).endsWith("/generate-creative-set"))![1] as GenerateCreativeSetPayload;
    expect(firstRequest.slides).toEqual(carouselSlides);
    fireEvent.change(screen.getByLabelText("Slide 2 body"), { target: { value: "Edited slide body" } });
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Regenerate visuals" }));
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
    expect(saved.generationOptions).toMatchObject({ tone: "Professional", includeEmojis: false, slideCount: 3, visualsStale: false });
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
    await user.click(screen.getByRole("button", { name: "Create post + image" }));
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
    await user.click(screen.getByRole("button", { name: "Create post + image" }));
    await screen.findByRole("img", { name: "LinkedIn slide 1 artwork" });
    fireEvent.change(screen.getByLabelText("Slide 1 body"), { target: { value: "Changed artwork copy" } });
    await user.click(screen.getByRole("button", { name: "Regenerate visuals" }));
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

  it.each(["partial", "processing", "completed-missing-facebook"])("blocks every publishing entry point for a %s single-image set until a complete retry", async (status) => {
    const user = userEvent.setup();
    let attempts = 0;
    vi.mocked(apiClient.post).mockImplementation(async (url) => {
      if (!String(url).endsWith("/generate-creative-set")) return response(generated);
      attempts += 1;
      return response({ ...creativeSet, status: attempts > 1 || status === "completed-missing-facebook" ? "completed" : status, items: attempts === 1 && status === "completed-missing-facebook" ? creativeSet.items.slice(0, 1) : creativeSet.items });
    });
    renderStudio();
    await user.click(screen.getByRole("switch", { name: "Add an image" }));
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Share our latest business update" } });
    await user.click(screen.getByRole("button", { name: "Create post + image" }));
    await screen.findByRole("button", { name: "Retry visuals" });
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "More post actions" }));
    expect(screen.getByRole("menuitem", { name: "Schedule" }).getAttribute("data-disabled")).not.toBeNull();
    expect(screen.getByRole("menuitem", { name: "Publish now" }).getAttribute("data-disabled")).not.toBeNull();
    await user.keyboard("{Escape}");
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
    expect((screen.getByLabelText("Slide count") as HTMLSelectElement).value).toBe("8");
    expect(screen.getByRole("radio", { name: "Luxury" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: "Emojis" }).getAttribute("aria-checked")).toBe("true");
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
    await user.click(screen.getByRole("button", { name: "Create post" }));
    const first = await screen.findByRole("textbox", { name: "Tweet 1 of 2" });
    expect((first as HTMLTextAreaElement).value).toBe("First");
    fireEvent.change(first, { target: { value: "Edited first tweet" } });
    await user.click(screen.getByRole("button", { name: "Copy tweet 1" }));
    expect(await navigator.clipboard.readText()).toBe("Edited first tweet");
    expect((screen.getByText("Publish now", { selector: "button" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "More post actions" }));
    expect(screen.getByRole("menuitem", { name: "Schedule" }).getAttribute("data-disabled")).not.toBeNull();
    expect(screen.getByRole("menuitem", { name: "Publish now" }).getAttribute("data-disabled")).not.toBeNull();
    await user.keyboard("{Escape}");
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
    await user.click(screen.getByRole("button", { name: "Create post" }));
    old.unmount();
    renderStudio("generate", "different-workspace");
    await act(async () => resolve(response(generated)));
    expect(screen.queryByRole("textbox", { name: "LinkedIn caption" })).toBeNull();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("navigates the single-page workspace explicitly and focuses the requested heading", async () => {
    const user = userEvent.setup();
    renderStudio();
    const brief = screen.getByRole("heading", { name: "Your creative brief" });
    const content = screen.getByRole("heading", { name: "Your content workspace" });
    await user.click(screen.getByRole("button", { name: "Content" }));
    expect(document.activeElement).toBe(content);
    expect(content.scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
    await user.click(screen.getByRole("button", { name: "Brief" }));
    expect(document.activeElement).toBe(brief);
    expect(apiClient.post).not.toHaveBeenCalled();
    const caption = await createCopy(user);
    fireEvent.change(caption, { target: { value: "Keep my edits while navigating" } });
    await user.click(screen.getByRole("button", { name: "View content" }));
    expect(document.activeElement).toBe(content);
    expect((caption as HTMLTextAreaElement).value).toBe("Keep my edits while navigating");
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it("keeps publishing actions accessible without triggering them by opening the menu", async () => {
    const user = userEvent.setup();
    renderStudio();
    await createCopy(user);
    await user.click(screen.getByRole("button", { name: "More post actions" }));
    for (const name of ["Schedule", "Publish now", "Submit for approval", "New post"]) {
      expect(screen.getByRole("menuitem", { name }).getAttribute("data-disabled")).toBeNull();
    }
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "More post actions" }));
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
    expect(screen.getByRole("heading", { name: "Your next great post starts here" })).toBeTruthy();
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
    await user.click(screen.getByRole("tab", { name: "Live preview" }));
    expect(screen.getByLabelText("Platform preview").textContent).toBe("Our edited update");
  });

  it("uses server defaults for copy and image generation without loading a model catalog", async () => {
    const user = userEvent.setup();
    renderStudio();
    expect(screen.queryByRole("combobox", { name: /model/i })).toBeNull();
    await user.click(screen.getByRole("switch", { name: "Add an image" }));
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Share our latest business update" } });
    await user.click(screen.getByRole("button", { name: "Create post + image" }));
    await screen.findByRole("textbox", { name: "LinkedIn caption" });
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    expect(apiClient.post).toHaveBeenNthCalledWith(1,
      "/api/v1/workspaces/studio/social/generate",
      expect.objectContaining({ platforms: ["linkedin", "facebook"] }),
      { timeout: 120_000 },
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(2,
      "/api/v1/workspaces/studio/social/generate-creative-set",
      expect.objectContaining({ requestId: expect.any(String), mode: "create", format: "post", platforms: ["linkedin", "facebook"], caption: generated.platforms.linkedin!.caption, textOverlay: true }),
      { timeout: 600_000 },
    );
    expect((await screen.findByRole("link", { name: "Download" })).getAttribute("href")).toBe(generatedImage.imageUrl);
    expect(vi.mocked(apiClient.get).mock.calls.some(([url]) => String(url).endsWith("/ai-models"))).toBe(false);
  });

  it("uses server defaults for image-only generation", async () => {
    const user = userEvent.setup();
    renderStudio();
    fireEvent.change(screen.getByLabelText("What do you want to post?"), { target: { value: "Share our latest business update" } });
    await user.click(screen.getByRole("button", { name: "Create image only" }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(
      "/api/v1/workspaces/studio/social/generate-creative-set",
      expect.objectContaining({ format: "post" }),
      { timeout: 600_000 },
    ));
    expect((await screen.findByRole("link", { name: "Download" })).getAttribute("href")).toBe(generatedImage.imageUrl);
  });

  it("does not start overlapping caption or image generation", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockReturnValue(new Promise(() => {}));
    renderStudio();
    await user.type(screen.getByLabelText("What do you want to post?"), "A short business update");
    await user.click(screen.getByRole("button", { name: "Create post" }));
    expect(screen.getByRole("status", { name: "Generating content" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Create image only" }) as HTMLButtonElement).disabled).toBe(true);
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
    await user.click(screen.getByRole("button", { name: "Create post" }));
    expect(screen.getByRole("dialog", { name: "Replace your current copy?" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Generate again" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
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