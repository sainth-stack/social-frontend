"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminUser } from "@/types/admin";
import type { PlanTier } from "@/types/auth";

type ChangePlanModalProps = {
  user: AdminUser | null;
  saving?: boolean;
  error?: string | null;
  onCloseAutoFocus?: (event: Event) => void;
  onClose: () => void;
  onConfirm: (plan: PlanTier) => void;
};

export default function ChangePlanModal({
  user,
  saving = false,
  error = null,
  onCloseAutoFocus,
  onClose,
  onConfirm,
}: ChangePlanModalProps) {
  const [plan, setPlan] = useState<PlanTier>("starter");

  useEffect(() => {
    if (user) setPlan(user.plan);
  }, [user]);

  return (
    <Dialog open={Boolean(user)} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Confirm plan assignment</DialogTitle>
          <DialogDescription className="break-words">
            {user
              ? `Update the primary owned workspace ${user.workspaceName} for ${user.email}. This changes workspace entitlements without collecting payment.`
              : undefined}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="assign-user-plan">Plan</Label>
          <Select value={plan} disabled={saving} onValueChange={(v) => setPlan(v as PlanTier)}>
            <SelectTrigger id="assign-user-plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="starter">Free</SelectItem>
              <SelectItem value="growth">Pro</SelectItem>
              <SelectItem value="enterprise">Growth</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">All plans include unlimited connected accounts.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => { if (!saving && user?.workspaceId && plan !== user.plan) onConfirm(plan); }} disabled={saving || !user?.workspaceId || plan === user.plan}>
            {saving ? "Saving…" : error ? "Retry plan assignment" : "Confirm plan assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
