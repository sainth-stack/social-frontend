import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagInput } from "./tag-input";

afterEach(cleanup);
function Editor({ disabled = false, initial = ["LLMs", "LangGraph"] }: { disabled?: boolean; initial?: string[] }) {
  const [tags, setTags] = useState(initial);
  return <TagInput value={tags} onChange={setTags} disabled={disabled} />;
}
describe("hashtag chips", () => {
  it("adds tags with Enter and Space, strips the prefix, and removes only the chosen chip", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const input = screen.getByRole("textbox", { name: "Hashtags" });
    await user.type(input, "#MCP{Enter}AI ");
    expect(screen.getByRole("button", { name: "Remove hashtag MCP" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove hashtag AI" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove hashtag LangGraph" }));
    expect(screen.queryByRole("button", { name: "Remove hashtag LangGraph" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove hashtag LLMs" })).toBeTruthy();
  });
  it("pastes multiple tags and deduplicates without changing existing values", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole("textbox", { name: "Hashtags" }));
    await user.paste("#llms, #SaaS\n#MCP SaaS");
    expect(screen.getAllByRole("button", { name: /Remove hashtag/ })).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Remove hashtag LLMs" })).toBeTruthy();
  });
  it("commits an unfinished tag on blur and never removes a chip on empty Backspace", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const input = screen.getByRole("textbox", { name: "Hashtags" });
    await user.type(input, "Consulting");
    await user.tab();
    expect(screen.getByRole("button", { name: "Remove hashtag Consulting" })).toBeTruthy();
    await user.click(input);
    await user.keyboard("{Backspace}");
    expect(screen.getAllByRole("button", { name: /Remove hashtag/ })).toHaveLength(3);
  });
  it("announces duplicate entry and disables both input and removal when read-only", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Editor />);
    await user.type(screen.getByRole("textbox", { name: "Hashtags" }), "llms{Enter}");
    expect(screen.getByRole("status").textContent).toContain("already added");
    rerender(<Editor disabled />);
    expect((screen.getByRole("textbox", { name: "Hashtags" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getAllByRole("button", { name: /Remove hashtag/ }).every(button => (button as HTMLButtonElement).disabled)).toBe(true);
  });
});