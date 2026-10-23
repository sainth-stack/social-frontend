"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Link2,
  Link2Off,
  RefreshCcw,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { openSocialOAuthPopup } from "./OAuthConnectButton";

const ACCOUNTS_CONNECT_PLATFORMS: { platform: SocialPlatform; name: string }[] = [
  { platform: "instagram", name: "Instagram" },
  { platform: "linkedin", name: "LinkedIn" },
  { platform: "facebook", name: "Facebook" },
];

const X_ACCOUNTS_DISABLED = true;

function accountSections(
  accounts: SocialAccount[],
): { platform: SocialPlatform; name: string }[] {
  const sections = [...ACCOUNTS_CONNECT_PLATFORMS];
  if (X_ACCOUNTS_DISABLED && accounts.some((a) => a.platform === "x")) {
    sections.push({ platform: "x", name: "X" });
  }
  return sections;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "—";
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

function extractErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
    ?.detail;
  return typeof detail === "string" ? detail : fallback;
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
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      {hint ? (
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export default function AccountsPage() {
  const user = useAppSelector(selectUser);
  const workspaceId = user?.workspaceId ?? "";

  return <WorkspaceAccounts key={workspaceId} workspaceId={workspaceId} />;
}

function WorkspaceAccounts({ workspaceId }: { workspaceId: string }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [accountsLimit, setAccountsLimit] = useState<number | null | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<SocialAccount | null>(null);
  const alive = useRef(false);
  const listRequest = useRef<symbol | null>(null);
  const usageRequest = useRef<symbol | null>(null);
  const action = useRef<symbol | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId || !alive.current || listRequest.current) return;
    const request = Symbol();
    listRequest.current = request;
    setLoading(true);
    try {
      const items = await socialMediaApi.listAccounts(workspaceId);
      if (!alive.current || listRequest.current !== request) return;
      setAccounts(items.filter((a) => a.isActive));
      setLoaded(true);
      setListError(false);
    } catch {
      if (alive.current && listRequest.current === request) setListError(true);
    } finally {
      if (alive.current && listRequest.current === request) {
        listRequest.current = null;
        setLoading(false);
      }
    }
  }, [workspaceId]);

  const loadUsage = useCallback(async (replacePending = false) => {
    if (!workspaceId || !alive.current || (usageRequest.current && !replacePending)) return;
    const request = Symbol();
    usageRequest.current = request;
    setUsageLoading(true);
    try {
      const usage = await socialMediaApi.getUsage(workspaceId);
      if (!alive.current || usageRequest.current !== request) return;
      setAccountsLimit(usage.accounts.limit);
      setUsageError(false);
    } catch {
      if (alive.current && usageRequest.current === request) {
        setAccountsLimit(undefined);
        setUsageError(true);
      }
    } finally {
      if (alive.current && usageRequest.current === request) {
        usageRequest.current = null;
        setUsageLoading(false);
      }
    }
  }, [workspaceId]);

  useEffect(() => {
    alive.current = true;
    void load();
    void loadUsage();
    return () => {
      alive.current = false;
      listRequest.current = null;
      usageRequest.current = null;
      action.current = null;
    };
  }, [load, loadUsage]);

  const connectedCount = accounts.length;
  const limitReached =
    accountsLimit != null && connectedCount >= accountsLimit;
  const usagePercent = accountsLimit == null
    ? undefined
    : accountsLimit === 0 ? 100 : Math.min(100, (connectedCount / accountsLimit) * 100);

  const byPlatform = useMemo(() => {
    const map = new Map<SocialPlatform, SocialAccount[]>();
    for (const a of accounts) {
      const list = map.get(a.platform) ?? [];
      list.push(a);
      map.set(a.platform, list);
    }
    return map;
  }, [accounts]);

  const begin = (key: string) => {
    if (!workspaceId || !alive.current || action.current || listRequest.current) return null;
    const token = Symbol();
    action.current = token;
    setBusy(key);
    return token;
  };

  const current = (token: symbol) => alive.current && action.current === token;

  const refresh = (resource: "all" | "accounts" | "usage" = "all") => {
    if (action.current) return;
    if (resource !== "usage") void load();
    if (resource !== "accounts") void loadUsage();
  };

  const finish = (token: symbol) => {
    if (!current(token)) return;
    action.current = null;
    setBusy(null);
  };

  const authorize = async (platform: SocialPlatform, account?: SocialAccount) => {
    if (X_ACCOUNTS_DISABLED && platform === "x") return;
    if (!account && limitReached) {
      toast.error("You've reached your account limit. Request an upgrade from admin.");
      return;
    }
    const token = begin(account ? `reconnect:${account.id}` : `connect:${platform}`);
    if (!token) return;
    try {
      let result;
      if (account) {
        try {
          result = await socialMediaApi.reconnectAccount(workspaceId, account.id);
        } catch {
          if (!current(token)) return;
          toast.message("Reconnect could not start. Trying a new authorization for this platform.");
          result = await socialMediaApi.getOAuthUrl(workspaceId, platform);
        }
      } else {
        result = await socialMediaApi.getOAuthUrl(workspaceId, platform);
      }
      if (!current(token)) return;
      openSocialOAuthPopup(result.url, (success, message, silent) => {
        if (!current(token)) return;
        finish(token);
        if (silent) return;
        if (success) {
          toast.success(message || (account ? "Account reconnected" : `${PLATFORM_LABELS[platform]} connected`));
          void load();
          void loadUsage(true);
        } else if (message) {
          toast.error(message);
        }
      });
    } catch (err) {
      if (!current(token)) return;
      toast.error(extractErrorMessage(err, account ? "Failed to reconnect" : `Failed to start ${platform} connection`));
      finish(token);
    }
  };

  const accountAction = async (account: SocialAccount, kind: "sync" | "disconnect") => {
    const token = begin(`${kind}:${account.id}`);
    if (!token) return;
    try {
      if (kind === "sync") await socialMediaApi.syncAccount(workspaceId, account.id);
      else await socialMediaApi.deleteAccount(workspaceId, account.id);
      if (!current(token)) return;
      if (kind === "sync") toast.success(`${PLATFORM_LABELS[account.platform]} synced`);
      else {
        toast("Account disconnected");
        setDisconnectTarget(null);
      }
      await Promise.all([load(), loadUsage(true)]);
    } catch (err) {
      if (current(token)) toast.error(extractErrorMessage(err, kind === "sync" ? "Sync failed" : "Failed to disconnect"));
    } finally {
      finish(token);
    }
  };

  const platformSections = useMemo(() => accountSections(accounts), [accounts]);

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader icon={Users} title="Accounts" description="Your connected channels, all in one place. Keep every account ready to publish." />
        <Button variant="outline" className="shrink-0" disabled={!workspaceId || loading || usageLoading || !!busy} onClick={() => refresh()}>
          <RefreshCcw aria-hidden className={cn("mr-2 h-4 w-4", loading && "motion-safe:animate-spin")} />
          {loading && loaded ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {!workspaceId ? <p role="status" className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Select a workspace to manage its accounts.</p> : <>
      <Card className={cn("shadow-soft", limitReached && "border-warning/40")}>
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Users aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium">Connected accounts</p>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {loaded ? connectedCount : "—"} / {accountsLimit === undefined ? "Limit unknown" : accountsLimit === null ? "Unlimited" : accountsLimit}
              </p>
              {usageLoading && <p role="status" className="mt-1 text-xs text-muted-foreground">Checking account limit…</p>}
            </div>
          </div>
          {loaded && usagePercent !== undefined && (
            <Progress
              aria-label="Account usage"
              aria-valuenow={usagePercent}
              aria-valuetext={`${connectedCount} of ${accountsLimit} accounts`}
              value={usagePercent}
              className="h-2 md:max-w-xs"
            />
          )}
          {limitReached && (
            <Button asChild>
              <Link href="/dashboard/billing">
                <Zap aria-hidden className="mr-2 h-4 w-4" /> Upgrade
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {usageError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm">
        <p>Account limit unavailable. You can still manage your accounts; connection limits are checked when you connect.</p>
        <Button variant="outline" size="sm" disabled={usageLoading || !!busy} onClick={() => refresh("usage")}>Retry usage</Button>
      </div>}
      {limitReached && <p className="text-sm text-muted-foreground">You&apos;ve reached your account limit. Request an upgrade from admin to connect more accounts.</p>}
      {listError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-card p-4 text-sm">
        <p>{loaded ? "Couldn't refresh accounts. Showing the last loaded accounts." : "Couldn't load accounts. Try again to see your connected channels."}</p>
        <Button variant="outline" size="sm" disabled={loading || !!busy} onClick={() => refresh("accounts")}>Retry accounts</Button>
      </div>}

      {!loaded && !listError ? (
        <div role="status" aria-label="Loading accounts" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <span className="sr-only">Loading accounts…</span>
          {platformSections.map((p) => (
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
      ) : loaded ? (
        <div aria-label="Platform accounts" aria-busy={loading} className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {platformSections.map(({ platform, name }) => {
            const platformAccounts = byPlatform.get(platform) ?? [];
            const xDisabled = X_ACCOUNTS_DISABLED && platform === "x";

            return (
              <Card key={platform} className="min-w-0 overflow-hidden shadow-soft">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <PlatformIcon platform={platform} size="lg" />
                    <div>
                      <h2 className="text-base font-semibold">{name}</h2>
                      <p className="text-xs text-muted-foreground">{platformAccounts.length ? `${platformAccounts.length} connected` : "Not connected"}</p>
                    </div>
                  </div>
                  {xDisabled ? (
                    <Badge variant="secondary" className="ml-2">
                      Unavailable
                    </Badge>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {xDisabled ? (
                    <p className="mb-3 text-xs text-muted-foreground">
                      New X connections are turned off. You can disconnect existing accounts below.
                    </p>
                  ) : null}
                  <div className="space-y-4">
                  {platformAccounts.map((account) => (
                    <section key={account.id} aria-label={`${name} account ${account.accountName}`} className="rounded-xl border border-border bg-muted/20 p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="min-w-0 break-words text-sm font-semibold">{account.accountName}</h3>
                        {account.isDefault && <Badge variant="secondary">Default</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Stat label="Last sync" value={relativeTime(account.lastSyncedAt)} />
                        <Stat
                          label="Health"
                          value={(() => {
                            const h = healthLabel(account.tokenStatus);
                            return (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1",
                                  h.ok
                                    ? "text-foreground"
                                    : "text-warning-foreground",
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full",
                                    h.ok
                                      ? "bg-success"
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
                          disabled={!!busy || loading}
                          onClick={() => void accountAction(account, "sync")}
                        >
                          <RefreshCcw
                            className={cn(
                              "mr-1.5 h-3.5 w-3.5",
                              busy === `sync:${account.id}` && "motion-safe:animate-spin",
                            )}
                            aria-hidden
                          />{" "}
                          Sync now
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!!busy || loading || xDisabled}
                          onClick={() => void authorize(platform, account)}
                        >
                          <Link2 aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Reconnect
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={!!busy || loading}
                          onClick={() => setDisconnectTarget(account)}
                        >
                          <Link2Off aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Disconnect
                        </Button>
                      </div>
                    </section>
                  ))}
                  </div>
                  {!xDisabled && (platformAccounts.length ? (
                    <Button variant="outline" size="sm" className="mt-4" disabled={!!busy || loading || limitReached} onClick={() => void authorize(platform)}>
                      <Sparkles aria-hidden className="mr-2 h-4 w-4" /> {busy === `connect:${platform}` ? "Connecting…" : `Add another ${name} account`}
                    </Button>
                  ) : (
                    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-5">
                      <p className="text-sm text-muted-foreground">
                        Connect {name} to schedule, publish, and track engagement from OpsBrain.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => void authorize(platform)}
                        disabled={!!busy || loading || limitReached}
                      >
                        {busy === `connect:${platform}` ? (
                          <>
                            <RefreshCcw aria-hidden className="mr-1.5 h-3.5 w-3.5 motion-safe:animate-spin" /> Connecting…
                          </>
                        ) : (
                          <>
                            <Sparkles aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Connect {name}
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {loaded && !listError && connectedCount === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Users aria-hidden className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No accounts connected yet</p>
            <p className="text-xs text-muted-foreground">
              Pick a platform above to get started.
            </p>
          </CardContent>
        </Card>
      )}
      {busy && <p role="status" className="text-sm text-muted-foreground">{busy.startsWith("connect:") || busy.startsWith("reconnect:") ? "Complete authorization in the popup window." : "Updating account…"}</p>}
      </>}

      <Dialog
        open={!!disconnectTarget}
        onOpenChange={(o) => !o && !busy && setDisconnectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect account?</DialogTitle>
            <DialogDescription>
              {disconnectTarget?.accountName ? `${disconnectTarget.accountName}: ` : ""}
              This will pause scheduled posts and remove analytics for this account. You can
              reconnect anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={!!busy} onClick={() => setDisconnectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!busy}
              onClick={() => disconnectTarget && void accountAction(disconnectTarget, "disconnect")}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
