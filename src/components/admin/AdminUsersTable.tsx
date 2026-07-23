"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Box } from "@mui/material";

import ChangePlanModal from "@/components/admin/ChangePlanModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DataTable, { TablePrimaryText, TableSecondaryText } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import SearchFilterBar from "@/components/ui/SearchFilterBar";
import StatusChip, { PlanBadge } from "@/components/ui/StatusChip";
import {
  selectAdminUsers,
  selectAdminUsersError,
  selectAdminUsersLoading,
} from "@/features/admin/adminSelectors";
import {
  changeAdminUserPlan,
  fetchAdminUsers,
  suspendAdminUser,
} from "@/features/admin/adminThunks";
import { formatDate } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { AdminUser } from "@/types/admin";
import type { PlanTier } from "@/types/auth";

const PLAN_FILTER_OPTIONS = [
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "enterprise", label: "Enterprise" },
];

export default function AdminUsersTable() {
  const dispatch = useAppDispatch();
  const users = useAppSelector(selectAdminUsers);
  const loading = useAppSelector(selectAdminUsersLoading);
  const error = useAppSelector(selectAdminUsersError);

  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [planTarget, setPlanTarget] = useState<AdminUser | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    void dispatch(fetchAdminUsers());
  }, [dispatch]);

  const filtered = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        search.trim() === "" ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.workspaceName.toLowerCase().includes(search.toLowerCase());
      const matchesPlan = planFilter === "all" || user.plan === planFilter;
      return matchesSearch && matchesPlan;
    });
  }, [users, search, planFilter]);

  const handleSuspendConfirm = async () => {
    if (!suspendTarget) return;
    setActionLoading(true);
    try {
      await dispatch(
        suspendAdminUser({ userId: suspendTarget.id, suspended: suspendTarget.status !== "suspended" }),
      ).unwrap();
    } catch {
      // error surfaced via selectAdminUsersError
    } finally {
      setActionLoading(false);
      setSuspendTarget(null);
    }
  };

  const handlePlanConfirm = async (plan: PlanTier) => {
    if (!planTarget) return;
    setActionLoading(true);
    try {
      await dispatch(changeAdminUserPlan({ userId: planTarget.id, plan })).unwrap();
    } catch {
      // error surfaced via selectAdminUsersError
    } finally {
      setActionLoading(false);
      setPlanTarget(null);
    }
  };

  return (
    <Box>
      <PageHeader title="Users" subtitle="Every account across all workspaces on the platform." />

      {error ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error} — connect the admin API to manage real users.
        </Alert>
      ) : null}

      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email, or workspace"
        filterValue={planFilter}
        onFilterChange={setPlanFilter}
        filterOptions={PLAN_FILTER_OPTIONS}
        filterLabel="Plan"
      />

      <DataTable
        rows={filtered}
        getRowId={(row) => row.id}
        loading={loading}
        emptyMessage="No users found"
        emptyDescription="Once the admin API is connected, registered users will appear here."
        columns={[
          {
            id: "user",
            label: "User",
            emphasis: "primary",
            render: (row) => (
              <Box>
                <TablePrimaryText>{row.name}</TablePrimaryText>
                <TableSecondaryText>{row.email}</TableSecondaryText>
              </Box>
            ),
          },
          { id: "workspace", label: "Workspace", render: (row) => row.workspaceName },
          {
            id: "plan",
            label: "Plan",
            render: (row) => <PlanBadge plan={row.plan.charAt(0).toUpperCase() + row.plan.slice(1)} />,
          },
          {
            id: "status",
            label: "Status",
            render: (row) => (
              <StatusChip
                label={row.status}
                variant={row.status === "active" ? "active" : "failed"}
              />
            ),
          },
          {
            id: "created",
            label: "Created",
            emphasis: "secondary",
            render: (row) => formatDate(row.createdAt),
          },
        ]}
        rowActions={(row) => [
          {
            id: "plan",
            label: "Change plan",
            onClick: () => setPlanTarget(row),
          },
          {
            id: "suspend",
            label: row.status === "suspended" ? "Reactivate user" : "Suspend user",
            danger: row.status !== "suspended",
            onClick: () => setSuspendTarget(row),
          },
        ]}
      />

      <ChangePlanModal
        user={planTarget}
        saving={actionLoading}
        onClose={() => setPlanTarget(null)}
        onConfirm={(plan) => void handlePlanConfirm(plan)}
      />

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        title={suspendTarget?.status === "suspended" ? "Reactivate user" : "Suspend user"}
        description={
          suspendTarget?.status === "suspended"
            ? `${suspendTarget?.name} will regain access to their workspace immediately.`
            : `${suspendTarget?.name} will lose access to their workspace immediately.`
        }
        confirmLabel={suspendTarget?.status === "suspended" ? "Reactivate" : "Suspend"}
        danger={suspendTarget?.status !== "suspended"}
        loading={actionLoading}
        onConfirm={() => void handleSuspendConfirm()}
        onCancel={() => setSuspendTarget(null)}
      />
    </Box>
  );
}
