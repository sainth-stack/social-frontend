import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { axe } from "vitest-axe";
import socialMediaApi from "@/api/endpoints/social-media.api";
import type { SocialPost, SocialPostListResponse, SocialPostPlatform } from "@/types/social-media.types";
import PostsPage from "./PostsPage";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/api/endpoints/social-media.api", () => ({ default: { listPosts: vi.fn(), duplicatePost: vi.fn(), archivePost: vi.fn(), deletePost: vi.fn(), retryPost: vi.fn(), publishNow: vi.fn() } }));

function post(id: string, status: SocialPost["status"] = "draft", platform: SocialPostPlatform["platform"] = "linkedin"): SocialPost {
  return { id, orgId: "workspace", createdBy: "user", title: `Post ${id}`, status, scheduledAt: null, publishedAt: status === "published" ? "2026-10-22T10:00:00Z" : null, approvalStatus: "not_required", approvedBy: null, templateId: null, aiPrompt: "A business update", imageUrl: null, imageSource: "none", platforms: [{ id: `platform-${id}`, platform, socialAccountId: "account", caption: `Copy for ${id}`, hashtags: [], firstComment: null, characterCount: 10, status: status === "published" ? "published" : "pending", platformPostId: null, publishedAt: null, errorCode: null, errorMessage: null, retryCount: 0, nextRetryAt: null, reach: 250, impressions: 500, likes: 20, comments: 4, shares: 2, clicks: 3, engagementRate: 0.05 }], createdAt: "2026-10-20T10:00:00Z", updatedAt: "2026-10-22T10:00:00Z" };
}
const fixtures = [post("one"), post("two", "published", "facebook"), post("three", "failed")];
const payload = (items = fixtures, total = items.length, page = 1, totalPages = 1): SocialPostListResponse => ({ items, total, page, pageSize: 20, totalPages });

