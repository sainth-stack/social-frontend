import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import PlatformPreview from "./PlatformPreview";
import CarouselSlideRenderer from "./CarouselSlideRenderer";
import fixtures from "@/lib/socialCaption.fixtures.json";

const network = vi.fn(() => { throw new Error("Network forbidden in preview tests"); });
beforeEach(() => {
  vi.stubGlobal("fetch", network);
  vi.stubGlobal("WebSocket", network);
  vi.spyOn(XMLHttpRequest.prototype, "send").mockImplementation(network);
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: network });
});
afterEach(() => {
  cleanup();
  expect(network).not.toHaveBeenCalled();
  expect(document.querySelector('link[href*="fonts.googleapis.com"]')).toBeNull();
  Reflect.deleteProperty(navigator, "sendBeacon");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const slides = ["one", "two"].map((id) => ({ id, headline: `Headline ${id}`, body: "Slide-only body", renderedAsset: true }));
const media = slides.map((slide) => ({ slideId: slide.id, assetId: slide.id, blobKey: `social/studio/${slide.id}.jpg`, url: `data:image/png;base64,iVBORw0KGgo=#${slide.id}`, width: 1080, height: 1350, mimeType: "image/jpeg" }));

describe("actual platform exports", () => {
  it.each(fixtures)("keeps exact authored publisher body: $name", ({ caption, hashtags, expected }) => {
    const { container } = render(<PlatformPreview platform="linkedin" caption={caption} hashtags={hashtags} media={[]} />);
    expect(container.querySelector("article > p")?.textContent).toBe(expected);
  });

  it.each(["linkedin", "facebook", "instagram"] as const)("keeps %s comments separate and labels delivery honestly", (platform) => {
    const { container } = render(<PlatformPreview platform={platform} caption={"Authored #Inline\n\n\nBody"} hashtags={["##Tag", "Tag"]} firstComment={"Exact comment\n\nMore  context"} media={media} />);
    const comment = screen.getByRole("region", { name: "First comment preview" });
    expect(comment.textContent).toContain("Exact comment\n\nMore  context");
    expect(comment.textContent).toContain(platform === "linkedin" ? "manual copy only, not published automatically" : "automatic delivery after publishing");
    expect(container.querySelector("article > p")?.textContent).toBe("Authored #Inline\n\n\nBody\n\n#Tag #Tag");
    const nodes = Array.from(container.querySelector("article")!.children);
    const imageBlock = nodes.findIndex((node) => Boolean(node.querySelector("img")));
    const copy = nodes.findIndex((node) => node.tagName === "P");
    expect(platform === "instagram" ? imageBlock < copy : copy < imageBlock).toBe(true);
  });

  it("keeps native Instagram authored gaps and inline tags without sanitation", () => {
    const { container } = render(<PlatformPreview platform="instagram" caption={"Authored #Inline\n\n\nBody"} hashtags={["##Tag", "Tag"]} />);
    const copy = Array.from(container.querySelectorAll("p")).find((node) => node.textContent?.includes("Authored #Inline"))!;
    expect(copy.textContent).toContain("Authored #Inline\n\n\nBody\n\n#Tag #Tag");
    expect(copy.className).toContain("whitespace-pre-wrap");
  });

  it("does not infer an X thread from authored blank lines", () => {
    const { container } = render(<PlatformPreview platform="x" caption={"One\n\n\nTwo"} hashtags={["##A", "A"]} />);
    expect(Array.from(container.querySelectorAll("p")).some((node) => node.textContent === "One\n\n\nTwo\n\n#A #A")).toBe(true);
  });

  it("renders the ordered real images at their dimensions with accessible slide navigation", async () => {
    const { container } = render(<PlatformPreview platform="instagram" caption="Intro only" hashtags={[]} slides={slides} media={media} />);
    expect(screen.getByRole("img", { name: "Headline one" }).getAttribute("src")).toBe(media[0].url);
    expect(screen.getByRole("img", { name: "Headline one" }).getAttribute("height")).toBe("1350");
    expect(screen.queryByText("Slide-only body")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show slide 2" }));
    expect(screen.getByRole("img", { name: "Headline two" }).getAttribute("src")).toBe(media[1].url);
    expect(screen.getByRole("button", { name: "Show slide 2" }).getAttribute("aria-pressed")).toBe("true");
    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it("does not fabricate slide artwork for incomplete drafts", () => {
    render(<PlatformPreview platform="linkedin" caption="Intro" hashtags={[]} slides={slides} media={[]} />);
    expect(screen.getByText("Slide 1 artwork not generated")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders structured threads as separate tweets", () => {
    render(<PlatformPreview platform="x" caption="" hashtags={[]} tweets={[{ text: "First tweet" }, { text: "Second tweet" }]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Second tweet")).toBeTruthy();
  });

  it("uses a finished export directly rather than drawing copy over it again", () => {
    render(<CarouselSlideRenderer slide={{ ...slides[0], imageUrl: media[0].url }} slideNum={1} totalSlides={2} />);
    expect(screen.getByRole("img").getAttribute("src")).toBe(media[0].url);
    expect(screen.queryByText("Slide-only body")).toBeNull();
  });

  it("matches exports by slide id, preserves slide order, and retains the selected id across reordering", () => {
    const props = { platform: "linkedin" as const, caption: "Intro", hashtags: [] };
    const { rerender } = render(<PlatformPreview {...props} slides={slides} media={[media[1], media[0]]} />);
    expect(screen.getByRole("img", { name: "Headline one" }).getAttribute("src")).toBe(media[0].url);
    fireEvent.click(screen.getByRole("button", { name: "Show slide 2" }));
    rerender(<PlatformPreview {...props} slides={[slides[1], slides[0]]} media={media} />);
    expect(screen.getByRole("img", { name: "Headline two" }).getAttribute("src")).toBe(media[1].url);
    expect(screen.getByRole("button", { name: "Show slide 1" }).getAttribute("aria-pressed")).toBe("true");
    rerender(<PlatformPreview {...props} slides={[slides[0]]} media={media} />);
    expect(screen.getByRole("img", { name: "Headline one" })).toBeTruthy();
  });

  it("shows every unfinished slide's headline and full body without fabricating a finished export", () => {
    const drafts = slides.map(slide => ({ ...slide, renderedAsset: false, body: "Full slide body. ".repeat(30) }));
    render(<PlatformPreview platform="facebook" caption="Intro" hashtags={[]} slides={drafts} media={[]} />);
    expect(screen.getByText("Headline one")).toBeTruthy();
    expect(screen.getByText(drafts[0].body.trim()).textContent).toBe(drafts[0].body);
    fireEvent.click(screen.getByRole("button", { name: "Show slide 2" }));
    expect(screen.getByText("Headline two")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("falls back to a slide's image, never an unrelated export or the legacy single image", () => {
    render(<PlatformPreview platform="instagram" caption="Intro" hashtags={[]} slides={[{ ...slides[0], imageUrl: media[0].url }, slides[1]]} media={[{ ...media[1], slideId: "unrelated" }]} imageUrl={media[1].url} />);
    expect(screen.getByRole("img", { name: "Headline one" }).getAttribute("src")).toBe(media[0].url);
    fireEvent.click(screen.getByRole("button", { name: "Show slide 2" }));
    expect(screen.getByText("Slide 2 artwork not generated")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("keeps standalone media in array order ahead of legacy URLs and retains polls", () => {
    const { container } = render(<PlatformPreview platform="linkedin" caption="Intro" hashtags={[]} media={media} imageUrl="data:image/png;base64,legacy" videoUrl="data:video/mp4;base64,legacy" pollOptions={["Choice one", "", "Choice two"]} />);
    expect(screen.getByRole("img").getAttribute("src")).toBe(media[0].url);
    fireEvent.click(screen.getByRole("button", { name: "Show slide 2" }));
    expect(screen.getByRole("img").getAttribute("src")).toBe(media[1].url);
    expect(screen.getByRole("region", { name: "Poll preview" }).querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("video")).toBeNull();
    expect(screen.queryByText(/votes|%|likes|reposts/)).toBeNull();
  });

  it.each([{ media: undefined }, { media: [] }])("preserves legacy video precedence with media $media", ({ media }) => {
    const { container } = render(<PlatformPreview platform="instagram" caption="Intro" hashtags={[]} media={media} videoUrl="data:video/mp4;base64,local" imageUrl="data:image/png;base64,local" />);
    expect(screen.getByLabelText("Instagram video preview").getAttribute("src")).toBe("data:video/mp4;base64,local");
    expect(container.querySelector("video")?.getAttribute("preload")).toBe("none");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders standalone video media by MIME type and falls back to a legacy image for empty media", () => {
    const props = { platform: "facebook" as const, caption: "Intro", hashtags: [] };
    const { rerender } = render(<PlatformPreview {...props} media={[{ url: "data:video/webm;base64,local", mimeType: "video/webm" }]} />);
    expect(screen.getByLabelText("Facebook video preview")).toBeTruthy();
    rerender(<PlatformPreview {...props} media={[]} imageUrl={media[0].url} />);
    expect(screen.getByRole("img").getAttribute("src")).toBe(media[0].url);
  });

  it("retains explicit account identity and avatar ahead of brand defaults", () => {
    render(<PlatformPreview platform="x" caption="Copy" hashtags={[]} brandName="Unused brand" account={{ accountName: "@Local Studio", handle: "@explicit_handle", accountPictureUrl: media[0].url }} firstComment="Manual note" />);
    expect(screen.getByText("Local Studio")).toBeTruthy();
    expect(screen.getByText("@explicit_handle")).toBeTruthy();
    expect(screen.queryByText("Unused brand")).toBeNull();
    expect(screen.getByRole("article").querySelector("header img")?.getAttribute("src")).toBe(media[0].url);
    expect(screen.getByRole("region", { name: "First comment preview" }).textContent).toContain("unsupported, manual copy only");
  });

  it("expands long X captions with exact whitespace and resets when the channel changes", () => {
    const caption = "Long authored copy. ".repeat(25) + "\n\n\nLast  line";
    const { container, rerender } = render(<PlatformPreview platform="x" caption={caption} hashtags={["Tag", "Tag"]} />);
    const button = screen.getByRole("button", { name: "See more" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    expect(container.querySelector("article > p")?.textContent).toBe(`${caption}\n\n#Tag #Tag`);
    expect(screen.getByRole("button", { name: "See less" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "See less" }));
    fireEvent.click(screen.getByRole("button", { name: "See more" }));
    rerender(<PlatformPreview platform="linkedin" caption={caption} hashtags={[]} />);
    expect(screen.getByRole("button", { name: "See more" }).getAttribute("aria-expanded")).toBe("false");
  });
});