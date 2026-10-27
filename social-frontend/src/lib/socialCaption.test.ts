import { describe, expect, it } from "vitest";
import fixtures from "./socialCaption.fixtures.json";
import { formatPostBody, formatTagsForDisplay } from "./socialCaption";

describe("publisher body contract", () => {
  it.each(fixtures)("$name", ({ caption, hashtags, expected }) => {
    expect(formatPostBody(caption, hashtags)).toBe(expected);
  });

  it("preserves order and duplicates without extracting inline tags or capping authored tags", () => {
    const tags = Array.from({ length: 40 }, () => "##Same");
    expect(formatTagsForDisplay(tags)).toBe(Array(40).fill("#Same").join(" "));
    expect(formatPostBody("#Authored", tags)).toBe(`#Authored\n\n${Array(40).fill("#Same").join(" ")}`);
  });
});