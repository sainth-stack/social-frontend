"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import adminApi from "@/api/endpoints/admin.api";
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
import type { AdminWorkspace } from "@/types/admin";
import type { PlanTier } from "@/types/auth";

const PLAN_LABELS = { starter: "Free", growth: "Pro", enterprise: "Growth" };

export default function AdminWorkspaces() {
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectAccessToken);
  if (!user?.isPlatformAdmin) return <p role="alert">Platform administrator access is required.</p>;
  return <WorkspacesContent key={`${user.id}:${token}`} />;
}

function WorkspacesContent() {
  const [filters, setFilters] = useState({ search: "", page: 0 });
  const [result, setResult] = useState<AdminWorkspace[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState<{ workspace: AdminWorkspace; action: "plan" | "status" } | null>(null);
  const [plan, setPlan] = useState<PlanTier>("starter");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  const session = useRef(getStoredAccessToken());
  const actionTrigger = useRef<HTMLElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);

  function current() { return mounted.current && session.current === getStoredAccessToken(); }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++request.current; controller.current?.abort(); mutation.current?.abort(); };
  }, []);

  function invalidate() {
    ++request.current; controller.current?.abort();
    setResult(null); setLoading(true); setError(false);
  }
  function changeFilters(next: typeof filters) { invalidate(); setFilters(next); setNotice(""); }
  function refresh() { invalidate(); setRevision((value) => value + 1); }
  function close() { if (!locked.current) { setTarget(null); setSaveError(false); } }

  useEffect(() => {
    const id = ++request.current;
    const abort = new AbortController();
    controller.current = abort;
    const valid = () => id === request.current && !abort.signal.aborted && mounted.current && session.current === getStoredAccessToken();
    setLoading(true); setError(false);
    const timer = setTimeout(() => {
      if (!valid()) return;
      void adminApi.listWorkspaces({ search: filters.search.trim() || undefined, limit: 21, offset: filters.page * 20 }, abort.signal)
        .then((data) => {
          if (!valid()) return;
          if (!data.length && filters.page > 0) { setFilters((value) => ({ ...value, page: value.page - 1 })); return; }
          setResult(data);
        }).catch(() => { if (valid()) setError(true); })
        .finally(() => { if (valid()) setLoading(false); });
    }, filters.search.trim() ? 300 : 0);
    return () => { clearTimeout(timer); ++request.current; abort.abort(); };
  }, [filters, revision]);

  async function save() {
    if (locked.current || !target || !current() || (target.action === "plan" && target.workspace.plan === plan)) return;
    locked.current = true;
    const abort = new AbortController();
    mutation.current = abort;
    setSaving(true); setSaveError(false); setNotice("");
    try {
      if (target.action === "plan") await adminApi.changeWorkspacePlan(target.workspace.id, plan, abort.signal);
      else await adminApi.changeWorkspaceStatus(target.workspace.id, !target.workspace.is_active, abort.signal);
      if (!current() || abort.signal.aborted) return;
      setTarget(null); setNotice("Workspace updated."); refresh();
    } catch {
      if (current() && !abort.signal.aborted) setSaveError(true);
    } finally {
      locked.current = false;
      if (current()) setSaving(false);
    }
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <PageHeader icon={Building2} title="Workspaces" description="Workspaces are the collaboration, billing and AI quota boundary. Users are individual sign-ins and can belong to multiple workspaces." />
      <Card><CardContent className="space-y-3 p-4"><div className="space-y-1.5"><Label htmlFor="workspace-search">Search workspaces</Label><Input ref={searchInput} id="workspace-search" placeholder="Workspace name" value={filters.search} onChange={(event) => changeFilters({ search: event.target.value, page: 0 })} /></div><p className="text-sm text-muted-foreground">All plans include unlimited connected accounts. Plan changes are administrative assignments, not payments.</p></CardContent></Card>
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {loading ? <div role="status" aria-label="Loading workspaces" className="space-y-3 rounded-xl border p-4"><span className="sr-only">Loading workspaces…</span>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : error ? <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4"><p>Workspaces could not be loaded.</p><Button variant="outline" onClick={refresh}>Retry workspaces</Button></div> : result ? <>
        <p aria-live="polite" className="text-sm text-muted-foreground">{result.length ? `Showing ${filters.page * 20 + 1}–${filters.page * 20 + Math.min(20, result.length)}` : "0 workspaces on this page"}</p>
        <Card className="min-w-0 overflow-hidden"><CardContent className="min-w-0 p-0">
          {!result.length ? <div className="space-y-3 p-8 text-center"><h2 className="font-semibold">No workspaces found</h2><p className="text-sm text-muted-foreground">Workspaces appear here when users create them. Try another search.</p>{filters.search && <Button variant="outline" onClick={() => changeFilters({ search: "", page: 0 })}>Clear search</Button>}</div> :
            <div role="region" aria-label="Workspaces table" tabIndex={0} className="max-w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Table>
              <TableHeader><TableRow><TableHead>Workspace</TableHead><TableHead>Owner</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Members</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>{result.slice(0, 20).map((workspace) => <TableRow key={workspace.id}>
                <TableCell><div className="w-44 break-words font-medium">{workspace.name}</div></TableCell>
                <TableCell><div className="w-48 break-all text-muted-foreground">{workspace.owner_email || "Owner unavailable"}</div></TableCell>
                <TableCell><Badge variant="outline">{PLAN_LABELS[workspace.plan]}</Badge></TableCell>
                <TableCell><Badge variant={workspace.is_active ? "secondary" : "destructive"}>{workspace.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                <TableCell>{workspace.member_count.toLocaleString()}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{Number.isNaN(Date.parse(workspace.created_at)) ? "Unavailable" : new Date(workspace.created_at).toLocaleDateString()}</TableCell>
                <TableCell><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link href={`/admin/ai-usage?workspaceId=${encodeURIComponent(workspace.id)}`} aria-label={`AI usage for ${workspace.name}`}>AI usage</Link></Button><Button size="sm" variant="outline" disabled={saving} aria-label={`Change plan for ${workspace.name}`} onClick={(event) => { actionTrigger.current = event.currentTarget; setPlan(workspace.plan); setSaveError(false); setTarget({ workspace, action: "plan" }); }}>Change plan</Button><Button size="sm" variant="outline" disabled={saving} aria-label={`${workspace.is_active ? "Deactivate" : "Activate"} ${workspace.name}`} onClick={(event) => { actionTrigger.current = event.currentTarget; setSaveError(false); setTarget({ workspace, action: "status" }); }}>{workspace.is_active ? "Deactivate" : "Activate"}</Button></div></TableCell>
              </TableRow>)}</TableBody>
            </Table></div>}
        </CardContent></Card>
        <nav aria-label="Workspace pagination" className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Page {filters.page + 1}</p><div className="flex gap-2"><Button variant="outline" disabled={filters.page === 0} onClick={() => changeFilters({ ...filters, page: filters.page - 1 })}>Previous</Button><Button variant="outline" disabled={result.length <= 20} onClick={() => changeFilters({ ...filters, page: filters.page + 1 })}>Next</Button></div></nav>
      </> : null}
      <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) close(); }}><DialogContent className="max-h-dvh overflow-y-auto sm:max-w-md" onCloseAutoFocus={(event) => { event.preventDefault(); if (actionTrigger.current?.isConnected) actionTrigger.current.focus(); else searchInput.current?.focus(); }}>
        <DialogHeader><DialogTitle>{target?.action === "plan" ? "Confirm workspace plan" : target?.workspace.is_active ? "Deactivate workspace?" : "Activate workspace?"}</DialogTitle><DialogDescription className="break-words">{target?.workspace.name} — {target?.action === "plan" ? "Change workspace entitlements without collecting payment. All plans include unlimited connected accounts." : target?.workspace.is_active ? "Deactivate this workspace for all of its members. You can reactivate it later." : "Restore access to this workspace for its members."}</DialogDescription></DialogHeader>
        {target?.action === "plan" && <div className="space-y-1.5"><Label htmlFor="workspace-assignment-plan">Plan</Label><Select disabled={saving} value={plan} onValueChange={(value) => setPlan(value as PlanTier)}><SelectTrigger id="workspace-assignment-plan"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PLAN_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>}
        {saveError && <p role="alert" className="text-sm text-destructive">Could not update workspace. Your selection is preserved. Try again.</p>}
        <DialogFooter className="gap-2"><Button variant="outline" disabled={saving} onClick={close}>Cancel</Button><Button variant={target?.action === "status" && target.workspace.is_active ? "destructive" : "default"} disabled={saving || (target?.action === "plan" && plan === target.workspace.plan)} onClick={() => void save()}>{saving ? "Saving…" : saveError ? "Retry workspace update" : "Confirm workspace update"}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}