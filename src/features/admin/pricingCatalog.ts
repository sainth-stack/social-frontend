import type { PricingPlan } from "@/types/admin";

/**
 * Fallback pricing catalog matching backend plan definitions.
 * DB keys: starter → Free, growth → Pro, enterprise → Growth.
 * New registrations start on Free. Pro / Growth are admin-assigned.
 */
export const DEFAULT_PRICING_CATALOG: PricingPlan[] = [
  {
    id: "starter",
    name: "Free",
    tagline: "Brand voice included — 2 accounts and AI content basics",
    priceMonthlyUsd: 0,
    priceAnnualUsd: 0,
    isCustom: false,
    limits: {
      accounts: 2,
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
    tagline: "More posts, approval workflow, and multi-version AI",
    priceMonthlyUsd: 99,
    priceAnnualUsd: 990,
    isCustom: false,
    recommended: true,
    limits: {
      accounts: 10,
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
    tagline: "For agencies and larger brands scaling content",
    priceMonthlyUsd: 299,
    priceAnnualUsd: 2990,
    isCustom: false,
    limits: {
      accounts: 50,
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
