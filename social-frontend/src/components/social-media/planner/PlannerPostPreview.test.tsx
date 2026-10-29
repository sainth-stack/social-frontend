import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import PlatformPreview from "../content-studio/PlatformPreview";
import PlannerPostPreview, { PlannerArtwork } from "./PlannerPostPreview";
import { testItem } from "./planner-test-fixtures";
import fixtures from "@/lib/socialCaption.fixtures.json";
import type { PlannerPlatform } from "@/types/planner";

vi.mock("@/components/social-media/ai-studio/ResponsivePhonePreview", () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

const artworkUrl = "data:image/png;base64,iVBORw0KGgo=";
const beacon = vi.fn(() => { throw new Error("Beacon forbidden in preview tests"); });
beforeEach(() => Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon }));
afterEach(() => {
  cleanup();
  expect(beacon).not.toHaveBeenCalled();
  Reflect.deleteProperty(navigator, "sendBeacon");
});

function itemFor(platform: PlannerPlatform, image = false) {
  const item = testItem();
  return { ...item, slot: { ...item.slot, platform }, post: item.post && { ...item.post, imageUrl: image ? artworkUrl : null } };
}

describe.each(["linkedin", "facebook", "instagram"] as const)("%s shared feed adapter", platform => {
  it.each(fixtures)("matches Studio publisher formatting: $name", ({ caption, hashtags, expected }) => {
    const { container } = render(<>
      <PlatformPreview platform={platform} caption={caption} hashtags={hashtags} imageUrl={artworkUrl} />
      <PlannerPostPreview item={itemFor(platform, true)} accountName="Example" caption={caption} hashtags={hashtags.join("\n")} firstComment="" unsaved={false} />
    </>);
    const articles = container.querySelectorAll("article");
    expect(articles).toHaveLength(2);
    for (const article of articles) {
      expect(article.className).toContain("bg-card text-card-foreground");
      expect(article.querySelector(":scope > p")?.textContent).toBe(expected);
      const children = Array.from(article.children);
      const image = children.findIndex(child => child.tagName === "IMG" || Boolean(child.querySelector("img")));
      const copy = children.findIndex(child => child.tagName === "P");
      expect(platform === "instagram" ? image < copy : copy < image).toBe(true);
    }
    expect(screen.getByRole("img", { name: "Post artwork in feed preview" }).getAttribute("src")).toBe(artworkUrl);
  });

  it("expands exact long copy in both adapters and resets Planner expansion for the next item", () => {
    const caption = "Long authored content. ".repeat(30) + "\n\n\nFinal  line";
    const props = { item: itemFor(platform), accountName: "Example", caption, hashtags: "##Tag\nTag", firstComment: "", unsaved: false };
    const { container, rerender } = render(<><PlatformPreview platform={platform} caption={caption} hashtags={["##Tag", "Tag"]} /><PlannerPostPreview {...props} /></>);
    for (const button of screen.getAllByRole("button", { name: "See more" })) {
      expect(button.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(button);
      expect(button.getAttribute("aria-expanded")).toBe("true");
      expect(document.getElementById(button.getAttribute("aria-controls")!)?.textContent).toBe(`${caption}\n\n#Tag #Tag`);
    }
    expect(Array.from(container.querySelectorAll("article > p")).map(copy => copy.textContent)).toEqual([`${caption}\n\n#Tag #Tag`, `${caption}\n\n#Tag #Tag`]);
    rerender(<PlannerPostPreview {...props} item={{ ...props.item, id: "next-item" }} />);
    expect(screen.getByRole("button", { name: "See more" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("preserves separate Planner comment labels, normalized gaps and unsaved warnings", async () => {
    const item = itemFor(platform, true);
    const { container } = render(<PlannerPostPreview item={item} accountName="Example" caption="Live copy" hashtags="Tag" firstComment={"  First\r\n\r\nMore  context  "} unsaved />);
    const preview = within(screen.getByRole("region", { name: "Live post preview" }));
    expect(preview.getByText("Unsaved live copy")).toBeTruthy();
    expect(preview.getByRole("status").textContent).toContain("older approved version");
    expect(preview.getByText(platform === "linkedin" ? "First comment draft · Manual copy only" : "First comment · Example")).toBeTruthy();
    expect(preview.getByRole("region", { name: "First comment preview" }).lastElementChild?.textContent).toBe("First\n\nMore  context");
    expect(container.querySelector("article > p")?.textContent).toBe("Live copy\n\n#Tag");
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });
});

describe("Planner artwork slot", () => {
  it("keeps stage progress ahead of an existing image", () => {
    render(<PlannerPostPreview item={{ ...itemFor("linkedin", true), visualState: "processing", imageStage: "format" }} accountName="Example" caption="Copy" hashtags="" firstComment="" unsaved={false} />);
    expect(screen.getByRole("status").textContent).toBe("Formatting artwork");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("keeps failed-image feedback and does not invent an image for text-only posts", () => {
    const props = { accountName: "Example", caption: "Copy", hashtags: "", firstComment: "", unsaved: false };
    const { rerender } = render(<PlannerPostPreview {...props} item={{ ...itemFor("facebook"), visualState: "failed" }} />);
    expect(screen.getByText("Image failed")).toBeTruthy();
    rerender(<PlannerPostPreview {...props} item={{ ...itemFor("facebook"), imageIntent: "text_only" }} />);
    expect(screen.queryByText("No image yet")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    rerender(<PlannerPostPreview {...props} item={itemFor("instagram")} />);
    expect(screen.getByText("No image yet")).toBeTruthy();
  });

  it("preserves artwork errors, explicit reload, URL recovery and thumbnail alt labels", () => {
    const item = itemFor("linkedin", true);
    const { rerender } = render(<PlannerArtwork item={item} />);
    fireEvent.error(screen.getByRole("img", { name: "Post artwork in feed preview" }));
    expect(screen.getByText("Preview unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reload preview" }));
    expect(screen.getByRole("img", { name: "Post artwork in feed preview" })).toBeTruthy();
    fireEvent.error(screen.getByRole("img"));
    rerender(<PlannerArtwork item={{ ...item, post: item.post && { ...item.post, imageUrl: `${artworkUrl}#new` } }} thumbnail />);
    expect(screen.getByRole("img", { name: "Post artwork thumbnail" }).getAttribute("src")).toBe(`${artworkUrl}#new`);
  });

  it("preserves stale-artwork warnings even when the editor has no unsaved copy", () => {
    render(<PlannerPostPreview item={{ ...itemFor("linkedin", true), visualState: "stale" }} accountName="Example" caption="Copy" hashtags="" firstComment="" unsaved={false} />);
    expect(screen.getByRole("status").textContent).toContain("older approved version");
    expect(screen.queryByText("Unsaved live copy")).toBeNull();
  });
});