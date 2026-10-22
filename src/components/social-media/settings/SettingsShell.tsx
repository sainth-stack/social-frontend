"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { Bell, CalendarClock, CheckCheck, Cog, Palette, Sparkles, Users } from "lucide-react";
import { PageHeader } from "@/components/layouts/PageHeader";
import { cn } from "@/lib/utils";

export type SettingsSection = "general" | "notifications" | "appearance" | "schedule" | "ai" | "approval";

const sections = [
  { key: "general", label: "General", href: "/dashboard/settings", icon: Cog },
  { key: "notifications", label: "Notifications", href: "/dashboard/settings?tab=notifications", icon: Bell },
  { key: "appearance", label: "Appearance", href: "/dashboard/settings?tab=appearance", icon: Palette },
  { key: "schedule", label: "Posting schedule", href: "/dashboard/settings/schedule", icon: CalendarClock },
  { key: "ai", label: "AI defaults", href: "/dashboard/settings/ai", icon: Sparkles },
  { key: "approval", label: "Approval workflow", href: "/dashboard/settings/approval", icon: CheckCheck },
  { key: "team", label: "Team permissions", href: "/dashboard/settings/team", icon: Users },
] as const;

export default function SettingsShell({ section, children, dirty = false, saving = false, onDiscard }: {
  section: SettingsSection | "team";
  children: ReactNode;
  dirty?: boolean;
  saving?: boolean;
  onDiscard?: () => void;
}) {
  useEffect(() => {
    if (!dirty && !saving) return;
    const previousUrl = location.href;
    const previousState: unknown = history.state;
    const canLeave = () => !saving && (!dirty || window.confirm("Discard your unsaved settings changes?"));
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, location.href);
      if (target.pathname === location.pathname && target.search === location.search) return;
      if (!canLeave()) {
        event.preventDefault();
        event.stopPropagation();
      } else onDiscard?.();
    };
    const popstate = (event: PopStateEvent) => {
      if (location.href === previousUrl) return;
      if (!canLeave()) {
        event.stopImmediatePropagation();
        history.pushState(previousState, "", previousUrl);
      } else onDiscard?.();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", popstate, true);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", popstate, true);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, saving, onDiscard]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader icon={Cog} title="Workspace settings" description="Make this workspace work for your team. Manage publishing, preferences, and access." />
      <div className="grid min-w-0 gap-6 lg:grid-cols-4 lg:gap-8">
        <nav aria-label="Settings sections" className="min-w-0 lg:col-span-1">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-2 lg:flex-col">
            {sections.map(({ key, label, href, icon: Icon }) => (
              <Link key={key} href={href} aria-current={section === key ? "page" : undefined}
                className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", section === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{label}
              </Link>
            ))}
          </div>
        </nav>
        <div className="min-w-0 space-y-6 lg:col-span-3">{children}</div>
      </div>
    </div>
  );
}