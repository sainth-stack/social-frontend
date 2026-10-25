"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminFilters({ children, activeCount, className }: { children: ReactNode; activeCount: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="min-w-0 sm:contents">
    <Button variant="outline" className="min-h-11 w-full justify-between sm:hidden" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <span className="flex items-center gap-2"><SlidersHorizontal className="size-4" aria-hidden />Advanced filters{activeCount > 0 ? ` · ${activeCount} active` : " · None active"}</span><ChevronDown className={cn("size-4", open && "rotate-180")} aria-hidden />
    </Button>
    <div id={id} className={cn(open ? "mt-4 sm:mt-0" : "hidden sm:block", className)}>{children}</div>
  </div>;
}

export function AdminTableView({ children }: { children: ReactNode }) {
  return <div className="min-w-0 max-md:[&_table]:block max-md:[&_thead]:sr-only max-md:[&_tbody]:grid max-md:[&_tbody]:gap-3 max-md:[&_tr]:block max-md:[&_tbody>tr]:rounded-xl max-md:[&_tbody>tr]:border max-md:[&_tbody>tr]:bg-card max-md:[&_tbody>tr]:p-4 max-md:[&_td]:block max-md:[&_td]:min-w-0 max-md:[&_td]:whitespace-normal max-md:[&_td]:break-words max-md:[&_td]:px-0 max-md:[&_td]:py-2 max-md:[&_td]:text-left max-md:[&_td]:before:mb-1 max-md:[&_td]:before:block max-md:[&_td]:before:text-xs max-md:[&_td]:before:font-medium max-md:[&_td]:before:text-muted-foreground max-md:[&_td]:before:content-[attr(data-label)] max-md:[&_td>div]:w-auto max-md:[&_td>details]:w-auto max-md:[&_td>div>div]:w-auto max-md:[&_td_button]:min-h-11 max-md:[&_td_a]:min-h-11 max-md:[&_td_a]:items-center max-md:[&_td_a]:inline-flex">
    {children}
  </div>;
}