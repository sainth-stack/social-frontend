"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { authApi } from "@/api/endpoints/auth.api";
import { toApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { loginSuccess, selectUser } from "@/features/auth/authSlice";
import { mapApiUserToUser } from "@/lib/auth/mapUser";
import { socialPermissionLabel } from "@/lib/permissions";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks";
import type { SocialPermissionLevel } from "@/types/auth";
import SettingsShell from "./SettingsShell";

type TeamPermissionRow = { userId: string; name: string; email: string; permission: string };
const LEVELS: SocialPermissionLevel[] = ["viewer", "editor", "publisher", "admin"];

export default function SocialTeamPermissions() {
  const user = useAppSelector(selectUser);
  return <WorkspaceTeam key={user?.workspaceId ?? "no-workspace"} />;
}

function WorkspaceTeam() {
  const user = useAppSelector(selectUser);
  const workspaceId = user?.workspaceId ?? "";
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const [rows, setRows] = useState<TeamPermissionRow[]>([]);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ userId: string; message: string } | null>(null);
  const [sessionError, setSessionError] = useState(false);
  const [sessionRefreshing, setSessionRefreshing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const alive = useRef(false);
  const sequence = useRef(0);
  const mutex = useRef(false);
  const sessionMutex = useRef(false);
  const canManage = Boolean(user?.isPlatformAdmin || user?.socialPermissionLevel === "admin");
  const active = useCallback(() => alive.current && store.getState().auth.user?.workspaceId === workspaceId, [store, workspaceId]);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const request = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      const data = await socialMediaApi.listTeamPermissions(workspaceId);
      if (!active() || sequence.current !== request) return;
      setRows(data);
    } catch (cause) {
      if (active() && sequence.current === request) setError(toApiError(cause).message || "Failed to load team permissions");
    } finally {
      if (active() && sequence.current === request) setLoading(false);
    }
  }, [workspaceId, active]);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; sequence.current += 1; };
  }, [load]);

  const refreshSession = async () => {
    if (sessionMutex.current) return;
    sessionMutex.current = true;
    setSessionRefreshing(true);
    try {
      const me = await authApi.me();
      if (!active()) return;
      const workspace = me.workspaces.find((item) => item.id === workspaceId);
      const token = store.getState().auth.accessToken;
      if (!workspace || !token) throw new Error("Workspace session unavailable");
      const refreshedUser = mapApiUserToUser(me.user, workspace);
      if (workspace.role === "owner" || refreshedUser.isPlatformAdmin) refreshedUser.socialPermissionLevel = "admin";
      dispatch(loginSuccess({ user: refreshedUser, accessToken: token }));
      setSessionError(false);
    } catch {
      if (active()) setSessionError(true);
    } finally {
      sessionMutex.current = false;
      if (active()) setSessionRefreshing(false);
    }
  };

  const saveRole = async (row: TeamPermissionRow) => {
    const permission = drafts[row.userId];
    if (!workspaceId || !canManage || sessionError || mutex.current || !permission || permission === row.permission) return;
    mutex.current = true;
    setSavingId(row.userId);
    setSaveError(null);
    try {
      await socialMediaApi.updateTeamPermission(workspaceId, row.userId, permission);
      if (!active()) return;
      setRows((current) => current.map((item) => item.userId === row.userId ? { ...item, permission } : item));
      setDrafts((current) => { const next = { ...current }; delete next[row.userId]; return next; });
      toast.success("Permission updated");
      if (row.userId === user?.id) await refreshSession();
    } catch (cause) {
      if (active()) setSaveError({ userId: row.userId, message: toApiError(cause).message || "Failed to update permission" });
    } finally {
      mutex.current = false;
      if (active()) setSavingId(null);
    }
  };

  const discard = () => { setDrafts({}); setSaveError(null); };
  return <SettingsShell section="team" dirty={Object.keys(drafts).length > 0} saving={savingId !== null || sessionRefreshing} onDiscard={discard}>
    <Card><CardHeader><h2 className="text-lg font-semibold">Team permissions</h2><CardDescription>Give each teammate the access they need. Role changes apply only after you save.</CardDescription></CardHeader><CardContent className="space-y-5">
      <p className="text-sm text-muted-foreground">Workspace owners, platform admins, and social admins can manage team permissions. Other members have read-only access.</p>
      <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground sm:grid-cols-2">
        <p><strong className="text-foreground">Viewer:</strong> View workspace content.</p><p><strong className="text-foreground">Editor:</strong> Create and edit content.</p><p><strong className="text-foreground">Publisher:</strong> Publish and review content.</p><p><strong className="text-foreground">Admin:</strong> Manage social settings and permissions.</p>
      </div>
      {!workspaceId ? <p role="status" className="text-sm text-muted-foreground">Select a workspace to view team permissions.</p> : loading ? <div role="status" aria-label="Loading team permissions" aria-busy="true" className="space-y-4">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24 w-full" />)}<span className="sr-only">Loading team permissions</span></div> : error ? <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"><p className="text-sm">{error}</p><Button variant="outline" onClick={() => void load()}>Retry loading team</Button></div> : rows.length === 0 ? <div className="space-y-3 rounded-lg border border-dashed border-border p-8 text-center"><h3 className="font-medium">No team members found</h3><p className="text-sm text-muted-foreground">Members will appear here when they belong to this workspace. This screen manages existing members; it does not send invitations.</p><Button variant="outline" onClick={() => void load()}>Refresh team</Button></div> : <>
        {!canManage && <p role="status" className="text-sm text-muted-foreground">You have read-only access to team permissions.</p>}
        {sessionError && <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 p-4"><p className="text-sm">Your permission was saved, but your session could not be refreshed. Refresh it before making more changes.</p><Button variant="outline" disabled={savingId !== null || sessionRefreshing} onClick={() => void refreshSession()}>Retry session refresh</Button></div>}
        <ul className="divide-y divide-border">{rows.map((row) => {
          const pending = drafts[row.userId] !== undefined && drafts[row.userId] !== row.permission;
          return <li key={row.userId} className="space-y-3 py-5 first:pt-0 last:pb-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1"><h3 className="break-words text-sm font-semibold">{row.name}{row.userId === user?.id ? " (you)" : ""}</h3><p className="break-all text-sm text-muted-foreground">{row.email}</p><p className="break-all text-xs text-muted-foreground">User ID: <span className="select-all">{row.userId}</span></p></div>
              <fieldset disabled={!canManage || savingId !== null || sessionError} className="w-full space-y-3 sm:w-48 sm:shrink-0"><legend className="sr-only">Permission for {row.name}</legend>
                <Label htmlFor={`permission-${row.userId}`}>Social role for {row.name}</Label>
                <Select value={drafts[row.userId] ?? row.permission} onValueChange={(value) => {
                  setDrafts((current) => { const next = { ...current }; if (value === row.permission) delete next[row.userId]; else next[row.userId] = value; return next; });
                  setSaveError(null);
                }}><SelectTrigger id={`permission-${row.userId}`}><SelectValue /></SelectTrigger><SelectContent>{!LEVELS.includes(row.permission as SocialPermissionLevel) && <SelectItem value={row.permission}>{row.permission}</SelectItem>}{LEVELS.map((level) => <SelectItem key={level} value={level}>{socialPermissionLabel(level)}</SelectItem>)}</SelectContent></Select>
                {(pending || savingId === row.userId) && <div className="flex gap-2"><Button size="sm" onClick={() => void saveRole(row)} aria-label={`Save role for ${row.name}`}>{savingId === row.userId ? "Saving…" : "Save role"}</Button><Button size="sm" variant="outline" aria-label={`Cancel role change for ${row.name}`} onClick={() => { setDrafts((current) => { const next = { ...current }; delete next[row.userId]; return next; }); setSaveError(null); }}>Cancel</Button></div>}
              </fieldset>
            </div>
            {pending && <p role="status" className="text-xs text-muted-foreground">Unsaved role change{row.userId === user?.id ? ". Changing your own role may remove your management access." : "."}</p>}
            {saveError?.userId === row.userId && <p role="alert" className="text-sm text-destructive">{saveError.message} Your draft is preserved. Use Save role to retry.</p>}
          </li>;
        })}</ul>
      </>}
    </CardContent></Card>
  </SettingsShell>;
}
