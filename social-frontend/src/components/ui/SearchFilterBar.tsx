"use client";

import type { ReactNode } from "react";
import SearchIcon from "@mui/icons-material/Search";
import { Box, InputAdornment, MenuItem } from "@mui/material";

import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";

export type SearchFilterOption = {
  value: string;
  label: string;
};

type SearchFilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: SearchFilterOption[];
  filterLabel?: string;
  filterSlot?: ReactNode;
  rightAction?: ReactNode;
};

export default function SearchFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterValue,
  onFilterChange,
  filterOptions,
  filterLabel = "Status",
  filterSlot,
  rightAction,
}: SearchFilterBarProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap: 1.5,
        mb: 2,
      }}
    >
      <AppInput
        compact
        hideLabel
        placeholder={searchPlaceholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        sx={{ flex: 1, minWidth: 220 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },
        }}
      />

      {filterSlot}

      {filterOptions && onFilterChange ? (
        <AppSelect
          label={filterLabel}
          value={filterValue ?? "all"}
          onChange={(event) => onFilterChange(event.target.value)}
          sx={{ minWidth: 160 }}
          options={[{ value: "all", label: "All" }, ...filterOptions]}
        />
      ) : null}

      {rightAction ? <Box sx={{ ml: "auto" }}>{rightAction}</Box> : null}
    </Box>
  );
}
