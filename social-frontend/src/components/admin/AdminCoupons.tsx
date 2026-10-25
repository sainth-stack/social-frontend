"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History, Loader2, Plus, Tag } from "lucide-react";

import billingApi from "@/api/endpoints/billing.api";
import { AdminTableView } from "./AdminMobile";
import { toApiError } from "@/api/errors";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { selectAccessToken, selectUser } from "@/features/auth/authSlice";
import { getStoredAccessToken } from "@/lib/auth/session";
import { useAppSelector } from "@/store/hooks";
import type { AdminCoupon, CreateAdminCouponPayload } from "@/types/billing";

const wholeInr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const fractionalInr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr = { format: (value: number) => (Number.isInteger(value) ? wholeInr : fractionalInr).format(value) };
const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const initialForm = {
  code: "", planKey: "any", discountType: "percent" as CreateAdminCouponPayload["discountType"],
  discountValue: "10", maxRedemptions: "", validUntil: "", notes: "", isActive: true,
};
type FieldErrors = Partial<Record<keyof typeof initialForm, string>>;

function planLabel(key?: string | null): string {
  if (!key) return "Any paid plan";
  return ({ growth: "Pro", enterprise: "Growth", starter: "Free", scale: "Scale" } as Record<string, string>)[key] ?? key;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Date unavailable";
}

function formatDiscount(coupon: AdminCoupon): string {
  if (coupon.discountType === "free") return "100% off (free)";
  if (coupon.discountType === "fixed_inr") return `${inr.format(coupon.discountValue)} off`;
  return `${Math.min(100, Math.max(0, coupon.discountValue))}% off`;
}

function useCouponResource<T>(fetcher: () => Promise<T[]>) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const session = useRef(getStoredAccessToken());
  const current = useCallback(() => mounted.current && session.current === getStoredAccessToken(), []);
  const load = useCallback(async () => {
    if (!current()) return;
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (current() && request === generation.current) setData(result);
    } catch (error) {
      if (current() && request === generation.current) setError(toApiError(error).message);
    } finally {
      if (current() && request === generation.current) setLoading(false);
    }
  }, [current, fetcher]);
  const upsert = useCallback((item: T, key: (row: T) => string) => {
    if (!current()) return;
    ++generation.current;
    setLoading(false);
    setData((previous) => previous?.some((row) => key(row) === key(item))
      ? previous.map((row) => key(row) === key(item) ? item : row)
      : [item, ...(previous ?? [])]);
  }, [current]);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; ++generation.current; };
  }, [load]);
  return { data, loading, error, load, upsert };
}

