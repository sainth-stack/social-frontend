"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Skeleton, Stack, Typography } from "@mui/material";

import AppSelect from "@/components/ui/AppSelect";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { selectUser } from "@/features/auth/authSlice";
import { enqueueToast } from "@/features/ui/uiSlice";
import { socialPermissionLabel } from "@/lib/permissions";
import { surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { SocialPermissionLevel } from "@/types/auth";

type TeamPermissionRow = {
  userId: string;
  name: string;
  email: string;
  permission: string;
};

const LEVELS: SocialPermissionLevel[] = ["viewer", "editor", "publisher", "admin"];

export default function SocialTeamPermissions() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const [rows, setRows] = useState<TeamPermissionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    void socialMediaApi
      .listTeamPermissions(orgId)
      .then((data) => setRows(data as TeamPermissionRow[]))
      .catch(() => setError("Failed to load team permissions"));
  }, [orgId]);

  const handleChange = async (userId: string, permission: string) => {
    if (!orgId) return;
    setSavingId(userId);
    try {
      await socialMediaApi.updateTeamPermission(orgId, userId, permission);
      setRows((prev) =>
        prev ? prev.map((r) => (r.userId === userId ? { ...r, permission } : r)) : prev,
      );
      dispatch(enqueueToast({ message: "Permission updated", severity: "success" }));
    } catch {
      dispatch(enqueueToast({ message: "Failed to update permission", severity: "error" }));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Team"
        subtitle="Set the social media permission level for each teammate."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ ...surfaceSx, p: 0, overflow: "hidden" }}>
        {rows === null ? (
          <Stack sx={{ p: 2.5 }} spacing={1.5}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={48} />
            ))}
          </Stack>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No team members yet"
            description="Invite teammates to your workspace to assign social permissions."
          />
        ) : (
          <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
            {rows.map((row) => (
              <Box
                key={row.userId}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  p: 2,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: "0.875rem" }}>{row.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.email}
                  </Typography>
                </Box>
                <AppSelect
                  value={row.permission}
                  disabled={savingId === row.userId}
                  onChange={(e) => void handleChange(row.userId, String(e.target.value))}
                  options={LEVELS.map((level) => ({ value: level, label: socialPermissionLabel(level) }))}
                  sx={{ minWidth: 160 }}
                />
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
