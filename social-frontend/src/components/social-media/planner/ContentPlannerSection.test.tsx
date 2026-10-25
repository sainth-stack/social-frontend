import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { ContentPlannerSection } from "./ContentPlannerSection";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/api/endpoints/social-media.api", () => ({ default: { getCalendar: vi.fn(), getPost: vi.fn(), deletePost: vi.fn(), startContentPlanJob: vi.fn(), getContentPlanJob: vi.fn(), updatePost: vi.fn(), approveContentPlanVisual: vi.fn(), regeneratePostContent: vi.fn() } }));

function renderPlanner() {
  const store = configureStore({ reducer: {
    auth: () => ({ user: { workspaceId: "workspace", plan: "growth" } }),
    socialAccounts: () => ({ accounts: [{ id: "account", platform: "linkedin", isActive: true }] }),
  } });
  return render(<Provider store={store}><ContentPlannerSection orgId="workspace" /></Provider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  const today = new Date();
  today.setHours(14, 0, 0, 0);
  vi.mocked(socialMediaApi.getCalendar).mockResolvedValue({ month: "", items: [{ id: "planned", title: "Campaign", status: "scheduled", scheduledAt: today.toISOString(), publishedAt: null, platforms: ["linkedin"], captionPreview: "Review this campaign", imageUrl: null }] });
  vi.mocked(socialMediaApi.getPost).mockReturnValue(new Promise(() => {}));
});
afterEach(cleanup);

