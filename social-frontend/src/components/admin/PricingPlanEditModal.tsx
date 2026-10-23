"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlanLimits, PricingPlan } from "@/types/admin";

const quotas = [
  ["postsPerMonth", "Posts / month"],
  ["aiTextGenerations", "AI text limit"],
  ["aiImageGenerations", "AI image limit"],
  ["aiVideoGenerations", "AI video limit"],
  ["templates", "Templates"],
] as const;
const features = [["brandVoice", "Brand voice"], ["approvalWorkflow", "Approval workflow"]] as const;
type Quota = typeof quotas[number][0];
type Allowances = Omit<PlanLimits, "accounts">;
type FormState = Record<Quota, string> & Pick<Allowances, "brandVoice" | "approvalWorkflow">;
type Mode = "edit" | "review" | "cancel" | "reset";

function formFromPlan(plan: PricingPlan): FormState {
  return {
    postsPerMonth: plan.limits.postsPerMonth === null ? "" : String(plan.limits.postsPerMonth),
    aiTextGenerations: plan.limits.aiTextGenerations === null ? "" : String(plan.limits.aiTextGenerations),
    aiImageGenerations: plan.limits.aiImageGenerations === null ? "" : String(plan.limits.aiImageGenerations),
    aiVideoGenerations: plan.limits.aiVideoGenerations === null ? "" : String(plan.limits.aiVideoGenerations),
    templates: plan.limits.templates === null ? "" : String(plan.limits.templates),
    brandVoice: plan.limits.brandVoice,
    approvalWorkflow: plan.limits.approvalWorkflow,
  };
}

function valueLabel(value: number | boolean | null) {
  return value === null ? "Unlimited" : typeof value === "boolean" ? (value ? "Included" : "Not included") : value.toLocaleString("en-IN");
}

type PricingPlanEditModalProps = {
  plan: PricingPlan | null;
  saving?: boolean;
  disabled?: boolean;
  onClose: () => void;
  onSave: (payload: { limits: Partial<Allowances> }) => void | Promise<void>;
};

