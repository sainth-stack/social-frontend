import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { plannerApi } from "@/api/endpoints/planner.api";
import socialMediaApi from "@/api/endpoints/social-media.api";
import PlannerSetup from "./PlannerSetup";
import { testPreview, testRun, testWarning } from "./planner-test-fixtures";
import type { SocialAccount, SocialSettings } from "@/types/social-media.types";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/api/endpoints/planner.api", () => ({ plannerApi: { listRuns: vi.fn(), previewSlots: vi.fn(), createRun: vi.fn() } }));
vi.mock("@/api/endpoints/social-media.api", () => ({ default: { getSettings: vi.fn(), listAccounts: vi.fn() } }));

beforeEach(() => {
  vi.setSystemTime(new Date("2027-01-01T00:00:00Z"));
  vi.clearAllMocks();
  vi.mocked(socialMediaApi.getSettings).mockResolvedValue({ timezone: "Asia/Kolkata" } as SocialSettings);
  vi.mocked(socialMediaApi.listAccounts).mockResolvedValue([{ id: "account", platform: "linkedin", accountName: "Main account", isDefault: true, isActive: true, tokenStatus: "active" }] as SocialAccount[]);
  vi.mocked(plannerApi.listRuns).mockResolvedValue({ total: 1, items: [testRun()] });
  vi.mocked(plannerApi.previewSlots).mockResolvedValue(testPreview());
  vi.mocked(plannerApi.createRun).mockResolvedValue(testRun());
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function fillRange() {
  await screen.findByText("Workspace timezone: Asia/Kolkata");
  fireEvent.change(screen.getByLabelText("What should this plan cover?"), { target: { value: "A useful campaign with exact facts" } });
  fireEvent.click(screen.getByLabelText("linkedin"));
  fireEvent.click(screen.getByRole("button", { name: "Choose your date range" }));
  fireEvent.click(screen.getByRole("button", { name: /January 2nd, 2027/ }));
  fireEvent.keyDown(screen.getByRole("button", { name: /January 2nd, 2027/ }), { key: "Escape" });
}

describe("planner exact setup", () => {
  it.each([true, false])("inherits workspace first-comment preference %s and permits an explicit override", async enabled => {
    const user = userEvent.setup();
    vi.mocked(socialMediaApi.getSettings).mockResolvedValue({ timezone: "Asia/Kolkata", autoFirstComment: enabled } as SocialSettings);
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await fillRange();
    const toggle = screen.getByRole("checkbox", { name: "Generate first comment" });
    expect(toggle.getAttribute("aria-checked")).toBe(String(enabled));
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Review dates" }));
    await user.click(await screen.findByRole("button", { name: "Generate 1 drafts" }));
    expect(plannerApi.createRun).toHaveBeenCalledWith("workspace", expect.objectContaining({ includeComment: !enabled }));
  });
  it("explicitly disables shared controls for viewers", async () => {
    render(<PlannerSetup workspaceId="workspace" canEdit={false} plan="growth" />);
    await screen.findByText("Workspace timezone: Asia/Kolkata");
    expect((screen.getByRole("combobox", { name: "Tone" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "linkedin account" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: "linkedin" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Choose your date range" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("disables busy controls and keeps the selected values after preview settles", async () => {
    const user = userEvent.setup();
    let finish!: (value: ReturnType<typeof testPreview>) => void;
    vi.mocked(plannerApi.previewSlots).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await fillRange();
    await user.click(screen.getByRole("button", { name: "Review dates" }));
    expect((screen.getByRole("combobox", { name: "Tone" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "linkedin account" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: "linkedin" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Jan.*2027/ }) as HTMLButtonElement).disabled).toBe(true);
    finish(testPreview());
    await screen.findByRole("button", { name: "Generate 1 drafts" });
    expect((screen.getByRole("combobox", { name: "Tone" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("combobox", { name: "Tone" }).textContent).toContain("Professional");
    expect(screen.getByRole("checkbox", { name: "linkedin" }).getAttribute("aria-checked")).toBe("true");
    expect(plannerApi.previewSlots).toHaveBeenCalledWith("workspace", expect.objectContaining({ startDate: "2027-01-02", endDate: "2027-01-02", platforms: ["linkedin"], accountIds: { linkedin: "account" } }));
  });
  it("requires aggregate warning consent before generating and never overwrites an existing post", async () => {
    const user = userEvent.setup();
    const preview = testPreview();
    preview.slots[0] = { ...preview.slots[0], warnings: [testWarning()], warningFingerprint: "aggregate", acknowledgmentRequired: true };
    vi.mocked(plannerApi.previewSlots).mockResolvedValue(preview);
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await fillRange();
    await user.click(screen.getByRole("button", { name: "Review dates" }));
    await user.click(await screen.findByRole("button", { name: "Generate 1 drafts" }));
    const dialog = screen.getByRole("dialog", { name: "Other posts at this time" });
    expect(within(dialog).getByText("An existing scheduled post")).toBeTruthy();
    expect(plannerApi.createRun).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Continue anyway" }));
    expect(plannerApi.createRun).toHaveBeenCalledWith("workspace", expect.objectContaining({ conflictAcknowledgments: [{ slotId: "slot", warningFingerprint: "aggregate" }] }));
  });
  it("discards warning consent when the selected posting time changes", async () => {
    const user = userEvent.setup();
    const preview = testPreview();
    preview.slots[0] = { ...preview.slots[0], warnings: [testWarning()], warningFingerprint: "aggregate" };
    vi.mocked(plannerApi.previewSlots).mockResolvedValue(preview);
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await fillRange();
    await user.click(screen.getByRole("button", { name: "Review dates" }));
    await user.click(await screen.findByRole("button", { name: "Generate 1 drafts" }));
    await user.click(screen.getByRole("button", { name: "Change time" }));
    fireEvent.change(screen.getByLabelText("Time for 2027-01-02 linkedin"), { target: { value: "15:00" } });
    expect((screen.getByRole("button", { name: "Generate 1 drafts" }) as HTMLButtonElement).disabled).toBe(true);
    expect(plannerApi.createRun).not.toHaveBeenCalled();
  });
  it.each([
    ["past_slot", "This posting time has already passed. Choose a later time or date"],
    ["time_in_past", "This posting time has already passed. Choose a later time or date"],
    ["slot_occupied", "This account already has a scheduled or publishing post at this exact time"],
    ["posting_day_disabled", "No default posting time is enabled for this weekday. Enter a time"],
  ])("explains the actual %s blocker", async (reason, message) => {
    const preview = testPreview();
    preview.slots[0].reasons = [reason];
    vi.mocked(plannerApi.previewSlots).mockResolvedValue(preview);
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await fillRange();
    fireEvent.click(screen.getByRole("button", { name: "Review dates" }));
    expect(await screen.findByText(`Blocked: ${message}. Correct and preview again, or explicitly exclude.`)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Generate 1 drafts" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("uses workspace timezone and final token, then navigates to the durable run", async () => {
    const user = userEvent.setup();
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await fillRange();
    await user.click(screen.getByRole("button", { name: "Review dates" }));
    await user.click(await screen.findByRole("button", { name: "Generate 1 drafts" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/content-studio/planner/run"));
    expect(plannerApi.createRun).toHaveBeenCalledWith("workspace", expect.objectContaining({ timezone: "Asia/Kolkata", startDate: "2027-01-02", endDate: "2027-01-02", previewToken: "final-token", requestId: expect.any(String), excludedSlotIds: [], accountIds: { linkedin: "account" } }));
    expect(screen.queryByLabelText(/Call to action/i)).toBeNull();
    expect(screen.getByRole("link", { name: /A complete saved plan brief/ }).getAttribute("href")).toBe("/dashboard/content-studio/planner/run");
  });
  it("requires explicit exclusion of blocked slots and submits those exact IDs", async () => {
    const user = userEvent.setup();
    const preview = testPreview();
    preview.slots.push({ ...preview.slots[0], slotId: "blocked", date: "2027-01-03", reasons: ["blackout_date"] });
    vi.mocked(plannerApi.previewSlots).mockResolvedValue(preview);
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await fillRange();
    await user.click(screen.getByRole("button", { name: "Review dates" }));
    const generate = await screen.findByRole("button", { name: "Generate 2 drafts" });
    expect((generate as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getAllByLabelText("Exclude this slot")[1]);
    await user.click(screen.getByRole("button", { name: "Generate 1 drafts" }));
    expect(plannerApi.createRun).toHaveBeenCalledWith("workspace", expect.objectContaining({ excludedSlotIds: ["blocked"] }));
  });
  it("invalidates the token for edited times and re-previews exact overrides", async () => {
    const user = userEvent.setup();
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await fillRange();
    await user.click(screen.getByRole("button", { name: "Review dates" }));
    fireEvent.change(await screen.findByLabelText("Time for 2027-01-02 linkedin"), { target: { value: "14:30" } });
    expect((screen.getByRole("button", { name: "Generate 1 drafts" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Review dates again" }));
    expect(plannerApi.previewSlots).toHaveBeenLastCalledWith("workspace", expect.objectContaining({ overrides: [{ date: "2027-01-02", platform: "linkedin", time: "14:30", accountId: "account", utcOffsetMinutes: 330 }] }));
  });
  it("supports individual dates, deduplication and explicit removal", async () => {
    const user = userEvent.setup();
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await screen.findByText("Workspace timezone: Asia/Kolkata");
    await user.click(screen.getByRole("button", { name: "Individual dates" }));
    await user.click(screen.getByLabelText("linkedin"));
    await user.click(screen.getByRole("button", { name: "Choose individual dates" }));
    await user.click(screen.getByRole("button", { name: /January 8th, 2027/ }));
    await user.click(screen.getByRole("button", { name: /January 2nd, 2027/ }));
    fireEvent.keyDown(screen.getByRole("button", { name: /January 2nd, 2027/ }), { key: "Escape" });
    await user.click(screen.getByRole("button", { name: "Remove 2027-01-08" }));
    await user.click(screen.getByRole("button", { name: "Review dates" }));
    expect(plannerApi.previewSlots).toHaveBeenLastCalledWith("workspace", expect.objectContaining({ dates: ["2027-01-02"] }));
    expect(vi.mocked(plannerApi.previewSlots).mock.calls[0][1]).not.toHaveProperty("startDate");
  });
  it("reuses the create request ID after a network error instead of duplicating a run", async () => {
    const user = userEvent.setup();
    vi.mocked(plannerApi.createRun).mockRejectedValueOnce(new Error("Create response lost")).mockResolvedValue(testRun());
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await fillRange();
    await user.click(screen.getByRole("button", { name: "Review dates" }));
    await user.click(await screen.findByRole("button", { name: "Generate 1 drafts" }));
    await screen.findByText("Create response lost");
    await user.click(screen.getByRole("button", { name: "Generate 1 drafts" }));
    await waitFor(() => expect(plannerApi.createRun).toHaveBeenCalledTimes(2));
    expect(vi.mocked(plannerApi.createRun).mock.calls[0][1]).toBe(vi.mocked(plannerApi.createRun).mock.calls[1][1]);
  });
});