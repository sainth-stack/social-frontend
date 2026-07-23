/** OpsBrain platform brand */
export const platformBrand = {
  mark: "/favicon.png",
  name: "OpsBrain",
  suffix: "AI",
  marketingUrl: process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://opsbrainai.com",
} as const;

/** Demo org admin uses platform logo in the sidebar (not a client upload). */
export const DEMO_ORG_ID = "org_1";
