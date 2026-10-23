"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, CreditCard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Settings, Shield, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logout, selectUser } from "@/features/auth/authSlice";
import { getBreadcrumbs } from "@/lib/navigation";
import { canManageSettings, hasSocialPermission, socialPermissionLabel } from "@/lib/permissions";
import { PLAN_DISPLAY_NAMES } from "@/lib/plans";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

type TopbarProps = { onMenuClick?: () => void; isAdmin?: boolean; onCollapseClick?: () => void; collapsed?: boolean; menuOpen?: boolean };
const initials = (name: string) => name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U";

export default function Topbar({ onMenuClick, isAdmin = false, onCollapseClick, collapsed = false, menuOpen = false }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const crumbs = getBreadcrumbs(pathname).map((crumb, index, list) => ({ ...crumb, label: index === list.length - 1 && /^\/dashboard\/posts\/[^/]+$/.test(pathname) && !["drafts", "scheduled", "published", "failed", "archived", "publishing"].includes(pathname.split("/").pop()!) ? "Post details" : crumb.label }));
  const role = user ? user.isPlatformAdmin ? "Platform admin" : socialPermissionLabel(user.socialPermissionLevel) : "";

  return <header className="sticky top-0 z-20 flex h-16 min-w-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur lg:gap-4 lg:px-8">
      <Button id="navigation-menu-trigger" variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={onMenuClick} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="mobile-navigation"><Menu aria-hidden="true" className="h-5 w-5" /></Button>
      <Button variant="ghost" size="icon" className="hidden shrink-0 lg:inline-flex" onClick={onCollapseClick} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="desktop-navigation">{collapsed ? <PanelLeftOpen aria-hidden="true" className="h-4 w-4" /> : <PanelLeftClose aria-hidden="true" className="h-4 w-4" />}</Button>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-xs font-medium text-muted-foreground">{isAdmin ? "Platform admin" : user?.workspaceName || "Workspace"}</p>
        <nav aria-label="Breadcrumb"><ol className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">{crumbs.map((crumb, index) => <li key={index} className={index === crumbs.length - 1 ? "flex min-w-0 items-center gap-1.5" : "hidden shrink-0 items-center gap-1.5 sm:flex"}>{index > 0 && <ChevronRight aria-hidden="true" className="hidden h-3 w-3 shrink-0 text-muted-foreground sm:block" />}{crumb.href ? <Link href={crumb.href} className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{crumb.label}</Link> : <span aria-current="page" className="truncate">{crumb.label}</span>}</li>)}</ol></nav>
      </div>
      {!isAdmin && user && <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">{PLAN_DISPLAY_NAMES[user.plan] ?? "Free"}</Badge>}
      {!isAdmin && hasSocialPermission(user, "editor") && <Button size="sm" className="h-9 shrink-0 gap-1.5 px-2.5 sm:px-3" asChild><Link href="/dashboard/content-studio/generate" aria-label="Create a post"><Plus aria-hidden="true" className="h-4 w-4" /><span className="hidden sm:inline">Create post</span></Link></Button>}
      {user && <DropdownMenu>
        <DropdownMenuTrigger asChild><button type="button" aria-label="Open account menu" className="flex shrink-0 items-center gap-2 rounded-lg p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Avatar className="h-8 w-8"><AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(user.name)}</AvatarFallback></Avatar><ChevronDown aria-hidden="true" className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel><div className="min-w-0 space-y-1"><p className="truncate text-sm font-semibold">{user.name}</p><p className="break-all text-xs font-normal text-muted-foreground">{user.email}</p><p className="text-xs font-normal text-muted-foreground">{role}</p></div></DropdownMenuLabel><DropdownMenuSeparator />
          {!isAdmin && <DropdownMenuItem asChild><Link href="/dashboard"><UserIcon aria-hidden="true" className="mr-2 h-4 w-4" />Dashboard</Link></DropdownMenuItem>}
          {canManageSettings(user) && <DropdownMenuItem asChild><Link href="/dashboard/settings"><Settings aria-hidden="true" className="mr-2 h-4 w-4" />Workspace settings</Link></DropdownMenuItem>}
          {!isAdmin && <DropdownMenuItem asChild><Link href="/dashboard/billing"><CreditCard aria-hidden="true" className="mr-2 h-4 w-4" />Plan & billing</Link></DropdownMenuItem>}
          {user.isPlatformAdmin && <><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href={isAdmin ? "/dashboard" : "/admin"}><Shield aria-hidden="true" className="mr-2 h-4 w-4" />{isAdmin ? "Exit admin" : "Admin console"}</Link></DropdownMenuItem></>}
          <DropdownMenuSeparator /><DropdownMenuItem onClick={() => { dispatch(logout()); router.replace("/login"); }}><LogOut aria-hidden="true" className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>}
    </header>;
}