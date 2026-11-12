/** Public origins baked in at build time (Next.js NEXT_PUBLIC_*). */

export function publicUrl(value: string | undefined, fallback: string) {
  try {
    const url = new URL(value || fallback);
    return ["https:", "http:"].includes(url.protocol) ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

const marketingEnv =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_MARKETING_URL;

export const MARKETING_URL = publicUrl(
  marketingEnv,
  "https://earnedvoice.opsbrainai.com",
);

export const APP_URL = publicUrl(
  process.env.NEXT_PUBLIC_APP_URL,
  "https://peers.opsbrainai.com",
);

export const PRIVACY_URL = `${MARKETING_URL}/privacy`;
export const TERMS_URL = `${MARKETING_URL}/terms`;
