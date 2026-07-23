"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import MetricGrid from "@/components/ui/MetricGrid";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { selectUser } from "@/features/auth/authSlice";
import { colors, surfaceSx } from "@/lib/theme";
import { useAppSelector } from "@/store/hooks";
import type {
  SocialActivityItem,
  SocialDashboardStats,
} from "@/types/social-media.types";
import { PLATFORM_LABELS } from "@/types/social-media.types";

export default function SocialDashboard() {
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const [stats, setStats] = useState<SocialDashboardStats | null>(null);
  const [activity, setActivity] = useState<SocialActivityItem[]>([]);
  const [recs, setRecs] = useState<Array<{ topic: string; reason: string }>>([]);
  const [upcoming, setUpcoming] = useState<
    Array<{ id: string; title: string; scheduledAt: string | null; caption: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [s, a, r, posts] = await Promise.all([
        socialMediaApi.getDashboardStats(orgId),
        socialMediaApi.getActivity(orgId, 10),
        socialMediaApi.getRecommendations(orgId),
        socialMediaApi.listPosts(orgId, { status: "scheduled", pageSize: 5 }),
      ]);
      setStats(s);
      setActivity(a);
      setRecs(r);
      setUpcoming(
        posts.items.map((p) => ({
          id: p.id,
          title: p.title,
          scheduledAt: p.scheduledAt,
          caption: p.platforms[0]?.caption || p.title || "",
        })),
      );
    } catch {
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const noAccounts = !loading && (stats?.connectedAccounts ?? 0) === 0;
  const usage = stats?.usage;

  return (
    <Box>
      <PageHeader
        title="Social Media"
        subtitle="Manage your AI-powered social presence"
        primaryAction={
          <AppButton
            variant="primary"
            component={Link}
            href="/dashboard/content-studio/generate"
          >
            New Post
          </AppButton>
        }
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => void load()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {usage && usage.postsThisMonth.limit != null && usage.postsThisMonth.used / usage.postsThisMonth.limit >= 0.8 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You have used {usage.postsThisMonth.used} of {usage.postsThisMonth.limit} posts this month
          on the {usage.plan} plan.
          {usage.postsThisMonth.used >= usage.postsThisMonth.limit
            ? " Upgrade to publish more."
            : " Approaching your plan limit."}
        </Alert>
      )}

      {loading ? (
        <MetricGrid sx={{ mb: 3 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={96} />
          ))}
        </MetricGrid>
      ) : (
        <MetricGrid sx={{ mb: 3 }}>
          <StatCard title="Connected Accounts" value={stats?.connectedAccounts ?? 0} />
          <StatCard title="Posts This Week" value={stats?.postsThisWeek ?? 0} />
          <StatCard title="Total Reach" value={(stats?.totalReach ?? 0).toLocaleString()} />
          <StatCard
            title="Avg Engagement"
            value={`${((stats?.avgEngagementRate ?? 0) * 100).toFixed(1)}%`}
          />
        </MetricGrid>
      )}

      {noAccounts ? (
        <Box sx={{ ...surfaceSx, p: 6, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>Connect your first account</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Link Facebook, Instagram, LinkedIn, or X to start publishing.
          </Typography>
          <AppButton variant="primary" component={Link} href="/dashboard/accounts">
            Connect account
          </AppButton>
        </Box>
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ ...surfaceSx, p: 2.5, height: "100%" }}>
              <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Accounts</Typography>
              <Stack spacing={1}>
                {(stats?.accounts ?? []).map((a) => (
                  <Box
                    key={a.id}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>
                        {PLATFORM_LABELS[a.platform]}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {a.accountName} · {a.followerCount.toLocaleString()} followers
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={a.tokenStatus.replace("_", " ")}
                      color={
                        a.tokenStatus === "active"
                          ? "success"
                          : a.tokenStatus === "expired"
                            ? "error"
                            : "warning"
                      }
                    />
                  </Box>
                ))}
                {(stats?.expiredAccounts ?? 0) > 0 && (
                  <AppButton
                    variant="secondary"
                    component={Link}
                    href="/dashboard/accounts"
                  >
                    Reconnect expired
                  </AppButton>
                )}
              </Stack>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ ...surfaceSx, p: 2.5, height: "100%" }}>
              <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Upcoming posts</Typography>
              {upcoming.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No scheduled posts.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {upcoming.map((p) => (
                    <Box key={p.id}>
                      <Typography
                        component={Link}
                        href={`/dashboard/posts/${p.id}`}
                        sx={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "inherit",
                          textDecoration: "none",
                          display: "block",
                        }}
                      >
                        {p.caption.slice(0, 60) || p.title || "Untitled"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {p.scheduledAt
                          ? new Date(p.scheduledAt).toLocaleString()
                          : "Unscheduled"}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ ...surfaceSx, p: 2.5, height: "100%" }}>
              <Typography sx={{ fontWeight: 600, mb: 1.5 }}>Recent activity</Typography>
              {activity.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No activity yet.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {activity.map((item) => (
                    <Box key={item.id}>
                      <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                        {item.action}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString()
                          : ""}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Box sx={{ ...surfaceSx, p: 2.5 }}>
              <Typography sx={{ fontWeight: 600, mb: 1.5 }}>AI recommendations</Typography>
              <Grid container spacing={2}>
                {recs.map((rec) => (
                  <Grid key={rec.topic} size={{ xs: 12, md: 4 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: "10px",
                        bgcolor: colors.background,
                        border: `1px solid ${colors.border}`,
                        height: "100%",
                      }}
                    >
                      <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{rec.topic}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {rec.reason}
                      </Typography>
                      <AppButton
                        variant="secondary"
                        size="small"
                        component={Link}
                        href={`/dashboard/content-studio/generate?topic=${encodeURIComponent(rec.topic)}`}
                      >
                        Use topic
                      </AppButton>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
