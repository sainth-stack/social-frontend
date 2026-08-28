"use client";

import { useEffect, useState } from "react";
import { Check, Crown, Mail, Sparkles, Zap } from "lucide-react";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { DEFAULT_PRICING_CATALOG } from "@/features/admin/pricingCatalog";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import type { PlanTier } from "@/types/auth";
import type { SocialDashboardStats } from "@/types/social-media.types";

const CONTACT_EMAIL = "admin@opsbrainai.com";

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {used.toLocaleString()} / {limit === null ? "Unlimited" : limit.toLocaleString()}
        </span>
      </div>
      {limit !== null ? (
        <Progress value={pct} className="h-1.5" />
      ) : (
        <div className="h-1.5 rounded-full bg-primary/20" />
      )}
    </div>
  );
}

export default function BillingOverview() {
  const user = useAppSelector(selectUser);
  const workspaceId = user?.workspaceId ?? "";
  const [stats, setStats] = useState<SocialDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    setLoading(true);
    socialMediaApi
      .getDashboardStats(workspaceId)
      .then((data) => {
        if (active) setStats(data);
      })
      .catch(() => {
        if (active) setError("Failed to load your current usage.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const planId: PlanTier = user?.plan ?? "starter";
  const currentPlan =
    DEFAULT_PRICING_CATALOG.find((p) => p.id === planId) ?? DEFAULT_PRICING_CATALOG[0];
  const usage = stats?.usage;

  const usageBars = [
    {
      label: "Posts",
      used: usage?.postsThisMonth.used ?? 0,
      limit: usage?.postsThisMonth.limit ?? currentPlan.limits.postsPerMonth,
    },
    {
      label: "Connected accounts",
      used: usage?.accounts.used ?? 0,
      limit: usage?.accounts.limit ?? currentPlan.limits.accounts,
    },
    {
      label: "Templates",
      used: usage?.templates.used ?? 0,
      limit: usage?.templates.limit ?? currentPlan.limits.templates,
    },
  ];

  const atLimit = usageBars.some(
    (b) => b.limit != null && b.limit > 0 && b.used / b.limit >= 0.8,
  );

  const upgradeHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `Upgrade request — ${user?.workspaceName ?? "workspace"} (${currentPlan.name} → Pro/Growth)`,
  )}&body=${encodeURIComponent(
    `Hi OpsBrain admin,\n\nI'd like to request a plan upgrade for workspace "${user?.workspaceName ?? ""}" (${workspaceId}).\n\nCurrent plan: ${currentPlan.name}\nRequested plan: Pro / Growth\n\nThanks.`,
  )}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing & plans</h1>
          <p className="text-sm text-muted-foreground">
            Free by default. Pro and Growth are assigned by an OpsBrain admin — there
            is no self-serve checkout.
          </p>
        </div>
        <Button onClick={() => setUpgradeOpen(true)} className="gap-1.5">
          <Crown className="h-4 w-4" /> Request upgrade
        </Button>
      </header>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        New workspaces start on <span className="font-medium">Free</span>. To move to Growth
        or Growth, email{" "}
        <a className="font-medium text-primary hover:underline" href={upgradeHref}>
          {CONTACT_EMAIL}
        </a>
        . Only platform admins can change workspace plans.
      </div>

      {error && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Current plan</CardTitle>
            <CardDescription>Your subscription and usage this month.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{currentPlan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentPlan.isCustom
                      ? "Custom pricing · Assigned by admin"
                      : currentPlan.priceMonthlyUsd === 0
                        ? "Free forever · Admin-assigned upgrades"
                        : `$${currentPlan.priceMonthlyUsd?.toLocaleString()}/mo · Assigned by admin`}
                  </p>
                </div>
              </div>
              <Badge variant="secondary">Active</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))
                : usageBars.map((b) => (
                    <UsageBar
                      key={b.label}
                      label={b.label}
                      used={b.used}
                      limit={b.limit}
                    />
                  ))}
            </div>

            {atLimit && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <span className="font-medium text-foreground">
                  You&apos;re close to your plan limit.
                </span>{" "}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setUpgradeOpen(true)}
                >
                  Request an upgrade to keep publishing.
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How upgrades work</CardTitle>
            <CardDescription>No card on file required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 text-success" />
                Free plan is the default for every workspace
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 text-success" />
                Pro / Growth are assigned by OpsBrain admins
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 text-success" />
                No Stripe checkout in this product
              </li>
            </ul>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href={upgradeHref}>
                <Mail className="mr-2 h-4 w-4" /> Email admin
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plans</CardTitle>
          <CardDescription>Compare tiers — upgrades are admin-assigned only.</CardDescription>
          <div className="mt-3 inline-flex items-center rounded-lg border border-border bg-muted p-1">
            {(["monthly", "yearly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                  cycle === c
                    ? "bg-background text-foreground shadow-soft"
                    : "text-muted-foreground",
                )}
              >
                {c}{" "}
                {c === "yearly" && (
                  <Badge variant="secondary" className="ml-1 text-[9px]">
                    save
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {DEFAULT_PRICING_CATALOG.map((p) => {
              const isCurrent = p.id === planId;
              const monthly =
                p.isCustom || p.priceMonthlyUsd == null
                  ? null
                  : cycle === "monthly"
                    ? p.priceMonthlyUsd
                    : p.priceAnnualUsd != null
                      ? Math.round(p.priceAnnualUsd / 12)
                      : p.priceMonthlyUsd;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex flex-col rounded-2xl border p-5",
                    p.recommended
                      ? "border-primary bg-primary/5 shadow-elevated"
                      : "border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{p.name}</p>
                    {p.recommended && <Badge>Popular</Badge>}
                  </div>
                  <div className="mt-3">
                    {monthly == null ? (
                      <span className="text-3xl font-semibold">Custom</span>
                    ) : monthly === 0 ? (
                      <>
                        <span className="text-3xl font-semibold">$0</span>
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl font-semibold">
                          ${monthly.toLocaleString()}
                        </span>
                        <span className="text-sm text-muted-foreground">/mo</span>
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{p.tagline}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {[
                      p.limits.postsPerMonth == null
                        ? "Unlimited posts / month"
                        : `${p.limits.postsPerMonth} posts / month`,
                      p.limits.accounts == null
                        ? "Unlimited connected accounts"
                        : `${p.limits.accounts} connected accounts`,
                      p.limits.aiTextGenerations == null
                        ? "Unlimited AI text"
                        : `${p.limits.aiTextGenerations} AI text generations`,
                      p.limits.aiImageGenerations == null
                        ? "Unlimited AI images"
                        : `${p.limits.aiImageGenerations} AI images`,
                      p.limits.aiVideoGenerations
                        ? `${p.limits.aiVideoGenerations} AI videos`
                        : p.limits.aiVideoGenerations === null
                          ? "Unlimited AI video"
                          : "No AI video",
                      p.limits.brandVoice ? "Brand voice" : "No brand voice",
                      p.limits.approvalWorkflow
                        ? "Approval workflow"
                        : "No approval workflow",
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-3.5 w-3.5 text-success" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-5 w-full"
                    variant={isCurrent ? "outline" : p.recommended ? "default" : "outline"}
                    disabled={isCurrent}
                    asChild={!isCurrent}
                  >
                    {isCurrent ? (
                      <span>Current plan</span>
                    ) : (
                      <a href={upgradeHref}>Request {p.name}</a>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Zap className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center">Request a plan upgrade</DialogTitle>
            <DialogDescription className="text-center">
              OpsBrain does not process payments in-app. Email an admin and they will assign
              Growth or Growth to your workspace.
            </DialogDescription>
          </DialogHeader>
          <ul className="my-2 space-y-2 text-sm">
            {[
              "Higher post and AI limits",
              "More connected accounts",
              "Brand voice & approval workflow",
              "Assigned by platform admin only",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" /> {f}
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUpgradeOpen(false)}>
              Maybe later
            </Button>
            <Button asChild>
              <a href={upgradeHref} onClick={() => setUpgradeOpen(false)}>
                <Mail className="mr-2 h-4 w-4" /> Email {CONTACT_EMAIL}
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
