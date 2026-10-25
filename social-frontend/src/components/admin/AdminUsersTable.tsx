"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import adminApi from "@/api/endpoints/admin.api";
import { AdminFilters, AdminTableView } from "./AdminMobile";
import ChangePlanModal from "@/components/admin/ChangePlanModal";
import CreateUserModal from "@/components/admin/CreateUserModal";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { selectAccessToken, selectUser } from "@/features/auth/authSlice";
import { getStoredAccessToken } from "@/lib/auth/session";
import { useAppSelector } from "@/store/hooks";
import type { AdminUser, AdminUserListResponse, CreateAdminUserPayload } from "@/types/admin";
import type { PlanTier } from "@/types/auth";

const PLAN_LABELS = { starter: "Free", growth: "Pro", enterprise: "Growth" };
type Filters = { search: string; plan: PlanTier | "all"; status: string; page: number };
const initialFilters: Filters = { search: "", plan: "all", status: "all", page: 1 };

export default function AdminUsersTable() {
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectAccessToken);
  if (!user?.isPlatformAdmin) return <p role="alert">Platform administrator access is required.</p>;
  return <UsersContent key={`${user.id}:${token}`} currentUserId={user.id} />;
}

function UsersContent({ currentUserId }: { currentUserId: string }) {
  const [filters, setFilters] = useState(initialFilters);
  const [result, setResult] = useState<AdminUserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [planTarget, setPlanTarget] = useState<AdminUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  const session = useRef(getStoredAccessToken());
  const actionTrigger = useRef<HTMLElement | null>(null);
  const createTrigger = useRef<HTMLButtonElement | null>(null);

  function current() { return mounted.current && session.current === getStoredAccessToken(); }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++request.current; controller.current?.abort(); mutation.current?.abort(); };
  }, []);

  function invalidate() {
    ++request.current;
    controller.current?.abort();
    setResult(null);
    setLoading(true);
    setError(false);
  }
  function changeFilters(next: Filters) { invalidate(); setFilters(next); setNotice(""); }
  function refresh() { invalidate(); setRevision((value) => value + 1); }
  function close() {
    if (locked.current) return;
    setPlanTarget(null); setStatusTarget(null); setCreateOpen(false); setSaveError(null);
  }
  function restoreFocus(event: Event) {
    event.preventDefault();
    const target = actionTrigger.current;
    if (target?.isConnected) target.focus(); else createTrigger.current?.focus();
  }

  useEffect(() => {
    const id = ++request.current;
    const abort = new AbortController();
    controller.current = abort;
    const valid = () => id === request.current && !abort.signal.aborted && mounted.current && session.current === getStoredAccessToken();
    setLoading(true); setError(false);
    const timer = setTimeout(() => {
      if (!valid()) return;
      void adminApi.listUsers({ search: filters.search.trim() || undefined, plan: filters.plan === "all" ? undefined : filters.plan, status: filters.status === "all" ? undefined : filters.status, page: filters.page, pageSize: 20 }, abort.signal)
        .then((data) => {
          if (!valid()) return;
          const lastPage = Math.max(1, data.totalPages);
          if (filters.page > lastPage) { setFilters((value) => ({ ...value, page: lastPage })); return; }
          setResult(data);
        }).catch(() => { if (valid()) setError(true); })
        .finally(() => { if (valid()) setLoading(false); });
    }, filters.search.trim() ? 300 : 0);
    return () => { clearTimeout(timer); ++request.current; abort.abort(); };
  }, [filters, revision]);

  async function save(action: (signal: AbortSignal) => Promise<unknown>, message: string) {
    if (locked.current || !current()) return;
    locked.current = true;
    const abort = new AbortController();
    mutation.current = abort;
    setSaving(true); setSaveError(null); setNotice("");
    try {
      await action(abort.signal);
      if (!current() || abort.signal.aborted) return;
      setPlanTarget(null); setStatusTarget(null); setCreateOpen(false);
      setNotice(message); refresh();
    } catch {
      if (current() && !abort.signal.aborted) setSaveError("Could not save changes. Your entries are preserved. Try again.");
    } finally {
      locked.current = false;
      if (current()) setSaving(false);
    }
  }

  function create(payload: CreateAdminUserPayload) { void save((signal) => adminApi.createUser(payload, signal), "User created."); }
  function changePlan(plan: PlanTier) {
    if (planTarget?.workspaceId) void save((signal) => adminApi.changeUserPlan(planTarget.id, plan, signal), "Workspace plan updated.");
  }
  function changeStatus() {
    if (!statusTarget || (statusTarget.id === currentUserId && statusTarget.status === "active")) return;
    void save((signal) => adminApi.suspendUser(statusTarget.id, statusTarget.status !== "suspended", signal), "User status updated.");
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader icon={Users} title="Users" description="Manage user access and primary owned workspace plans." />
        <Button ref={createTrigger} disabled={saving} onClick={(event) => { actionTrigger.current = event.currentTarget; setSaveError(null); setCreateOpen(true); }}><Plus className="mr-2 size-4" aria-hidden />Create user</Button>
      </header>
      <p className="text-sm text-muted-foreground">Users are individual sign-ins. The primary workspace is their primary owned workspace, not every workspace they can access. Plans belong to workspaces, not users; Change plan updates that workspace. <Link href="/admin/workspaces" className="font-medium text-primary underline">Manage all Workspaces</Link> for collaboration, billing and AI quotas.</p>
      <Card><CardContent className="flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor="user-search">Search users</Label><Input id="user-search" placeholder="Name, email or owned workspace" value={filters.search} onChange={(event) => changeFilters({ ...filters, search: event.target.value, page: 1 })} /></div>
        <AdminFilters activeCount={Number(filters.plan !== "all") + Number(filters.status !== "all")} className="space-y-4 sm:contents sm:space-y-0">
        <div className="space-y-1.5 sm:w-52"><Label htmlFor="user-plan">Primary workspace plan</Label><Select value={filters.plan} onValueChange={(value) => changeFilters({ ...filters, plan: value as Filters["plan"], page: 1 })}><SelectTrigger id="user-plan"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All plans</SelectItem>{Object.entries(PLAN_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5 sm:w-40"><Label htmlFor="user-status">Filter status</Label><Select value={filters.status} onValueChange={(value) => changeFilters({ ...filters, status: value, page: 1 })}><SelectTrigger id="user-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select></div>
        </AdminFilters>
      </CardContent></Card>
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {loading ? <div role="status" aria-label="Loading users" className="space-y-3 rounded-xl border p-4"><span className="sr-only">Loading users…</span>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : error ? <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4"><p>Users could not be loaded.</p><Button variant="outline" onClick={refresh}>Retry users</Button></div> : result ? <>
        <p aria-live="polite" className="text-sm text-muted-foreground">{result.total.toLocaleString()} users matching current filters</p>
        <Card className="min-w-0 overflow-hidden"><CardContent className="min-w-0 p-0">
          {!result.items.length ? <div className="space-y-3 p-8 text-center"><h2 className="font-semibold">No users found</h2><p className="text-sm text-muted-foreground">Try another search or create a user.</p><Button variant="outline" onClick={() => changeFilters(initialFilters)}>Clear filters</Button></div> :
            <AdminTableView><div role="region" aria-label="Users table" tabIndex={0} className="max-w-full overflow-x-auto p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-0"><Table>
              <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Primary workspace</TableHead><TableHead>Primary workspace plan</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>{result.items.map((user) => <TableRow key={user.id}>
                <TableCell data-label="User"><div className="w-48 break-words font-medium">{user.name || "Unnamed user"}</div><div className="w-48 break-all text-xs text-muted-foreground">{user.email}</div>{user.isPlatformAdmin && <Badge variant="outline">Platform admin</Badge>}{user.id === currentUserId && <Badge variant="secondary">You</Badge>}</TableCell>
                <TableCell data-label="Primary workspace"><div className="w-40 break-words">{user.workspaceName || "No owned workspace"}</div></TableCell>
                <TableCell data-label="Primary workspace plan"><Badge variant="outline">{user.workspaceId ? PLAN_LABELS[user.plan] : "No workspace"}</Badge></TableCell>
                <TableCell data-label="Status"><Badge variant={user.status === "active" ? "secondary" : "destructive"}>{user.status === "active" ? "Active" : "Suspended"}</Badge></TableCell>
                <TableCell data-label="Created" className="whitespace-nowrap text-muted-foreground">{Number.isNaN(Date.parse(user.createdAt)) ? "Unavailable" : new Date(user.createdAt).toLocaleDateString()}</TableCell>
                <TableCell data-label="Actions"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link href={`/admin/ai-usage?userId=${encodeURIComponent(user.id)}`} aria-label={`AI usage for ${user.email}`}>AI usage</Link></Button><Button size="sm" variant="outline" disabled={saving || !user.workspaceId} aria-label={`Change plan for ${user.email}`} onClick={(event) => { actionTrigger.current = event.currentTarget; setSaveError(null); setPlanTarget(user); }}>Change plan</Button><Button size="sm" variant="outline" disabled={saving || (user.id === currentUserId && user.status === "active")} aria-label={`${user.status === "active" ? "Suspend" : "Activate"} ${user.email}`} onClick={(event) => { actionTrigger.current = event.currentTarget; setSaveError(null); setStatusTarget(user); }}>{user.status === "active" ? "Suspend" : "Activate"}</Button></div>{user.id === currentUserId && <p className="mt-1 text-xs text-muted-foreground">You cannot suspend yourself.</p>}</TableCell>
              </TableRow>)}</TableBody>
            </Table></div></AdminTableView>}
        </CardContent></Card>
        <nav aria-label="User pagination" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Page {filters.page} of {Math.max(1, result.totalPages)}</p><div className="flex gap-2"><Button variant="outline" disabled={filters.page <= 1} onClick={() => changeFilters({ ...filters, page: filters.page - 1 })}>Previous</Button><Button variant="outline" disabled={filters.page >= result.totalPages} onClick={() => changeFilters({ ...filters, page: filters.page + 1 })}>Next</Button></div></nav>
      </> : null}
      <CreateUserModal open={createOpen} saving={saving} error={saveError} onClose={close} onConfirm={create} onCloseAutoFocus={restoreFocus} />
      <ChangePlanModal user={planTarget} saving={saving} error={saveError} onClose={close} onConfirm={changePlan} onCloseAutoFocus={restoreFocus} />
      <Dialog open={Boolean(statusTarget)} onOpenChange={(open) => { if (!open) close(); }}><DialogContent className="max-h-dvh overflow-y-auto sm:max-w-md" onCloseAutoFocus={restoreFocus}>
        <DialogHeader><DialogTitle>{statusTarget?.status === "active" ? "Suspend user?" : "Activate user?"}</DialogTitle><DialogDescription className="break-words">{statusTarget?.email}: {statusTarget?.status === "active" ? "This user will lose access to the platform. You can reactivate them later." : "Restore this user’s access to the platform."}</DialogDescription></DialogHeader>
        {statusTarget?.isPlatformAdmin && <p className="text-sm font-medium">This account has platform administrator privileges.</p>}
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        <DialogFooter className="gap-2"><Button variant="outline" disabled={saving} onClick={close}>Cancel</Button><Button variant={statusTarget?.status === "active" ? "destructive" : "default"} disabled={saving} onClick={changeStatus}>{saving ? "Saving…" : saveError ? "Retry status change" : "Confirm status change"}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
