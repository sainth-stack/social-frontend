import AnalyticsOutlinedIcon from "@mui/icons-material/AnalyticsOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DraftsOutlinedIcon from "@mui/icons-material/DraftsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import PeopleOutlineOutlinedIcon from "@mui/icons-material/PeopleOutlineOutlined";
import PermMediaOutlinedIcon from "@mui/icons-material/PermMediaOutlined";
import RecordVoiceOverOutlinedIcon from "@mui/icons-material/RecordVoiceOverOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import type { SvgIconComponent } from "@mui/icons-material";

import { hasSocialPermission } from "@/lib/permissions";
import type { User } from "@/types/auth";

export type NavItem = {
  label: string;
  href: string;
  icon: SvgIconComponent;
  badge?: string;
  children?: NavItem[];
  /** Hide this item unless the current user meets this social permission level. */
  minPermission?: "viewer" | "editor" | "publisher" | "admin";
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

export const dashboardNavSections: NavSection[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: DashboardOutlinedIcon }],
  },
  {
    title: "Create",
    items: [
      {
        label: "Content Studio",
        href: "/dashboard/content-studio",
        icon: AutoAwesomeOutlinedIcon,
        minPermission: "editor",
        children: [
          { label: "AI Generate", href: "/dashboard/content-studio/generate", icon: AutoAwesomeOutlinedIcon },
          { label: "Media Library", href: "/dashboard/content-studio/media", icon: PermMediaOutlinedIcon },
          { label: "Drafts", href: "/dashboard/content-studio/drafts", icon: DraftsOutlinedIcon },
          { label: "Templates", href: "/dashboard/content-studio/templates", icon: MenuBookOutlinedIcon },
          { label: "Brand Voice", href: "/dashboard/content-studio/brand-voice", icon: RecordVoiceOverOutlinedIcon },
        ],
      },
      { label: "Calendar", href: "/dashboard/calendar", icon: CalendarMonthOutlinedIcon },
      { label: "Posts", href: "/dashboard/posts", icon: ListAltOutlinedIcon },
    ],
  },
  {
    title: "Grow",
    items: [
      { label: "Accounts", href: "/dashboard/accounts", icon: ShareOutlinedIcon, minPermission: "admin" },
      {
        label: "Analytics",
        href: "/dashboard/analytics",
        icon: AnalyticsOutlinedIcon,
        children: [
          { label: "Overview", href: "/dashboard/analytics", icon: AnalyticsOutlinedIcon },
          { label: "Platform", href: "/dashboard/analytics/platform", icon: AssessmentOutlinedIcon },
          { label: "Post Performance", href: "/dashboard/analytics/posts", icon: ListAltOutlinedIcon },
          { label: "Audience Growth", href: "/dashboard/analytics/audience", icon: GroupsOutlinedIcon },
        ],
      },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Billing", href: "/dashboard/billing", icon: CreditCardOutlinedIcon },
      {
        label: "Settings",
        href: "/dashboard/settings",
        icon: SettingsOutlinedIcon,
        minPermission: "admin",
        children: [
          { label: "General", href: "/dashboard/settings", icon: SettingsOutlinedIcon },
          { label: "Posting Schedule", href: "/dashboard/settings/schedule", icon: ScheduleOutlinedIcon },
          { label: "AI Configuration", href: "/dashboard/settings/ai", icon: AutoAwesomeOutlinedIcon },
          { label: "Approval Workflow", href: "/dashboard/settings/approval", icon: HandshakeOutlinedIcon },
          { label: "Notifications", href: "/dashboard/settings/notifications", icon: NotificationsOutlinedIcon },
          { label: "Team", href: "/dashboard/settings/team", icon: GroupsOutlinedIcon },
        ],
      },
    ],
  },
];

export const adminNavSections: NavSection[] = [
  {
    title: "Platform",
    items: [
      { label: "Overview", href: "/admin", icon: DashboardOutlinedIcon },
      { label: "Users", href: "/admin/users", icon: PeopleOutlineOutlinedIcon },
      { label: "Pricing", href: "/admin/pricing", icon: LocalOfferOutlinedIcon },
      { label: "Analytics", href: "/admin/analytics", icon: BarChartOutlinedIcon },
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
