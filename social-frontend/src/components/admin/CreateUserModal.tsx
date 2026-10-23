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
  onCloseAutoFocus?: (event: Event) => void;
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
  onCloseAutoFocus,
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
    if (saving) return;
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
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-lg" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Create a user and their workspace. This administrative plan assignment does not collect payment. All plans include unlimited connected accounts.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }} aria-busy={saving}>
        <fieldset disabled={saving} className="min-w-0 space-y-4">
          {(localError || error) && (
            <p role="alert" id="create-user-error" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {localError || error}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-user-name">Full name</Label>
              <Input
                id="create-user-name"
                required
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-user-workspace">Workspace</Label>
              <Input
                id="create-user-workspace"
                value={form.workspaceName}
                onChange={(e) => setForm((f) => ({ ...f, workspaceName: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-user-email">Email</Label>
            <Input
              id="create-user-email"
              required
              autoComplete="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-user-password">Password</Label>
            <Input
              id="create-user-password"
              required
              minLength={8}
              autoComplete="new-password"
              aria-describedby="create-user-password-hint"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <p id="create-user-password-hint" className="text-xs text-muted-foreground">Use at least 8 characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-user-plan">Plan</Label>
            <Select
              disabled={saving}
              value={form.plan}
              onValueChange={(v) => setForm((f) => ({ ...f, plan: v as PlanTier }))}
            >
              <SelectTrigger id="create-user-plan">
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
              disabled={saving}
              aria-describedby="create-user-admin-context"
              checked={form.isPlatformAdmin}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, isPlatformAdmin: v === true }))
              }
            />
            <span>Grant platform administrator access</span>
          </label>
          <p id="create-user-admin-context" className="text-sm text-muted-foreground">Platform administrators can manage users, workspaces and platform settings. Only grant this privilege to a trusted operator.</p>
          {form.isPlatformAdmin && <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">Confirm that {form.email || "this user"} should receive platform-wide administrator privileges before creating this account.</p>}
        </fieldset>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} aria-describedby={localError || error ? "create-user-error" : undefined}>
            {saving ? "Creating…" : error ? "Retry creation" : form.isPlatformAdmin ? "Create platform admin" : "Create user"}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
