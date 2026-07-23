const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  admin: "Admin",
  "content-studio": "Content Studio",
  generate: "AI Generate",
  media: "Media Library",
  drafts: "Drafts",
  templates: "Templates",
  "brand-voice": "Brand Voice",
  calendar: "Calendar",
  posts: "Posts",
  scheduled: "Scheduled",
  published: "Published",
  publishing: "Publishing",
  failed: "Failed",
  archived: "Archived",
  accounts: "Accounts",
  analytics: "Analytics",
  platform: "Platform",
  audience: "Audience Growth",
  settings: "Settings",
  schedule: "Posting Schedule",
  ai: "AI Configuration",
  approval: "Approval Workflow",
  notifications: "Notifications",
  team: "Team",
  billing: "Billing",
  users: "Users",
  pricing: "Pricing",
  overview: "Overview",
  new: "Create",
};

function formatSegment(segment: string): string {
  return LABELS[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === "/login") {
    return [{ label: "Sign in" }];
  }
  if (pathname === "/register") {
    return [{ label: "Create account" }];
  }

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];
  let path = "";

  segments.forEach((segment, index) => {
    path += `/${segment}`;
    const isLast = index === segments.length - 1;
    crumbs.push({
      label: formatSegment(segment),
      href: isLast ? undefined : path,
    });
  });

  return crumbs;
}

export function getPageTitle(pathname: string): string {
  const crumbs = getBreadcrumbs(pathname);
  return crumbs[crumbs.length - 1]?.label ?? "Dashboard";
}

const ROOT_PORTAL_PATHS = new Set(["/admin", "/dashboard"]);

export function shouldShowTopbarContext(pathname: string): boolean {
  return !ROOT_PORTAL_PATHS.has(pathname);
}
