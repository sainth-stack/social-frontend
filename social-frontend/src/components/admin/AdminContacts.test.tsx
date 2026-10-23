import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import adminApi from "@/api/endpoints/admin.api";
import type { ContactList, ContactSubmission } from "@/types/admin";
import AdminContacts from "./AdminContacts";

const auth = vi.hoisted(() => ({ user: { id: "admin", isPlatformAdmin: true }, token: "session-a", stored: "session-a" }));
vi.mock("@/store/hooks", () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: auth.user, accessToken: auth.token } }) }));
vi.mock("@/lib/auth/session", () => ({ getStoredAccessToken: () => auth.stored }));
vi.mock("@/api/endpoints/admin.api", () => ({ default: { listContacts: vi.fn(), updateContact: vi.fn() } }));

const contact: ContactSubmission = {
  id: "contact-one", name: "Ada Lovelace", email: "ada@example.com", company: "Analytical Engines",
  message: "Please share your agency options.\nWe have five teams.", status: "new",
  createdAt: "2026-10-23T10:00:00Z", updatedAt: "2026-10-23T10:00:00Z",
};
const list = (items = [contact], total = items.length, page = 1, totalPages = 1): ContactList => ({ items, total, page, pageSize: 20, totalPages });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function choose(label: string, option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(screen.getByRole("option", { name: option }));
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.user = { id: "admin", isPlatformAdmin: true }; auth.token = "session-a"; auth.stored = "session-a";
  vi.mocked(adminApi.listContacts).mockResolvedValue(list());
  vi.mocked(adminApi.updateContact).mockResolvedValue({ ...contact, status: "resolved", updatedAt: "2026-10-23T11:00:00Z" });
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

describe("AdminContacts", () => {
  it("loads real submission details with a message disclosure and explicit save", async () => {
    render(<AdminContacts />);
    expect(screen.getByRole("status", { name: "Loading enquiries" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: contact.name })).toBeTruthy();
    expect(screen.getByRole("link", { name: contact.email }).getAttribute("href")).toBe(`mailto:${contact.email}`);
    expect(screen.getByText(contact.company!)).toBeTruthy();
    const disclosure = screen.getByText(`Read message from ${contact.name}`);
    expect(disclosure.closest("details")?.open).toBe(false);
    fireEvent.click(disclosure);
    expect(disclosure.closest("details")?.textContent).toContain("five teams");
    expect(screen.getByText(/Received/).querySelector("time")?.getAttribute("dateTime")).toBe(contact.createdAt);
    expect((screen.getByRole("button", { name: `Save status for ${contact.name}` }) as HTMLButtonElement).disabled).toBe(true);
    expect(adminApi.listContacts).toHaveBeenCalledWith({ search: undefined, status: undefined, page: 1, pageSize: 20 }, expect.any(AbortSignal));
  });

  it("shows a readable fallback when company is absent", async () => {
    vi.mocked(adminApi.listContacts).mockResolvedValue(list([{ ...contact, company: null }]));
    render(<AdminContacts />);
    expect(await screen.findByText("No company provided")).toBeTruthy();
  });

  it("shows errors rather than empty success and retries the request", async () => {
    vi.mocked(adminApi.listContacts).mockRejectedValueOnce(new Error("Offline"));
    render(<AdminContacts />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("No enquiries found")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry enquiries" }));
    expect(await screen.findByRole("heading", { name: contact.name })).toBeTruthy();
  });

  it("handles the empty-list totalPages=1 contract", async () => {
    vi.mocked(adminApi.listContacts).mockResolvedValue(list([]));
    render(<AdminContacts />);
    expect(await screen.findByText("No enquiries found")).toBeTruthy();
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("debounces search, resets pagination and keeps the selected status", async () => {
    vi.mocked(adminApi.listContacts).mockResolvedValue(list([contact], 42, 1, 3));
    render(<AdminContacts />);
    await screen.findByRole("heading", { name: contact.name });
    await choose("Filter status", "New");
    await waitFor(() => expect(adminApi.listContacts).toHaveBeenLastCalledWith(expect.objectContaining({ status: "new", page: 1 }), expect.any(AbortSignal)));
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() => expect(adminApi.listContacts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.any(AbortSignal)));
    const calls = vi.mocked(adminApi.listContacts).mock.calls.length;
    fireEvent.change(screen.getByRole("textbox", { name: "Search enquiries" }), { target: { value: "agency" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Search enquiries" }), { target: { value: "Ada" } });
    expect(adminApi.listContacts).toHaveBeenCalledTimes(calls);
    await waitFor(() => expect(adminApi.listContacts).toHaveBeenLastCalledWith({ search: "Ada", status: "new", page: 1, pageSize: 20 }, expect.any(AbortSignal)));
    expect(adminApi.listContacts).toHaveBeenCalledTimes(calls + 1);
  });

  it("clears filters from an empty search result", async () => {
    vi.mocked(adminApi.listContacts).mockResolvedValue(list([]));
    render(<AdminContacts />);
    await screen.findByText("No enquiries found");
    fireEvent.change(screen.getByRole("textbox", { name: "Search enquiries" }), { target: { value: "missing" } });
    fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(adminApi.listContacts).toHaveBeenLastCalledWith(expect.objectContaining({ search: undefined, page: 1 }), expect.any(AbortSignal)));
    expect((screen.getByRole("textbox", { name: "Search enquiries" }) as HTMLInputElement).value).toBe("");
  });

  it("ignores a late response immediately during the search debounce", async () => {
    const old = deferred<ContactList>();
    vi.mocked(adminApi.listContacts).mockReturnValueOnce(old.promise).mockResolvedValue(list([{ ...contact, id: "grace", name: "Grace Hopper" }]));
    render(<AdminContacts />);
    await waitFor(() => expect(adminApi.listContacts).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(adminApi.listContacts).mock.calls[0][1];
    fireEvent.change(screen.getByRole("textbox", { name: "Search enquiries" }), { target: { value: "Grace" } });
    expect(signal?.aborted).toBe(true);
    await act(async () => old.resolve(list()));
    expect(screen.queryByRole("heading", { name: contact.name })).toBeNull();
    expect(await screen.findByRole("heading", { name: "Grace Hopper" })).toBeTruthy();
  });

  it("requires Save before mutation and refreshes with unchanged search and status", async () => {
    render(<AdminContacts />);
    await screen.findByRole("heading", { name: contact.name });
    await choose("Filter status", "New");
    await screen.findByRole("heading", { name: contact.name });
    fireEvent.change(screen.getByRole("textbox", { name: "Search enquiries" }), { target: { value: "Ada" } });
    await screen.findByRole("heading", { name: contact.name });
    await choose(`Status for ${contact.name}`, "Resolved");
    expect(adminApi.updateContact).not.toHaveBeenCalled();
    vi.mocked(adminApi.listContacts).mockResolvedValue(list([]));
    fireEvent.click(screen.getByRole("button", { name: `Save status for ${contact.name}` }));
    expect(await screen.findByText("Enquiry status saved.")).toBeTruthy();
    expect(adminApi.updateContact).toHaveBeenCalledWith(contact.id, { status: "resolved" });
    expect(await screen.findByText("No enquiries found")).toBeTruthy();
    expect(adminApi.listContacts).toHaveBeenLastCalledWith({ search: "Ada", status: "new", page: 1, pageSize: 20 }, expect.any(AbortSignal));
  });

  it("reports mutation failure and lets Save retry without losing the selected status", async () => {
    vi.mocked(adminApi.updateContact).mockRejectedValueOnce(new Error("Offline"));
    render(<AdminContacts />);
    await screen.findByRole("heading", { name: contact.name });
    await choose(`Status for ${contact.name}`, "Resolved");
    fireEvent.click(screen.getByRole("button", { name: `Save status for ${contact.name}` }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not save");
    expect(screen.getByRole("combobox", { name: `Status for ${contact.name}` }).textContent).toContain("Resolved");
    fireEvent.click(screen.getByRole("button", { name: `Save status for ${contact.name}` }));
    expect(await screen.findByText("Enquiry status saved.")).toBeTruthy();
    expect(adminApi.updateContact).toHaveBeenCalledTimes(2);
  });

  it("does not inject an old mutation into newer filters or accept a pre-save list response", async () => {
    const mutation = deferred<ContactSubmission>();
    const stale = deferred<ContactList>();
    vi.mocked(adminApi.updateContact).mockReturnValue(mutation.promise);
    render(<AdminContacts />);
    await screen.findByRole("heading", { name: contact.name });
    await choose(`Status for ${contact.name}`, "Resolved");
    fireEvent.click(screen.getByRole("button", { name: `Save status for ${contact.name}` }));
    vi.mocked(adminApi.listContacts).mockReturnValueOnce(stale.promise).mockResolvedValue(list([{ ...contact, id: "grace", name: "Grace Hopper" }]));
    fireEvent.change(screen.getByRole("textbox", { name: "Search enquiries" }), { target: { value: "Grace" } });
    await waitFor(() => expect(adminApi.listContacts).toHaveBeenCalledTimes(2));
    const signal = vi.mocked(adminApi.listContacts).mock.calls[1][1];
    await act(async () => mutation.resolve({ ...contact, status: "resolved" }));
    expect(signal?.aborted).toBe(true);
    await act(async () => stale.resolve(list()));
    expect(screen.queryByRole("heading", { name: contact.name })).toBeNull();
    expect(await screen.findByRole("heading", { name: "Grace Hopper" })).toBeTruthy();
    expect(adminApi.listContacts).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Grace", page: 1 }), expect.any(AbortSignal));
  });

  it("returns to the last available page when a status update reduces the page count", async () => {
    vi.mocked(adminApi.listContacts).mockResolvedValueOnce(list([contact], 21, 1, 2)).mockResolvedValueOnce(list([contact], 21, 2, 2)).mockResolvedValue(list([contact], 20, 1, 1));
    render(<AdminContacts />);
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 2");
    await choose(`Status for ${contact.name}`, "Resolved");
    fireEvent.click(screen.getByRole("button", { name: `Save status for ${contact.name}` }));
    expect(await screen.findByText("Page 1 of 1")).toBeTruthy();
    expect(adminApi.listContacts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }), expect.any(AbortSignal));
  });

  it("prevents duplicate saves while a mutation is pending", async () => {
    vi.mocked(adminApi.updateContact).mockReturnValue(new Promise(() => {}));
    render(<AdminContacts />);
    await screen.findByRole("heading", { name: contact.name });
    await choose(`Status for ${contact.name}`, "In progress");
    const button = screen.getByRole("button", { name: `Save status for ${contact.name}` });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(adminApi.updateContact).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("aborts list requests on unmount", async () => {
    vi.mocked(adminApi.listContacts).mockReturnValue(new Promise(() => {}));
    const view = render(<AdminContacts />);
    await waitFor(() => expect(adminApi.listContacts).toHaveBeenCalled());
    const signal = vi.mocked(adminApi.listContacts).mock.calls[0][1];
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("has accessible enquiry controls and disclosure markup", async () => {
    const { container } = render(<AdminContacts />);
    await screen.findByRole("heading", { name: contact.name });
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it("refreshes empty results without changing filters", async () => {
    vi.mocked(adminApi.listContacts).mockResolvedValueOnce(list([]));
    render(<AdminContacts />);
    await screen.findByText("No enquiries found");
    fireEvent.click(screen.getByRole("button", { name: "Refresh enquiries" }));
    expect(await screen.findByRole("heading", { name: contact.name })).toBeTruthy();
    expect(adminApi.listContacts).toHaveBeenCalledTimes(2);
  });

  it("labels stale results and disables saving after a failed refresh", async () => {
    render(<AdminContacts />);
    await screen.findByRole("heading", { name: contact.name });
    await choose(`Status for ${contact.name}`, "Resolved");
    const pending = deferred<ContactList>();
    vi.mocked(adminApi.listContacts).mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error("Offline"));
    const refresh = screen.getByRole("button", { name: "Refresh enquiries" });
    fireEvent.click(refresh); fireEvent.click(refresh);
    expect(screen.getByText(/Refreshing enquiries/)).toBeTruthy();
    await waitFor(() => expect(adminApi.listContacts).toHaveBeenCalledTimes(2));
    expect((screen.getByRole("button", { name: `Save status for ${contact.name}` }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => pending.resolve(list()));
    await waitFor(() => expect((refresh as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(refresh);
    expect((await screen.findByRole("alert")).textContent).toContain("out of date");
    expect(screen.getByRole("heading", { name: contact.name })).toBeTruthy();
    expect((screen.getByRole("button", { name: `Save status for ${contact.name}` }) as HTMLButtonElement).disabled).toBe(true);
    vi.mocked(adminApi.listContacts).mockResolvedValue(list());
    fireEvent.click(screen.getByRole("button", { name: "Retry enquiries" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("disables refresh during save while preserving filter changes", async () => {
    const mutation = deferred<ContactSubmission>();
    vi.mocked(adminApi.updateContact).mockReturnValue(mutation.promise);
    render(<AdminContacts />);
    await screen.findByRole("heading", { name: contact.name });
    await choose(`Status for ${contact.name}`, "Resolved");
    fireEvent.click(screen.getByRole("button", { name: `Save status for ${contact.name}` }));
    const refresh = screen.getByRole("button", { name: "Refresh enquiries" });
    expect((refresh as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(refresh);
    expect(adminApi.listContacts).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("Search enquiries"), { target: { value: "Grace" } });
    await act(async () => mutation.resolve({ ...contact, status: "resolved" }));
    expect(screen.queryByText("Enquiry status saved.")).toBeNull();
    await waitFor(() => expect(adminApi.listContacts).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Grace" }), expect.any(AbortSignal)));
  });

  it("ignores a failed save after its filters have changed", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(adminApi.updateContact).mockReturnValue(new Promise((_, no) => { reject = no; }));
    render(<AdminContacts />);
    await screen.findByRole("heading", { name: contact.name });
    await choose(`Status for ${contact.name}`, "Resolved");
    fireEvent.click(screen.getByRole("button", { name: `Save status for ${contact.name}` }));
    fireEvent.change(screen.getByLabelText("Search enquiries"), { target: { value: "Grace" } });
    await act(async () => reject(new Error("Offline")));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("resets filters and aborts old lists on session changes", async () => {
    const stale = deferred<ContactList>();
    const view = render(<AdminContacts />);
    await screen.findByRole("heading", { name: contact.name });
    vi.mocked(adminApi.listContacts).mockReturnValueOnce(stale.promise).mockResolvedValue(list([{ ...contact, name: "New session" }]));
    fireEvent.change(screen.getByLabelText("Search enquiries"), { target: { value: "Ada" } });
    await waitFor(() => expect(adminApi.listContacts).toHaveBeenCalledTimes(2));
    const signal = vi.mocked(adminApi.listContacts).mock.calls[1][1];
    auth.token = "session-b"; auth.stored = "session-b";
    view.rerender(<AdminContacts />);
    expect(signal?.aborted).toBe(true);
    expect((screen.getByLabelText("Search enquiries") as HTMLInputElement).value).toBe("");
    await screen.findByRole("heading", { name: "New session" });
    await act(async () => stale.resolve(list()));
    expect(screen.queryByRole("heading", { name: contact.name })).toBeNull();
  });

  it("ignores mutations that finish after the session changes", async () => {
    const mutation = deferred<ContactSubmission>();
    vi.mocked(adminApi.updateContact).mockReturnValue(mutation.promise);
    const view = render(<AdminContacts />);
    await screen.findByRole("heading", { name: contact.name });
    await choose(`Status for ${contact.name}`, "Resolved");
    fireEvent.click(screen.getByRole("button", { name: `Save status for ${contact.name}` }));
    auth.token = "session-b"; auth.stored = "session-b";
    view.rerender(<AdminContacts />);
    await screen.findByRole("heading", { name: contact.name });
    await act(async () => mutation.resolve({ ...contact, status: "resolved" }));
    expect(screen.queryByText("Enquiry status saved.")).toBeNull();
    expect(adminApi.listContacts).toHaveBeenCalledTimes(2);
  });
});