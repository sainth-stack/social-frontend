"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Typography } from "@mui/material";

import DateRangeControl from "@/components/social-media/analytics/DateRangeControl";
import TopPostsTable from "@/components/social-media/analytics/TopPostsTable";
import PageHeader from "@/components/ui/PageHeader";
import { selectUser } from "@/features/auth/authSlice";
import {
  selectAnalyticsDateRange,
  selectAnalyticsError,
  selectAnalyticsLoading,
  selectPostPerformance,
} from "@/features/social-media/socialAnalyticsSlice";
import { fetchPostPerformance } from "@/features/social-media/socialAnalyticsThunks";
import { surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export default function PostPerformance() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const range = useAppSelector(selectAnalyticsDateRange);
  const items = useAppSelector(selectPostPerformance);
  const loading = useAppSelector(selectAnalyticsLoading);
  const error = useAppSelector(selectAnalyticsError);
  const [sortKey, setSortKey] = useState("engagementRate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!orgId) return;
    void dispatch(
      fetchPostPerformance({
        orgId,
        from: range.from,
        to: range.to,
        sort: sortKey,
        order: sortOrder,
      }),
    );
  }, [dispatch, orgId, range.from, range.to, sortKey, sortOrder]);

  const onSort = (key: string) => {
    if (key === sortKey) {
      setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const exportCsv = () => {
    const header = [
      "caption",
      "platform",
      "publishedAt",
      "reach",
      "impressions",
      "likes",
      "comments",
      "shares",
      "engagementRate",
    ];
    const lines = [
      header.join(","),
      ...items.map((i) =>
        [
          JSON.stringify(i.caption),
          i.platform,
          i.publishedAt ?? "",
          i.reach,
          i.impressions,
          i.likes,
          i.comments,
          i.shares,
          i.engagementRate,
        ].join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `social-post-performance-${range.from}-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <PageHeader
        title="Post Performance"
        subtitle="Rank posts by reach, engagement, and clicks"
        secondaryAction={<DateRangeControl />}
        primaryAction={
          <Box
            component="button"
            onClick={exportCsv}
            sx={{
              border: `1px solid`,
              borderColor: "divider",
              bgcolor: "background.paper",
              borderRadius: "8px",
              px: 1.5,
              py: 0.75,
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Export CSV
          </Box>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && items.length === 0 ? (
        <Box sx={{ ...surfaceSx, p: 6, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>No published posts</Typography>
          <Typography color="text.secondary">
            Analytics appear after posts are published.
          </Typography>
        </Box>
      ) : (
        <TopPostsTable
          items={items}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={onSort}
        />
      )}
    </Box>
  );
}
