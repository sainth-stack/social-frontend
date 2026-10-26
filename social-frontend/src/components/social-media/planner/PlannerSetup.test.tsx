import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { plannerApi } from "@/api/endpoints/planner.api";
import socialMediaApi from "@/api/endpoints/social-media.api";
import PlannerSetup from "./PlannerSetup";
import { testPreview, testRun } from "./planner-test-fixtures";
import type { SocialAccount, SocialSettings } from "@/types/social-media.types";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/api/endpoints/planner.api", () => ({ plannerApi: { listRuns: vi.fn(), previewSlots: vi.fn(), createRun: vi.fn() } }));
vi.mock("@/api/endpoints/social-media.api", () => ({ default: { getSettings: vi.fn(), listAccounts: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(socialMediaApi.getSettings).mockResolvedValue({ timezone: "Asia/Kolkata" } as SocialSettings);
  vi.mocked(socialMediaApi.listAccounts).mockResolvedValue([{ id: "account", platform: "linkedin", accountName: "Main account", isDefault: true, isActive: true, tokenStatus: "active" }] as SocialAccount[]);
  vi.mocked(plannerApi.listRuns).mockResolvedValue({ total: 1, items: [testRun()] });
  vi.mocked(plannerApi.previewSlots).mockResolvedValue(testPreview());
  vi.mocked(plannerApi.createRun).mockResolvedValue(testRun());
});
afterEach(cleanup);

async function fillRange() {
  await screen.findByText("Workspace timezone: Asia/Kolkata");
  fireEvent.change(screen.getByLabelText("What should this plan cover?"), { target: { value: "A useful campaign with exact facts" } });
  fireEvent.click(screen.getByLabelText("linkedin"));
  fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2027-01-02" } });
  fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2027-01-02" } });
}

describe("planner exact setup", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Preview exact slots" }));
    expect(await screen.findByText(`Blocked: ${message}. Correct and preview again, or explicitly exclude.`)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Generate text for 1 posts" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("uses workspace timezone and final token, then navigates to the durable run", async () => {
    const user = userEvent.setup();
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await fillRange();
    await user.click(screen.getByRole("button", { name: "Preview exact slots" }));
    await user.click(await screen.findByRole("button", { name: "Generate text for 1 posts" }));
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
    await user.click(screen.getByRole("button", { name: "Preview exact slots" }));
    const generate = await screen.findByRole("button", { name: "Generate text for 2 posts" });
    expect((generate as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getAllByLabelText("Exclude this slot")[1]);
    await user.click(screen.getByRole("button", { name: "Generate text for 1 posts" }));
    expect(plannerApi.createRun).toHaveBeenCalledWith("workspace", expect.objectContaining({ excludedSlotIds: ["blocked"] }));
  });
  it("invalidates the token for edited times and re-previews exact overrides", async () => {
    const user = userEvent.setup();
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await fillRange();
    await user.click(screen.getByRole("button", { name: "Preview exact slots" }));
    fireEvent.change(await screen.findByLabelText("Time for 2027-01-02 linkedin"), { target: { value: "14:30" } });
    expect((screen.getByRole("button", { name: "Generate text for 1 posts" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Refresh final preview" }));
    expect(plannerApi.previewSlots).toHaveBeenLastCalledWith("workspace", expect.objectContaining({ overrides: [{ date: "2027-01-02", platform: "linkedin", time: "14:30", accountId: "account", utcOffsetMinutes: 330 }] }));
  });
  it("supports individual dates, deduplication and explicit removal", async () => {
    const user = userEvent.setup();
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await screen.findByText("Workspace timezone: Asia/Kolkata");
    await user.selectOptions(screen.getByLabelText("Date selection"), "dates");
    await user.click(screen.getByLabelText("linkedin"));
    for (const date of ["2027-01-08", "2027-01-02"]) {
      fireEvent.change(screen.getByLabelText("Choose date"), { target: { value: date } });
      await user.click(screen.getByRole("button", { name: "Add date" }));
    }
    fireEvent.change(screen.getByLabelText("Choose date"), { target: { value: "2027-01-02" } });
    expect((screen.getByRole("button", { name: "Add date" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Remove 2027-01-08" }));
    await user.click(screen.getByRole("button", { name: "Preview exact slots" }));
    expect(plannerApi.previewSlots).toHaveBeenLastCalledWith("workspace", expect.objectContaining({ dates: ["2027-01-02"] }));
    expect(vi.mocked(plannerApi.previewSlots).mock.calls[0][1]).not.toHaveProperty("startDate");
  });
  it("reuses the create request ID after a network error instead of duplicating a run", async () => {
    const user = userEvent.setup();
    vi.mocked(plannerApi.createRun).mockRejectedValueOnce(new Error("Create response lost")).mockResolvedValue(testRun());
    render(<PlannerSetup workspaceId="workspace" canEdit plan="growth" />);
    await fillRange();
    await user.click(screen.getByRole("button", { name: "Preview exact slots" }));
    await user.click(await screen.findByRole("button", { name: "Generate text for 1 posts" }));
    await screen.findByText("Create response lost");
    await user.click(screen.getByRole("button", { name: "Generate text for 1 posts" }));
    await waitFor(() => expect(plannerApi.createRun).toHaveBeenCalledTimes(2));
    expect(vi.mocked(plannerApi.createRun).mock.calls[0][1]).toBe(vi.mocked(plannerApi.createRun).mock.calls[1][1]);
  });
});