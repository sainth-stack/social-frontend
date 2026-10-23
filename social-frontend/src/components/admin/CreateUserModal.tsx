"use client";

import { useEffect, useState } from "react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CreateAdminUserPayload } from "@/types/admin";
import type { PlanTier } from "@/types/auth";

type CreateUserModalProps = {
  open: boolean;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (payload: CreateAdminUserPayload) => void;
};

const EMPTY = {
  name: "",
  email: "",
  password: "",
  workspaceName: "",
  plan: "starter" as PlanTier,
  isPlatformAdmin: false,
};

export default function CreateUserModal({
  open,
  saving = false,
  error = null,
  onClose,
  onConfirm,
}: CreateUserModalProps) {
  const [form, setForm] = useState(EMPTY);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setLocalError(null);
    }
  }, [open]);

  function submit() {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      setLocalError("Name, email, and a password of at least 8 characters are required.");
      return;
    }
    setLocalError(null);
    onConfirm({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      workspaceName: form.workspaceName.trim() || undefined,
      plan: form.plan,
      isPlatformAdmin: form.isPlatformAdmin,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Provision a workspace and assign a plan (no Stripe).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {(localError || error) && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {localError || error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Workspace</Label>
              <Input
                value={form.workspaceName}
                onChange={(e) => setForm((f) => ({ ...f, workspaceName: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select
              value={form.plan}
              onValueChange={(v) => setForm((f) => ({ ...f, plan: v as PlanTier }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Free</SelectItem>
                <SelectItem value="growth">Pro</SelectItem>
                <SelectItem value="enterprise">Growth</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isPlatformAdmin}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, isPlatformAdmin: v === true }))
              }
            />
            <span>Platform admin</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
