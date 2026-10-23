"use client";

import { Box, Tab, Tabs } from "@mui/material";

import { colors } from "@/lib/theme";

export type PageTab = {
  label: string;
  href: string;
};

type PageTabsProps = {
  tabs: PageTab[];
  value: number;
  onChange: (index: number) => void;
  scrollable?: boolean;
};

export default function PageTabs({ tabs, value, onChange, scrollable = false }: PageTabsProps) {
  return (
    <Box sx={{ borderBottom: `1px solid ${colors.border}`, mb: 2 }}>
      <Tabs
        value={value}
        onChange={(_, idx: number) => onChange(idx)}
        variant={scrollable ? "scrollable" : "standard"}
        scrollButtons={scrollable ? "auto" : false}
        sx={{
          "& .MuiTab-root": {
            textTransform: "none",
            fontWeight: 500,
            fontSize: "0.875rem",
            minHeight: 44,
          },
        }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.href} label={tab.label} />
        ))}
      </Tabs>
    </Box>
  );
}

export const pageTabsSx = {
  borderBottom: `1px solid ${colors.border}`,
  mb: 2,
  "& .MuiTab-root": {
    textTransform: "none",
    fontWeight: 500,
    fontSize: "0.875rem",
    minHeight: 44,
  },
} as const;
