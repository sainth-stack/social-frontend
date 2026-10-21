/** Keep caption body and hashtags separate — no duplicate #tags in preview or publish. */

const HASHTAG_TOKEN = /#([A-Za-z][\w]{1,})/g;
const TRAILING_HASHTAG_RUN = /(?:\s+#[A-Za-z][\w]{1,})+\s*$/;

function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().replace(/^#/, "");
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export function extractInlineHashtags(caption: string): string[] {
  const found: string[] = [];
  const text = caption ?? "";
  let match: RegExpExecArray | null;
  const re = new RegExp(HASHTAG_TOKEN.source, "g");
  while ((match = re.exec(text)) !== null) {
    found.push(match[1]);
  }
  return found;
}

export function stripHashtagsFromCaption(caption: string): string {
  let text = (caption ?? "").trim();
  if (!text) return "";

  const lines = text.split("\n").map((line) => {
    const stripped = line.trim();
    if (!stripped) return "";
    const withoutTags = stripped.replace(HASHTAG_TOKEN, "").trim();
    if (!withoutTags && HASHTAG_TOKEN.test(stripped)) return "";
    return line.replace(HASHTAG_TOKEN, "").replace(/[ \t]+$/g, "");
  });

  text = lines.join("\n").trim();
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(TRAILING_HASHTAG_RUN, "").trim();
  return text;
}

export function sanitizeCaptionAndHashtags(
  caption: string,
  hashtags: string[],
  maxTags = 30,
): { caption: string; hashtags: string[] } {
  const inline = extractInlineHashtags(caption);
  const cleanCaption = stripHashtagsFromCaption(caption);
  const merged = dedupeTags([...hashtags, ...inline]).slice(0, maxTags);
  return { caption: cleanCaption, hashtags: merged };
}

/** Caption + hashtags as shown on LinkedIn/Facebook (one blank line between). */
export function formatPostBody(caption: string, hashtags: string[]): string {
  const { caption: body, hashtags: tags } = sanitizeCaptionAndHashtags(caption, hashtags);
  const tagLine = tags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  return [body, tagLine].filter(Boolean).join("\n\n");
}

export function formatTagsForDisplay(hashtags: string[]): string {
  return dedupeTags(hashtags).map((h) => `#${h.replace(/^#/, "")}`).join(" ");
}