export default function PricingPlanEditModal({ plan, saving = false, disabled = false, onClose, onSave }: PricingPlanEditModalProps) {
  const id = useId();
  const [form, setForm] = useState<FormState | null>(null);
  const [mode, setMode] = useState<Mode>("edit");
  const [errors, setErrors] = useState<Partial<Record<Quota, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const busy = saving || pending;

  useEffect(() => {
    if (plan) returnFocus.current = document.activeElement as HTMLElement;
    setForm(plan ? formFromPlan(plan) : null);
    setMode("edit");
    setErrors({});
    setSaveError(null);
  }, [plan]);

  useEffect(() => {
    heading.current?.focus();
  }, [mode]);

  if (!plan || !form) return null;

  const initial = formFromPlan(plan);
  const changes: Partial<Allowances> = {};
  const validation: Partial<Record<Quota, string>> = {};
  for (const [key] of quotas) {
    const raw = form[key].trim();
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < 0)) {
      validation[key] = "Enter a whole number of 0 or more, or leave blank for unlimited.";
    } else if (value !== plan.limits[key]) {
      changes[key] = value;
    }
  }
  for (const [key] of features) {
    if (form[key] !== plan.limits[key]) changes[key] = form[key];
  }
  const dirty = [...quotas, ...features].some(([key]) => form[key] !== initial[key]);
  const hasChanges = Object.keys(changes).length > 0;

  const close = () => {
    if (lock.current || busy) return;
    if (dirty) setMode("cancel");
    else onClose();
  };

  const review = () => {
    if (lock.current || busy || disabled) return;
    setErrors(validation);
    const invalid = quotas.find(([key]) => validation[key]);
    if (invalid) {
      document.getElementById(`${id}-${invalid[0]}`)?.focus();
      return;
    }
    if (hasChanges) setMode("review");
  };

  const save = async () => {
    if (lock.current || busy || disabled || mode !== "review" || !hasChanges || Object.keys(validation).length) return;
    lock.current = true;
    setPending(true);
    setSaveError(null);
    try {
      await onSave({ limits: changes });
      onClose();
    } catch (error) {
      setSaveError(typeof error === "string" ? error : error instanceof Error ? error.message : "Could not save allowances. Please try again.");
      setMode("edit");
    } finally {
      lock.current = false;
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        className="flex max-h-dvh flex-col overflow-y-auto sm:max-w-lg"
        aria-busy={busy}
        onEscapeKeyDown={(event) => { event.preventDefault(); close(); }}
        onPointerDownOutside={(event) => { event.preventDefault(); close(); }}
        onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus(); }}
      >
        <DialogHeader className="pr-6">
          <DialogTitle ref={heading} tabIndex={-1}>
            {mode === "review" ? `Confirm ${plan.name} allowances` : mode === "cancel" || mode === "reset" ? "Discard unsaved changes?" : `Edit ${plan.name} allowances`}
          </DialogTitle>
          <DialogDescription>
            {mode === "review" ? `These changes affect every workspace on the ${plan.name} plan. Checkout prices and unlimited social accounts will not change.` : "Edit allowances only. Prices are managed by checkout configuration. Social accounts remain unlimited on every plan."}
          </DialogDescription>
        </DialogHeader>

        {mode === "edit" ? (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); review(); }} noValidate>
            <p id={`${id}-help`} className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">Leave a quota blank for unlimited. Enter 0 to allow none. Other values must be whole numbers of 0 or more.</p>
            {disabled ? <p role="alert" className="text-sm text-destructive">Live plans must be verified before saving. Your draft has been preserved.</p> : null}
            {saveError ? <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{saveError} Your changes are still here. Retry saving when ready.</p> : null}
            <fieldset disabled={busy || disabled} className="space-y-4">
              <legend className="sr-only">Plan allowances</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                {quotas.map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`${id}-${key}`}>{label}</Label>
                    <Input id={`${id}-${key}`} inputMode="numeric" value={form[key]} placeholder="Unlimited" aria-invalid={Boolean(errors[key])} aria-describedby={`${id}-help${errors[key] ? ` ${id}-${key}-error` : ""}`} onChange={(event) => {
                      setForm({ ...form, [key]: event.target.value });
                      setErrors((current) => ({ ...current, [key]: undefined }));
                    }} />
                    {errors[key] ? <p id={`${id}-${key}-error`} className="text-xs text-destructive">{errors[key]}</p> : null}
                  </div>
                ))}
              </div>
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-sm text-muted-foreground">Connected accounts: Unlimited (fixed)</p>
                {features.map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox id={`${id}-${key}`} checked={form[key]} disabled={busy || disabled} onCheckedChange={(value) => setForm({ ...form, [key]: value === true })} />
                    <Label htmlFor={`${id}-${key}`}>{label}</Label>
                  </div>
                ))}
              </div>
            </fieldset>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setMode("reset")} disabled={!dirty || busy}>Reset</Button>
              <Button type="button" variant="outline" onClick={close} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy || disabled || !dirty}><Save aria-hidden className="mr-2 size-4" />{saveError ? "Retry save" : "Save changes"}</Button>
            </DialogFooter>
          </form>
        ) : mode === "review" ? (
          <>
            <ul className="space-y-2 rounded-lg border border-border p-4 text-sm">
              {[...quotas, ...features].map(([key, label]) => changes[key] !== undefined ? (
                <li key={key} className="flex flex-wrap justify-between gap-2"><span>{label}</span><span className="font-medium">{valueLabel(plan.limits[key])} → {valueLabel(changes[key])}</span></li>
              ) : null)}
            </ul>
            <DialogFooter className="gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setMode("edit")}>Back to editing</Button>
              <Button disabled={busy || disabled} onClick={() => void save()}>{busy ? "Saving…" : "Confirm and save"}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{mode === "reset" ? "Restore the loaded allowances and discard your draft." : "Your allowance changes have not been saved."}</p>
            <DialogFooter className="gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setMode("edit")}>Keep editing</Button>
              <Button variant="destructive" disabled={busy} onClick={() => {
                if (lock.current || busy) return;
                if (mode === "cancel") onClose();
                else { setForm(initial); setErrors({}); setSaveError(null); setMode("edit"); }
              }}>Discard changes</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
