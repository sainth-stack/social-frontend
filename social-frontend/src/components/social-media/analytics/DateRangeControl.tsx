"use client";

import { Chip, Stack } from "@mui/material";

import AppDatePicker from "@/components/ui/AppDatePicker";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  selectAnalyticsDateRange,
  setAnalyticsDateRange,
} from "@/features/social-media/socialAnalyticsSlice";

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type DateRangeControlProps = {
  onChange?: (range: { from: string; to: string }) => void;
};

export default function DateRangeControl({ onChange }: DateRangeControlProps) {
  const dispatch = useAppDispatch();
  const range = useAppSelector(selectAnalyticsDateRange);

  const apply = (from: string, to: string) => {
    dispatch(setAnalyticsDateRange({ from, to }));
    onChange?.({ from, to });
  };

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (days - 1));
    apply(toIsoDate(from), toIsoDate(to));
  };

  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "flex-end" }}>
      {PRESETS.map((p) => (
        <Chip
          key={p.label}
          size="small"
          label={p.label}
          clickable
          color={
            (() => {
              const to = new Date();
              const from = new Date();
              from.setDate(to.getDate() - (p.days - 1));
              return range.from === toIsoDate(from) && range.to === toIsoDate(to)
                ? "primary"
                : "default";
            })()
          }
          onClick={() => applyPreset(p.days)}
        />
      ))}
      <AppDatePicker
        label="From"
        value={range.from}
        onChange={(value) => apply(value, range.to)}
        fullWidth={false}
      />
      <AppDatePicker
        label="To"
        value={range.to}
        onChange={(value) => apply(range.from, value)}
        fullWidth={false}
      />
    </Stack>
  );
}
