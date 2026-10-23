"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Tag } from "lucide-react";

import billingApi from "@/api/endpoints/billing.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminCoupon, AdminCouponRedemption, CreateAdminCouponPayload } from "@/types/billing";

function formatDiscount(c: AdminCoupon): string {
  if (c.discountType === "free") return "100% off (free)";
  if (c.discountType === "fixed_inr") return `₹${c.discountValue} off`;
  return `${c.discountValue}% off`;
}

function planLabel(planKey?: string | null): string {
  if (planKey === "growth") return "Pro only";
  if (planKey === "enterprise") return "Growth only";
  return "Any paid plan";
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [redemptions, setRedemptions] = useState<AdminCouponRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<CreateAdminCouponPayload>({
    code: "",
    planKey: null,
    discountType: "percent",
    discountValue: 10,
    maxRedemptions: null,
    notes: "",
    isActive: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, r] = await Promise.all([
        billingApi.listCoupons(),
        billingApi.listCouponRedemptions(),
      ]);
      setCoupons(c);
      setRedemptions(r);
    } catch {
      setError("Failed to load coupons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!form.code.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await billingApi.createCoupon({
        ...form,
        code: form.code.trim(),
        discountValue: form.discountType === "free" ? 0 : form.discountValue,
      });
      setCreateOpen(false);
      setForm({
        code: "",
        planKey: null,
        discountType: "percent",
        discountValue: 10,
        maxRedemptions: null,
        notes: "",
        isActive: true,
      });
      await load();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? String((e as { response?: { data?: { detail?: string } } }).response?.data?.detail)
          : "Could not create coupon";
      setError(msg || "Could not create coupon");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(coupon: AdminCoupon) {
    try {
      await billingApi.updateCoupon(coupon.id, { isActive: !coupon.isActive });
      await load();
    } catch {
      setError("Failed to update coupon");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coupons</h1>
          <p className="text-sm text-muted-foreground">
            Generate codes for Pro (₹499) and Growth (₹999). Redemptions are tracked per workspace.
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New coupon
        </Button>
      </header>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" /> Active codes
          </CardTitle>
          <CardDescription>Share codes with customers — they apply at checkout on the billing page.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : coupons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No coupons yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">{c.code}</TableCell>
                    <TableCell>{formatDiscount(c)}</TableCell>
                    <TableCell>{planLabel(c.planKey)}</TableCell>
                    <TableCell>
                      {c.redemptionCount}
                      {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.isActive ? "secondary" : "outline"}>
                        {c.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(c)}>
                        {c.isActive ? "Disable" : "Enable"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Redemption history</CardTitle>
          <CardDescription>Who used which code and which plan was granted.</CardDescription>
        </CardHeader>
        <CardContent>
          {redemptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No redemptions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {redemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono">{r.couponCode}</TableCell>
                    <TableCell>{r.workspaceName || r.workspaceId}</TableCell>
                    <TableCell className="text-xs">{r.userEmail || r.userId}</TableCell>
                    <TableCell>{r.planKey === "growth" ? "Pro" : "Growth"}</TableCell>
                    <TableCell className="text-right">
                      ₹{(r.amountPaise / 100).toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create coupon</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="LAUNCH50"
              />
            </div>
            <div className="space-y-2">
              <Label>Applies to</Label>
              <Select
                value={form.planKey ?? "any"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, planKey: v === "any" ? null : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any paid plan</SelectItem>
                  <SelectItem value="growth">Pro (₹499)</SelectItem>
                  <SelectItem value="enterprise">Growth (₹999)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Discount type</Label>
                <Select
                  value={form.discountType}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      discountType: v as CreateAdminCouponPayload["discountType"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="fixed_inr">Fixed ₹</SelectItem>
                    <SelectItem value="free">Free (100%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.discountType !== "free" && (
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.discountValue}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, discountValue: Number(e.target.value) }))
                    }
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Max redemptions (optional)</Label>
              <Input
                type="number"
                min={1}
                value={form.maxRedemptions ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxRedemptions: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (internal)</Label>
              <Input
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.code.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
