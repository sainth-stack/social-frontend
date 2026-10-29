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
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("matchMedia", vi.fn(() => Object.assign(new EventTarget(), { matches: false }))); vi.mocked(plannerApi.getRun).mockResolvedValue(testRun()); vi.mocked(socialMediaApi.listAccounts).mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function viewPost(user: ReturnType<typeof userEvent.setup>, index = 0) {
  await user.click((await screen.findAllByRole("button", { name: /^More actions/ }))[index]);
  await user.click(screen.getByRole("menuitem", { name: "View post" }));
}

async function generateImage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Choose visuals" }));
  expect(plannerApi.image).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Generate image" }));
  await user.click(within(screen.getByRole("dialog", { name: "Generate an image?" })).getByRole("button", { name: "Generate image" }));
  await user.click(screen.getByRole("button", { name: "Back to run" }));
}

async function retryImage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Choose visuals" }));
  await user.click(screen.getByRole("button", { name: "Retry saved image operation" }));
  await user.click(screen.getByRole("button", { name: "Retry existing image" }));
  await user.click(screen.getByRole("button", { name: "Back to run" }));
}

describe("dedicated planner review", () => {
  it.each([
    { field: "Caption", variant: "unapproved" },
    { field: "Time", variant: "unapproved" },
    { field: "Caption", variant: "text_only" },
    { field: "Time", variant: "text_only" },
    { field: "Caption", variant: "retry" },
    { field: "Time", variant: "retry" },
  ])("blocks same-item list mutations for dirty $field with $variant visuals", async ({ field, variant }) => {
    const user = userEvent.setup();
    vi.stubGlobal("matchMedia", vi.fn(() => Object.assign(new EventTarget(), { matches: true })));
    const item = testItem(variant === "text_only" ? { copyApproved: true, imageIntent: "text_only" } : variant === "retry" ? { copyApproved: true, visualState: "failed", imageOperationId: "operation", imageRequestId: "request", imageRetryable: true } : {});
    const other = testItem({ id: "other" });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item, other]));
    render(<PlannerRunReview {...props} />);
    await screen.findByRole("region", { name: "Review your post" });
    await viewPost(user);
    const editor = screen.getByRole("region", { name: "Review your post" });
    if (field === "Time") fireEvent.click(within(editor).getByText("Posting date and time"));
    const input = within(editor).getByLabelText(field);
    const original = (input as HTMLInputElement).value;
    const edited = field === "Time" ? "15:30" : "Unsaved inline copy";
    fireEvent.change(input, { target: { value: edited } });
    expect(screen.getByText(/Save or discard this post’s unsaved edits/)).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: /^More actions/ })[0]);
    const names = ["Approve text", "Regenerate text", "Use text only", ...(variant === "text_only" ? ["Add an image"] : variant === "retry" ? ["Regenerate image", "Retry saved image operation"] : [])];
    for (const name of names) {
      const action = screen.getByRole("menuitem", { name });
      expect(action.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(action);
    }
    await user.click(screen.getByRole("menuitem", { name: "View post" }));
    expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).toBeNull();
    expect((input as HTMLInputElement).value).toBe(edited);
    await user.click(screen.getAllByRole("button", { name: /^More actions/ })[1]);
    expect(screen.getByRole("menuitem", { name: "Regenerate text" }).getAttribute("aria-disabled")).not.toBe("true");
    await user.keyboard("{Escape}");
    fireEvent.change(input, { target: { value: original } });
    await user.click(screen.getAllByRole("button", { name: /^More actions/ })[0]);
    expect(screen.getByRole("menuitem", { name: "Regenerate text" }).getAttribute("aria-disabled")).not.toBe("true");
    expect(plannerApi.approveCopy).not.toHaveBeenCalled();
    expect(plannerApi.regenerateText).not.toHaveBeenCalled();
    expect(plannerApi.image).not.toHaveBeenCalled();
    expect(plannerApi.imageIntent).not.toHaveBeenCalled();
    expect(plannerApi.previewSchedule).not.toHaveBeenCalled();
  });
  it.each(["Caption", "Time"])("blocks both schedule entry points for selected dirty %s without blocking other selections", async field => {
    const user = userEvent.setup();
    vi.stubGlobal("matchMedia", vi.fn(() => Object.assign(new EventTarget(), { matches: true })));
    const item = testItem({ copyApproved: true, imageIntent: "text_only", canSchedule: true, reasons: [] });
    const other = testItem({ ...item, id: "other" });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item, other]));
    vi.mocked(plannerApi.previewSchedule).mockResolvedValue({ previewId: "other-preview", expiresAt: "2027-01-03T00:00:00Z", items: [] });
    render(<PlannerRunReview {...props} />);
    const editor = await screen.findByRole("region", { name: "Review your post" });
    await user.click(screen.getAllByLabelText("Include in schedule")[0]);
    if (field === "Time") fireEvent.click(within(editor).getByText("Posting date and time"));
    fireEvent.change(within(editor).getByLabelText(field), { target: { value: field === "Time" ? "15:30" : "Unsaved selected copy" } });
    const schedule = screen.getByRole("button", { name: "Review selected schedule" });
    expect((schedule as HTMLButtonElement).disabled).toBe(true);
    screen.getAllByRole("button", { name: "Review schedule" }).forEach(button => {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    });
    fireEvent.click(schedule);
    expect(plannerApi.previewSchedule).not.toHaveBeenCalled();
    expect(plannerApi.confirmSchedule).not.toHaveBeenCalled();
    expect(screen.getByText(/Save or discard the selected post’s unsaved edits/)).toBeTruthy();
    await user.click(screen.getAllByLabelText("Include in schedule")[0]);
    await user.click(screen.getAllByLabelText("Include in schedule")[1]);
    expect((schedule as HTMLButtonElement).disabled).toBe(false);
    await user.click(schedule);
    expect(plannerApi.previewSchedule).toHaveBeenCalledExactlyOnceWith("workspace", "run", ["other"]);
  });
  it("resets dirty mutation guards after discarding on item switch and closing the editor", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("matchMedia", vi.fn(() => Object.assign(new EventTarget(), { matches: true })));
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([testItem(), testItem({ id: "other" })]));
    render(<PlannerRunReview {...props} />);
    await screen.findByRole("region", { name: "Review your post" });
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Unsaved first item" } });
    await viewPost(user, 1);
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByText(/Save or discard this post’s unsaved edits/)).toBeNull();
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("Exact saved caption\nSecond line");
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Unsaved second item" } });
    await user.click(screen.getByRole("button", { name: "Back to run" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.queryByLabelText("Caption")).toBeNull();
    expect(screen.queryByText(/Save or discard this post’s unsaved edits/)).toBeNull();
    await user.click(screen.getAllByRole("button", { name: /^More actions/ })[1]);
    expect(screen.getByRole("menuitem", { name: "Approve text" }).getAttribute("aria-disabled")).not.toBe("true");
    expect(plannerApi.editCopy).not.toHaveBeenCalled();
    expect(plannerApi.approveCopy).not.toHaveBeenCalled();
  });
  it("selects the first outstanding desktop post locally and guards list, next and filtered selection", async () => {
    const user = userEvent.setup();
    const media = new EventTarget() as EventTarget & { matches: boolean };
    media.matches = true;
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    const ready = testItem({ id: "ready", copyApproved: true, imageIntent: "text_only", canSchedule: true, reasons: [] });
    const review = testItem({ id: "review" });
    const visual = testItem({ id: "visual", copyApproved: true });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([ready, review, visual]));
    render(<PlannerRunReview {...props} />);
    let editor = await screen.findByRole("region", { name: "Review your post" });
    expect(within(editor).getByText(/Post 2 of 3/)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.change(within(editor).getByLabelText("Caption"), { target: { value: "Desktop unsaved copy" } });
    await user.click(screen.getByRole("button", { name: "Choose visuals" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("Desktop unsaved copy");
    await user.click(within(screen.getByRole("group", { name: "Filter posts" }).parentElement!).getAllByRole("button", { name: "Review next" })[0]);
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(within(editor).getByText(/Post 2 of 3/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Ready (1)" }));
    expect(screen.getByRole("region", { name: "Review your post" })).toBe(editor);
    await user.click(within(editor).getByRole("button", { name: "Review next" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    editor = screen.getByRole("region", { name: "Review your post" });
    expect(within(editor).getByText(/Post 3 of 3/)).toBeTruthy();
    expect(within(editor).getByRole("region", { name: "Visual choices" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Discard unsaved changes?" })).toBeNull();
    expect(plannerApi.editCopy).not.toHaveBeenCalled();
    expect(plannerApi.approveCopy).not.toHaveBeenCalled();
    expect(plannerApi.image).not.toHaveBeenCalled();
    expect(plannerApi.regenerateText).not.toHaveBeenCalled();
    expect(plannerApi.previewSchedule).not.toHaveBeenCalled();
    expect(socialMediaApi.listMediaAssets).not.toHaveBeenCalled();
  });
  it("does not automatically open the mobile editor after loading a plan", async () => {
    render(<PlannerRunReview {...props} />);
    await screen.findByRole("button", { name: "Review text" });
    expect(screen.queryByRole("dialog", { name: "Review your post" })).toBeNull();
    expect(screen.queryByLabelText("Caption")).toBeNull();
    expect(plannerApi.image).not.toHaveBeenCalled();
    expect(plannerApi.approveCopy).not.toHaveBeenCalled();
  });
  it("offers visual choices without starting generation, stock search or scheduling", async () => {
    const user = userEvent.setup();
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([testItem({ copyApproved: true })]));
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "Choose visuals" }));
    expect(screen.getByRole("button", { name: "Upload, paste or choose media" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate image" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use text only" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Preview" }));
    await user.click(screen.getByRole("button", { name: "Visuals" }));
    await user.click(screen.getByRole("button", { name: "Upload, paste or choose media" }));
    const picker = screen.getByRole("dialog", { name: "Choose media" });
    expect(within(picker).getByLabelText("Choose a media file").getAttribute("accept")).toBe("image/jpeg,image/png,image/webp");
    expect(within(picker).getByRole("tab", { name: "Stock" })).toBeTruthy();
    expect(plannerApi.image).not.toHaveBeenCalled();
    expect(plannerApi.attachImage).not.toHaveBeenCalled();
    expect(plannerApi.approveCopy).not.toHaveBeenCalled();
    expect(plannerApi.previewSchedule).not.toHaveBeenCalled();
    expect(socialMediaApi.listMediaAssets).not.toHaveBeenCalled();
  });
  it("confirms an explicit Facebook or LinkedIn text-only choice at the saved revision", async () => {
    const user = userEvent.setup();
    const item = testItem({ copyApproved: true });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([item]));
    vi.mocked(plannerApi.imageIntent).mockResolvedValue({ ...item, imageIntent: "text_only", canSchedule: true });
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "Choose visuals" }));
    await user.click(screen.getByRole("button", { name: "Use text only" }));
    expect(plannerApi.imageIntent).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog", { name: "Use text only?" })).getByRole("button", { name: "Use text only" }));
    await waitFor(() => expect(plannerApi.imageIntent).toHaveBeenCalledExactlyOnceWith("workspace", "run", "item", { expectedRevision: "revision", intent: "text_only" }));
    expect(plannerApi.image).not.toHaveBeenCalled();
    expect(plannerApi.confirmSchedule).not.toHaveBeenCalled();
  });
  it("keeps explicit selections across exclusive filters and previews every selected ID", async () => {
    const user = userEvent.setup();
    const review = testItem();
    const visual = testItem({ id: "visual", copyApproved: true });
    const ready = testItem({ id: "ready", copyApproved: true, imageIntent: "text_only", canSchedule: true, reasons: [] });
    const pending = testItem({ id: "pending", isScheduled: true, scheduleState: "uncertain" });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([review, visual, ready, pending]));
    vi.mocked(plannerApi.previewSchedule).mockResolvedValue({ previewId: "selection", expiresAt: "2027-01-03T00:00:00Z", items: [] });
    render(<PlannerRunReview {...props} />);
    const checkboxes = await screen.findAllByLabelText("Include in schedule");
    await user.click(checkboxes[0]);
    expect((screen.getByRole("button", { name: "Review schedule" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Choose visuals (1)" }));
    expect(screen.getAllByLabelText("Include in schedule")).toHaveLength(1);
    await user.click(screen.getByLabelText("Include in schedule"));
    await user.click(screen.getByRole("button", { name: "Ready (1)" }));
    expect(screen.getByLabelText("Include in schedule").getAttribute("aria-checked")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Needs attention (1)" }));
    expect(screen.getByText("Dispatch pending")).toBeTruthy();
    expect(screen.queryByLabelText("Include in schedule")).toBeNull();
    expect(screen.getByRole("button", { name: "Scheduled (0)" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "All (4)" }));
    expect(screen.getAllByLabelText("Include in schedule")[0].getAttribute("aria-checked")).toBe("true");
    expect(screen.getAllByLabelText("Include in schedule")[1].getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Review selected schedule" }));
    expect(plannerApi.previewSchedule).toHaveBeenCalledExactlyOnceWith("workspace", "run", ["item", "visual"]);
    expect(plannerApi.confirmSchedule).not.toHaveBeenCalled();
  });
  it("reviews the next outstanding item with dirty guards and never implicitly approves", async () => {
    const user = userEvent.setup();
    const other = testItem({ id: "other", copyApproved: true });
    vi.mocked(plannerApi.getRun).mockResolvedValue(testRun([testItem(), other]));
    render(<PlannerRunReview {...props} />);
    await user.click(await screen.findByRole("button", { name: "Review next" }));
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Keep these unsaved edits" } });
    await user.click(screen.getByRole("button", { name: "Review next" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("Keep these unsaved edits");
    await user.click(screen.getByRole("button", { name: "Review next" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(screen.getByText(/Post 2 of 2/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upload, paste or choose media" })).toBeTruthy();
    expect(plannerApi.approveCopy).not.toHaveBeenCalled();
    expect(plannerApi.editCopy).not.toHaveBeenCalled();
    expect(plannerApi.image).not.toHaveBeenCalled();
    expect(plannerApi.previewSchedule).not.toHaveBeenCalled();
  });
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
    await viewPost(user);
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
    await generateImage(user);
    await screen.findAllByText("Generating artwork");
    expect(plannerApi.getRun).toHaveBeenCalledTimes(2);
    await viewPost(user, 1);
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
    await viewPost(user);
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
    await viewPost(user);
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
    await viewPost(user);
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
    await user.click(await screen.findByRole("button", { name: "Choose visuals" }));
    await user.click(screen.getByRole("button", { name: "Retry saved image operation" }));
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
    await retryImage(user);
    expect(await screen.findByText(/Retry A response lost/)).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: "Refresh saved run" }) as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByRole("button", { name: /More actions/ }));
    await user.click(screen.getByRole("menuitem", { name: "Regenerate image" }));
    await user.click(screen.getByRole("button", { name: "Confirm new artwork credits" }));
    await screen.findAllByText("Operation B needs retry");
    await waitFor(() => expect((screen.getByRole("button", { name: "Refresh saved run" }) as HTMLButtonElement).disabled).toBe(false));
    await retryImage(user);
    await waitFor(() => expect(plannerApi.image).toHaveBeenCalledTimes(3));
    const calls = vi.mocked(plannerApi.image).mock.calls;
    expect(calls[0]).toEqual(["workspace", "run", "item", { expectedRevision: "revision", requestId: "request-A", mode: "retry", creditsConfirmed: false }]);
    expect(calls[1][3]).toEqual(expect.objectContaining({ expectedRevision: "revision", requestId: requestB, mode: "regenerate", creditsConfirmed: true }));
    expect(requestB).not.toBe("request-A");
    expect(requestB).not.toBe("");
    expect(calls[2]).toEqual(["workspace", "run", "item", { expectedRevision: "revision", requestId: requestB, mode: "retry", creditsConfirmed: false }]);
    await screen.findByRole("button", { name: "Resolve issues" });
    expect(plannerApi.confirmSchedule).not.toHaveBeenCalled();
  });
  it("preserves content and distinguishes image HTTP errors from run fetch failures", async () => {
    const user = userEvent.setup();
    vi.mocked(plannerApi.getRun).mockResolvedValueOnce(testRun([testItem({ copyApproved: true })])).mockRejectedValue(new Error("Refresh unavailable"));
    vi.mocked(plannerApi.image).mockRejectedValue(new Error("Image upload interrupted"));
    render(<PlannerRunReview {...props} />);
    await generateImage(user);
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
    await viewPost(user);
    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "14:00" } });
    await user.click(screen.getByRole("button", { name: "Save proposed time" }));
    expect(plannerApi.editSlot).toHaveBeenCalledWith("workspace", "run", "item", { date: "2027-01-02", time: "14:00", timezone: "Asia/Kolkata" });
  });
});