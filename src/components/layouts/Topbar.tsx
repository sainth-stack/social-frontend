"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, CreditCard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Shield, User as UserIcon } from "lucide-react";
import { adminNavSections, dashboardNavSections, filterNavSections } from "@/components/layouts/nav-config";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const selecting = useRef(false);
  const navigationLinks = useRef(new Map<string, HTMLAnchorElement>());
  const sections = useMemo(() => filterNavSections(isAdmin ? adminNavSections : dashboardNavSections, user), [isAdmin, user]);
  const crumbs = getBreadcrumbs(pathname).map((crumb, index, list) => ({ ...crumb, label: index === list.length - 1 && /^\/dashboard\/posts\/[^/]+$/.test(pathname) && !["drafts", "scheduled", "published", "failed", "archived", "publishing"].includes(pathname.split("/").pop()!) ? "Post details" : crumb.label }));
  const role = user ? user.isPlatformAdmin ? "Platform admin" : socialPermissionLabel(user.socialPermissionLevel) : "";

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !event.altKey) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => { setSearchOpen(false); setSearch(""); }, [pathname, user?.workspaceId, user?.id]);

  return <>
    <header className="sticky top-0 z-20 flex h-16 min-w-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur lg:gap-4 lg:px-8">
      <Button id="navigation-menu-trigger" variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={onMenuClick} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="mobile-navigation"><Menu aria-hidden="true" className="h-5 w-5" /></Button>
      <Button variant="ghost" size="icon" className="hidden shrink-0 lg:inline-flex" onClick={onCollapseClick} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="desktop-navigation">{collapsed ? <PanelLeftOpen aria-hidden="true" className="h-4 w-4" /> : <PanelLeftClose aria-hidden="true" className="h-4 w-4" />}</Button>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-xs font-medium text-muted-foreground">{isAdmin ? "Platform admin" : user?.workspaceName || "Workspace"}</p>
        <nav aria-label="Breadcrumb"><ol className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">{crumbs.map((crumb, index) => <li key={index} className={index === crumbs.length - 1 ? "flex min-w-0 items-center gap-1.5" : "hidden shrink-0 items-center gap-1.5 sm:flex"}>{index > 0 && <ChevronRight aria-hidden="true" className="hidden h-3 w-3 shrink-0 text-muted-foreground sm:block" />}{crumb.href ? <Link href={crumb.href} className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{crumb.label}</Link> : <span aria-current="page" className="truncate">{crumb.label}</span>}</li>)}</ol></nav>
      </div>
      {!isAdmin && user && <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">{PLAN_DISPLAY_NAMES[user.plan] ?? "Free"}</Badge>}
      <Button ref={searchTrigger} variant="outline" aria-label="Search navigation" aria-keyshortcuts="Control+k Meta+k" onClick={() => setSearchOpen(true)} className="h-9 w-9 shrink-0 p-0 xl:w-56 xl:justify-start xl:px-3"><Search aria-hidden="true" className="h-4 w-4" /><span className="hidden xl:inline">Quick navigation</span><kbd className="ml-auto hidden rounded border border-border bg-muted px-1 py-0.5 text-xs text-muted-foreground xl:inline">Ctrl / ⌘ K</kbd></Button>
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
    </header>
    <Dialog open={searchOpen} onOpenChange={(open) => { setSearchOpen(open); if (!open) setSearch(""); }}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl" onCloseAutoFocus={(event) => { event.preventDefault(); searchTrigger.current?.focus(); }}>
        <DialogHeader className="sr-only"><DialogTitle>Quick navigation</DialogTitle><DialogDescription>Find a workspace screen. Use arrow keys to choose a result, then press Enter.</DialogDescription></DialogHeader>
        <Command><CommandInput aria-label="Find a screen" placeholder="Where would you like to go?" value={search} onValueChange={setSearch} className="pr-10" /><CommandList><CommandEmpty>No screens found. Try another name.</CommandEmpty>{sections.map((section, index) => <CommandGroup key={index} heading={section.title ?? (isAdmin ? "Platform" : "Workspace app")}>{section.items.flatMap((item) => [item, ...(item.children ?? [])]).map((item) => { const Icon = item.icon; return <CommandItem key={item.href} value={`${item.label} ${item.href}`} onSelect={() => { if (selecting.current || document.activeElement?.getAttribute("role") !== "combobox") return; selecting.current = true; navigationLinks.current.get(item.href)?.click(); selecting.current = false; }} asChild className="gap-3 px-3 py-3"><Link ref={(node) => { if (node) navigationLinks.current.set(item.href, node); else navigationLinks.current.delete(item.href); }} href={item.href} onClick={() => { setSearchOpen(false); setSearch(""); }}><Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" /><span>{item.label}</span></Link></CommandItem>; })}</CommandGroup>)}</CommandList></Command>
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Search screens and shortcuts, not post content. Press Escape to close.</p>
      </DialogContent>
    </Dialog>
  </>;
}