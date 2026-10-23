"use client";

import type { ReactNode, SyntheticEvent } from "react";
import { Box, Tab, Tabs } from "@mui/material";

import { colors } from "@/lib/theme";

export type TabsHeaderItem = {
  label: string;
  value?: string | number;
  disabled?: boolean;
};

type TabsHeaderProps = {
  tabs: TabsHeaderItem[];
  value: number;
  onChange: (event: SyntheticEvent, value: number) => void;
  action?: ReactNode;
};

export default function TabsHeader({ tabs, value, onChange, action }: TabsHeaderProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${colors.border}`,
        px: 2,
        gap: 2,
      }}
    >
      <Tabs
        value={value}
        onChange={onChange}
        sx={{
          minHeight: 48,
          flex: 1,
          "& .MuiTabs-flexContainer": { gap: 0.5 },
        }}
      >
        {tabs.map((tab, index) => (
          <Tab
            key={tab.value ?? tab.label}
            label={tab.label}
            disabled={tab.disabled}
            value={index}
          />
        ))}
      </Tabs>
      {action ? <Box sx={{ flexShrink: 0, py: 1 }}>{action}</Box> : null}
    </Box>
  );
}
