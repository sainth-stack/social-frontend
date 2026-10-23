import type { PricingPlan } from "@/types/admin";

/**
 * Fallback pricing catalog matching backend plan definitions.
 * DB keys: starter → Free, growth → Pro, enterprise → Growth.
 * New registrations start on Free. Pro ₹499/mo and Growth ₹999/mo via Razorpay checkout.
 */
export const DEFAULT_PRICING_CATALOG: PricingPlan[] = [
  {
    id: "starter",
    name: "Free",
    tagline: "Try the essentials with unlimited social accounts",
    priceMonthlyUsd: 0,
    priceAnnualUsd: 0,
    isCustom: false,
    limits: {
      accounts: null,
      postsPerMonth: 10,
      aiTextGenerations: 30,
      aiImageGenerations: 5,
      aiVideoGenerations: 0,
      templates: 3,
      brandVoice: true,
      approvalWorkflow: false,
    },
  },
  {
    id: "growth",
    name: "Pro",
    tagline: "Creators and solo businesses",
    priceMonthlyUsd: 99,
    priceMonthlyInr: 499,
    priceAnnualUsd: 990,
    isCustom: false,
    limits: {
      accounts: null,
      postsPerMonth: 100,
      aiTextGenerations: 300,
      aiImageGenerations: 50,
      aiVideoGenerations: 5,
      templates: 30,
      brandVoice: true,
      approvalWorkflow: true,
    },
  },
  {
    id: "enterprise",
    name: "Growth",
    tagline: "Growing brands and small teams",
    priceMonthlyUsd: 299,
    priceMonthlyInr: 999,
    priceAnnualUsd: 2990,
    isCustom: false,
    recommended: true,
    limits: {
      accounts: null,
      postsPerMonth: 500,
      aiTextGenerations: 1500,
      aiImageGenerations: 200,
      aiVideoGenerations: 20,
      templates: 100,
      brandVoice: true,
      approvalWorkflow: true,
    },
  },
];
