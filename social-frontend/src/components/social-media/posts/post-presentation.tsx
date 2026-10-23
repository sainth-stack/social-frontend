import { AlertCircle, Archive, CheckCircle2, Clock, FileText, Send } from "lucide-react";
import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLATFORM_LABELS, type SocialPlatform, type SocialPostStatus } from "@/types/social-media.types";

const POST_STATUS = {
  published: { label: "Published", icon: CheckCircle2, color: "border-success/20 bg-success/10 text-success" },
  scheduled: { label: "Scheduled", icon: Clock, color: "border-primary/20 bg-primary/10 text-primary" },
  draft: { label: "Draft", icon: FileText, color: "border-border bg-muted text-muted-foreground" },
  failed: { label: "Failed", icon: AlertCircle, color: "border-destructive/20 bg-destructive/10 text-destructive" },
  publishing: { label: "Publishing", icon: Send, color: "border-info/20 bg-info/10 text-info" },
  archived: { label: "Archived", icon: Archive, color: "border-border bg-muted text-muted-foreground" },
  pending_approval: { label: "Pending approval", icon: Clock, color: "border-warning/20 bg-warning/10 text-warning" },
};

export function PostStatusBadge({ status }: { status: SocialPostStatus }) {
  const meta = POST_STATUS[status] ?? POST_STATUS.draft;
  const Icon = meta.icon;
  return <Badge variant="outline" className={cn("gap-1 whitespace-nowrap text-xs font-medium", meta.color)}><Icon className="h-3 w-3" />{meta.label}</Badge>;
}

export function PostChannels({ platforms }: { platforms: SocialPlatform[] }) {
  return <span className="flex flex-wrap items-center gap-1.5">{[...new Set(platforms)].map((platform) => <span key={platform} title={PLATFORM_LABELS[platform]} className="inline-flex"><PlatformIcon platform={platform} size="sm" /><span className="sr-only">{PLATFORM_LABELS[platform]}</span></span>)}{!platforms.length && <span className="text-xs text-muted-foreground">No channels</span>}</span>;
}

export function formatPostDate(iso: string | null | undefined, timeOnly = false) {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return "Time not set";
  return new Date(iso).toLocaleString(undefined, timeOnly ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function postActionError(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail) return String(detail.message);
  return error instanceof Error ? error.message : fallback;
}