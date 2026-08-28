"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import ChangePlanModal from "@/components/admin/ChangePlanModal";
import CreateUserModal from "@/components/admin/CreateUserModal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  selectAdminUsers,
  selectAdminUsersError,
  selectAdminUsersLoading,
} from "@/features/admin/adminSelectors";
import {
  changeAdminUserPlan,
  createAdminUser,
  fetchAdminUsers,
  suspendAdminUser,
} from "@/features/admin/adminThunks";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { AdminUser, CreateAdminUserPayload } from "@/types/admin";
import type { PlanTier } from "@/types/auth";

const PAGE_SIZE = 8;

const PLAN_LABELS: Record<string, string> = {
  starter: "Free",
  growth: "Pro",
  enterprise: "Growth",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AdminUsersTable() {
  const dispatch = useAppDispatch();
  const users = useAppSelector(selectAdminUsers);
  const loading = useAppSelector(selectAdminUsersLoading);
  const error = useAppSelector(selectAdminUsersError);

  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [planTarget, setPlanTarget] = useState<AdminUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    void dispatch(fetchAdminUsers());
  }, [dispatch]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (
        q &&
        !`${u.name} ${u.email} ${u.workspaceName}`.toLowerCase().includes(q.toLowerCase())
      ) {
        return false;
      }
      if (plan !== "all" && u.plan !== plan) return false;
      if (status !== "all" && u.status !== status) return false;
      return true;
    });
  }, [users, q, plan, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSuspend = async (user: AdminUser) => {
    setActionLoading(true);
    try {
      await dispatch(
        suspendAdminUser({ userId: user.id, suspended: user.status !== "suspended" }),
      ).unwrap();
      toast.success(
        user.status === "active" ? `${user.name} suspended` : `${user.name} activated`,
      );
    } catch {
      toast.error("Could not update user status");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlanConfirm = async (nextPlan: PlanTier) => {
    if (!planTarget) return;
    setActionLoading(true);
    try {
      await dispatch(changeAdminUserPlan({ userId: planTarget.id, plan: nextPlan })).unwrap();
      toast.success("Plan assigned");
    } catch {
      toast.error("Could not change plan");
    } finally {
      setActionLoading(false);
      setPlanTarget(null);
    }
  };

  const handleCreateConfirm = async (payload: CreateAdminUserPayload) => {
    setActionLoading(true);
    setCreateError(null);
    try {
      await dispatch(createAdminUser(payload)).unwrap();
      toast.success("User created");
      setCreateOpen(false);
    } catch (err) {
      setCreateError(typeof err === "string" ? err : "Failed to create user");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} users across all plans.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateError(null);
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Create user
        </Button>
      </header>

      {error && !createOpen ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, business…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={plan}
          onValueChange={(v) => {
            setPlan(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="starter">Free</SelectItem>
            <SelectItem value="growth">Pro</SelectItem>
            <SelectItem value="enterprise">Growth</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && users.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
            </div>
          ) : paged.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No users match your filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-muted text-xs">
                            {initials(u.name || u.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{u.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{u.workspaceName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{PLAN_LABELS[u.plan] ?? u.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.status === "active" ? "secondary" : "destructive"}
                        className="capitalize"
                      >
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPlanTarget(u)}>
                            Change plan
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.status === "active" ? (
                            <DropdownMenuItem
                              disabled={actionLoading}
                              onClick={() => void handleSuspend(u)}
                            >
                              <UserX className="mr-2 h-4 w-4" /> Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              disabled={actionLoading}
                              onClick={() => void handleSuspend(u)}
                            >
                              <UserCheck className="mr-2 h-4 w-4" /> Activate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <CreateUserModal
        open={createOpen}
        saving={actionLoading}
        error={createError}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
        onConfirm={(payload) => void handleCreateConfirm(payload)}
      />

      <ChangePlanModal
        user={planTarget}
        saving={actionLoading}
        onClose={() => setPlanTarget(null)}
        onConfirm={(nextPlan) => void handlePlanConfirm(nextPlan)}
      />
    </div>
  );
}
