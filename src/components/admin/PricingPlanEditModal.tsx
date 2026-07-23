"use client";

import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import AppCheckbox from "@/components/ui/AppCheckbox";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";
import type { PlanLimits, PricingPlan } from "@/types/admin";

type FormState = {
  tagline: string;
  priceMonthlyUsd: string;
  priceAnnualUsd: string;
  accounts: string;
  postsPerMonth: string;
  aiTextGenerations: string;
  aiImageGenerations: string;
  aiVideoGenerations: string;
  templates: string;
  brandVoice: boolean;
  approvalWorkflow: boolean;
};

function toFieldValue(value: number | null): string {
  return value === null ? "" : String(value);
}

function toLimitValue(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function formFromPlan(plan: PricingPlan): FormState {
  return {
    tagline: plan.tagline,
    priceMonthlyUsd: plan.priceMonthlyUsd === null ? "" : String(plan.priceMonthlyUsd),
    priceAnnualUsd: plan.priceAnnualUsd === null ? "" : String(plan.priceAnnualUsd),
    accounts: toFieldValue(plan.limits.accounts),
    postsPerMonth: toFieldValue(plan.limits.postsPerMonth),
    aiTextGenerations: toFieldValue(plan.limits.aiTextGenerations),
    aiImageGenerations: toFieldValue(plan.limits.aiImageGenerations),
    aiVideoGenerations: toFieldValue(plan.limits.aiVideoGenerations),
    templates: toFieldValue(plan.limits.templates),
    brandVoice: plan.limits.brandVoice,
    approvalWorkflow: plan.limits.approvalWorkflow,
  };
}

type PricingPlanEditModalProps = {
  plan: PricingPlan | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: { tagline: string; priceMonthlyUsd: number | null; priceAnnualUsd: number | null; limits: PlanLimits }) => void;
};

export default function PricingPlanEditModal({ plan, saving = false, onClose, onSave }: PricingPlanEditModalProps) {
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    setForm(plan ? formFromPlan(plan) : null);
  }, [plan]);

  if (!plan || !form) {
    return <AppModal open={false} onClose={onClose} title="" />;
  }

  const handleSave = () => {
    onSave({
      tagline: form.tagline.trim(),
      priceMonthlyUsd: plan.isCustom ? null : (Number(form.priceMonthlyUsd) || 0),
      priceAnnualUsd: plan.isCustom ? null : (Number(form.priceAnnualUsd) || 0),
      limits: {
        accounts: toLimitValue(form.accounts),
        postsPerMonth: toLimitValue(form.postsPerMonth),
        aiTextGenerations: toLimitValue(form.aiTextGenerations),
        aiImageGenerations: toLimitValue(form.aiImageGenerations),
        aiVideoGenerations: toLimitValue(form.aiVideoGenerations),
        templates: toLimitValue(form.templates),
        brandVoice: form.brandVoice,
        approvalWorkflow: form.approvalWorkflow,
      },
    });
  };

  return (
    <AppModal
      open={Boolean(plan)}
      onClose={onClose}
      title={`Edit ${plan.name} plan`}
      description="Update pricing and usage limits. Leave a limit blank for unlimited."
      maxWidth="sm"
      footer={
        <>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </AppButton>
          <AppButton onClick={handleSave} loading={saving}>
            Save changes
          </AppButton>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5, pb: 1 }}>
        <AppInput
          label="Tagline"
          value={form.tagline}
          onChange={(e) => setForm((prev) => (prev ? { ...prev, tagline: e.target.value } : prev))}
        />

        {!plan.isCustom ? (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <AppInput
              label="Price / month (USD)"
              type="number"
              value={form.priceMonthlyUsd}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, priceMonthlyUsd: e.target.value } : prev))}
            />
            <AppInput
              label="Price / year (USD)"
              type="number"
              value={form.priceAnnualUsd}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, priceAnnualUsd: e.target.value } : prev))}
            />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Enterprise pricing is custom — contact sales handles quoting.
          </Typography>
        )}

        <Typography sx={{ fontWeight: 600, fontSize: "0.8125rem", mt: 0.5 }}>
          Usage limits (blank = unlimited)
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
          <AppInput
            label="Connected accounts"
            type="number"
            value={form.accounts}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, accounts: e.target.value } : prev))}
          />
          <AppInput
            label="Posts / month"
            type="number"
            value={form.postsPerMonth}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, postsPerMonth: e.target.value } : prev))}
          />
          <AppInput
            label="AI text / month"
            type="number"
            value={form.aiTextGenerations}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, aiTextGenerations: e.target.value } : prev))}
          />
          <AppInput
            label="AI images / month"
            type="number"
            value={form.aiImageGenerations}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, aiImageGenerations: e.target.value } : prev))}
          />
          <AppInput
            label="AI video / month"
            type="number"
            value={form.aiVideoGenerations}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, aiVideoGenerations: e.target.value } : prev))}
          />
          <AppInput
            label="Templates"
            type="number"
            value={form.templates}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, templates: e.target.value } : prev))}
          />
        </Box>

        <Box sx={{ display: "flex", gap: 2 }}>
          <AppCheckbox
            checked={form.brandVoice}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, brandVoice: e.target.checked } : prev))}
            label="Brand voice"
          />
          <AppCheckbox
            checked={form.approvalWorkflow}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, approvalWorkflow: e.target.checked } : prev))}
            label="Approval workflow"
          />
        </Box>
      </Box>
    </AppModal>
  );
}
