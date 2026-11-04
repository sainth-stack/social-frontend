import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { plannerApi } from "@/api/endpoints/planner.api";
import socialMediaApi from "@/api/endpoints/social-media.api";
import type { ReactNode } from "react";
import PlannerRunReview from "./PlannerRunReview";
import { testItem, testRun } from "./planner-test-fixtures";

vi.mock("@/api/endpoints/planner.api", () => ({
  plannerApi: {
    getRun: vi.fn(), approveCopy: vi.fn(), image: vi.fn(), attachImage: vi.fn(), imageIntent: vi.fn(),
    editCopy: vi.fn(), editSlot: vi.fn(), regenerateText: vi.fn(), previewSchedule: vi.fn(),
    confirmSchedule: vi.fn(), retrySchedule: vi.fn(), retryRun: vi.fn(), cancelRun: vi.fn(),
  },
}));
vi.mock("@/api/endpoints/social-media.api", () => ({ default: { listAccounts: vi.fn(), listMediaAssets: vi.fn() } }));
vi.mock("@/components/social-media/ai-studio/ResponsivePhonePreview", () => ({
  default: ({ children }: { children: ReactNode }) => <div aria-label="Mobile post preview">{children}</div>,
}));

const props = { workspaceId: "workspace", runId: "run", canEdit: true, canPublish: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", vi.fn(() => Object.assign(new EventTarget(), { matches: false })));
  vi.mocked(plannerApi.getRun).mockResolvedValue(testRun());
  vi.mocked(socialMediaApi.listAccounts).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function generateImage(user: ReturnType<typeof userEvent.setup>) {
  const visuals = await screen.findByRole("region", { name: "Visual choices" });
  expect(plannerApi.image).not.toHaveBeenCalled();
  await user.click(within(visuals).getByRole("button", { name: "Generate image" }));
  await user.click(within(screen.getByRole("dialog", { name: "Generate image?" })).getByRole("button", { name: "Generate" }));
}

describe("planner wizard review", () => {
  it("shows one screen grouped by posting date", async () => {
    const linkedin = testItem({ id: "li", copyApproved: false });
    linkedin.slot.date = "2026-11-05";
    linkedin.slot.platform = "linkedin";
    const facebook = testItem({ id: "fb", copyApproved: false });
    facebook.slot.date = "2026-11-05";
    facebook.slot.platform = "facebook";
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([linkedin, facebook]));
    render(<PlannerRunReview {...props} />);
    expect(await screen.findByRole("heading", { name: "Approve your plan" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Posting dates" })).toBeTruthy();
    expect(screen.getAllByRole("tab", { name: /linkedin/i })).toHaveLength(1);
    expect(screen.getByRole("tab", { name: /facebook/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Choose visuals" })).toBeNull();
  });

  it("approves text then offers image generation without scheduling", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: true });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    render(<PlannerRunReview {...props} />);
    await generateImage(user);
    expect(plannerApi.image).toHaveBeenCalled();
    expect(plannerApi.previewSchedule).not.toHaveBeenCalled();
  });

  it("approves copy from the wizard text step", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: false });
    vi.mocked(plannerApi.approveCopy).mockResolvedValue({ ...item, copyApproved: true });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: /Approve text for linkedin/i }));
    await waitFor(() => expect(plannerApi.approveCopy).toHaveBeenCalled());
    expect(plannerApi.image).not.toHaveBeenCalled();
  });

  it("confirms text-only intent from the image step", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: true });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    vi.mocked(plannerApi.imageIntent).mockResolvedValue({ ...item, imageIntent: "text_only", canSchedule: true });
    render(<PlannerRunReview {...props} />);
    const visuals = await screen.findByRole("region", { name: "Visual choices" });
    await user.click(within(visuals).getByRole("button", { name: "Use text only" }));
    await user.click(within(screen.getByRole("dialog", { name: "Use text only?" })).getByRole("button", { name: "Use text only" }));
    await waitFor(() => expect(plannerApi.imageIntent).toHaveBeenCalled());
  });

  it("opens schedule preview when every day is ready", async () => {
    const user = userEvent.setup();
    const ready = testItem({ copyApproved: true, visualState: "ready", canSchedule: true, reasons: [] });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([ready]));
    vi.mocked(plannerApi.previewSchedule).mockResolvedValue({ previewId: "preview", expiresAt: "2027-01-03T00:00:00Z", items: [] });
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: /Confirm schedule/ }));
    await waitFor(() => expect(plannerApi.previewSchedule).toHaveBeenCalledWith("workspace", "run", ["item"]));
  });

  it("blocks day navigation while copy edits are unsaved", async () => {
    const user = userEvent.setup();
    const dayOne = testItem({ id: "day-one", copyApproved: false });
    dayOne.slot.date = "2026-11-05";
    const dayTwo = testItem({ id: "day-two", copyApproved: false });
    dayTwo.slot.date = "2026-11-06";
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([dayOne, dayTwo]));
    render(<PlannerRunReview {...props} />);
    fireEvent.change(await screen.findByLabelText("Caption"), { target: { value: "Edited caption" } });
    const nextDay = screen.getAllByRole("button").find((button) => button.textContent?.includes("2026-11-06"));
    expect(nextDay).toBeTruthy();
    expect((nextDay as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Next day" }));
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("Edited caption");
  });

  it("retries image generation from the visual step", async () => {
    const user = userEvent.setup();
    const item = testItem({
      copyApproved: true,
      visualState: "failed",
      imageOperationId: "operation",
      imageRequestId: "saved-request",
      imageRetryable: true,
    });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "Retry last attempt" }));
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(plannerApi.image).toHaveBeenCalledWith("workspace", "run", "item", {
        expectedRevision: "revision",
        requestId: "saved-request",
        mode: "retry",
        creditsConfirmed: false,
      }),
    );
  });
});