function LoadingRows({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="space-y-3 py-4"><span className="sr-only">{label}</span>{[0, 1, 2].map((row) => <Skeleton key={row} className="h-12 w-full motion-reduce:animate-none" />)}</div>;
}

function SectionError({ error, label, retry }: { error: string; label: string; retry: () => void }) {
  return <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><p className="min-w-0 break-words">{error}</p><Button variant="outline" size="sm" onClick={retry}>{label}</Button></div>;
}

export default function AdminCoupons() {
  const user = useAppSelector(selectUser);
  const token = useAppSelector(selectAccessToken);
  if (!user?.isPlatformAdmin) return <p role="alert">Platform administrator access is required.</p>;
  return <CouponsContent key={`${user.id}:${token}`} />;
}

function CouponsContent() {
  const codes = useCouponResource(billingApi.listCoupons);
  const history = useCouponResource(billingApi.listCouponRedemptions);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<{ id: string; message: string } | null>(null);
  const [deactivating, setDeactivating] = useState<AdminCoupon | null>(null);
  const [notice, setNotice] = useState("");
  const lifecycle = useRef(0);
  const mounted = useRef(false);
  const session = useRef(getStoredAccessToken());
  const createMutex = useRef(false);
  const toggleMutex = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const toggleTrigger = useRef<HTMLButtonElement | null>(null);

  function current() { return mounted.current && session.current === getStoredAccessToken(); }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++lifecycle.current; };
  }, []);

  function changeField<K extends keyof typeof initialForm>(key: K, value: typeof initialForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => ({ ...previous, [key]: undefined }));
    setCreateError(null);
  }

  async function handleCreate() {
    if (createMutex.current || !current()) return;
    const code = form.code.trim().toUpperCase();
    const discountValue = form.discountType === "free" ? 0 : Number(form.discountValue);
    const maxRedemptions = form.maxRedemptions.trim() ? Number(form.maxRedemptions) : null;
    const expiry = form.validUntil ? new Date(form.validUntil) : null;
    const errors: FieldErrors = {};
    if (code.length < 3 || code.length > 32) errors.code = "Use 3–32 characters after trimming spaces.";
    if (!["any", "growth", "enterprise"].includes(form.planKey)) errors.planKey = "Choose any paid plan, Pro, or Growth.";
    if (form.discountType !== "free" && (!form.discountValue.trim() || !Number.isSafeInteger(discountValue) || discountValue < 0)) errors.discountValue = "Enter a non-negative whole number.";
    if (maxRedemptions !== null && (!Number.isSafeInteger(maxRedemptions) || maxRedemptions < 1)) errors.maxRedemptions = "Enter a whole number of at least 1, or leave blank for unlimited.";
    if (expiry && (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())) errors.validUntil = "Choose a valid future date and time.";
    setFieldErrors(errors);
    setCreateError(null);
    if (Object.keys(errors).length) {
      const first = Object.keys(errors)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    createMutex.current = true;
    setSaving(true);
    const generation = lifecycle.current;
    try {
      const created = await billingApi.createCoupon({
        code, planKey: form.planKey === "any" ? null : form.planKey,
        discountType: form.discountType, discountValue, maxRedemptions,
        validUntil: expiry?.toISOString() ?? null, notes: form.notes, isActive: form.isActive,
      });
      if (!current() || generation !== lifecycle.current) return;
      codes.upsert(created, (row) => row.id);
      setCreateOpen(false);
      setForm(initialForm);
      setNotice(`${created.code} created.`);
      void codes.load();
    } catch (error) {
      if (current() && generation === lifecycle.current) setCreateError(toApiError(error).message);
    } finally {
      if (current() && generation === lifecycle.current) { createMutex.current = false; setSaving(false); }
    }
  }

  async function toggleActive(coupon: AdminCoupon) {
    if (toggleMutex.current || !current()) return;
    toggleMutex.current = true;
    setPendingToggle(coupon.id);
    setToggleError(null);
    const generation = lifecycle.current;
    try {
      const updated = await billingApi.updateCoupon(coupon.id, { isActive: !coupon.isActive });
      if (!current() || generation !== lifecycle.current) return;
      codes.upsert(updated, (row) => row.id);
      setDeactivating(null);
      setNotice(`${updated.code} ${updated.isActive ? "activated" : "deactivated"}.`);
      void codes.load();
    } catch (error) {
      if (current() && generation === lifecycle.current) setToggleError({ id: coupon.id, message: toApiError(error).message });
    } finally {
      if (current() && generation === lifecycle.current) { toggleMutex.current = false; setPendingToggle(null); }
    }
  }

  function fieldError(key: keyof typeof initialForm) {
    return fieldErrors[key] ? <p id={`coupon-${key}-error`} role="alert" className="text-sm text-destructive">{fieldErrors[key]}</p> : null;
  }

  return (
    <div className="min-w-0 space-y-6">
      <Dialog open={createOpen} onOpenChange={(open) => { if (!createMutex.current) setCreateOpen(open); }}>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader icon={Tag} title="Coupons" description="Create checkout offers for Pro and Growth, then follow their redemptions." />
          <DialogTrigger asChild><Button><Plus aria-hidden="true" className="mr-2 h-4 w-4" />New coupon</Button></DialogTrigger>
        </header>
        <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Create coupon</DialogTitle><DialogDescription>Start with a code and offer. Limits and expiry are optional.</DialogDescription></DialogHeader>
          <form ref={formRef} noValidate onSubmit={(event) => { event.preventDefault(); void handleCreate(); }} className="space-y-5">
            <fieldset disabled={saving} className="min-w-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="coupon-code">Code</Label>
                <Input id="coupon-code" name="code" value={form.code} onChange={(event) => changeField("code", event.target.value.toUpperCase())} placeholder="LAUNCH10" autoComplete="off" aria-invalid={!!fieldErrors.code} aria-describedby={`coupon-code-help${fieldErrors.code ? " coupon-code-error" : ""}`} />
                <p id="coupon-code-help" className="text-xs text-muted-foreground">3–32 characters. Codes are saved in uppercase.</p>{fieldError("code")}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="coupon-type">Discount type</Label><select id="coupon-type" className={selectClass} value={form.discountType} onChange={(event) => changeField("discountType", event.target.value as typeof form.discountType)}><option value="percent">Percentage</option><option value="fixed_inr">Fixed amount (INR)</option><option value="free">Free (100% off)</option></select></div>
                {form.discountType !== "free" && <div className="space-y-2"><Label htmlFor="coupon-value">{form.discountType === "percent" ? "Discount (%)" : "Discount (INR)"}</Label><Input id="coupon-value" name="discountValue" type="number" min={0} step={1} value={form.discountValue} onChange={(event) => changeField("discountValue", event.target.value)} aria-invalid={!!fieldErrors.discountValue} aria-describedby={`coupon-discount-help${fieldErrors.discountValue ? " coupon-discountValue-error" : ""}`} />{fieldError("discountValue")}</div>}
              </div>
              <p id="coupon-discount-help" className="text-xs text-muted-foreground">{form.discountType === "free" ? "Covers the full checkout price. The selected eligible plan is granted after checkout, not when the code is created." : form.discountType === "fixed_inr" ? "Whole rupees, not paise. The discount cannot exceed the checkout price." : "Whole percentages. Values above 100 are capped at 100% at checkout."}{form.discountType !== "free" && Number(form.discountValue) === 0 ? " A zero discount can be saved, but cannot be redeemed at checkout." : ""}</p>
              <div className="space-y-2"><Label htmlFor="coupon-plan">Applies to</Label><select id="coupon-plan" name="planKey" className={selectClass} value={form.planKey} onChange={(event) => changeField("planKey", event.target.value)} aria-invalid={!!fieldErrors.planKey} aria-describedby="coupon-plan-help"><option value="any">Any paid plan</option><option value="growth">Pro only</option><option value="enterprise">Growth only</option></select><p id="coupon-plan-help" className="text-xs text-muted-foreground">Pro and Growth checkout only. Existing upgrade eligibility still applies; coupons do not bypass plan restrictions.</p>{fieldError("planKey")}</div>
              <details className="rounded-lg border border-border p-4" open={fieldErrors.maxRedemptions || fieldErrors.validUntil ? true : undefined}>
                <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Limits, expiry & internal notes</summary>
                <div className="mt-4 space-y-4">
                  <div className="space-y-2"><Label htmlFor="coupon-max">Max redemptions (optional)</Label><Input id="coupon-max" name="maxRedemptions" type="number" min={1} step={1} value={form.maxRedemptions} onChange={(event) => changeField("maxRedemptions", event.target.value)} aria-invalid={!!fieldErrors.maxRedemptions} aria-describedby={`coupon-max-help${fieldErrors.maxRedemptions ? " coupon-maxRedemptions-error" : ""}`} /><p id="coupon-max-help" className="text-xs text-muted-foreground">Leave blank for unlimited redemptions.</p>{fieldError("maxRedemptions")}</div>
                  <div className="space-y-2"><Label htmlFor="coupon-expiry">Expires at (optional)</Label><Input id="coupon-expiry" name="validUntil" type="datetime-local" value={form.validUntil} onChange={(event) => changeField("validUntil", event.target.value)} aria-invalid={!!fieldErrors.validUntil} aria-describedby={`coupon-expiry-help${fieldErrors.validUntil ? " coupon-validUntil-error" : ""}`} /><p id="coupon-expiry-help" className="text-xs text-muted-foreground">Your local time, saved in UTC. Leave blank for no expiry.</p>{fieldError("validUntil")}</div>
                  <div className="space-y-2"><Label htmlFor="coupon-notes">Notes (internal)</Label><Input id="coupon-notes" value={form.notes} onChange={(event) => changeField("notes", event.target.value)} /></div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={form.isActive} onChange={(event) => changeField("isActive", event.target.checked)} />Active immediately</label>
                </div>
              </details>
            </fieldset>
            {createError && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><p className="font-medium">Could not create coupon</p><p className="break-words">{createError}</p><p className="mt-1 text-muted-foreground">Your entries are kept. Review them and try again.</p></div>}
            <DialogFooter className="gap-2"><Button type="button" variant="ghost" disabled={saving} onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}{saving ? "Creating…" : "Create coupon"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <p role="status" className="sr-only">{notice}</p>
      <section aria-labelledby="coupon-codes-title" className="min-w-0">
        <Card className="shadow-sm">
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="coupon-codes-title" className="font-semibold">Coupon codes</h2><CardDescription className="mt-1">All returned codes, including inactive and expired offers.{codes.data !== null && ` ${codes.data.length} loaded.`}</CardDescription></div><Button variant="outline" size="sm" onClick={() => void codes.load()}>Refresh codes</Button></div></CardHeader>
          <CardContent>
            {codes.error && <SectionError error={codes.error} label="Retry codes" retry={() => void codes.load()} />}
            {codes.loading && (codes.data === null ? <LoadingRows label="Loading coupon codes" /> : <p role="status" className="mb-3 text-sm text-muted-foreground">Refreshing codes…</p>)}
            {codes.error && codes.data !== null && <p className="mb-3 text-xs text-muted-foreground">Showing previously loaded codes.</p>}
            {codes.data?.length === 0 && <div className="space-y-3 rounded-lg border border-dashed py-10 text-center"><Tag aria-hidden="true" className="mx-auto h-6 w-6 text-muted-foreground" /><h3 className="font-medium">No coupons yet</h3><p className="text-sm text-muted-foreground">Create your first offer to share at checkout.</p><Button variant="outline" onClick={() => setCreateOpen(true)}>Create first coupon</Button></div>}
            {!!codes.data?.length && <AdminTableView><Table aria-label="Coupon codes"><TableHeader><TableRow><TableHead>Code & offer</TableHead><TableHead>Plan</TableHead><TableHead>Redemptions</TableHead><TableHead>Availability</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{codes.data.map((coupon) => {
              const expired = !!coupon.validUntil && new Date(coupon.validUntil).getTime() <= Date.now();
              const exhausted = coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions;
              return <TableRow key={coupon.id}>
                <TableCell data-label="Code & offer"><p className="max-w-xs break-all font-mono font-semibold">{coupon.code}</p><p className="mt-1 text-sm text-muted-foreground">{formatDiscount(coupon)}</p>{coupon.notes && <p className="mt-1 max-w-xs break-words text-xs text-muted-foreground">{coupon.notes}</p>}</TableCell>
                <TableCell data-label="Plan">{planLabel(coupon.planKey)}</TableCell>
                <TableCell data-label="Redemptions" className="whitespace-nowrap">{coupon.redemptionCount} / {coupon.maxRedemptions ?? "Unlimited"}</TableCell>
                <TableCell data-label="Availability"><div className="flex flex-wrap gap-1"><Badge variant={coupon.isActive ? "secondary" : "outline"}>{coupon.isActive ? "Active" : "Inactive"}</Badge>{expired && <Badge variant="outline">Expired</Badge>}{exhausted && <Badge variant="outline">Fully redeemed</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{coupon.validUntil ? `Expires ${formatDate(coupon.validUntil)}` : "No expiry"}</p></TableCell>
                <TableCell data-label="Actions" className="text-right"><Button variant="outline" size="sm" disabled={pendingToggle !== null} aria-label={`${coupon.isActive ? "Deactivate" : "Activate"} ${coupon.code}`} onClick={(event) => { if (toggleMutex.current) return; toggleTrigger.current = event.currentTarget; if (coupon.isActive) { setToggleError(null); setDeactivating(coupon); } else void toggleActive(coupon); }}>{pendingToggle === coupon.id ? "Updating…" : coupon.isActive ? "Deactivate" : "Activate"}</Button>{toggleError?.id === coupon.id && !deactivating && <p role="alert" className="mt-2 max-w-xs break-words text-left text-sm text-destructive">{toggleError.message} Try again using the action above.</p>}</TableCell>
              </TableRow>;
            })}</TableBody></Table></AdminTableView>}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="coupon-history-title" className="min-w-0">
        <Card className="shadow-sm">
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="coupon-history-title" className="font-semibold">Redemption history</h2><CardDescription className="mt-1">Completed redemptions by workspace, user and granted plan.{history.data !== null && ` ${history.data.length} loaded.`}</CardDescription></div><Button variant="outline" size="sm" onClick={() => void history.load()}>Refresh history</Button></div></CardHeader>
          <CardContent>
            {history.error && <SectionError error={history.error} label="Retry history" retry={() => void history.load()} />}
            {history.loading && (history.data === null ? <LoadingRows label="Loading redemption history" /> : <p role="status" className="mb-3 text-sm text-muted-foreground">Refreshing history…</p>)}
            {history.error && history.data !== null && <p className="mb-3 text-xs text-muted-foreground">Showing previously loaded redemptions.</p>}
            {history.data?.length === 0 && <div className="space-y-2 rounded-lg border border-dashed py-10 text-center"><History aria-hidden="true" className="mx-auto h-6 w-6 text-muted-foreground" /><h3 className="font-medium">No redemptions yet</h3><p className="text-sm text-muted-foreground">Completed coupon checkouts will appear here.</p></div>}
            {!!history.data?.length && <AdminTableView><Table aria-label="Redemption history"><TableHeader><TableRow><TableHead>When</TableHead><TableHead>Code</TableHead><TableHead>Workspace / user</TableHead><TableHead>Plan granted</TableHead><TableHead className="text-right">Discount</TableHead><TableHead className="text-right">Paid</TableHead></TableRow></TableHeader><TableBody>{history.data.map((row) => <TableRow key={row.id}><TableCell data-label="When" className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</TableCell><TableCell data-label="Code" className="max-w-xs break-all font-mono font-medium">{row.couponCode}</TableCell><TableCell data-label="Workspace / user"><p className="max-w-xs break-all">{row.workspaceName || row.workspaceId}</p><p className="mt-1 max-w-xs break-all text-xs text-muted-foreground">{row.userEmail || row.userId}</p></TableCell><TableCell data-label="Plan granted">{planLabel(row.planKey)}</TableCell><TableCell data-label="Discount" className="whitespace-nowrap text-right tabular-nums">{inr.format(row.discountPaise / 100)}</TableCell><TableCell data-label="Paid" className="whitespace-nowrap text-right tabular-nums">{inr.format(row.amountPaise / 100)}</TableCell></TableRow>)}</TableBody></Table></AdminTableView>}
          </CardContent>
        </Card>
      </section>

      <Dialog open={!!deactivating} onOpenChange={(open) => { if (!open && !toggleMutex.current) setDeactivating(null); }}>
        <DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); toggleTrigger.current?.focus(); }}>
          <DialogHeader><DialogTitle>Deactivate {deactivating?.code}?</DialogTitle><DialogDescription>New checkouts will no longer accept this code. Existing redemptions and granted plans are unchanged. You can activate it again later.</DialogDescription></DialogHeader>
          {toggleError?.id === deactivating?.id && toggleError && <p role="alert" className="break-words text-sm text-destructive">{toggleError.message} Try again below.</p>}
          <DialogFooter className="gap-2"><Button variant="ghost" disabled={pendingToggle !== null} onClick={() => setDeactivating(null)}>Cancel</Button><Button variant="destructive" disabled={pendingToggle !== null} onClick={() => { if (deactivating) void toggleActive(deactivating); }}>{pendingToggle ? "Deactivating…" : "Deactivate coupon"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