function renderPosts(initialStatus: "all" | "draft" = "all") {
  const store = configureStore({ reducer: { auth: () => ({ user: { workspaceId: "workspace" } }) } });
  return render(<Provider store={store}><PostsPage initialStatus={initialStatus} /></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(socialMediaApi.listPosts).mockResolvedValue(payload());
  vi.mocked(socialMediaApi.duplicatePost).mockResolvedValue(post("copy"));
  vi.mocked(socialMediaApi.archivePost).mockResolvedValue(post("archived", "archived"));
  vi.mocked(socialMediaApi.deletePost).mockResolvedValue(undefined);
  vi.mocked(socialMediaApi.retryPost).mockResolvedValue({ post: post("retry"), retriedPlatforms: 1, skippedPlatforms: 0 });
  vi.mocked(socialMediaApi.publishNow).mockResolvedValue(post("publishing", "publishing"));
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

describe("PostsPage", () => {
  it("renders a single page heading and truthful page-scoped metrics", async () => {
    renderPosts();
    await screen.findByRole("button", { name: /Post one Copy for one/ });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Drafts on this page" })).toBeTruthy();
    expect(socialMediaApi.listPosts).toHaveBeenCalledWith("workspace", { status: undefined, search: undefined, page: 1, pageSize: 20 });
    expect(screen.getByText(/Showing 3 of 3 on this page/)).toBeTruthy();
  });

  it("shows a skeleton while loading and never treats errors as an empty list", async () => {
    vi.mocked(socialMediaApi.listPosts).mockRejectedValueOnce(new Error("Offline"));
    renderPosts();
    expect(screen.getByRole("status", { name: "Loading posts" })).toBeTruthy();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Your next post starts here")).toBeNull();
  });

  it("retries an initial failure", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.listPosts).mockRejectedValueOnce(new Error("Offline"));
    renderPosts();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Post one")).toBeTruthy();
  });

  it("uses server pagination instead of a capped 100-post result", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.listPosts).mockResolvedValue(payload(fixtures, 45, 1, 3));
    renderPosts();
    await user.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() => expect(socialMediaApi.listPosts).toHaveBeenLastCalledWith("workspace", expect.objectContaining({ page: 2, pageSize: 20 })));
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  });

  it("sends the selected status to the API and preserves the status route", async () => {
    const user = userEvent.setup();
    renderPosts();
    await screen.findByText("Post one");
    await user.click(screen.getByRole("tab", { name: "Scheduled" }));
    await waitFor(() => expect(socialMediaApi.listPosts).toHaveBeenLastCalledWith("workspace", expect.objectContaining({ status: "scheduled", page: 1 })));
    expect(navigation.replace).toHaveBeenCalledWith("/dashboard/posts/scheduled");
  });

  it("debounces search and resets page selection", async () => {
    renderPosts();
    await screen.findByText("Post one");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Post one" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search posts" }), { target: { value: "launch" } });
    expect(screen.queryByText("1 selected on this page")).toBeNull();
    await waitFor(() => expect(socialMediaApi.listPosts).toHaveBeenLastCalledWith("workspace", expect.objectContaining({ search: "launch", page: 1 })));
  });

  it("clears hidden selection when the channel filter changes", async () => {
    const user = userEvent.setup();
    renderPosts();
    await screen.findByText("Post one");
    await user.click(screen.getByRole("checkbox", { name: "Select Post one" }));
    await user.click(screen.getByRole("combobox", { name: "Filter channels on this page" }));
    await user.click(screen.getByRole("option", { name: "Facebook" }));
    expect(screen.queryByText("Post one")).toBeNull();
    expect(screen.queryByText("1 selected on this page")).toBeNull();
    expect(screen.getByText("Post two")).toBeTruthy();
    expect(screen.getByText(/Channel filtering applies to the current page/)).toBeTruthy();
  });

  it("requires confirmation before bulk deletion and respects the platform option", async () => {
    const user = userEvent.setup();
    renderPosts();
    await screen.findByText("Post one");
    await user.click(screen.getByRole("checkbox", { name: "Select all posts on this page" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(socialMediaApi.deletePost).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Delete 3 posts?" });
    await user.click(within(dialog).getByRole("checkbox", { name: "Also remove from connected platforms" }));
    await user.click(within(dialog).getByRole("button", { name: "Delete posts" }));
    await waitFor(() => expect(socialMediaApi.deletePost).toHaveBeenCalledTimes(3));
    expect(socialMediaApi.deletePost).toHaveBeenCalledWith("workspace", "one", { deleteFromPlatforms: false });
  });

  it("reports partial bulk failures and refreshes the list", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.archivePost).mockRejectedValueOnce(new Error("Not allowed"));
    renderPosts();
    await screen.findByText("Post one");
    await user.click(screen.getByRole("checkbox", { name: "Select all posts on this page" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect((await screen.findByRole("alert")).textContent).toContain("2 of 3 posts updated");
    await waitFor(() => expect(socialMediaApi.listPosts).toHaveBeenCalledTimes(2));
  });

  it("opens a preview with every platform and preserves detail/edit links", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.listPosts).mockResolvedValue(payload([{ ...fixtures[0], platforms: [fixtures[0].platforms[0], fixtures[1].platforms[0]] }]));
    renderPosts();
    await user.click(await screen.findByRole("button", { name: /Post one Copy for one/ }));
    const dialog = screen.getByRole("dialog", { name: "Post one" });
    expect(within(dialog).getByText("LinkedIn")).toBeTruthy();
    expect(within(dialog).getByText("Facebook")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "View details" }).getAttribute("href")).toBe("/dashboard/posts/one");
    expect(within(dialog).getByRole("link", { name: "Open in AI Studio" }).getAttribute("href")).toContain("draftId=one");
  });

  it("retains named row actions for retry and publishing", async () => {
    const user = userEvent.setup();
    renderPosts();
    await user.click(await screen.findByRole("button", { name: "Actions for Post three" }));
    await user.click(screen.getByRole("menuitem", { name: "Retry" }));
    await waitFor(() => expect(socialMediaApi.retryPost).toHaveBeenCalledWith("workspace", "three"));
    await user.click(screen.getByRole("button", { name: "Actions for Post one" }));
    await user.click(screen.getByRole("menuitem", { name: "Publish now" }));
    await waitFor(() => expect(socialMediaApi.publishNow).toHaveBeenCalledWith("workspace", "one"));
  });

  it("retains loaded cards when refresh fails", async () => {
    const user = userEvent.setup();
    renderPosts();
    await screen.findByText("Post one");
    vi.mocked(socialMediaApi.listPosts).mockRejectedValueOnce(new Error("Offline"));
    await user.click(screen.getByRole("button", { name: "Refresh posts" }));
    await screen.findByRole("alert");
    expect(screen.getByText("Post one")).toBeTruthy();
  });

  it("ignores a late search response after a new query", async () => {
    let resolveOld!: (value: SocialPostListResponse) => void;
    vi.mocked(socialMediaApi.listPosts).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValue(payload([post("new")]));
    renderPosts();
    await waitFor(() => expect(socialMediaApi.listPosts).toHaveBeenCalled());
    fireEvent.change(screen.getByRole("textbox", { name: "Search posts" }), { target: { value: "new" } });
    await act(async () => resolveOld(payload([post("obsolete")])));
    expect(await screen.findByText("Post new")).toBeTruthy();
    expect(screen.queryByText("Post obsolete")).toBeNull();
  });

  it("shows an actionable empty state", async () => {
    vi.mocked(socialMediaApi.listPosts).mockResolvedValue(payload([]));
    renderPosts();
    expect(await screen.findByText("Your next post starts here")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Create a post/ }).length).toBeGreaterThan(0);
  });

  it("passes automated accessibility checks", async () => {
    const { container } = renderPosts();
    await screen.findByText("Post one");
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});