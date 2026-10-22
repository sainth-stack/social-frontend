"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, CreditCard, Sparkle, X, Zap } from "lucide-react";

import type { NavItem, NavSection } from "@/components/layouts/nav-config";
import { useDashboardUsage } from "@/hooks/useDashboardUsage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { selectUser } from "@/features/auth/authSlice";
import { canManageSettings } from "@/lib/permissions";
import { PLAN_DISPLAY_NAMES } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";

export type SidebarBrand =
  | { type: "platform" }
  | { type: "organization"; name: string; logoUrl?: string | null };

type SidebarProps = {
  sections: NavSection[];
  brand: SidebarBrand;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
};

const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar";

function navigate(event: MouseEvent<HTMLAnchorElement>, onNavigate?: () => void) {
  if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onNavigate?.();
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin" || href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(pathname: string, item: NavItem): boolean {
  if (isActive(pathname, item.href)) return true;
  return item.children?.some((child) => isActive(pathname, child.href)) ?? false;
}

function workspaceInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function NavLink({
  item,
  pathname,
  nested = false,
  collapsed = false,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  nested?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={(event) => navigate(event, onNavigate)}
      aria-current={pathname === item.href ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        focusClass,
        nested && !collapsed && "ml-3",
        collapsed && "justify-center px-2",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
      {item.badge && !collapsed ? (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function NavGroup({
  item,
  pathname,
  collapsed = false,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const groupActive = isGroupActive(pathname, item);
  const [open, setOpen] = useState(groupActive);
  const id = useId();
  const Icon = item.icon;

  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive]);

  if (!item.children?.length) {
    return <NavLink item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />;
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          focusClass,
          collapsed && "justify-center px-2",
          groupActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
        )}
      >
        <Icon aria-hidden="true" className={cn("size-4 shrink-0", groupActive && "text-primary")} />
        {!collapsed ? <><span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown aria-hidden="true"
          className={cn("h-4 w-4 opacity-60 transition-transform", open && "rotate-180")}
        /></> : null}
      </button>
        <div id={id} hidden={!open} className="mt-1 space-y-1">
          {item.children.map((child) => (
            <NavLink
              key={child.href}
              item={child}
              pathname={pathname}
              nested
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
    </div>
  );
}

function UsageCard({ state, collapsed, onNavigate }: {
  state: ReturnType<typeof useDashboardUsage>;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const user = useAppSelector(selectUser);
  const plan = user?.plan ?? "starter";
  const label = PLAN_DISPLAY_NAMES[plan] ?? plan;
  const posts = state.usage?.postsThisMonth;
  const percent = posts && posts.limit !== null ? (posts.limit === 0 ? (posts.used > 0 ? 100 : 0) : Math.min(100, posts.used / posts.limit * 100)) : null;
  if (collapsed) return <Link href="/dashboard/billing" aria-label="Manage billing" title={`Manage billing · ${label}`} onClick={(event) => navigate(event, onNavigate)} className={cn("mx-3 mb-4 flex min-h-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground", focusClass)}><CreditCard className="size-4" aria-hidden="true" /></Link>;
  return (
    <section aria-label="Plan and usage" className="mx-3 mb-4 rounded-xl border border-sidebar-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div><p className="text-xs text-muted-foreground">Current plan</p><p className="mt-1 text-sm font-semibold">{label}</p></div>
        {plan !== "enterprise" && canManageSettings(user) ? <Link href="/dashboard/billing" onClick={(event) => navigate(event, onNavigate)} className={cn("inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15", focusClass)}><Zap className="size-3" aria-hidden="true" />Upgrade</Link> : null}
      </div>
      <div className="mt-3 space-y-2" aria-busy={state.loading}>
        {state.loading && !posts ? <p role="status" className="text-xs text-muted-foreground">Loading usage…</p> : null}
        {state.error ? <div role="alert" className="text-xs text-muted-foreground"><p>{state.error}</p><Button variant="link" size="sm" className="h-7 px-0 text-xs" disabled={state.loading} onClick={() => void state.reload()}>Retry usage</Button></div> : null}
        {posts ? <><div className="flex justify-between gap-2 text-xs"><span className="text-muted-foreground">Posts this month</span><span className="font-medium tabular-nums">{posts.used} / {posts.limit === null ? "Unlimited" : posts.limit}</span></div>{percent !== null ? <Progress value={percent} aria-label="Monthly post usage" className="h-1" /> : null}</> : null}
      </div>
      <Button variant="outline" size="sm" className="mt-3 h-8 w-full text-xs" asChild><Link href="/dashboard/billing" onClick={(event) => navigate(event, onNavigate)}>Manage billing</Link></Button>
    </section>
  );
}

function SidebarHeader({
  brand,
  homeHref,
  collapsed,
  onNavigate,
}: {
  brand: SidebarBrand;
  homeHref: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const isAdmin = brand.type === "platform";

  if (isAdmin) {
    return (
      <Link
        href={homeHref}
        onClick={(event) => navigate(event, onNavigate)}
        aria-label="OpsBrain AI · Admin console"
        title={collapsed ? "OpsBrain AI" : undefined}
        className={cn("flex h-20 shrink-0 items-center gap-3 border-b border-sidebar-border px-4", focusClass, collapsed && "justify-center px-2")}
      >
        <Image
          src="/brand/mark.png"
          alt=""
          width={36}
          height={36}
          className="size-9 shrink-0 rounded-lg object-cover"
          aria-hidden
        />
        {!collapsed ? <div className="min-w-0 flex flex-col">
          <span className="truncate text-sm font-semibold text-foreground">
            OpsBrain <span className="text-primary">AI</span>
          </span>
          <span className="truncate text-xs text-muted-foreground">Admin console</span>
        </div> : null}
      </Link>
    );
  }

  const org = brand as { type: "organization"; name: string; logoUrl?: string | null };

  return (
    <Link
      href={homeHref}
      onClick={(event) => navigate(event, onNavigate)}
      aria-label={`${org.name} · Social workspace`}
      title={collapsed ? org.name : undefined}
      className={cn("flex h-20 shrink-0 items-center gap-3 border-b border-sidebar-border px-4", focusClass, collapsed && "justify-center px-2")}
    >
      <Avatar className="h-9 w-9 shrink-0 rounded-lg border border-border/60">
        {org.logoUrl ? <AvatarImage src={org.logoUrl} alt="" /> : null}
        <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
          {workspaceInitials(org.name || "WS")}
        </AvatarFallback>
      </Avatar>
      {!collapsed ? <div className="min-w-0 flex flex-col">
        <span className="truncate text-sm font-semibold text-foreground">{org.name}</span>
        <span className="truncate text-xs text-muted-foreground">Social workspace</span>
      </div> : null}
    </Link>
  );
}

function SidebarContent({
  sections,
  brand,
  collapsed = false,
  usage,
  onNavigate,
}: {
  sections: NavSection[];
  brand: SidebarBrand;
  collapsed?: boolean;
  usage: ReturnType<typeof useDashboardUsage>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isAdmin = brand.type === "platform";
  const homeHref = isAdmin ? "/admin" : "/dashboard";

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <SidebarHeader brand={brand} homeHref={homeHref} collapsed={collapsed} onNavigate={onNavigate} />

      <nav aria-label={isAdmin ? "Admin navigation" : "Workspace navigation"} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {sections.map((section, sectionIndex) => (
          <div key={section.title ?? `section-${sectionIndex}`} className="space-y-1">
            {section.title ? (
              <p className={cn("px-3 pb-2 text-xs font-medium text-muted-foreground", collapsed && "sr-only")}>
                {section.title}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavGroup
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!isAdmin ? <UsageCard state={usage} collapsed={collapsed} onNavigate={onNavigate} /> : null}
      {isAdmin ? (
        <div className="mx-3 mb-4 rounded-xl border border-sidebar-border bg-card p-3">
          <Link
            href="/dashboard"
            onClick={(event) => navigate(event, onNavigate)}
            aria-label="Back to workspace app"
            title={collapsed ? "Back to workspace app" : undefined}
            className={cn("flex min-h-6 items-center gap-2 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground", focusClass, collapsed && "justify-center")}
          >
            <Sparkle aria-hidden="true" className="size-4 shrink-0 text-primary" /> {!collapsed ? "Back to workspace app" : null}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function Sidebar({
  sections,
  brand,
  mobileOpen = false,
  onMobileClose,
  collapsed = false,
}: SidebarProps) {
  const user = useAppSelector(selectUser);
  const pathname = usePathname();
  const usage = useDashboardUsage(user?.workspaceId, Boolean(user?.workspaceId && brand.type !== "platform"));
  const previous = useRef({ pathname, plan: user?.plan, workspace: user?.workspaceId });
  useEffect(() => {
    const last = previous.current;
    if (last.workspace === user?.workspaceId && (last.pathname !== pathname || last.plan !== user?.plan)) void usage.reload();
    previous.current = { pathname, plan: user?.plan, workspace: user?.workspaceId };
  }, [pathname, user?.plan, user?.workspaceId, usage.reload]);
  return (
    <>
      <aside id="desktop-navigation" aria-label="Desktop sidebar" className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar lg:flex", collapsed ? "w-20" : "w-64")}>
        <SidebarContent sections={sections} brand={brand} collapsed={collapsed} usage={usage} />
      </aside>
      <Dialog.Root open={mobileOpen} onOpenChange={(open) => { if (!open) onMobileClose?.(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 lg:hidden" />
          <Dialog.Content id="mobile-navigation" className="fixed inset-y-0 left-0 z-50 w-64 max-w-full border-r border-sidebar-border bg-sidebar shadow-xl focus:outline-none lg:hidden" onCloseAutoFocus={(event) => { const trigger = document.getElementById("navigation-menu-trigger"); if (trigger) { event.preventDefault(); trigger.focus(); } }}>
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Navigate your {brand.type === "platform" ? "admin console" : "workspace"} and manage your plan.</Dialog.Description>
            <Dialog.Close asChild><Button variant="outline" size="icon" aria-label="Close navigation" className="absolute right-2 top-2 z-10 size-6"><X className="size-3" aria-hidden="true" /></Button></Dialog.Close>
            <SidebarContent sections={sections} brand={brand} usage={usage} onNavigate={onMobileClose} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
