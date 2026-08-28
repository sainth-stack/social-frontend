"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Sparkle } from "lucide-react";

import socialMediaApi from "@/api/endpoints/social-media.api";
import type { NavItem, NavSection } from "@/components/layouts/nav-config";
import { Badge } from "@/components/ui/badge";
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
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        nested && "ml-3 pl-3",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4", active && "text-primary")} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
          {item.badge}
        </Badge>
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
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          groupActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className={cn("h-4 w-4", groupActive && "text-primary")} />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="mt-0.5 space-y-0.5 pb-1">
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
  const [postsUsed, setPostsUsed] = useState(0);
  const [postsLimit, setPostsLimit] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.workspaceId || user.isPlatformAdmin) return;
    let active = true;

    socialMediaApi
      .getDashboardStats(user.workspaceId)
      .then((stats) => {
        if (!active) return;
        setPostsUsed(stats.usage.postsThisMonth.used);
        setPostsLimit(stats.usage.postsThisMonth.limit);
      })
      .catch(() => {
        if (!active) return;
        const plan =
          DEFAULT_PRICING_CATALOG.find((p) => p.id === user.plan) ?? DEFAULT_PRICING_CATALOG[0];
        setPostsLimit(plan.limits.postsPerMonth);
      });

    return () => {
      active = false;
    };
  }, [user?.workspaceId, user?.isPlatformAdmin, user?.plan]);

  const plan = user?.plan ?? "starter";
  const catalog = DEFAULT_PRICING_CATALOG.find((p) => p.id === plan);
  const limit = postsLimit ?? catalog?.limits.postsPerMonth ?? 60;
  const pct = limit ? Math.min(100, (postsUsed / limit) * 100) : 0;

  return (
    <div className="m-3 rounded-xl border border-sidebar-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{planLabel(plan)} plan</span>
        <Badge variant="secondary" className="text-[10px]">
          Upgrade
        </Badge>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Posts</span>
          <span className="font-medium">
            {postsUsed}/{limit ?? "∞"}
          </span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>
      <Button size="sm" className="mt-3 w-full" asChild>
        <Link href="/dashboard/billing">View plan</Link>
      </Button>
    </div>
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
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <Link
          href={homeHref}
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2 text-inherit no-underline"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/mark.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-[22%] object-cover"
            aria-hidden
          />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-sidebar-foreground">
              OpsBrain <span className="text-primary">AI</span>
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {isAdmin ? "Admin Console" : "Social Media Manager"}
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto p-3">
        {sections.map((section, sectionIndex) => (
          <div key={section.title ?? `section-${sectionIndex}`} className="space-y-1">
            {section.title ? (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            ) : null}
            {section.items.map((item) => (
              <NavGroup
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      {!isAdmin ? <UsageCard /> : null}
      {isAdmin ? (
        <div className="m-3 rounded-xl border border-sidebar-border bg-card p-4">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Sparkle className="h-3.5 w-3.5" /> Back to app
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarContent sections={sections} brand={brand} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-[1px]"
            onClick={onMobileClose}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-sidebar-border bg-sidebar shadow-elevated">
            <SidebarContent
              sections={sections}
              brand={brand}
              onNavigate={onMobileClose}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
