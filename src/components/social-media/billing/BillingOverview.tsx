"use client";

import { useEffect, useState } from "react";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import { Alert, Box, LinearProgress, Stack, Typography } from "@mui/material";

import socialMediaApi from "@/api/endpoints/social-media.api";
import AppButton from "@/components/ui/AppButton";
import AppCard from "@/components/ui/AppCard";
import LoadingState from "@/components/ui/LoadingState";
import PageHeader from "@/components/ui/PageHeader";
import { PlanBadge } from "@/components/ui/StatusChip";
import { selectUser } from "@/features/auth/authSlice";
import { DEFAULT_PRICING_CATALOG } from "@/features/admin/pricingCatalog";
import { colors } from "@/lib/theme";
import { useAppSelector } from "@/store/hooks";
import type { PlanTier } from "@/types/auth";
import type { SocialDashboardStats } from "@/types/social-media.types";

const CONTACT_EMAIL = "sales@opsbrain.ai";

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isNearLimit = limit != null && used / limit >= 0.8;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {used.toLocaleString()} / {limit === null ? "Unlimited" : limit.toLocaleString()}
        </Typography>
      </Box>
      {limit !== null ? (
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 8,
            borderRadius: 999,
            bgcolor: colors.background,
            "& .MuiLinearProgress-bar": {
              borderRadius: 999,
              bgcolor: isNearLimit ? colors.error : colors.primary,
            },
          }}
        />
      ) : (
        <Box sx={{ height: 8, borderRadius: 999, bgcolor: colors.primaryLight }} />
      )}
    </Box>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      {enabled ? (
        <CheckCircleOutlineIcon sx={{ fontSize: 18, color: colors.primary }} />
      ) : (
        <CancelOutlinedIcon sx={{ fontSize: 18, color: colors.textMuted }} />
      )}
      <Typography variant="body2" color={enabled ? "text.primary" : "text.secondary"}>
        {label}
      </Typography>
    </Box>
  );
}

export default function BillingOverview() {
  const user = useAppSelector(selectUser);
  const workspaceId = user?.workspaceId ?? "";
  const [stats, setStats] = useState<SocialDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    setLoading(true);
    socialMediaApi
      .getDashboardStats(workspaceId)
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(() => {
        if (active) setError("Failed to load your current usage.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const planId: PlanTier = user?.plan ?? "starter";
  const plan = DEFAULT_PRICING_CATALOG.find((p) => p.id === planId) ?? DEFAULT_PRICING_CATALOG[0];
  const usage = stats?.usage;

  const upgradeHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `Upgrade request — ${user?.workspaceName ?? "workspace"}`,
  )}`;

  return (
    <Box>
      <PageHeader
        title="Billing & Plan"
        subtitle="Review your current plan, usage, and upgrade options."
      />

      {error ? (
        <Alert severity="warning" sx={{ mb: 2.5 }}>
          {error}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <AppCard title="Current usage" subtitle="This billing cycle">
          {loading ? (
            <LoadingState variant="inline" />
          ) : (
            <Stack spacing={2.5}>
              <UsageBar
                label="Connected accounts"
                used={usage?.accounts.used ?? 0}
                limit={usage?.accounts.limit ?? plan.limits.accounts}
              />
              <UsageBar
                label="Posts this month"
                used={usage?.postsThisMonth.used ?? 0}
                limit={usage?.postsThisMonth.limit ?? plan.limits.postsPerMonth}
              />
              <UsageBar
                label="Templates"
                used={usage?.templates.used ?? 0}
                limit={usage?.templates.limit ?? plan.limits.templates}
              />
            </Stack>
          )}
        </AppCard>

        <AppCard
          title="Your plan"
          action={<PlanBadge plan={plan.name} />}
        >
          <Stack spacing={2}>
            <Box>
              {plan.isCustom ? (
                <Typography sx={{ fontWeight: 700, fontSize: "1.75rem" }}>Custom</Typography>
              ) : (
                <Typography sx={{ fontWeight: 700, fontSize: "1.75rem", lineHeight: 1.1 }}>
                  ${plan.priceMonthlyUsd?.toLocaleString()}
                  <Typography component="span" variant="body2" color="text.secondary">
                    {" "}
                    /mo
                  </Typography>
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                {plan.tagline}
              </Typography>
            </Box>

            <Stack spacing={0.75}>
              <FeatureRow label="Brand voice" enabled={plan.limits.brandVoice} />
              <FeatureRow label="Approval workflow" enabled={plan.limits.approvalWorkflow} />
            </Stack>

            <AppButton variant="primary" component="a" href={upgradeHref} fullWidth>
              {planId === "enterprise" ? "Contact your account manager" : "Talk to sales about upgrading"}
            </AppButton>
          </Stack>
        </AppCard>
      </Box>
    </Box>
  );
}
