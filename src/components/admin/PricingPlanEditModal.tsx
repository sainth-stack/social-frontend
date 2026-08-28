"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlanLimits, PricingPlan } from "@/types/admin";

type FormState = {
  tagline: string;
  priceMonthlyUsd: string;
  priceAnnualUsd: string;
  accounts: string;
  postsPerMonth: string;
  aiTextGenerations: string;
  aiImageGenerations: string;
  aiVideoGenerations: string;
  templates: string;
  brandVoice: boolean;
  approvalWorkflow: boolean;
};

function toFieldValue(value: number | null): string {
  return value === null ? "" : String(value);
}

function toLimitValue(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function formFromPlan(plan: PricingPlan): FormState {
  return {
    tagline: plan.tagline,
    priceMonthlyUsd: plan.priceMonthlyUsd === null ? "" : String(plan.priceMonthlyUsd),
    priceAnnualUsd: plan.priceAnnualUsd === null ? "" : String(plan.priceAnnualUsd),
    accounts: toFieldValue(plan.limits.accounts),
    postsPerMonth: toFieldValue(plan.limits.postsPerMonth),
    aiTextGenerations: toFieldValue(plan.limits.aiTextGenerations),
    aiImageGenerations: toFieldValue(plan.limits.aiImageGenerations),
    aiVideoGenerations: toFieldValue(plan.limits.aiVideoGenerations),
    templates: toFieldValue(plan.limits.templates),
    brandVoice: plan.limits.brandVoice,
    approvalWorkflow: plan.limits.approvalWorkflow,
  };
}

type PricingPlanEditModalProps = {
  plan: PricingPlan | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: {
    tagline: string;
    priceMonthlyUsd: number | null;
    priceAnnualUsd: number | null;
    limits: PlanLimits;
  }) => void;
};

export default function PricingPlanEditModal({
  plan,
  saving = false,
  onClose,
  onSave,
}: PricingPlanEditModalProps) {
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    setForm(plan ? formFromPlan(plan) : null);
  }, [plan]);

  if (!plan || !form) {
    return (
      <Dialog open={false} onOpenChange={() => onClose()}>
        <DialogContent />
      </Dialog>
    );
  }

  const handleSave = () => {
    onSave({
      tagline: form.tagline.trim(),
      priceMonthlyUsd: plan.isCustom ? null : Number(form.priceMonthlyUsd) || 0,
      priceAnnualUsd: plan.isCustom ? null : Number(form.priceAnnualUsd) || 0,
      limits: {
        accounts: toLimitValue(form.accounts),
        postsPerMonth: toLimitValue(form.postsPerMonth),
        aiTextGenerations: toLimitValue(form.aiTextGenerations),
        aiImageGenerations: toLimitValue(form.aiImageGenerations),
        aiVideoGenerations: toLimitValue(form.aiVideoGenerations),
        templates: toLimitValue(form.templates),
        brandVoice: form.brandVoice,
        approvalWorkflow: form.approvalWorkflow,
      },
    });
  };

  return (
    <Dialog open={Boolean(plan)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {plan.name} plan</DialogTitle>
          <DialogDescription>
            Update plan limits. Leave a limit blank for unlimited.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tagline</Label>
            <Input
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            />
          </div>
          {!plan.isCustom ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monthly price ($)</Label>
                <Input
                  type="number"
                  value={form.priceMonthlyUsd}
                  onChange={(e) => setForm({ ...form, priceMonthlyUsd: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Yearly price ($)</Label>
                <Input
                  type="number"
                  value={form.priceAnnualUsd}
                  onChange={(e) => setForm({ ...form, priceAnnualUsd: e.target.value })}
                />
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["postsPerMonth", "Max posts / month"],
                ["accounts", "Max accounts"],
                ["aiTextGenerations", "AI text limit"],
                ["aiImageGenerations", "AI image limit"],
                ["aiVideoGenerations", "AI video limit"],
                ["templates", "Templates"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input
                  type="number"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder="Unlimited"
                />
              </div>
            ))}
          </div>
          <div className="space-y-3 rounded-lg border border-border p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.brandVoice}
                onCheckedChange={(v) => setForm({ ...form, brandVoice: v === true })}
              />
              Brand voice
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.approvalWorkflow}
                onCheckedChange={(v) =>
                  setForm({ ...form, approvalWorkflow: v === true })
                }
              />
              Approval workflow
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
