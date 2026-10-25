"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Layers3, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layouts/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PricingPlanCard from "@/components/admin/PricingPlanCard";
import PricingPlanEditModal from "@/components/admin/PricingPlanEditModal";
import {
  selectPricingError,
  selectPricingIsFallback,
  selectPricingLoading,
  selectPricingPlans,
  selectPricingSaving,
} from "@/features/admin/adminSelectors";
import { fetchPricingPlans, updatePricingPlan } from "@/features/admin/adminThunks";
import { selectAccessToken, selectUser } from "@/features/auth/authSlice";
import { getStoredAccessToken } from "@/lib/auth/session";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { PlanLimits, PricingPlan } from "@/types/admin";

export default function AdminPricing() {
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectAccessToken);
  if (!user?.isPlatformAdmin) return <p role="alert">Platform administrator access is required.</p>;
  return <PricingContent key={`${user.id}:${token}`} />;
}

function PricingContent() {
  const dispatch = useAppDispatch();
  const plans = useAppSelector(selectPricingPlans);
  const loading = useAppSelector(selectPricingLoading);
  const saving = useAppSelector(selectPricingSaving);
  const error = useAppSelector(selectPricingError);
  const isFallback = useAppSelector(selectPricingIsFallback);

  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const request = useRef(0);
  const saveLock = useRef(false);
  const mounted = useRef(false);
  const session = useRef(getStoredAccessToken());
  const readTask = useRef<{ abort(): void } | null>(null);
  const saveTask = useRef<{ abort(): void } | null>(null);

  const current = useCallback(() => mounted.current && session.current === getStoredAccessToken(), []);

  const load = useCallback(async () => {
    if (!current()) return;
    const id = ++request.current;
    readTask.current?.abort();
    setStatus("loading");
    try {
      const task = dispatch(fetchPricingPlans());
      readTask.current = task;
      await task.unwrap();
      if (current() && id === request.current) setStatus("ready");
    } catch {
      if (current() && id === request.current) setStatus("error");
    }
  }, [current, dispatch]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      request.current += 1;
      readTask.current?.abort();
      saveTask.current?.abort();
    };
  }, [load]);

  const verified = status === "ready" && !isFallback;
  const handleSave = async (payload: { limits: Partial<Omit<PlanLimits, "accounts">> }) => {
    if (!current() || !editingPlan || !verified || loading) throw new Error("Reload live plans before editing allowances.");
    if (saveLock.current || saving) throw new Error("A plan update is already in progress.");
    saveLock.current = true;
    try {
      const task = dispatch(updatePricingPlan({ planId: editingPlan.id, payload }));
      saveTask.current = task;
      await task.unwrap();
      if (!current()) return;
      toast.success(`${editingPlan.name} allowances updated`);
      setEditingPlan(null);
    } finally {
      saveLock.current = false;
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader icon={Layers3} title="Plans" description="View checkout prices in INR and manage workspace allowances. Prices are read-only; allowance changes apply to every workspace on the plan." />

      {status === "loading" || loading ? (
        <div role="status" aria-label="Loading plans" aria-busy="true">
          <span className="sr-only">Loading verified plans…</span>
          <div aria-hidden className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <div key={key} className="space-y-5 rounded-xl border border-border p-6">
                <Skeleton className="h-6 w-24 motion-reduce:animate-none" />
                <Skeleton className="h-10 w-40 motion-reduce:animate-none" />
                <Skeleton className="h-64 w-full motion-reduce:animate-none" />
              </div>
            ))}
          </div>
        </div>
      ) : !verified ? (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="font-semibold">Live plans unavailable</h2>
          <p className="text-sm text-muted-foreground">{error || "The live plan catalog could not be verified."} No fallback prices or allowances can be edited.</p>
          <Button variant="outline" onClick={() => void load()}><RefreshCw aria-hidden className="mr-2 size-4" />Retry plans</Button>
        </div>
      ) : plans.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-dashed border-border p-8 text-center">
          <h2 className="font-semibold">No plans available</h2>
          <p className="text-sm text-muted-foreground">The live catalog returned no plans. Reload to check again.</p>
          <Button variant="outline" onClick={() => void load()}>Reload plans</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PricingPlanCard key={plan.id} plan={plan} verified={verified} disabled={saving || Boolean(error)} onEdit={setEditingPlan} />
          ))}
        </div>
      )}

      {verified && error && !editingPlan ? (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-4">
          <p className="text-sm">Reload plans to verify the current allowances before editing.</p>
          <Button variant="outline" onClick={() => void load()}>Retry plans</Button>
        </div>
      ) : null}

      <aside className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Scale is sales-only.</span> Tailored allowances are discussed with sales; Scale is not an assignable or editable plan here.
      </aside>

      <PricingPlanEditModal
        plan={editingPlan}
        saving={saving}
        disabled={!verified || loading}
        onClose={() => setEditingPlan(null)}
        onSave={handleSave}
      />
    </div>
  );
}
