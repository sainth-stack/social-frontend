import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act as reactAct, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { plannerApi } from "@/api/endpoints/planner.api";
import socialMediaApi from "@/api/endpoints/social-media.api";
import type { ReactNode } from "react";
import PlannerRunReview from "./PlannerRunReview";
import { testItem, testRun, testWarning } from "./planner-test-fixtures";

vi.mock("@/api/endpoints/planner.api", () => ({ plannerApi: { getRun: vi.fn(), approveCopy: vi.fn(), image: vi.fn(), attachImage: vi.fn(), imageIntent: vi.fn(), editCopy: vi.fn(), editSlot: vi.fn(), regenerateText: vi.fn(), previewSchedule: vi.fn(), confirmSchedule: vi.fn(), retrySchedule: vi.fn(), retryRun: vi.fn(), cancelRun: vi.fn() } }));
vi.mock("@/api/endpoints/social-media.api", () => ({ default: { listAccounts: vi.fn(), listMediaAssets: vi.fn() } }));
vi.mock("@/components/social-media/ai-studio/ResponsivePhonePreview", () => ({ default: ({ children }: { children: ReactNode }) => <div aria-label="Mobile post preview">{children}</div> }));
const props = { workspaceId: "workspace", runId: "run", canEdit: true, canPublish: true };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(plannerApi.getRun).mockResolvedValue(testRun()); vi.mocked(socialMediaApi.listAccounts).mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("dedicated planner review", () => {
  it("asks for fresh final warning consent and sends the aggregate fingerprint", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: true, canSchedule: true, reasons: [] });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    const outcome = { slotId: "slot", itemId: item.id, postId: item.postId, revision: item.revision, proposedAt: item.proposedAt, timezone: item.slot.timezone, platform: item.slot.platform, accountId: item.slot.accountId, outcome: "ready" as const, reasons: [], warnings: [testWarning()], warningFingerprint: "final-aggregate", acknowledgmentRequired: true };
    vi.mocked(plannerApi.previewSchedule).mockResolvedValue({ previewId: "fresh-preview", expiresAt: "2027-01-03T00:00:00Z", items: [outcome] });
    vi.mocked(plannerApi.confirmSchedule).mockResolvedValue({ requestId: "confirmed", items: [{ ...outcome, outcome: "scheduled" }] });
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByLabelText("Include in schedule"));
    await user.click(screen.getByRole("button", { name: "Review selected schedule" }));
    await user.click(await screen.findByRole("button", { name: "Confirm schedule" }));
    expect(plannerApi.confirmSchedule).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Continue anyway" }));
    expect(plannerApi.confirmSchedule).toHaveBeenCalledWith("workspace", "run", expect.objectContaining({ previewId: "fresh-preview", conflictAcknowledgments: [{ slotId: "slot", warningFingerprint: "final-aggregate" }] }));
  });
  it("requires slot-edit consent and preserves copy approval for time-only edits", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: true });
    const slot = { ...item.slot, time: "14:00", warnings: [testWarning()], warningFingerprint: "edited-slot-aggregate" };
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    vi.mocked(plannerApi.editSlot).mockRejectedValueOnce({ response: { data: { detail: { code: "conflict_acknowledgment_required", slot } } } }).mockResolvedValue({ ...item, slot });
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "View" }));
    fireEvent.click(screen.getByText("Posting date and time"));
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "14:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save proposed time" }));
    await user.click(await screen.findByRole("button", { name: "Continue anyway" }));
    await waitFor(() => expect(plannerApi.editSlot).toHaveBeenCalledTimes(2));
    expect(vi.mocked(plannerApi.editSlot).mock.calls[1][3]).toEqual({ date: "2027-01-02", time: "14:00", timezone: "Asia/Kolkata", conflictAcknowledgments: [{ slotId: "slot", warningFingerprint: "edited-slot-aggregate" }] });
    expect(plannerApi.approveCopy).not.toHaveBeenCalled();
  });
  it("polls during an unresolved image start, retains newer stages and permits unrelated previews", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: true });
    const other = testItem({ id: "other", postId: "other-post", isScheduled: true });
    let server = testRun([item, other]);
    let finish!: (value: ReturnType<typeof testItem>) => void;
    vi.mocked(plannerApi.getRun).mockImplementation(async () => server);
    vi.mocked(plannerApi.image).mockImplementation((_workspace, _run, _item, payload) => {
      server = testRun([{ ...item, visualState: "processing", imageRequestId: payload.requestId, imageOperationId: "operation", imageStage: "generate", imageUpdatedAt: "2027-01-01T01:02:00Z" }, other]);
      return new Promise(resolve => { finish = resolve; });
    });
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "Generate image" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Generate image" }));
    await screen.findAllByText("Generating artwork");
    expect(plannerApi.getRun).toHaveBeenCalledTimes(2);
    await user.click(screen.getAllByRole("button", { name: "View" })[1]);
    expect(screen.getByRole("dialog", { name: "Review your post" })).toBeTruthy();
    vi.useFakeTimers();
    await reactAct(async () => { window.dispatchEvent(new Event("online")); });
    const before = vi.mocked(plannerApi.getRun).mock.calls.length;
    await reactAct(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(plannerApi.getRun).toHaveBeenCalledTimes(before + 1);
    await reactAct(async () => { finish({ ...server.items[0], imageStage: "queued", imageUpdatedAt: "2027-01-01T01:01:00Z" }); });
    expect(screen.getAllByText("Generating artwork").length).toBeGreaterThan(0);
    expect(plannerApi.image).toHaveBeenCalledTimes(1);
  });
  it("previews unsaved copy with the named account and labels old artwork", async () => {
    const user = userEvent.setup();
    const item = testItem();
    item.post!.imageUrl = "/mock-ui/sample.svg";
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    vi.mocked(socialMediaApi.listAccounts).mockResolvedValue([{ id: "account", accountName: "Editorial team" }] as Awaited<ReturnType<typeof socialMediaApi.listAccounts>>);
    render(<PlannerRunReview {...props} />);
    expect(await screen.findByRole("img", { name: "Post artwork thumbnail" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "View" }));
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Live unsaved caption" } });
    const preview = screen.getByRole("region", { name: "Live post preview" });
    expect(within(preview).getByText("Live unsaved caption #Saved #Original")).toBeTruthy();
    expect(within(preview).getByText("Editorial team")).toBeTruthy();
    expect(within(preview).getByText("Unsaved live copy")).toBeTruthy();
    expect(within(preview).getByText(/Artwork belongs to an older approved version/)).toBeTruthy();
  });
  it("rejects an outstanding GET after mutation settlement and accepts a fresh external revision", async () => {
    const user = userEvent.setup();
    const item = testItem({ imageRequestId: "saved-request", imageUpdatedAt: "2027-01-01T02:00:00Z" });
    const approved = { ...item, copyApproved: true, approvedRevision: item.revision };
    const external = testItem({ revision: "external-revision", imageRequestId: "external-request", imageUpdatedAt: "2027-01-01T01:00:00Z", error: "Fresh external revision loaded" });
    let finishApproval!: (value: ReturnType<typeof testItem>) => void;
    let finishStaleGet!: (value: ReturnType<typeof testRun>) => void;
    let finishFreshGet!: (value: ReturnType<typeof testRun>) => void;
    vi.mocked(plannerApi.getRun)
      .mockResolvedValueOnce(testRun([item]))
      .mockImplementationOnce(() => new Promise(resolve => { finishStaleGet = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { finishFreshGet = resolve; }));
    vi.mocked(plannerApi.approveCopy).mockImplementation(() => new Promise(resolve => { finishApproval = resolve; }));
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: /More actions/ }));
    await user.click(screen.getByRole("menuitem", { name: "Approve text" }));
    await waitFor(() => expect(plannerApi.getRun).toHaveBeenCalledTimes(2));
    await reactAct(async () => { finishApproval(approved); });
    await waitFor(() => expect(plannerApi.getRun).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole("button", { name: "Review text" })).toBeNull();
    await reactAct(async () => { finishStaleGet(testRun([testItem({ revision: "obsolete-revision", error: "Obsolete GET loaded" })])); });
    expect(screen.queryByText("Obsolete GET loaded")).toBeNull();
    expect(screen.queryByRole("button", { name: "Review text" })).toBeNull();
    await reactAct(async () => { finishFreshGet(testRun([external])); });
    expect(screen.getByText("Fresh external revision loaded")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Review text" })).toBeTruthy();
    expect(plannerApi.approveCopy).toHaveBeenCalledTimes(1);
  });
  it("loads durable saved content and approves text without image or scheduling calls", async () => {
    const user = userEvent.setup();
    vi.mocked(plannerApi.approveCopy).mockResolvedValue(testItem({ copyApproved: true, approvedRevision: "revision" }));
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "Review text" }));
    await user.click(screen.getByRole("button", { name: "Approve text" }));
    await waitFor(() => expect(plannerApi.approveCopy).toHaveBeenCalledWith("workspace", "run", "item", { expectedRevision: "revision" }));
    expect(plannerApi.image).not.toHaveBeenCalled();
    expect(plannerApi.confirmSchedule).not.toHaveBeenCalled();
  });
  it("opens exact caption, hashtag values and first comment, guarding dirty navigation", async () => {
    const user = userEvent.setup();
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "View" }));
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("Exact saved caption\nSecond line");
    expect(screen.getByRole("button", { name: "Remove hashtag Saved" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove hashtag Original" })).toBeTruthy();
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
    const item = testItem({ copyApproved: true, approvedRevision: "revision", visualState: "failed", imageOperationId: "operation", imageRequestId: "saved-request", imageRetryable: true, error: "Provider image failed" });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    vi.mocked(plannerApi.image).mockResolvedValue({ ...item, error: "Checkpoint upload failed" });
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "Retry image" }));
    expect(plannerApi.image).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Retry existing image" }));
    await waitFor(() => expect(plannerApi.image).toHaveBeenCalledWith("workspace", "run", "item", { expectedRevision: "revision", requestId: "saved-request", mode: "retry", creditsConfirmed: false }));
    expect(await screen.findAllByText("Checkpoint upload failed")).not.toHaveLength(0);
  });
  it("requires distinct credit confirmation for new artwork", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: true, imageOperationId: "operation", imageRequestId: "old", visualState: "ready" });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    vi.mocked(plannerApi.image).mockResolvedValue(item);
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: /More actions/ }));
    await user.click(screen.getByRole("menuitem", { name: "Regenerate image" }));
    await user.click(screen.getByRole("button", { name: "Confirm new artwork credits" }));
    await waitFor(() => expect(plannerApi.image).toHaveBeenCalledWith("workspace", "run", "item", expect.objectContaining({ mode: "regenerate", creditsConfirmed: true, requestId: expect.any(String) })));
    expect(vi.mocked(plannerApi.image).mock.calls[0][3].requestId).not.toBe("old");
  });
  it("retries operation B rather than cached operation A after a failed retry and regeneration", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: true, approvedRevision: "revision", visualState: "failed", imageOperationId: "operation-A", imageRequestId: "request-A", imageRetryable: true });
    let server = testRun([item]);
    let requestB = "";
    vi.mocked(plannerApi.getRun).mockImplementation(async () => server);
    vi.mocked(plannerApi.image)
      .mockRejectedValueOnce(new Error("Retry A response lost"))
      .mockImplementationOnce(async (_workspace, _run, _item, payload) => {
        requestB = payload.requestId;
        const regenerated = { ...item, imageOperationId: "operation-B", imageRequestId: requestB, error: "Operation B needs retry" };
        server = testRun([regenerated]);
        return regenerated;
      })
      .mockImplementationOnce(async () => {
        const ready = { ...server.items[0], visualState: "ready", imageRetryable: false, error: null };
        server = testRun([ready]);
        return ready;
      });
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "Retry image" }));
    await user.click(screen.getByRole("button", { name: "Retry existing image" }));
    expect(await screen.findByText(/Retry A response lost/)).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: "Refresh saved run" }) as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByRole("button", { name: /More actions/ }));
    await user.click(screen.getByRole("menuitem", { name: "Regenerate image" }));
    await user.click(screen.getByRole("button", { name: "Confirm new artwork credits" }));
    await screen.findAllByText("Operation B needs retry");
    await waitFor(() => expect((screen.getByRole("button", { name: "Retry image" }) as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByRole("button", { name: "Retry image" }));
    await user.click(screen.getByRole("button", { name: "Retry existing image" }));
    await waitFor(() => expect(plannerApi.image).toHaveBeenCalledTimes(3));
    const calls = vi.mocked(plannerApi.image).mock.calls;
    expect(calls[0]).toEqual(["workspace", "run", "item", { expectedRevision: "revision", requestId: "request-A", mode: "retry", creditsConfirmed: false }]);
    expect(calls[1][3]).toEqual(expect.objectContaining({ expectedRevision: "revision", requestId: requestB, mode: "regenerate", creditsConfirmed: true }));
    expect(requestB).not.toBe("request-A");
    expect(requestB).not.toBe("");
    expect(calls[2]).toEqual(["workspace", "run", "item", { expectedRevision: "revision", requestId: requestB, mode: "retry", creditsConfirmed: false }]);
    await screen.findByRole("button", { name: "Review schedule" });
    expect(plannerApi.confirmSchedule).not.toHaveBeenCalled();
  });
  it("preserves content and distinguishes image HTTP errors from run fetch failures", async () => {
    const user = userEvent.setup();
    vi.mocked(plannerApi.getRun).mockResolvedValueOnce(testRun([testItem({ copyApproved: true })])).mockRejectedValue(new Error("Refresh unavailable"));
    vi.mocked(plannerApi.image).mockRejectedValue(new Error("Image upload interrupted"));
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "Generate image" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Generate image" }));
    expect(await screen.findByText(/Image upload interrupted/)).toBeTruthy();
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
    await user.click(await screen.findByLabelText("Include in schedule"));
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
    await user.click(await screen.findByLabelText("Include in schedule"));
    await user.click(screen.getByRole("button", { name: "Review selected schedule" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm selected schedules" });
    expect((within(dialog).getByRole("button", { name: "Confirm schedule" }) as HTMLButtonElement).disabled).toBe(true);
    expect(plannerApi.confirmSchedule).not.toHaveBeenCalled();
  });
  it("preserves editor versus publisher permissions", async () => {
    const user = userEvent.setup();
    vi.mocked(plannerApi.previewSchedule).mockResolvedValue({ previewId: "preview", expiresAt: "2027-01-01T00:00:00Z", items: [] });
    render(<PlannerRunReview {...props} canPublish={false} />);
    await user.click(await screen.findByLabelText("Include in schedule"));
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
    const approve = await screen.findByRole("button", { name: "Review text" });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Use text only" })).toBeNull();
    expect(screen.queryByLabelText("Include in schedule")).toBeNull();
  });

  it("preserves the preview and confirmation request ID after an uncertain scheduling response", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: true, canSchedule: true, reasons: [] });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    vi.mocked(plannerApi.previewSchedule).mockResolvedValue({ previewId: "same-preview", expiresAt: "2027-01-01T00:00:00Z", items: [{ itemId: item.id, postId: item.postId, revision: item.revision, proposedAt: item.proposedAt, timezone: item.slot.timezone, platform: item.slot.platform, accountId: item.slot.accountId, outcome: "ready", reasons: [] }] });
    vi.mocked(plannerApi.confirmSchedule).mockRejectedValue(new Error("Confirmation response lost"));
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByLabelText("Include in schedule"));
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