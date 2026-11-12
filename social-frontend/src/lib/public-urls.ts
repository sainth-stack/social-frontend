/** Public marketing + app origins (NEXT_PUBLIC_* at build time). No imports outside this app. */

function publicUrl(value: string | undefined, fallback: string) {
  try {
    const url = new URL(value || fallback);
    return ["https:", "http:"].includes(url.protocol) ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

const marketingEnv =
  process.env.NEXT_PUBLIC_MARKETING_URL ?? process.env.NEXT_PUBLIC_SITE_URL;

export const MARKETING_URL = publicUrl(
  marketingEnv,
  "https://earnedvoice.opsbrainai.com",
);

export const APP_URL = publicUrl(
  process.env.NEXT_PUBLIC_APP_URL,
  "https://peers.opsbrainai.com",
);

/** Legal pages are served on the marketing site; auth links open these in a new tab. */
export const PRIVACY_URL = `${MARKETING_URL}/privacy`;
export const TERMS_URL = `${MARKETING_URL}/terms`;
