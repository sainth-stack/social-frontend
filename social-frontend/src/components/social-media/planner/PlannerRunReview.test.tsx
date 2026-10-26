import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { plannerApi } from "@/api/endpoints/planner.api";
import PlannerRunReview from "./PlannerRunReview";
import { testItem, testRun } from "./planner-test-fixtures";

vi.mock("@/api/endpoints/planner.api", () => ({ plannerApi: { getRun: vi.fn(), approveCopy: vi.fn(), image: vi.fn(), imageIntent: vi.fn(), editCopy: vi.fn(), editSlot: vi.fn(), regenerateText: vi.fn(), previewSchedule: vi.fn(), confirmSchedule: vi.fn(), retrySchedule: vi.fn(), retryRun: vi.fn(), cancelRun: vi.fn() } }));
const props = { workspaceId: "workspace", runId: "run", canEdit: true, canPublish: true };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(plannerApi.getRun).mockResolvedValue(testRun()); });
afterEach(cleanup);

describe("dedicated planner review", () => {
  it("loads durable saved content and approves text without image or scheduling calls", async () => {
    const user = userEvent.setup();
    vi.mocked(plannerApi.approveCopy).mockResolvedValue(testItem({ copyApproved: true, approvedRevision: "revision" }));
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "Approve text" }));
    await waitFor(() => expect(plannerApi.approveCopy).toHaveBeenCalledWith("workspace", "run", "item", { expectedRevision: "revision" }));
    expect(plannerApi.image).not.toHaveBeenCalled();
    expect(plannerApi.confirmSchedule).not.toHaveBeenCalled();
  });
  it("opens exact caption, hashtag values and first comment, guarding dirty navigation", async () => {
    const user = userEvent.setup();
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "View" }));
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("Exact saved caption\nSecond line");
    expect((screen.getByLabelText("Hashtags (one saved value per line)") as HTMLTextAreaElement).value).toBe("#Saved\n#Original");
    expect((screen.getByLabelText("First comment") as HTMLTextAreaElement).value).toBe("Exact first comment");
    await user.type(screen.getByLabelText("Caption"), " edited");
    await user.click(screen.getByRole("button", { name: "Back to run" }));
    expect(screen.getByRole("dialog", { name: "Discard unsaved changes?" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toContain(" edited");
    expect(plannerApi.editCopy).not.toHaveBeenCalled();
  });
  it("keeps edited copy when a save fails and does not approve it", async () => {
    const user = userEvent.setup();
    vi.mocked(plannerApi.editCopy).mockRejectedValue(new Error("Save failed"));
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "View" }));
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "New exact caption" } });
    await user.click(screen.getByRole("button", { name: "Save copy" }));
    await waitFor(() => expect(plannerApi.editCopy).toHaveBeenCalledWith("workspace", "run", "item", { expectedRevision: "revision", caption: "New exact caption", hashtags: ["#Saved", "#Original"], firstComment: "Exact first comment" }));
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("New exact caption");
    expect(plannerApi.approveCopy).not.toHaveBeenCalled();
  });
  it("confirms retry and reuses the persisted image request ID, surfacing returned item errors", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: true, approvedRevision: "revision", visualState: "failed", imageOperationId: "operation", imageRequestId: "saved-request", error: "Provider image failed" });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    vi.mocked(plannerApi.image).mockResolvedValue({ ...item, error: "Checkpoint upload failed" });
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "Retry image" }));
    expect(plannerApi.image).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Retry existing image" }));
    await waitFor(() => expect(plannerApi.image).toHaveBeenCalledWith("workspace", "run", "item", { expectedRevision: "revision", requestId: "saved-request", mode: "retry", creditsConfirmed: false }));
    expect(await screen.findByText("Checkpoint upload failed")).toBeTruthy();
  });
  it("requires distinct credit confirmation for new artwork", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: true, imageOperationId: "operation", imageRequestId: "old", visualState: "ready" });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    vi.mocked(plannerApi.image).mockResolvedValue(item);
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "Regenerate image" }));
    await user.click(screen.getByRole("button", { name: "Confirm new artwork credits" }));
    await waitFor(() => expect(plannerApi.image).toHaveBeenCalledWith("workspace", "run", "item", expect.objectContaining({ mode: "regenerate", creditsConfirmed: true, requestId: expect.any(String) })));
    expect(vi.mocked(plannerApi.image).mock.calls[0][3].requestId).not.toBe("old");
  });
  it("preserves content and distinguishes image HTTP errors from run fetch failures", async () => {
    const user = userEvent.setup();
    vi.mocked(plannerApi.getRun).mockResolvedValueOnce(testRun([testItem({ copyApproved: true })])).mockRejectedValue(new Error("Refresh unavailable"));
    vi.mocked(plannerApi.image).mockRejectedValue(new Error("Image upload interrupted"));
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "Generate image" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Generate image" }));
    expect(await screen.findByText("Image upload interrupted")).toBeTruthy();
    expect(await screen.findByText(/Refresh failed: Refresh unavailable/)).toBeTruthy();
    expect(screen.getByText(/Exact saved caption/)).toBeTruthy();
  });
  it("never schedules until selected IDs are previewed and final confirmation is clicked", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: true, canSchedule: true, reasons: [] });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    const outcome = { itemId: "item", postId: "post", revision: "revision", proposedAt: item.proposedAt, timezone: "Asia/Kolkata", platform: "linkedin", accountId: "account", outcome: "ready" as const, reasons: [] };
    vi.mocked(plannerApi.previewSchedule).mockResolvedValue({ previewId: "schedule-preview", expiresAt: "2027-01-01T00:00:00Z", items: [outcome] });
    vi.mocked(plannerApi.confirmSchedule).mockResolvedValue({ requestId: "confirmed", items: [{ ...outcome, outcome: "dispatch_pending" }] });
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByLabelText("Select for final schedule review"));
    await user.click(screen.getByRole("button", { name: "Review selected schedule" }));
    await screen.findByRole("dialog", { name: "Confirm selected schedules" });
    expect(plannerApi.previewSchedule).toHaveBeenCalledWith("workspace", "run", ["item"]);
    expect(plannerApi.confirmSchedule).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm schedule" }));
    await waitFor(() => expect(plannerApi.confirmSchedule).toHaveBeenCalledWith("workspace", "run", { previewId: "schedule-preview", requestId: expect.any(String), confirm: true }));
    expect(await screen.findByRole("heading", { name: "Scheduling outcomes" })).toBeTruthy();
    expect(screen.getByText(/linkedin · dispatch pending/i)).toBeTruthy();
  });
  it("shows blocked selected items without silently scheduling only ready items", async () => {
    const user = userEvent.setup();
    vi.mocked(plannerApi.previewSchedule).mockResolvedValue({ previewId: "preview", expiresAt: "2027-01-01T00:00:00Z", items: [{ itemId: "item", postId: "post", revision: "revision", proposedAt: null, timezone: "Asia/Kolkata", platform: "linkedin", accountId: "account", outcome: "blocked", reasons: ["copy_not_approved"] }] });
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByLabelText(/Select for final schedule review/));
    await user.click(screen.getByRole("button", { name: "Review selected schedule" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm selected schedules" });
    expect((within(dialog).getByRole("button", { name: "Confirm schedule" }) as HTMLButtonElement).disabled).toBe(true);
    expect(plannerApi.confirmSchedule).not.toHaveBeenCalled();
  });
  it("preserves editor versus publisher permissions", async () => {
    const user = userEvent.setup();
    vi.mocked(plannerApi.previewSchedule).mockResolvedValue({ previewId: "preview", expiresAt: "2027-01-01T00:00:00Z", items: [] });
    render(<PlannerRunReview {...props} canPublish={false} />);
    await user.click(await screen.findByLabelText(/Select for final schedule review/));
    await user.click(screen.getByRole("button", { name: "Review selected schedule" }));
    const dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByRole("button", { name: "Confirm schedule" }) as HTMLButtonElement).disabled).toBe(true);
    expect(plannerApi.confirmSchedule).not.toHaveBeenCalled();
  });
  it("does not offer text-only for Instagram or enable mutations for viewers", async () => {
    const item = testItem();
    item.slot.platform = "instagram";
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    render(<PlannerRunReview {...props} canEdit={false} canPublish={false} />);
    const approve = await screen.findByRole("button", { name: "Approve text" });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Use text only" })).toBeNull();
    expect(screen.queryByLabelText(/Select for final schedule review/)).toBeNull();
  });

  it("preserves the preview and confirmation request ID after an uncertain scheduling response", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: true, canSchedule: true, reasons: [] });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    vi.mocked(plannerApi.previewSchedule).mockResolvedValue({ previewId: "same-preview", expiresAt: "2027-01-01T00:00:00Z", items: [{ itemId: item.id, postId: item.postId, revision: item.revision, proposedAt: item.proposedAt, timezone: item.slot.timezone, platform: item.slot.platform, accountId: item.slot.accountId, outcome: "ready", reasons: [] }] });
    vi.mocked(plannerApi.confirmSchedule).mockRejectedValue(new Error("Confirmation response lost"));
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByLabelText("Select for final schedule review"));
    await user.click(screen.getByRole("button", { name: "Review selected schedule" }));
    await user.click(await screen.findByRole("button", { name: "Confirm schedule" }));
    await waitFor(() => expect(plannerApi.confirmSchedule).toHaveBeenCalledTimes(1));
    await user.click(await screen.findByRole("button", { name: "Confirm schedule" }));
    await waitFor(() => expect(plannerApi.confirmSchedule).toHaveBeenCalledTimes(2));
    expect(vi.mocked(plannerApi.confirmSchedule).mock.calls[0][2]).toEqual(vi.mocked(plannerApi.confirmSchedule).mock.calls[1][2]);
  });

  it("opens a failed missing draft slot for exact time correction", async () => {
    const user = userEvent.setup();
    const item = testItem({ post: null, revision: null, generationState: "failed", error: "Slot expired" });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    vi.mocked(plannerApi.editSlot).mockResolvedValue({ ...item, slot: { ...item.slot, time: "14:00" } });
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "View" }));
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "14:00" } });
    await user.click(screen.getByRole("button", { name: "Save proposed time" }));
    expect(plannerApi.editSlot).toHaveBeenCalledWith("workspace", "run", "item", { date: "2027-01-02", time: "14:00", timezone: "Asia/Kolkata" });
  });
});