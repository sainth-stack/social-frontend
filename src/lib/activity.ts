import type { SocialActivityItem } from "@/types/social-media.types";

export type ActivityVisualType = "generated" | "published" | "connected" | "scheduled";

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

export function activityVisualType(item: SocialActivityItem): ActivityVisualType {
  if (item.type === "generated" || item.type === "published" || item.type === "connected" || item.type === "scheduled") {
    return item.type;
  }
  const action = item.action.toLowerCase();
  if (action.includes("publish") || action.includes("failed")) return "published";
  if (action.includes("schedule")) return "scheduled";
  if (action.includes("connect") || action.includes("account") || action.includes("token")) return "connected";
  return "generated";
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
