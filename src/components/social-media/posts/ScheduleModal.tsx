"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule post</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="schedule-at">Publish at</Label>
          <Input
            id="schedule-at"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={loading}
            onClick={() => {
              const date = new Date(value);
              if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
                return;
              }
              onConfirm(date.toISOString());
            }}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
