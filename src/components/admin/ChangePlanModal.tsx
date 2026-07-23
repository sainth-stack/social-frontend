"use client";

import { useEffect, useState } from "react";

import AppButton from "@/components/ui/AppButton";
import AppModal from "@/components/ui/AppModal";
import AppSelect from "@/components/ui/AppSelect";
import type { AdminUser } from "@/types/admin";
import type { PlanTier } from "@/types/auth";

const PLAN_OPTIONS: Array<{ value: PlanTier; label: string }> = [
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "enterprise", label: "Enterprise" },
];

type ChangePlanModalProps = {
  user: AdminUser | null;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (plan: PlanTier) => void;
};

export default function ChangePlanModal({ user, saving = false, onClose, onConfirm }: ChangePlanModalProps) {
  const [plan, setPlan] = useState<PlanTier>("starter");

  useEffect(() => {
    if (user) setPlan(user.plan);
  }, [user]);

  return (
    <AppModal
      open={Boolean(user)}
      onClose={onClose}
      title="Change plan"
      description={user ? `Update the subscription plan for ${user.workspaceName}.` : undefined}
      maxWidth="xs"
      footer={
        <>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </AppButton>
          <AppButton onClick={() => onConfirm(plan)} loading={saving}>
            Save changes
          </AppButton>
        </>
      }
    >
      <AppSelect
        label="Plan"
        value={plan}
        onChange={(e) => setPlan(e.target.value as PlanTier)}
        options={PLAN_OPTIONS}
      />
    </AppModal>
  );
}
