"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import PricingPlanCard from "@/components/admin/PricingPlanCard";
import PricingPlanEditModal from "@/components/admin/PricingPlanEditModal";
import {
  selectPricingError,
  selectPricingIsFallback,
  selectPricingLoading,
  selectPricingPlans,
  selectPricingSaving,
} from "@/features/admin/adminSelectors";
import { fetchPricingPlans, updatePricingPlan } from "@/features/admin/adminThunks";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { PlanLimits, PricingPlan } from "@/types/admin";

export default function AdminPricing() {
  const dispatch = useAppDispatch();
  const plans = useAppSelector(selectPricingPlans);
  const loading = useAppSelector(selectPricingLoading);
  const saving = useAppSelector(selectPricingSaving);
  const error = useAppSelector(selectPricingError);
  const isFallback = useAppSelector(selectPricingIsFallback);

  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);

  useEffect(() => {
    void dispatch(fetchPricingPlans());
  }, [dispatch]);

  const handleSave = async (payload: {
    tagline: string;
    priceMonthlyUsd: number | null;
    priceAnnualUsd: number | null;
    limits: PlanLimits;
  }) => {
    if (!editingPlan) return;
    try {
      await dispatch(updatePricingPlan({ planId: editingPlan.id, payload })).unwrap();
      toast.success(`${editingPlan.name} plan updated`);
      setEditingPlan(null);
    } catch {
      toast.error("Could not update plan");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
        <p className="text-sm text-muted-foreground">
          Manage plan limits offered to workspaces. Admins assign plans — no Stripe checkout.
        </p>
      </header>

      {isFallback ? (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Showing the default plan catalog — connect the admin pricing API to persist live
          plans.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      {loading && plans.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PricingPlanCard key={plan.id} plan={plan} onEdit={setEditingPlan} />
          ))}
        </div>
      )}

      <PricingPlanEditModal
        plan={editingPlan}
        saving={saving}
        onClose={() => setEditingPlan(null)}
        onSave={(payload) => void handleSave(payload)}
      />
    </div>
  );
}
