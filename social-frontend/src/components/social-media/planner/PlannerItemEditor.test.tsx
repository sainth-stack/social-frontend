import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import apiClient from "@/api/client";
import PlannerItemEditor from "./PlannerItemEditor";
import { testItem } from "./planner-test-fixtures";

vi.mock("@/api/client", () => ({ default: { get: vi.fn() } }));
vi.mock("@/components/social-media/ai-studio/ResponsivePhonePreview", () => ({ default: ({ children }: { children: ReactNode }) => <div aria-label="Mobile post preview">{children}</div> }));

const props = { canEdit: true, busy: false, error: "", onClose: vi.fn(), onSave: vi.fn(), onSlot: vi.fn(), onMove: vi.fn(), index: 0, total: 1, workspaceId: "workspace", accountName: "Editorial account", onAttach: vi.fn(), onApprove: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); props.onSave.mockResolvedValue(false); props.onAttach.mockResolvedValue(true); });
afterEach(cleanup);

describe("planner preview workspace", () => {
  it("uses literal publisher paragraph gaps and marks LinkedIn comments as manual-only", () => {
    const item = testItem();
    item.post!.platforms[0].caption = "Opening\r\n\r\n\r\nSecond paragraph https://example.test/#section";
    item.post!.platforms[0].hashtags = ["#Launch", "Launch"];
    render(<PlannerItemEditor {...props} item={item} />);
    const preview = screen.getByRole("region", { name: "Live post preview" });
    const paragraph = preview.querySelector("p.whitespace-pre-wrap");
    expect(paragraph?.textContent).toBe("Opening\n\n\nSecond paragraph https://example.test/#section\n\n#Launch #Launch");
    expect(within(preview).getByText("First comment draft · Manual copy only")).toBeTruthy();
    expect(screen.getByText(/this comment is saved with your post/)).toBeTruthy();
  });
  it("aligns readable caption and first-comment fields without a duplicate nested comment heading", () => {
    render(<PlannerItemEditor {...props} item={testItem()} />);
    const caption = screen.getByRole("textbox", { name: "Caption" });
    const comment = screen.getByRole("textbox", { name: "First comment" });
    expect(caption.className).toContain("[field-sizing:content]");
    expect(caption.className).toContain("min-h-72");
    expect(comment.className).toContain("min-h-28");
    expect(comment.closest("details")).toBeNull();
    expect(document.querySelectorAll(`label[for="${comment.id}"]`)).toHaveLength(1);
    expect(comment.getAttribute("placeholder")).toContain("conversation starter");
  });
  it("saves hashtag chips and a new tag typed immediately before save", async () => {
    const user = userEvent.setup();
    const item = testItem();
    item.post!.platforms[0].hashtags = ["LLMs", "LangGraph"];
    render(<PlannerItemEditor {...props} item={item} />);
    await user.click(screen.getByRole("button", { name: "Remove hashtag LangGraph" }));
    await user.type(screen.getByRole("textbox", { name: "Hashtags" }), "#MCP");
    await user.click(screen.getByRole("button", { name: "Save copy" }));
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ hashtags: ["LLMs", "MCP"] }));
  });
  it("keeps long feed captions readable and exposes the full text on request", async () => {
    const user = userEvent.setup();
    const item = testItem();
    item.post!.platforms[0].caption = `${"A practical lesson. ".repeat(30)}Final takeaway.`;
    render(<PlannerItemEditor {...props} item={item} />);
    const preview = within(screen.getByRole("region", { name: "Live post preview" }));
    expect(preview.queryByText(/Final takeaway/)).toBeNull();
    await user.click(preview.getByRole("button", { name: "See more" }));
    expect(preview.getByText(/Final takeaway/)).toBeTruthy();
    await user.click(preview.getByRole("button", { name: "See less" }));
    expect(preview.queryByText(/Final takeaway/)).toBeNull();
  });
  it("attaches only an explicitly chosen listed workspace image at the saved revision", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [{ id: "owned-image", mediaType: "image", source: "uploaded", url: "https://example.test/owned.png", mimeType: "image/png", fileSizeBytes: 100, createdAt: "2027-01-01T00:00:00Z" }], total: 1, page: 1, pageSize: 12, totalPages: 1 } });
    render(<PlannerItemEditor {...props} item={testItem({ copyApproved: true })} />);
    await user.click(screen.getByRole("button", { name: "Choose from media" }));
    const media = screen.getByRole("dialog", { name: "Choose media" });
    expect(within(media).getByLabelText("Choose a media file").getAttribute("accept")).toBe("image/jpeg,image/png,image/webp");
    await user.click(within(media).getByRole("tab", { name: "Your media" }));
    expect(await within(media).findByRole("img", { name: "Saved media thumbnail" })).toBeTruthy();
    expect(props.onAttach).not.toHaveBeenCalled();
    await user.click(within(media).getByRole("button", { name: "Choose image 1" }));
    await user.click(within(media).getByRole("button", { name: "Use selected media" }));
    expect(apiClient.get).toHaveBeenCalledWith(expect.stringContaining("/workspaces/workspace/social/media-assets"), expect.objectContaining({ params: { search: undefined, mediaType: "image", page: 1, pageSize: 12 } }));
    expect(props.onAttach).toHaveBeenCalledExactlyOnceWith("owned-image");
    expect(screen.queryByRole("dialog", { name: "Choose media" })).toBeNull();
  });
  it("keeps failed attachments open and resets the picker when the saved revision changes", async () => {
    const user = userEvent.setup();
    props.onAttach.mockResolvedValue(false);
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [{ id: "owned-image", mediaType: "image", url: "https://example.test/owned.png" }], total: 1, page: 1, pageSize: 12, totalPages: 1 } });
    const { rerender } = render(<PlannerItemEditor {...props} item={testItem({ copyApproved: true })} />);
    await user.click(screen.getByRole("button", { name: "Choose from media" }));
    await user.click(screen.getByRole("tab", { name: "Your media" }));
    await user.click(await screen.findByRole("button", { name: "Choose image 1" }));
    await user.click(screen.getByRole("button", { name: "Use selected media" }));
    expect(screen.getByRole("dialog", { name: "Choose media" })).toBeTruthy();
    rerender(<PlannerItemEditor {...props} item={testItem({ copyApproved: true, revision: "new-revision" })} />);
    expect(screen.queryByRole("dialog", { name: "Choose media" })).toBeNull();
    expect(props.onAttach).toHaveBeenCalledExactlyOnceWith("owned-image");
  });
  it("prevents unsaved copy from being approved or bound to an owned image", () => {
    render(<PlannerItemEditor {...props} item={testItem({ copyApproved: true })} />);
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "Unsaved copy" } });
    expect((screen.getByRole("button", { name: "Choose from media" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Approve text" })).toBeNull();
    expect(within(screen.getByRole("region", { name: "Live post preview" })).getByText("Unsaved copy #Saved #Original")).toBeTruthy();
  });
  it("refreshes clean saved copy but never overwrites typed unsaved input", () => {
    const first = testItem();
    const { rerender } = render(<PlannerItemEditor {...props} item={first} />);
    const changed = testItem({ revision: "second" });
    changed.post!.platforms[0].caption = "Updated saved copy";
    rerender(<PlannerItemEditor {...props} item={changed} />);
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("Updated saved copy");
    fireEvent.change(screen.getByLabelText("Caption"), { target: { value: "My unsaved input" } });
    const third = testItem({ revision: "third" });
    rerender(<PlannerItemEditor {...props} item={third} />);
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).value).toBe("My unsaved input");
  });
  it("allows closing a clean read-only preview during unrelated work", () => {
    render(<PlannerItemEditor {...props} busy item={testItem({ isScheduled: true })} />);
    fireEvent.click(screen.getByRole("button", { name: "Back to run" }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect((screen.getByLabelText("Caption") as HTMLTextAreaElement).disabled).toBe(false);
    expect(screen.getByLabelText("Caption").closest("fieldset")?.disabled).toBe(true);
  });
  it("never offers approval for a missing draft while retaining exact-time correction", () => {
    render(<PlannerItemEditor {...props} item={testItem({ post: null, revision: null, generationState: "failed" })} />);
    expect(screen.queryByRole("button", { name: "Approve text" })).toBeNull();
    expect((screen.getByLabelText("Time") as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByLabelText("Caption").closest("fieldset")?.disabled).toBe(true);
  });
});