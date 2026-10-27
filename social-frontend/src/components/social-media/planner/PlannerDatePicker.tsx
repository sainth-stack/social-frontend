"use client";

import { DatePicker } from "@/components/ui/date-picker";

export { dateCount } from "@/components/ui/date-picker";

export default function PlannerDatePicker({ mode, ...props }: { mode: string; start: string; end: string; dates: string[]; today: string; cap: number; disabled?: boolean; onChange: (start: string, end: string, dates: string[]) => void }) {
  return <DatePicker {...props} mode={mode === "range" ? "range" : "multiple"} />;
}