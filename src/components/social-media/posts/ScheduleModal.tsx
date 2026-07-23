"use client";

import { useEffect, useState } from "react";

import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";

type ScheduleModalProps = {
  open: boolean;
  loading?: boolean;
  initialValue?: string;
  onClose: () => void;
  onConfirm: (scheduledAt: string) => void;
};

function toLocalInputValue(iso?: string): string {
  const date = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ScheduleModal({
  open,
  loading,
  initialValue,
  onClose,
  onConfirm,
}: ScheduleModalProps) {
  const [value, setValue] = useState(toLocalInputValue(initialValue));

  useEffect(() => {
    if (open) setValue(toLocalInputValue(initialValue));
  }, [open, initialValue]);

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Schedule post"
      maxWidth="xs"
      footer={
        <>
          <AppButton variant="ghost" onClick={onClose}>
            Cancel
          </AppButton>
          <AppButton
            variant="primary"
            loading={loading}
            onClick={() => {
              const date = new Date(value);
              if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
                return;
              }
              onConfirm(date.toISOString());
            }}
          >
            Schedule
          </AppButton>
        </>
      }
    >
      <AppInput
        type="datetime-local"
        label="Publish at"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
    </AppModal>
  );
}
