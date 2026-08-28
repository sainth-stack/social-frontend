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
import { formatCurrencyUsd } from "@/lib/format";
import type { PricingPlan } from "@/types/admin";

function limitLabel(value: number | null): string {
  return value === null ? "Unlimited" : value.toLocaleString("en-US");
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function BoolRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {enabled ? (
        <Check className="h-3.5 w-3.5 text-primary" />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className={enabled ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

type PricingPlanCardProps = {
  plan: PricingPlan;
  onEdit: (plan: PricingPlan) => void;
};

export default function PricingPlanCard({ plan, onEdit }: PricingPlanCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{plan.name}</CardTitle>
          {plan.recommended ? <Badge variant="secondary">Recommended</Badge> : null}
        </div>
        <CardDescription>
          {plan.isCustom ? (
            "Custom pricing"
          ) : (
            <>
              {formatCurrencyUsd(plan.priceMonthlyUsd ?? 0)}/mo ·{" "}
              {formatCurrencyUsd(plan.priceAnnualUsd ?? 0)}/yr
            </>
          )}
        </CardDescription>
        {plan.tagline ? (
          <p className="text-xs text-muted-foreground">{plan.tagline}</p>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3 text-sm">
        <Row label="Posts / month" value={limitLabel(plan.limits.postsPerMonth)} />
        <Row label="Connected accounts" value={limitLabel(plan.limits.accounts)} />
        <Row label="AI text" value={limitLabel(plan.limits.aiTextGenerations)} />
        <Row label="AI images" value={limitLabel(plan.limits.aiImageGenerations)} />
        <Row label="AI videos" value={limitLabel(plan.limits.aiVideoGenerations)} />
        <Row label="Templates" value={limitLabel(plan.limits.templates)} />
        <div className="space-y-1 border-t border-border pt-2">
          <BoolRow label="Brand voice" enabled={plan.limits.brandVoice} />
          <BoolRow label="Approval workflow" enabled={plan.limits.approvalWorkflow} />
        </div>
        <Button variant="outline" className="mt-auto w-full" onClick={() => onEdit(plan)}>
          <Pencil className="mr-2 h-4 w-4" /> Edit plan
        </Button>
      </CardContent>
    </Card>
  );
}
