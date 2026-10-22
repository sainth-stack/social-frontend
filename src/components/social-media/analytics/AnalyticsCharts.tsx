"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAnalyticsDate } from "./analytics-view";

const tooltipStyle = {
  background: "var(--card)",
  color: "var(--foreground)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
};

export default function AnalyticsCharts({ data }: { data: Array<{ date: string; engagements: number }> }) {
  const gradient = useId().replace(/:/g, "");
  return (
    <div className="h-72 w-full min-w-0" role="img" aria-label="Daily engagements for the selected period. Exact values are available in the data table.">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} accessibilityLayer>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatAnalyticsDate} minTickGap={36} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} tickMargin={12} />
          <YAxis allowDecimals={false} width={42} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={(value: number) => Intl.NumberFormat(undefined, { notation: "compact" }).format(value)} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => formatAnalyticsDate(String(label))} formatter={(value) => [Number(value).toLocaleString(), "Engagements"]} />
          <Area type="monotone" dataKey="engagements" name="Engagements" stroke="var(--primary)" strokeWidth={2.5} fill={`url(#${gradient})`} isAnimationActive={false} activeDot={{ r: 5, strokeWidth: 3, stroke: "var(--card)" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}