describe("ContentPlannerSection mobile controls", () => {
  it("opens day planning without hover and preserves the target date", async () => {
    const user = userEvent.setup();
    renderPlanner();
    await user.click(await screen.findByRole("button", { name: "Add another post" }));
    const dialog = screen.getByRole("dialog", { name: "Plan a post for this day" });
    expect(within(dialog).getByLabelText("What should the posts be about?")).toBeTruthy();
    expect(within(dialog).queryByText("Duration")).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Create post" }).hasAttribute("disabled")).toBe(true);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(socialMediaApi.startContentPlanJob).not.toHaveBeenCalled();
  });

  it("keeps deletion separate from opening a post and requires confirmation", async () => {
    const user = userEvent.setup();
    renderPlanner();
    const remove = await screen.findByRole("button", { name: "Delete post" });
    expect(remove.className).not.toMatch(/(?:^|\s)opacity-0(?:\s|$)/);
    await user.click(remove);
    expect(screen.getByRole("alertdialog", { name: "Delete this planned post?" })).toBeTruthy();
    expect(socialMediaApi.deletePost).not.toHaveBeenCalled();
    expect(socialMediaApi.getPost).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("keeps range and history controls usable without starting generation", async () => {
    const user = userEvent.setup();
    renderPlanner();
    await screen.findByText("Review this campaign");
    await user.click(screen.getByRole("radio", { name: "7 days" }));
    expect(screen.getByRole("radio", { name: "7 days" }).getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Plan history" }));
    expect(screen.getByRole("dialog", { name: "Plan history" })).toBeTruthy();
    expect(socialMediaApi.startContentPlanJob).not.toHaveBeenCalled();
  });
});

function draftPost(caption = "Saved caption") {
  return {
    id: "planned", orgId: "workspace", createdBy: "owner", title: "Campaign", status: "draft" as const,
    scheduledAt: new Date().toISOString(), publishedAt: null, imageUrl: null, imageSource: "none" as const,
    approvalStatus: "not_required" as const, approvedBy: null, templateId: null, aiPrompt: "A useful launch campaign",
    createdAt: "", updatedAt: "", platforms: [{ id: "platform", platform: "linkedin" as const,
      socialAccountId: "account", caption, hashtags: [], firstComment: null, characterCount: caption.length,
      status: "pending" as const, platformPostId: null, publishedAt: null, errorCode: null, errorMessage: null,
      retryCount: 0, nextRetryAt: null, reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, engagementRate: 0 }],
  };
}

describe("text-first planner", () => {
  it("requests text drafts without images or automatic scheduling and shows all partial errors", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.startContentPlanJob).mockResolvedValue({ jobId: "job" });
    vi.mocked(socialMediaApi.getContentPlanJob).mockResolvedValue({ jobId: "job", status: "completed", result: {
      days: 0, timezone: "UTC", autoScheduled: false, scheduledCount: 0, draftCount: 0, skippedCount: 0,
      items: [], calendarItems: [], errors: ["Day 1: retry caption", "Day 2: text limit", "Day 3: provider unavailable"], message: "No drafts saved",
    } });
    renderPlanner();
    await user.click(await screen.findByRole("button", { name: "Plan content" }));
    expect(screen.queryByLabelText("Branded images")).toBeNull();
    await user.type(screen.getByLabelText("What should the posts be about?"), "A launch campaign for our service");
    await user.click(screen.getByRole("button", { name: /Create \d+ posts/ }));
    await waitFor(() => expect(socialMediaApi.startContentPlanJob).toHaveBeenCalledWith("workspace", expect.objectContaining({ autoSchedule: false, generateImages: false })));
    expect(await screen.findByText("Day 3: provider unavailable")).toBeTruthy();
    expect(socialMediaApi.approveContentPlanVisual).not.toHaveBeenCalled();
  });

  it("saves the latest edited caption before explicit visual approval", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.getPost).mockResolvedValue(draftPost());
    vi.mocked(socialMediaApi.updatePost).mockResolvedValue(draftPost("Latest edited copy"));
    vi.mocked(socialMediaApi.approveContentPlanVisual).mockResolvedValue({ ...draftPost("Latest edited copy"), imageUrl: "https://cdn.test/image.jpg" });
    renderPlanner();
    await user.click(await screen.findByText("Review this campaign"));
    const caption = await screen.findByLabelText("Caption");
    await waitFor(() => expect((caption as HTMLTextAreaElement).value).toBe("Saved caption"));
    await user.clear(caption);
    await user.type(caption, "Latest edited copy");
    expect(socialMediaApi.approveContentPlanVisual).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Approve copy & generate visual" }));
    await waitFor(() => expect(socialMediaApi.approveContentPlanVisual).toHaveBeenCalledWith("workspace", "planned", "Latest edited copy"));
    expect(socialMediaApi.updatePost).toHaveBeenCalledWith("workspace", "planned", expect.objectContaining({ platforms: [expect.objectContaining({ caption: "Latest edited copy" })] }));
    expect(vi.mocked(socialMediaApi.updatePost).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(socialMediaApi.approveContentPlanVisual).mock.invocationCallOrder[0]);
  });

  it("preserves edited copy when saving fails and never attempts an image", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.getPost).mockResolvedValue(draftPost());
    vi.mocked(socialMediaApi.updatePost).mockRejectedValue(new Error("Save unavailable; retry"));
    renderPlanner();
    await user.click(await screen.findByText("Review this campaign"));
    const caption = await screen.findByLabelText("Caption");
    await waitFor(() => expect((caption as HTMLTextAreaElement).value).toBe("Saved caption"));
    await user.clear(caption);
    await user.type(caption, "Keep my edits");
    await user.click(screen.getByRole("button", { name: "Approve copy & generate visual" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Save unavailable; retry");
    expect((caption as HTMLTextAreaElement).value).toBe("Keep my edits");
    expect(socialMediaApi.approveContentPlanVisual).not.toHaveBeenCalled();
  });

  it("reports visual failures inline and allows approval retry without losing saved copy", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.getPost).mockResolvedValue(draftPost());
    vi.mocked(socialMediaApi.updatePost).mockResolvedValue(draftPost());
    vi.mocked(socialMediaApi.approveContentPlanVisual).mockRejectedValueOnce(new Error("Image quota reached"))
      .mockResolvedValueOnce(draftPost());
    renderPlanner();
    await user.click(await screen.findByText("Review this campaign"));
    const approve = await screen.findByRole("button", { name: "Approve copy & generate visual" });
    await user.click(approve);
    expect((await screen.findByRole("alert")).textContent).toContain("Image quota reached");
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("Saved caption");
    await user.click(screen.getByRole("button", { name: "Approve copy & generate visual" }));
    await waitFor(() => expect(socialMediaApi.approveContentPlanVisual).toHaveBeenCalledTimes(2));
  });

  it("rewrites copy only without approving or generating visuals", async () => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.getPost).mockResolvedValue(draftPost());
    vi.mocked(socialMediaApi.regeneratePostContent).mockResolvedValue(draftPost("Rewritten copy"));
    renderPlanner();
    await user.click(await screen.findByText("Review this campaign"));
    await waitFor(() => expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("Saved caption"));
    await user.click(screen.getByRole("button", { name: "Rewrite" }));
    await waitFor(() => expect(socialMediaApi.regeneratePostContent).toHaveBeenCalledWith("workspace", "planned", expect.objectContaining({ regenerateCaption: true, regenerateImage: false })));
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("Rewritten copy");
    expect(socialMediaApi.approveContentPlanVisual).not.toHaveBeenCalled();
  });
});