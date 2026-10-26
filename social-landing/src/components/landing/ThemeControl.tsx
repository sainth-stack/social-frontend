"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/ThemeProvider";
import type { ThemePreference } from "@/lib/theme";

export function ThemeControl() {
  const { preference, setPreference } = useTheme();
  return <DropdownMenu>
    <DropdownMenuTrigger className="btn btn-outline min-w-11 px-3" aria-label="Choose color theme">
      <Sun aria-hidden="true" className="size-4 dark:hidden" />
      <Moon aria-hidden="true" className="hidden size-4 dark:block" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" aria-label="Color theme">
      <DropdownMenuRadioGroup value={preference} onValueChange={value => setPreference(value as ThemePreference)}>
        <DropdownMenuRadioItem value="light" className="min-h-11"><Sun aria-hidden="true" className="mr-2 size-4" />Light</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark" className="min-h-11"><Moon aria-hidden="true" className="mr-2 size-4" />Dark</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system" className="min-h-11"><Monitor aria-hidden="true" className="mr-2 size-4" />System</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}