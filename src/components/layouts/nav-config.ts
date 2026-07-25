import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  LineChart,
  Settings,
  Share2,
  Sparkles,
  Tag,
  Users,
  Bell,
} from "lucide-react";

import { hasSocialPermission } from "@/lib/permissions";
import type { User } from "@/types/auth";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  children?: NavItem[];
  /** Hide this item unless the current user meets this social permission level. */
  minPermission?: "viewer" | "editor" | "publisher" | "admin";
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

/** Flat Spark-style nav — tabbed pages (AI Studio, Settings) have no sidebar children. */
export const dashboardNavSections: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Create",
    items: [
      {
        label: "AI Studio",
        href: "/dashboard/content-studio",
        icon: Sparkles,
        minPermission: "editor",
      },
      { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
      { label: "Posts", href: "/dashboard/posts", icon: FileText },
    ],
  },
  {
    title: "Grow",
    items: [
      { label: "Accounts", href: "/dashboard/accounts", icon: Share2, minPermission: "admin" },
      { label: "Analytics", href: "/dashboard/analytics", icon: LineChart },
      { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Plan", href: "/dashboard/billing", icon: CreditCard },
      {
        label: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
        minPermission: "admin",
      },
    ],
  },
];

export const adminNavSections: NavSection[] = [
  {
    title: "Platform",
    items: [
      { label: "Overview", href: "/admin", icon: LayoutDashboard },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Plans", href: "/admin/pricing", icon: Tag },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
];

function filterNavItem(item: NavItem, user: User | null): NavItem | null {
  if (item.minPermission && !hasSocialPermission(user, item.minPermission)) {
    return null;
  }

  if (item.children?.length) {
    const children = item.children
      .map((child) => filterNavItem(child, user))
      .filter((child): child is NavItem => child !== null);
    return { ...item, children };
  }

  return item;
}

export function filterNavSections(sections: NavSection[], user: User | null): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => filterNavItem(item, user))
        .filter((item): item is NavItem => item !== null),
    }))
    .filter((section) => section.items.length > 0);
}
