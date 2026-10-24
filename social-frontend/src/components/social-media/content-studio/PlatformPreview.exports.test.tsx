import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import PlatformPreview from "./PlatformPreview";
import CarouselSlideRenderer from "./CarouselSlideRenderer";

afterEach(cleanup);
const slides = ["one", "two"].map((id) => ({ id, headline: `Headline ${id}`, body: "Slide-only body", renderedAsset: true }));
const media = slides.map((slide) => ({ slideId: slide.id, assetId: slide.id, blobKey: `social/studio/${slide.id}.jpg`, url: `https://example.test/instagram/${slide.id}.jpg`, width: 1080, height: 1350, mimeType: "image/jpeg" }));

describe("actual platform exports", () => {
  it("renders the ordered real images at their dimensions with accessible slide navigation", async () => {
    const { container } = render(<PlatformPreview platform="instagram" caption="Intro only" hashtags={[]} slides={slides} media={media} />);
    expect(screen.getByRole("img", { name: "Headline one" }).getAttribute("src")).toBe(media[0].url);
    expect(screen.getByRole("img", { name: "Headline one" }).getAttribute("height")).toBe("1350");
    expect(screen.queryByText("Slide-only body")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show slide 2" }));
    expect(screen.getByRole("img", { name: "Headline two" }).getAttribute("src")).toBe(media[1].url);
    expect(screen.getByRole("button", { name: "Show slide 2" }).getAttribute("aria-pressed")).toBe("true");
    expect((await axe(container)).violations).toEqual([]);
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
});