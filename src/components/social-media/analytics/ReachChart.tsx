"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import ChartCard from "@/components/ui/ChartCard";
import { chartAxisTick, chartTooltipStyle, colors } from "@/lib/theme";

type ReachChartProps = {
  data: Array<{ platform: string; reach: number }>;
  height?: number;
};

export default function ReachChart({ data, height = 280 }: ReachChartProps) {
  return (
    <ChartCard title="Reach by platform" subtitle="Total reach in selected range" height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="platform" tick={chartAxisTick} axisLine={false} tickLine={false} />
          <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={36} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Bar dataKey="reach" fill={colors.primary} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
