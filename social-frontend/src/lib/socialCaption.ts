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

export function normalizeGeneratedText(value: string, includeEmojis = false): string {
  let text = value
    .replace(/^\s*```[^\n]*\n?/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*_]\s*){3,}$/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(?<!\w)([*_])([^\n]+?)\1(?!\w)/g, "$2")
    .replace(/`([^`]+)`/g, "$1");
  if (!includeEmojis) {
    text = text.replace(/(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)/gu, "");
  }
  return text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function formatPostBody(caption: string, hashtags: string[]): string {
  const body = trimPublisherText((caption ?? "").replace(/\r\n?/g, "\n"));
  const tagLine = formatTagsForDisplay(hashtags);
  return [body, tagLine].filter(Boolean).join("\n\n");
}

export function formatTagsForDisplay(hashtags: string[]): string {
  return (hashtags ?? []).filter((tag) => typeof tag === "string").map((tag) => trimPublisherText(trimPublisherText(tag).replace(/^#+/, ""))).filter(Boolean).map((tag) => `#${tag}`).join(" ");
}

function trimPublisherText(text: string): string {
  return text.replace(/^[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g, "");
}
