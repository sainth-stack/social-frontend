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
  onClose: () => void;
  onConfirm: (plan: PlanTier) => void;
};

export default function ChangePlanModal({
  user,
  saving = false,
  onClose,
  onConfirm,
}: ChangePlanModalProps) {
  const [plan, setPlan] = useState<PlanTier>("starter");

  useEffect(() => {
    if (user) setPlan(user.plan);
  }, [user]);

  return (
    <Dialog open={Boolean(user)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign plan</DialogTitle>
          <DialogDescription>
            {user
              ? `Update the subscription plan for ${user.workspaceName}. No payment required — admin assignment only.`
              : undefined}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Plan</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as PlanTier)}>
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
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(plan)} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
