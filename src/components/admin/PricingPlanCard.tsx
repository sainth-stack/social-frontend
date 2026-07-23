"use client";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import { Box, Stack, Typography } from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import AppCard from "@/components/ui/AppCard";
import StatusChip from "@/components/ui/StatusChip";
import { formatCurrencyUsd } from "@/lib/format";
import { colors } from "@/lib/theme";
import type { PricingPlan } from "@/types/admin";

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.375 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 500, fontSize: "0.875rem" }}>{value}</Typography>
    </Box>
  );
}

function limitLabel(value: number | null): string {
  return value === null ? "Unlimited" : value.toLocaleString("en-US");
}

function BoolRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.375 }}>
      {enabled ? (
        <CheckCircleOutlineIcon sx={{ fontSize: 16, color: colors.primary }} />
      ) : (
        <CancelOutlinedIcon sx={{ fontSize: 16, color: colors.textMuted }} />
      )}
      <Typography variant="body2" color={enabled ? "text.primary" : "text.secondary"}>
        {label}
      </Typography>
    </Box>
  );
}

type PricingPlanCardProps = {
  plan: PricingPlan;
  onEdit: (plan: PricingPlan) => void;
};

export default function PricingPlanCard({ plan, onEdit }: PricingPlanCardProps) {
  return (
    <AppCard
      padding="lg"
      sx={{ height: "100%", display: "flex", flexDirection: "column", borderColor: plan.recommended ? colors.primary : undefined }}
      action={plan.recommended ? <StatusChip label="Recommended" variant="active" /> : undefined}
      title={plan.name}
      subtitle={plan.tagline}
    >
      <Box sx={{ mb: 2 }}>
        {plan.isCustom ? (
          <Typography sx={{ fontWeight: 700, fontSize: "1.5rem" }}>Custom</Typography>
        ) : (
          <>
            <Typography sx={{ fontWeight: 700, fontSize: "1.75rem", lineHeight: 1.1 }}>
              {formatCurrencyUsd(plan.priceMonthlyUsd ?? 0)}
              <Typography component="span" variant="body2" color="text.secondary">
                {" "}
                /mo
              </Typography>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatCurrencyUsd(plan.priceAnnualUsd ?? 0)} billed annually
            </Typography>
          </>
        )}
      </Box>

      <Stack spacing={0.25} sx={{ mb: 2 }}>
        <LimitRow label="Connected accounts" value={limitLabel(plan.limits.accounts)} />
        <LimitRow label="Posts / month" value={limitLabel(plan.limits.postsPerMonth)} />
        <LimitRow label="AI text generations" value={limitLabel(plan.limits.aiTextGenerations)} />
        <LimitRow label="AI image generations" value={limitLabel(plan.limits.aiImageGenerations)} />
        <LimitRow label="AI video generations" value={limitLabel(plan.limits.aiVideoGenerations)} />
        <LimitRow label="Content templates" value={limitLabel(plan.limits.templates)} />
      </Stack>

      <Stack spacing={0.25} sx={{ mb: 2, flex: 1 }}>
        <BoolRow label="Brand voice" enabled={plan.limits.brandVoice} />
        <BoolRow label="Approval workflow" enabled={plan.limits.approvalWorkflow} />
      </Stack>

      <AppButton variant="secondary" size="small" onClick={() => onEdit(plan)} sx={{ mt: "auto" }}>
        Edit plan
      </AppButton>
    </AppCard>
  );
}
