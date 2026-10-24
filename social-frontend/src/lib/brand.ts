export const platformBrand = {
  mark: "/brand/earnedvoice-mark.svg",
  lockup: "/brand/earnedvoice-lockup.svg",
  /** Full wordmark viewBox width / height (Ascent lockup). */
  lockupAspect: 660 / 144,
  name: "EarnedVoice",
  suffix: "",
  marketingUrl: process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://opsbrainai.com",
} as const;

export const DEMO_ORG_ID = "org_1";
