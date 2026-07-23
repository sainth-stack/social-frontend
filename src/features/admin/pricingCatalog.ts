import type { PricingPlan } from "@/types/admin";

/**
 * Fallback pricing catalog matching the backend plan definitions.
 * Used to render the Pricing tab before the admin API responds (and as
 * the source of truth for limit copy shown to end users on /dashboard/billing).
 */
export const DEFAULT_PRICING_CATALOG: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For solo creators getting consistent on social",
    priceMonthlyUsd: 399,
    priceAnnualUsd: 3830,
    isCustom: false,
    limits: {
      accounts: 3,
      postsPerMonth: 60,
      aiTextGenerations: 150,
      aiImageGenerations: 60,
      aiVideoGenerations: 10,
      templates: 10,
      brandVoice: false,
      approvalWorkflow: false,
    },
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For marketing teams scaling multi-platform content",
    priceMonthlyUsd: 1499,
    priceAnnualUsd: 14390,
    isCustom: false,
    recommended: true,
    limits: {
      accounts: 10,
      postsPerMonth: 300,
      aiTextGenerations: 800,
      aiImageGenerations: 300,
      aiVideoGenerations: 60,
      templates: 50,
      brandVoice: true,
      approvalWorkflow: true,
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For agencies and large brands with custom needs",
    priceMonthlyUsd: null,
    priceAnnualUsd: null,
    isCustom: true,
    limits: {
      accounts: null,
      postsPerMonth: null,
      aiTextGenerations: null,
      aiImageGenerations: null,
      aiVideoGenerations: null,
      templates: null,
      brandVoice: true,
      approvalWorkflow: true,
    },
  },
];
