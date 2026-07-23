"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import ChartCard from "@/components/ui/ChartCard";
import { chartAxisTick, chartTooltipStyle, colors } from "@/lib/theme";
import { PLATFORM_COLORS } from "@/types/social-media.types";

type EngagementChartProps = {
  data: Array<Record<string, string | number>>;
  height?: number;
};

const SERIES = [
  { key: "facebook", color: PLATFORM_COLORS.facebook },
  { key: "instagram", color: PLATFORM_COLORS.instagram },
  { key: "linkedin", color: PLATFORM_COLORS.linkedin },
  { key: "x", color: PLATFORM_COLORS.x },
] as const;

export default function EngagementChart({ data, height = 280 }: EngagementChartProps) {
  return (
    <ChartCard title="Engagement over time" subtitle="Total engagements by platform" height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={chartAxisTick} axisLine={false} tickLine={false} />
          <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Legend />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
