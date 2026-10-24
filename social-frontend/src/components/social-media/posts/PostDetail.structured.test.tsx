import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import socialMediaApi from "@/api/endpoints/social-media.api";
import type { SocialPost, SocialPostPlatform } from "@/types/social-media.types";
import PostDetail from "./PostDetail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/api/endpoints/social-media.api", () => ({ default: { getPost: vi.fn() } }));
vi.mock("./ScheduleModal", () => ({ default: () => null }));
vi.mock("./RetryButton", () => ({ default: () => <button>Retry failed post</button> }));

const slides = ["one", "two"].map((id) => ({ id, headline: `Headline ${id}`, body: `Body ${id}`, imagePrompt: "Editorial" }));
const platform: SocialPostPlatform = {
  id: "linkedin", platform: "linkedin", caption: "Intro only", hashtags: [], status: "pending",
  socialAccountId: null, firstComment: null, characterCount: 10, platformPostId: null,
  publishedAt: null, errorCode: null, errorMessage: null, retryCount: 0, nextRetryAt: null,
  reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, engagementRate: 0,
  media: slides.map((slide) => ({ slideId: slide.id, url: `https://example.test/linkedin/${slide.id}.jpg`, assetId: slide.id, blobKey: `social/studio/${slide.id}.jpg`, width: 1080, height: 1080 })),
};
const post = { id: "post", orgId: "studio", status: "draft", approvalStatus: "not_required", title: "Useful post", format: "carousel", slides, platforms: [platform] } as SocialPost;

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);
function mount(value: SocialPost) {
  vi.mocked(socialMediaApi.getPost).mockResolvedValue(value);
  const store = configureStore({ reducer: {
    auth: () => ({ user: { id: "user", workspaceId: "studio" } }),
    socialPosts: () => ({ currentPost: value, publishing: false, loading: false }),
  } });
  return render(<Provider store={store}><PostDetail postId="post" /></Provider>);
}

describe("structured post details", () => {
  it("shows every ordered platform export and keeps complete carousel publishing available", () => {
    mount(post);
    expect(screen.getAllByRole("img").map((image) => image.getAttribute("src"))).toEqual(platform.media!.map((media) => media.url));
    expect((screen.getByRole("button", { name: "Publish now" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText("Intro only")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toContain("draftId=post");
  });

  it.each(["missing", "stale"])("blocks publishing/scheduling with %s carousel visuals", (state) => {
    mount({ ...post, generationOptions: { visualsStale: state === "stale" }, platforms: state === "missing" ? [{ ...platform, media: platform.media!.slice(0, 1) }] : post.platforms });
    expect((screen.getByRole("button", { name: "Publish now" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Schedule" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toMatch(/visuals|slide images/);
  });

  it("keeps restored threads copy-only and copies individual tweets without flattening", async () => {
    const user = userEvent.setup();
    mount({ ...post, format: "thread", slides: [], tweets: [{ text: "First tweet" }, { text: "Second tweet" }], platforms: [{ ...platform, platform: "x", media: [] }] });
    expect((screen.getByRole("button", { name: "Publish now" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Schedule" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("copy-only");
    await user.click(screen.getByRole("button", { name: "Copy tweet 2" }));
    expect(await navigator.clipboard.readText()).toBe("Second tweet");
  });

  it("retains legacy single-image behavior", () => {
    mount({ ...post, format: undefined, slides: undefined, imageUrl: "https://example.test/legacy.jpg", platforms: [{ ...platform, media: undefined }] });
    expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.test/legacy.jpg");
    expect((screen.getByRole("button", { name: "Publish now" }) as HTMLButtonElement).disabled).toBe(false);
  });
});