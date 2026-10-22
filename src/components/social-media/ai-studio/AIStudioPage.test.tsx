import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import type { AxiosResponse } from "axios";
import { axe } from "vitest-axe";
import apiClient from "@/api/client";
import socialMediaApi from "@/api/endpoints/social-media.api";
import type { BrandVoice, GeneratedContent } from "@/types/social-media.types";
import AIStudioPage from "./AIStudioPage";

const context = vi.hoisted(() => ({ token: "studio-0", params: new URLSearchParams(), push: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getStoredAccessToken: () => context.token }));
vi.mock("@/api/client", () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: context.push, replace: context.replace }), useSearchParams: () => context.params }));
vi.mock("next/dynamic", () => ({ default: () => () => <div>Planner workspace</div> }));
vi.mock("@/components/social-media/content-studio/PhoneFrame", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/social-media/content-studio/PlatformPreview", () => ({ default: ({ caption }: { caption: string }) => <div aria-label="Platform preview">{caption}</div> }));
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
const mediaPage = { items: [], total: 0, page: 1, pageSize: 24, totalPages: 0, stats: { images: 0, videos: 0, totalBytes: 0 } };
const response = (data: unknown) => ({ data }) as AxiosResponse;
let session = 0;

beforeEach(() => {
  vi.clearAllMocks();
  context.token = `studio-${++session}`;
  context.params = new URLSearchParams();
  vi.mocked(apiClient.get).mockImplementation(async (url) => response(String(url).endsWith("/brand-voice") ? brand : String(url).endsWith("/brand-logos") ? { items: [] } : mediaPage));
  vi.mocked(apiClient.post).mockResolvedValue(response(generated));
  vi.mocked(apiClient.put).mockResolvedValue(response(brand));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderStudio(initialTab: "generate" | "brand" | "media" = "generate") {
  const store = configureStore({ reducer: {
    auth: () => ({ user: { id: "user", name: "Alex", workspaceId: "studio", plan: "growth" } }),
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
    expect(calls[0][1]).toMatchObject({ platforms: ["linkedin", "facebook"], tone: "Friendly" });
    await user.click(screen.getByRole("tab", { name: "Live preview" }));
    expect(screen.getByLabelText("Platform preview").textContent).toBe("Our edited update");
  });

  it("does not start overlapping caption or image generation", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockReturnValue(new Promise(() => {}));
    renderStudio();
    await user.type(screen.getByLabelText("What do you want to post?"), "A short business update");
    await user.click(screen.getByRole("button", { name: "Create post" }));
    expect(screen.getByRole("status", { name: "Generating content" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Create image only" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "New" }) as HTMLButtonElement).disabled).toBe(true);
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
    await user.click(screen.getByRole("button", { name: "New" }));
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