"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Sparkle, Zap } from "lucide-react";

import type { NavItem, NavSection } from "@/components/layouts/nav-config";
import { useDashboardUsage } from "@/hooks/useDashboardUsage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { selectUser } from "@/features/auth/authSlice";
import { DEFAULT_PRICING_CATALOG } from "@/features/admin/pricingCatalog";
import { PLAN_DISPLAY_NAMES } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import type { PlanTier } from "@/types/auth";

export type SidebarBrand =
  | { type: "platform" }
  | { type: "organization"; name: string; logoUrl?: string | null };

type SidebarProps = {
  sections: NavSection[];
  brand: SidebarBrand;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

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

function planLabel(plan: PlanTier | string | undefined): string {
  if (!plan) return "Free";
  const key = String(plan).toLowerCase();
  return PLAN_DISPLAY_NAMES[key] ?? plan.charAt(0).toUpperCase() + plan.slice(1);
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
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
        nested && "ml-2 pl-3",
        active
          ? "bg-primary/[0.08] text-foreground shadow-sm shadow-primary/5"
          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
      )}
    >
      {active ? (
        <span
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
          aria-hidden
        />
      ) : null}
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function NavGroup({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const groupActive = isGroupActive(pathname, item);
  const [open, setOpen] = useState(groupActive);
  const Icon = item.icon;

  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive]);

  if (!item.children?.length) {
    return <NavLink item={item} pathname={pathname} onNavigate={onNavigate} />;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
          groupActive
            ? "bg-primary/[0.08] text-foreground"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
        )}
      >
        <Icon className={cn("h-[18px] w-[18px]", groupActive && "text-primary")} />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown
          className={cn("h-4 w-4 opacity-60 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="mt-0.5 space-y-0.5 border-l border-border/60 ml-4 pl-1">
          {item.children.map((child) => (
            <NavLink
              key={child.href}
              item={child}
              pathname={pathname}
              nested
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function UsageCard() {
  const user = useAppSelector(selectUser);
  const usage = useDashboardUsage(
    user?.workspaceId,
    Boolean(user?.workspaceId && !user?.isPlatformAdmin),
  );

  const plan = user?.plan ?? "starter";
  const catalog = DEFAULT_PRICING_CATALOG.find((p) => p.id === plan);
  const postsUsed = usage?.postsThisMonth.used ?? 0;
  const limit = usage?.postsThisMonth.limit ?? catalog?.limits.postsPerMonth ?? 60;
  const pct = limit ? Math.min(100, (postsUsed / limit) * 100) : 0;
  const nearLimit = pct >= 85;

  return (
    <div className="mx-3 mb-3 rounded-xl border border-border/80 bg-gradient-to-b from-card to-muted/30 p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Current plan
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">{planLabel(plan)}</p>
        </div>
        <Link
          href="/dashboard/billing"
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/15"
        >
          <Zap className="h-3 w-3" />
          Upgrade
        </Link>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Posts this month</span>
          <span className={cn("font-medium tabular-nums", nearLimit && "text-amber-600")}>
            {postsUsed}/{limit ?? "∞"}
          </span>
        </div>
        <Progress value={pct} className="h-1" />
      </div>
      <Button variant="outline" size="sm" className="mt-3 h-8 w-full text-xs" asChild>
        <Link href="/dashboard/billing">Manage billing</Link>
      </Button>
    </div>
  );
}

function SidebarHeader({
  brand,
  homeHref,
  onNavigate,
}: {
  brand: SidebarBrand;
  homeHref: string;
  onNavigate?: () => void;
}) {
  const isAdmin = brand.type === "platform";

  if (isAdmin) {
    return (
      <Link
        href={homeHref}
        onClick={onNavigate}
        className="flex h-[4.25rem] items-center gap-2.5 border-b border-sidebar-border px-4 no-underline"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/mark.png"
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-[22%] object-cover"
          aria-hidden
        />
        <div className="min-w-0 flex flex-col">
          <span className="truncate text-sm font-semibold text-foreground">
            OpsBrain <span className="text-primary">AI</span>
          </span>
          <span className="truncate text-[11px] text-muted-foreground">Admin console</span>
        </div>
      </Link>
    );
  }

  const org = brand as { type: "organization"; name: string; logoUrl?: string | null };

  return (
    <Link
      href={homeHref}
      onClick={onNavigate}
      className="flex h-[4.25rem] items-center gap-2.5 border-b border-sidebar-border px-4 no-underline"
    >
      <Avatar className="h-9 w-9 shrink-0 rounded-lg border border-border/60">
        {org.logoUrl ? <AvatarImage src={org.logoUrl} alt="" /> : null}
        <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
          {workspaceInitials(org.name || "WS")}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex flex-col">
        <span className="truncate text-sm font-semibold text-foreground">{org.name}</span>
        <span className="truncate text-[11px] text-muted-foreground">Social workspace</span>
      </div>
    </Link>
  );
}

function SidebarContent({
  sections,
  brand,
  onNavigate,
}: {
  sections: NavSection[];
  brand: SidebarBrand;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isAdmin = brand.type === "platform";
  const homeHref = isAdmin ? "/admin" : "/dashboard";

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <SidebarHeader brand={brand} homeHref={homeHref} onNavigate={onNavigate} />

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((section, sectionIndex) => (
          <div key={section.title ?? `section-${sectionIndex}`} className="space-y-1">
            {section.title ? (
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/90">
                {section.title}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavGroup
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!isAdmin ? <UsageCard /> : null}
      {isAdmin ? (
        <div className="mx-3 mb-3 rounded-xl border border-border/80 bg-card p-3">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Sparkle className="h-3.5 w-3.5 text-primary" /> Back to workspace app
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
}: SidebarProps) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarContent sections={sections} brand={brand} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
            onClick={onMobileClose}
          />
          <aside className="absolute inset-y-0 left-0 w-[17rem] border-r border-sidebar-border bg-sidebar shadow-2xl">
            <SidebarContent sections={sections} brand={brand} onNavigate={onMobileClose} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
