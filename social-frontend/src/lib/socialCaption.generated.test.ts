import { describe, expect, it } from "vitest";
import { normalizeGeneratedText, sanitizeCaptionAndHashtags } from "./socialCaption";

describe("generated plain text defense", () => {
  it("normalizes markdown before hashtag extraction without treating a heading as a hashtag", () => {
    const cleaned = normalizeGeneratedText("## Launch update\n**Useful** _ideas_ for teams.\n---\n#Business");
    expect(sanitizeCaptionAndHashtags(cleaned, [])).toEqual({ caption: "Launch update\nUseful ideas for teams.", hashtags: ["Business"] });
  });

  it("removes complete emoji sequences while preserving multilingual copy, numbers, URLs, and punctuation", () => {
    const text = "👨‍👩‍👧‍👦 👍🏽 🇮🇳 1️⃣ #️⃣ 🚀\nதமிழ் café C# costs $20. Visit https://example.test/a_b?q=1";
    expect(normalizeGeneratedText(text)).toBe("தமிழ் café C# costs $20. Visit https://example.test/a_b?q=1");
    expect(normalizeGeneratedText("Useful 🚀 ideas", true)).toBe("Useful 🚀 ideas");
  });

  it("keeps historic authored formatting untouched by the existing caption sanitizer", () => {
    expect(sanitizeCaptionAndHashtags("**Authored** 🚀", []).caption).toBe("**Authored** 🚀");
  });
});