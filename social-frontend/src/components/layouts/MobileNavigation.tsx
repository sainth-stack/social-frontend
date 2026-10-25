"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { filterNavSections, type NavSection } from "./nav-config";
import { selectUser } from "@/features/auth/authSlice";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/lib/utils";

export default function MobileNavigation({ sections, isAdmin, onMenuClick, menuOpen }: {
  sections: NavSection[];
  isAdmin: boolean;
  onMenuClick: () => void;
  menuOpen: boolean;
}) {
  const pathname = usePathname();
  const user = useAppSelector(selectUser);
  const priorities = isAdmin
    ? ["/admin", "/admin/users", "/admin/ai-usage"]
    : ["/dashboard", "/dashboard/content-studio", "/dashboard/calendar", "/dashboard/posts"];
  const available = filterNavSections(sections, user).flatMap((section) => section.items);
  const items = priorities.flatMap((href) => available.filter((item) => item.href === href));
  const active = [...items].reverse().find((item) => pathname === item.href || (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(`${item.href}/`)));

  return <nav aria-label={isAdmin ? "Mobile admin navigation" : "Mobile workspace navigation"} className="mobile-navigation fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 px-2 backdrop-blur lg:hidden">
    {items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={active?.href === href ? "page" : undefined} className={cn("flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-center text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active?.href === href ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      <Icon aria-hidden="true" className="size-5 shrink-0" /><span className="max-w-full truncate">{href === "/admin/ai-usage" ? "AI costs" : href === "/dashboard/content-studio" ? "Studio" : href === "/dashboard" ? "Home" : label}</span>
    </Link>)}
    <button type="button" onClick={onMenuClick} aria-label="More navigation" aria-expanded={menuOpen} aria-controls="mobile-navigation" className={cn("flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", !active || menuOpen ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Menu aria-hidden="true" className="size-5" /><span>More</span></button>
  </nav>;
}