"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { selectUser } from "@/features/auth/authSlice";
import { socialPermissionLabel } from "@/lib/permissions";
import { useAppSelector } from "@/store/hooks";
import type { SocialPermissionLevel } from "@/types/auth";

type TeamPermissionRow = {
  userId: string;
  name: string;
  email: string;
  permission: string;
};

const LEVELS: SocialPermissionLevel[] = ["viewer", "editor", "publisher", "admin"];

export default function SocialTeamPermissions() {
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
      toast.success("Permission updated");
    } catch {
      toast.error("Failed to update permission");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Set the social media permission level for each teammate.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {rows === null ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="font-medium">No team members yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Invite teammates to your workspace to assign social permissions.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li
                  key={row.userId}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                  </div>
                  <Select
                    value={row.permission}
                    disabled={savingId === row.userId}
                    onValueChange={(v) => void handleChange(row.userId, v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {socialPermissionLabel(level)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
