import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { appThemes } from "@/lib/theme";
import type { SocialPlatform } from "@/types/social-media.types";
import PhoneFrame from "./PhoneFrame";
import PlatformPreview from "./PlatformPreview";

const globals = readFileSync("src/app/globals.css", "utf8");
const platforms: SocialPlatform[] = ["linkedin", "instagram", "x", "facebook"];
const artworkUrl = "https://example.test/generated-original.jpg";
let tokens: HTMLStyleElement;

beforeEach(() => {
  tokens = document.createElement("style");
  tokens.textContent = [globals.match(/:root\s*\{[^}]+\}/)?.[0], globals.match(/\.dark\s*\{[^}]+\}/)?.[0]].join("\n");
  document.head.appendChild(tokens);
});

afterEach(() => {
  cleanup();
  tokens.remove();
  document.documentElement.classList.remove("dark");
});

describe.each(["light", "dark"] as const)("%s preview theme", (mode) => {
  beforeEach(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  });

  it.each(platforms)("themes %s chrome, captions, polls, and icons without recoloring artwork", (platform) => {
    const { container } = render(<ThemeProvider theme={appThemes[mode]}>
      <PlatformPreview platform={platform} caption="Original caption" hashtags={["brand"]} imageUrl={artworkUrl} brandName="Example Brand" pollOptions={["First choice", "Second choice"]} />
    </ThemeProvider>);
    const root = container.firstElementChild!;
    expect(getComputedStyle(document.documentElement).getPropertyValue("--card").trim()).toBe(mode === "dark" ? "#241e19" : "oklch(1 0 0)");
    expect(getComputedStyle(root).backgroundColor).toBe(["linkedin", "facebook"].includes(platform) ? "var(--background)" : "var(--card)");
    expect(getComputedStyle(root).color).toBe("var(--foreground)");
    expect(getComputedStyle(root.firstElementChild!).backgroundColor).toBe("var(--card)");
    expect(getComputedStyle(screen.getByText(/Original caption/)).color).toBe("var(--foreground)");
    expect(getComputedStyle(screen.getByText("First choice")).color).toBe("var(--foreground)");
    expect(root.querySelector('[stroke="var(--muted-foreground)"], [stroke="var(--foreground)"], [fill="var(--foreground)"]')).not.toBeNull();
    const image = container.querySelector(`img[src="${artworkUrl}"]`)!;
    expect(image).not.toBeNull();
    expect(getComputedStyle(image).filter).toBe("");
    expect(getComputedStyle(root).filter).toBe("");
    expect(screen.getByText(/#brand/)).toBeTruthy();
    if (platform === "linkedin") expect(getComputedStyle(screen.getByText("in")).backgroundColor).toBe("rgb(10, 102, 194)");
    if (platform === "facebook") expect(getComputedStyle(screen.getByText("facebook")).color).toBe("rgb(24, 119, 242)");
    if (platform === "instagram") expect(container.querySelector('[stroke="#ed4956"]')).not.toBeNull();
    if (platform === "x") expect(container.querySelector('[data-testid="HomeIcon"]')).not.toBeNull();
  });

  it.each(["linkedin", "instagram", "facebook"] as const)("keeps %s caption expansion working", (platform) => {
    const caption = "Original long caption. ".repeat(15);
    render(<ThemeProvider theme={appThemes[mode]}><PlatformPreview platform={platform} caption={caption} hashtags={[]} /></ThemeProvider>);
    expect(screen.queryByText(caption.trim())).toBeNull();
    fireEvent.click(screen.getByText(platform === "facebook" ? "See more" : platform === "linkedin" ? "…more" : "more"));
    expect(screen.getByText(caption.trim(), { exact: false })).toBeTruthy();
  });

  it("themes phone glass and status indicators while preserving dimensions and hardware", () => {
    const { container } = render(<ThemeProvider theme={appThemes[mode]}><PhoneFrame width={300}><p>Preview content</p></PhoneFrame></ThemeProvider>);
    const frame = container.firstElementChild!;
    const time = screen.getByText("9:41");
    const glass = time.parentElement!.parentElement!;
    const footer = glass.lastElementChild!;
    expect(getComputedStyle(frame).width).toBe("314px");
    expect(getComputedStyle(glass).backgroundColor).toBe("var(--card)");
    expect(getComputedStyle(glass).color).toBe("var(--foreground)");
    expect(getComputedStyle(time).color).toBe("var(--foreground)");
    expect(getComputedStyle(footer).backgroundColor).toBe("var(--card)");
    expect(getComputedStyle(footer.firstElementChild!).backgroundColor).toBe("var(--muted-foreground)");
    const status = time.nextElementSibling!;
    expect(getComputedStyle(status.firstElementChild!.firstElementChild!).backgroundColor).toBe("var(--foreground)");
    expect(getComputedStyle(status.lastElementChild!.firstElementChild!).backgroundColor).toBe("rgb(52, 199, 89)");
    expect(getComputedStyle(time.previousElementSibling!).backgroundColor).toBe("rgb(0, 0, 0)");
    expect(getComputedStyle(frame.children[1]).backgroundImage).toContain("linear-gradient(160deg");
    expect(screen.getByText("Preview content")).toBeTruthy();
  });

  it("keeps exports at native dimensions and navigates original artwork", () => {
    const slides = ["one", "two"].map((id) => ({ id, headline: `Artwork ${id}`, body: "Never overlay this copy", renderedAsset: true }));
    const media = slides.map((slide) => ({ slideId: slide.id, url: `https://example.test/${slide.id}.jpg`, width: 1080, height: 1350 }));
    render(<ThemeProvider theme={appThemes[mode]}><PhoneFrame><PlatformPreview platform="instagram" caption="Export caption" hashtags={["brand"]} slides={slides} media={media} /></PhoneFrame></ThemeProvider>);
    expect(screen.getByRole("article").className).toContain("bg-card text-card-foreground");
    expect(screen.getByText(/Export caption\s+#brand/)).toBeTruthy();
    const image = screen.getByRole("img", { name: "Artwork one" });
    expect(image.getAttribute("src")).toBe(media[0].url);
    expect(image.getAttribute("width")).toBe("1080");
    expect(image.getAttribute("height")).toBe("1350");
    expect(getComputedStyle(image).filter).toBe("");
    expect(screen.queryByText("Never overlay this copy")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show slide 2" }));
    expect(screen.getByRole("img", { name: "Artwork two" }).getAttribute("src")).toBe(media[1].url);
  });

  it("preserves structured thread copy", () => {
    render(<ThemeProvider theme={appThemes[mode]}><PlatformPreview platform="x" caption="" hashtags={[]} tweets={[{ text: "First tweet" }, { text: "Second tweet" }]} /></ThemeProvider>);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Second tweet")).toBeTruthy();
  });
});