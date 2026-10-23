import type { PlanTier } from "@/types/auth";

/** Display names for DB plan keys: starter → Free, growth → Pro, enterprise → Growth */
export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  starter: "Free",
  growth: "Pro",
  enterprise: "Growth",
};

export function planDisplayName(plan: PlanTier | string | undefined | null): string {
  if (!plan) return "Free";
  const key = String(plan).toLowerCase();
  return PLAN_DISPLAY_NAMES[key] ?? plan.charAt(0).toUpperCase() + plan.slice(1);
}

/** Multi A/B caption versions: Pro + Growth (not Free). */
export function canUseMultiVariations(plan: PlanTier | string | undefined | null): boolean {
  const key = String(plan ?? "starter").toLowerCase();
  return key === "growth" || key === "enterprise";
}

/** Max days for AI content plan generate (matches backend PLAN_DAY_CAP). */
export function contentPlanDayCap(plan: PlanTier | string | undefined | null): 7 | 15 | 30 {
  const key = String(plan ?? "starter").toLowerCase();
  if (key === "enterprise") return 30;
  if (key === "growth") return 15;
  return 7;
}
