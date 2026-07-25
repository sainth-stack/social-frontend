"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Link2,
  Link2Off,
  RefreshCcw,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { selectUser } from "@/features/auth/authSlice";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import type { SocialAccount, SocialPlatform } from "@/types/social-media.types";
import { PLATFORM_LABELS } from "@/types/social-media.types";

const PLATFORMS: { platform: SocialPlatform; name: string }[] = [
  { platform: "instagram", name: "Instagram" },
  { platform: "linkedin", name: "LinkedIn" },
  { platform: "x", name: "X" },
  { platform: "facebook", name: "Facebook" },
];

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function healthLabel(status: SocialAccount["tokenStatus"]): {
  label: string;
  ok: boolean;
} {
  if (status === "active") return { label: "Healthy", ok: true };
  if (status === "expires_soon") return { label: "Expires soon", ok: false };
  if (status === "expired") return { label: "Expired", ok: false };
  return { label: "Disconnected", ok: false };
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      {hint ? (
        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export default function AccountsPage() {
  const user = useAppSelector(selectUser);
  const workspaceId = user?.workspaceId ?? "";
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [accountsLimit, setAccountsLimit] = useState<number | null>(2);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<SocialPlatform | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<SocialAccount | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [items, stats] = await Promise.all([
        socialMediaApi.listAccounts(workspaceId),
        socialMediaApi.getDashboardStats(workspaceId).catch(() => null),
      ]);
      setAccounts(items.filter((a) => a.isActive));
      setAccountsLimit(stats?.usage.accounts.limit ?? null);
    } catch {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const connectedCount = accounts.length;
  const limitReached =
    accountsLimit != null && connectedCount >= accountsLimit;

  const byPlatform = useMemo(() => {
    const map = new Map<SocialPlatform, SocialAccount[]>();
    for (const p of PLATFORMS) map.set(p.platform, []);
    for (const a of accounts) {
      const list = map.get(a.platform) ?? [];
      list.push(a);
      map.set(a.platform, list);
    }
    return map;
  }, [accounts]);

  const startConnect = async (platform: SocialPlatform) => {
    if (!workspaceId) return;
    if (limitReached) {
      toast.error("You've reached your account limit. Request an upgrade from admin.");
      return;
    }
    setConnecting(platform);
    try {
      const { url } = await socialMediaApi.getOAuthUrl(workspaceId, platform);
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Complete authorization in the new window, then refresh.");
    } catch {
      toast.error(`Failed to start ${platform} connection`);
    } finally {
      setConnecting(null);
    }
  };

  const sync = async (account: SocialAccount) => {
    if (!workspaceId) return;
    setBusyId(account.id);
    try {
      const updated = await socialMediaApi.syncAccount(workspaceId, account.id);
      const followers = updated.followerCount ?? 0;
      toast.success(
        followers > 0
          ? `${PLATFORM_LABELS[account.platform] ?? account.platform} synced · ${followers.toLocaleString()} followers`
          : `${PLATFORM_LABELS[account.platform] ?? account.platform} synced (followers unavailable — reconnect if this stays 0)`,
      );
      await load();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toast.error(typeof detail === "string" ? detail : "Sync failed");
    } finally {
      setBusyId(null);
    }
  };

  const reconnect = async (account: SocialAccount) => {
    if (!workspaceId) return;
    setBusyId(account.id);
    try {
      const { url } = await socialMediaApi.reconnectAccount(workspaceId, account.id);
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Complete reconnection in the new window");
    } catch {
      try {
        const { url } = await socialMediaApi.getOAuthUrl(workspaceId, account.platform);
        window.open(url, "_blank", "noopener,noreferrer");
        toast.success("Complete reconnection in the new window");
      } catch {
        toast.error("Failed to reconnect");
      }
    } finally {
      setBusyId(null);
    }
  };

  const disconnect = async (account: SocialAccount) => {
    if (!workspaceId) return;
    setBusyId(account.id);
    try {
      await socialMediaApi.deleteAccount(workspaceId, account.id);
      toast("Account disconnected");
      setDisconnectTarget(null);
      await load();
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect the platforms you post to. We&apos;ll handle scheduling and analytics.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <Card className={cn("shadow-soft", limitReached && "border-warning/40")}>
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium">Connected accounts</p>
              <p className="text-xs text-muted-foreground">
                {loading ? (
                  <Skeleton className="mt-1 h-3 w-40" />
                ) : (
                  <>
                    {connectedCount}
                    {accountsLimit != null ? ` of ${accountsLimit}` : ""} on your plan
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-4 md:max-w-md">
            {loading ? (
              <Skeleton className="h-2 w-full" />
            ) : (
              <>
                <Progress
                  value={
                    accountsLimit
                      ? Math.min(100, (connectedCount / accountsLimit) * 100)
                      : connectedCount > 0
                        ? 40
                        : 0
                  }
                  className="h-2 flex-1"
                />
                <span className="whitespace-nowrap text-sm font-semibold">
                  {connectedCount}
                  {accountsLimit != null ? ` / ${accountsLimit}` : ""}
                </span>
              </>
            )}
          </div>
          {limitReached && (
            <Button asChild>
              <Link href="/dashboard/billing">
                <Zap className="mr-1.5 h-4 w-4" /> Upgrade
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PLATFORMS.map((p) => (
            <Card key={p.platform} className="shadow-soft">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PLATFORMS.map(({ platform, name }) => {
            const platformAccounts = byPlatform.get(platform) ?? [];
            const primary =
              platformAccounts.find((a) => a.isDefault) ?? platformAccounts[0] ?? null;

            return (
              <Card key={platform} className="shadow-soft">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <PlatformIcon platform={platform} size="lg" />
                    <div>
                      <CardTitle className="text-base">{name}</CardTitle>
                      {primary ? (
                        <p className="text-xs text-muted-foreground">{primary.accountName}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not connected</p>
                      )}
                    </div>
                  </div>
                  {primary ? (
                    <Badge className="gap-1 bg-[color:var(--color-success)] text-[color:var(--color-success-foreground)] hover:bg-[color:var(--color-success)]">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                      {platformAccounts.length > 1 ? ` · ${platformAccounts.length}` : ""}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Disconnected</Badge>
                  )}
                </CardHeader>
                <CardContent>
                  {primary ? (
                    <>
                      <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-muted/30 p-4">
                        <Stat
                          label="Followers"
                          value={
                            (primary.followerCount ?? 0) > 0
                              ? primary.followerCount.toLocaleString()
                              : "0"
                          }
                          hint={
                            (primary.followerCount ?? 0) === 0
                              ? platform === "linkedin"
                                ? "Needs LinkedIn connections product"
                                : platform === "x"
                                  ? "Sync needs valid X API credits"
                                  : platform === "facebook"
                                    ? "Meta reports 0 page fans"
                                    : undefined
                              : undefined
                          }
                        />
                        <Stat label="Last sync" value={relativeTime(primary.lastSyncedAt)} />
                        <Stat
                          label="Health"
                          value={(() => {
                            const h = healthLabel(primary.tokenStatus);
                            return (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1",
                                  h.ok
                                    ? "text-[color:var(--color-success)]"
                                    : "text-warning",
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    h.ok
                                      ? "bg-[color:var(--color-success)]"
                                      : "bg-warning",
                                  )}
                                />
                                {h.label}
                              </span>
                            );
                          })()}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === primary.id}
                          onClick={() => void sync(primary)}
                        >
                          <RefreshCcw
                            className={cn(
                              "mr-1.5 h-3.5 w-3.5",
                              busyId === primary.id && "animate-spin",
                            )}
                          />{" "}
                          Sync now
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === primary.id}
                          onClick={() => void reconnect(primary)}
                        >
                          <Link2 className="mr-1.5 h-3.5 w-3.5" /> Reconnect
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDisconnectTarget(primary)}
                        >
                          <Link2Off className="mr-1.5 h-3.5 w-3.5" /> Disconnect
                        </Button>
                        {!limitReached && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void startConnect(platform)}
                          >
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Add another
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-5">
                      <p className="text-sm text-muted-foreground">
                        Connect {name} to schedule, publish, and track engagement from OpsBrain.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => void startConnect(platform)}
                        disabled={connecting === platform || limitReached}
                      >
                        {connecting === platform ? (
                          <>
                            <RefreshCcw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Connecting…
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Connect {name}
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && connectedCount === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No accounts connected yet</p>
            <p className="text-xs text-muted-foreground">
              Pick a platform above to get started.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={!!disconnectTarget}
        onOpenChange={(o) => !o && setDisconnectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect account?</DialogTitle>
            <DialogDescription>
              This will pause scheduled posts and remove analytics for this account. You can
              reconnect anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!busyId}
              onClick={() => disconnectTarget && void disconnect(disconnectTarget)}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
