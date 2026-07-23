"use client";

import { useEffect, useState } from "react";
import { Alert, Box } from "@mui/material";

import PricingPlanCard from "@/components/admin/PricingPlanCard";
import PricingPlanEditModal from "@/components/admin/PricingPlanEditModal";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
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
      setEditingPlan(null);
    } catch {
      // error surfaced via selectPricingError, keep modal open for retry
    }
  };

  return (
    <Box>
      <PageHeader
        title="Pricing"
        subtitle="Manage the plans and usage limits offered to workspaces."
      />

      {isFallback ? (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          Showing the default plan catalog — connect the admin pricing API to load and persist live plans.
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="warning" sx={{ mb: 2.5 }}>
          {error}
        </Alert>
      ) : null}

      {loading && plans.length === 0 ? (
        <LoadingState variant="card" />
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 2.5,
          }}
        >
          {plans.map((plan) => (
            <PricingPlanCard key={plan.id} plan={plan} onEdit={setEditingPlan} />
          ))}
        </Box>
      )}

      <PricingPlanEditModal
        plan={editingPlan}
        saving={saving}
        onClose={() => setEditingPlan(null)}
        onSave={(payload) => void handleSave(payload)}
      />
    </Box>
  );
}
