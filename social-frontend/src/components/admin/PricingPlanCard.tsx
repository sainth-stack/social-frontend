"use client";

import { Check, Pencil, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PricingPlan } from "@/types/admin";

function limitLabel(value: number | null): string {
  return value === null ? "Unlimited" : value.toLocaleString("en-US");
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 text-sm">
      <span className="min-w-0 break-words text-muted-foreground">{label}</span>
      <span className="break-all text-right font-medium tabular-nums">{value}</span>
    </div>
  );
}

function BoolRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {enabled ? (
        <Check aria-hidden className="h-3.5 w-3.5 text-primary" />
      ) : (
        <X aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className={enabled ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className="sr-only">{enabled ? "Included" : "Not included"}</span>
    </div>
  );
}

type PricingPlanCardProps = {
  plan: PricingPlan;
  onEdit: (plan: PricingPlan) => void;
  disabled?: boolean;
  verified?: boolean;
};

export default function PricingPlanCard({ plan, onEdit, disabled = false, verified = false }: PricingPlanCardProps) {
  const price = plan.priceMonthlyInr;
  const hasPrice = verified && typeof price === "number" && Number.isFinite(price) && price >= 0;

  return (
    <Card className="flex min-w-0 flex-col rounded-xl border-border shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="min-w-0 break-words text-lg">{plan.name}</CardTitle>
          {plan.recommended ? <Badge variant="secondary">Recommended</Badge> : null}
        </div>
        <CardDescription>
          <span className="block text-2xl font-semibold tracking-tight text-foreground">
            {hasPrice
              ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(price)
              : "Price unavailable"}
          </span>
          <span className="mt-1 block">{hasPrice ? "INR / month · read-only" : "No verified INR price from checkout configuration."}</span>
        </CardDescription>
        {plan.id !== "starter" ? (
          <p className="text-xs leading-relaxed text-muted-foreground">Paid access lasts 30 days per payment. One-time payment; no auto-renewal.</p>
        ) : null}
        {plan.tagline ? (
          <p className="text-xs text-muted-foreground">{plan.tagline}</p>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3 text-sm">
        <Row label="Posts / month" value={limitLabel(plan.limits.postsPerMonth)} />
        <Row label="Connected accounts" value="Unlimited" />
        <Row label="AI text" value={limitLabel(plan.limits.aiTextGenerations)} />
        <Row label="AI images" value={limitLabel(plan.limits.aiImageGenerations)} />
        <Row label="AI videos" value={limitLabel(plan.limits.aiVideoGenerations)} />
        <Row label="Templates" value={limitLabel(plan.limits.templates)} />
        <div className="space-y-1 border-t border-border pt-2">
          <BoolRow label="Brand voice" enabled={plan.limits.brandVoice} />
          <BoolRow label="Approval workflow" enabled={plan.limits.approvalWorkflow} />
        </div>
        <Button variant="outline" className="mt-auto min-h-11 w-full sm:min-h-0" disabled={disabled || !verified} aria-label={`Edit ${plan.name} allowances`} onClick={() => onEdit(plan)}>
          <Pencil aria-hidden className="mr-2 h-4 w-4" /> Edit allowances
        </Button>
      </CardContent>
    </Card>
  );
}
