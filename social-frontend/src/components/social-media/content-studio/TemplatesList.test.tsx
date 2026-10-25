import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import socialMediaApi from "@/api/endpoints/social-media.api";
import TemplatesList from "./TemplatesList";

vi.mock("@/api/endpoints/social-media.api", () => ({ default: { listTemplates: vi.fn(), deleteTemplate: vi.fn() } }));
vi.mock("./TemplateUseModal", () => ({ default: () => null, GOAL_LABELS: {} }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(socialMediaApi.listTemplates).mockResolvedValue([
    { id: "sales", orgId: "workspace", createdBy: "user", createdAt: "2026-10-25T10:00:00Z", name: "Sales campaign", category: "Sales", description: "An offer", platforms: ["linkedin"], hashtags: [], captionTemplate: "Offer", isSystem: false },
    { id: "event", orgId: "workspace", createdBy: "user", createdAt: "2026-10-25T10:00:00Z", name: "Event launch", category: "Event", description: "An event", platforms: ["linkedin"], hashtags: [], captionTemplate: "Event", isSystem: false },
  ]);
});
afterEach(cleanup);

function renderTemplates() {
  const store = configureStore({ reducer: { auth: () => ({ user: { workspaceId: "workspace" } }) } });
  return render(<Provider store={store}><TemplatesList /></Provider>);
}

it("filters templates through the phone category picker without extra requests", async () => {
  const user = userEvent.setup();
  renderTemplates();
  await screen.findByText("Sales campaign");
  await user.selectOptions(screen.getByRole("combobox", { name: "Template category" }), "Sales");
  expect(screen.getByText("Sales campaign")).toBeTruthy();
  expect(screen.queryByText("Event launch")).toBeNull();
  await user.selectOptions(screen.getByRole("combobox", { name: "Template category" }), "all");
  await user.type(screen.getByRole("textbox", { name: "Search templates" }), "Event");
  expect(screen.queryByText("Sales campaign")).toBeNull();
  expect(screen.getByText("Event launch")).toBeTruthy();
  expect(socialMediaApi.listTemplates).toHaveBeenCalledTimes(1);
});

it("labels destructive template actions and keeps the confirmation guard", async () => {
  const user = userEvent.setup();
  renderTemplates();
  await user.click(await screen.findByRole("button", { name: "Delete Sales campaign" }));
  expect(screen.getByRole("alertdialog", { name: "Delete template?" })).toBeTruthy();
  expect(socialMediaApi.deleteTemplate).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
});