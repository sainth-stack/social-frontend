import { APP_URL, MARKETING_URL, PRIVACY_URL, TERMS_URL } from "@shared/content/public-urls";

export const platformBrand = {
  mark: "/brand/earnedvoice-mark.svg",
  lockup: "/brand/earnedvoice-lockup.svg",
  /** Full wordmark viewBox width / height (Ascent lockup). */
  lockupAspect: 660 / 144,
  name: "EarnedVoice",
  suffix: "",
  marketingUrl: MARKETING_URL,
  appUrl: APP_URL,
} as const;

export const legalUrls = {
  privacy: PRIVACY_URL,
  terms: TERMS_URL,
} as const;

export const DEMO_ORG_ID = "org_1";
