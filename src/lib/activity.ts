import type { SocialActivityItem, SocialPlatform } from "@/types/social-media.types";

export type ActivityVisualType =
  | "generated"
  | "published"
  | "connected"
  | "scheduled"
  | "failed";

const ACTION_LABELS: Record<string, (title?: string) => string> = {
  "post.created": (title) => (title ? `Created post '${title}'` : "Created a post"),
  "post.scheduled": (title) => (title ? `Scheduled '${title}'` : "Scheduled a post"),
  "post.published": (title) => (title ? `Published '${title}'` : "Published a post"),
  "post.failed": (title) => (title ? `Failed to publish '${title}'` : "Failed to publish a post"),
  "post.draft": (title) => (title ? `Saved draft '${title}'` : "Saved a draft"),
  "post.submitted_approval": (title) =>
    title ? `Submitted '${title}' for approval` : "Submitted a post for approval",
  "post.approved": (title) => (title ? `Approved '${title}'` : "Approved a post"),
  "post.rejected": (title) => (title ? `Rejected '${title}'` : "Rejected a post"),
  "post.changes_requested": (title) =>
    title ? `Requested changes on '${title}'` : "Requested changes on a post",
  "template.created": (title) => (title ? `Created template '${title}'` : "Created a template"),
  "setting.updated": () => "Updated workspace settings",
  "permission.updated": () => "Updated team permissions",
  "account.token_expired": () => "Social account token expired",
  "account.token_expiring": () => "Social account token expiring soon",
};

const ACTION_VERBS: Record<string, string> = {
  "post.created": "Created",
  "post.scheduled": "Scheduled",
  "post.published": "Published",
  "post.failed": "Publish failed",
  "post.draft": "Draft saved",
  "post.submitted_approval": "Sent for approval",
  "post.approved": "Approved",
  "post.rejected": "Rejected",
  "post.changes_requested": "Changes requested",
  "post.auto_approved": "Auto-approved",
  "post.auto_rejected": "Auto-rejected",
  "post.approval_reminder": "Approval reminder",
  "template.created": "Template created",
  "setting.updated": "Settings updated",
  "permission.updated": "Permissions updated",
  "account.token_expired": "Token expired",
  "account.token_expiring": "Token expiring",
};

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
};

export function activityVisualType(item: SocialActivityItem): ActivityVisualType {
  if (
    item.type === "generated" ||
    item.type === "published" ||
    item.type === "connected" ||
    item.type === "scheduled" ||
    item.type === "failed"
  ) {
    return item.type;
  }
  const action = item.action.toLowerCase();
  if (action.includes("failed")) return "failed";
  if (action.includes("publish")) return "published";
  if (action.includes("schedule")) return "scheduled";
  if (action.includes("connect") || action.includes("account") || action.includes("token")) {
    return "connected";
  }
  return "generated";
}

export function activityVerb(action: string): string {
  if (ACTION_VERBS[action]) return ACTION_VERBS[action];
  if (action.startsWith("post.")) {
    const status = action.split(".")[1]?.replace(/_/g, " ") ?? "updated";
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
  return action.replace(/\./g, " ").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function smartTruncate(text: string, max = 72): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  const slice = cleaned.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > max * 0.55) return `${slice.slice(0, lastSpace)}…`;
  return `${slice.trimEnd()}…`;
}

export function activityPostTitle(item: SocialActivityItem): string | null {
  if (typeof item.title === "string" && item.title.trim()) {
    return smartTruncate(item.title.trim());
  }
  const metaTitle =
    typeof item.metadata?.title === "string"
      ? item.metadata.title
      : typeof item.metadata?.name === "string"
        ? item.metadata.name
        : "";
  if (metaTitle.trim()) return smartTruncate(metaTitle.trim());

  const text = item.text?.trim() ?? activityLabel(item);
  const quoted = text.match(/'([^']+)'/);
  if (quoted?.[1]) return smartTruncate(quoted[1]);
  return null;
}

export function activityPlatforms(item: SocialActivityItem): SocialPlatform[] {
  const raw = item.platforms ?? [];
  const valid: SocialPlatform[] = [];
  for (const p of raw) {
    if (p === "instagram" || p === "facebook" || p === "linkedin" || p === "x") {
      if (!valid.includes(p)) valid.push(p);
    }
  }
  return valid;
}

export function activityChannelSummary(item: SocialActivityItem): string | null {
  const platforms = activityPlatforms(item);
  const groupCount = item.groupCount ?? 1;
  if (platforms.length === 1) {
    return `on ${PLATFORM_LABELS[platforms[0]]}`;
  }
  if (platforms.length > 1) {
    return `to ${platforms.length} channels`;
  }
  if (groupCount > 1) {
    return `${groupCount} events merged`;
  }
  return null;
}

export function activityLabel(item: SocialActivityItem): string {
  if (item.text?.trim()) return item.text.trim();
  const title =
    typeof item.metadata?.title === "string"
      ? item.metadata.title
      : typeof item.metadata?.name === "string"
        ? item.metadata.name
        : undefined;
  const formatter = ACTION_LABELS[item.action];
  if (formatter) return formatter(title);
  if (item.action.startsWith("post.")) {
    const status = item.action.split(".")[1]?.replace(/_/g, " ") ?? "updated";
    return title ? `Post ${status} '${title}'` : `Post ${status}`;
  }
  return item.action.replace(/\./g, " ").replace(/_/g, " ");
}

export function relativeActivityTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function activityPostHref(item: SocialActivityItem): string | null {
  if (item.entityType === "post" && item.entityId) {
    return `/dashboard/posts/${item.entityId}`;
  }
  if (item.action.includes("account") || item.action.includes("token")) {
    return "/dashboard/accounts";
  }
  if (item.action === "setting.updated" || item.action === "permission.updated") {
    return "/dashboard/settings";
  }
  return null;
}
