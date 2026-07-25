"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileText,
  Image as ImageIcon,
  Layers,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Send,
  Trash2,
  Video,
  Archive,
} from "lucide-react";
import { toast } from "sonner";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { PlatformIcon } from "@/components/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { selectUser } from "@/features/auth/authSlice";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import type {
  SocialPlatform,
  SocialPost,
  SocialPostStatus,
} from "@/types/social-media.types";

type TabValue = "all" | SocialPostStatus;

const TAB_META: { value: TabValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Drafts" },
  { value: "failed", label: "Failed" },
  { value: "publishing", label: "Publishing" },
  { value: "archived", label: "Archived" },
];

const statusMeta: Partial<
  Record<
    SocialPostStatus,
    { label: string; className: string; Icon: typeof CheckCircle2 }
  >
> = {
  published: {
    label: "Published",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    Icon: CheckCircle2,
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-primary/10 text-primary border-primary/20",
    Icon: Clock,
  },
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
    Icon: FileText,
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    Icon: AlertTriangle,
  },
  publishing: {
    label: "Publishing",
    className: "bg-info/10 text-info border-info/20",
    Icon: Send,
  },
  archived: {
    label: "Archived",
    className: "bg-muted text-muted-foreground border-border",
    Icon: Archive,
  },
  pending_approval: {
    label: "Pending approval",
    className: "bg-warning/10 text-warning border-warning/20",
    Icon: Clock,
  },
};

function mediaKind(post: SocialPost): "image" | "video" | "carousel" | "text" {
  if (post.imageUrl) return "image";
  const caption = post.platforms[0]?.caption ?? "";
  if (caption.length > 400) return "text";
  return "text";
}

const mediaIcon = {
  image: ImageIcon,
  video: Video,
  carousel: Layers,
  text: FileText,
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function postCaption(post: SocialPost): string {
  return post.platforms[0]?.caption ?? "";
}

function postPlatform(post: SocialPost): SocialPlatform | null {
  return post.platforms[0]?.platform ?? null;
}

function postMetrics(post: SocialPost) {
  const reach = post.platforms.reduce((s, p) => s + (p.reach || 0), 0);
  const likes = post.platforms.reduce((s, p) => s + (p.likes || 0), 0);
  const comments = post.platforms.reduce((s, p) => s + (p.comments || 0), 0);
  const shares = post.platforms.reduce((s, p) => s + (p.shares || 0), 0);
  if (!reach && !likes && !comments) return null;
  return { reach, likes, comments, shares };
}

function postError(post: SocialPost): string | null {
  return post.platforms.find((p) => p.errorMessage)?.errorMessage ?? null;
}

type PostsPageProps = {
  initialStatus?: SocialPostStatus | "all";
};

export default function PostsPage({ initialStatus = "all" }: PostsPageProps) {
  const user = useAppSelector(selectUser);
  const workspaceId = user?.workspaceId ?? "";
  const router = useRouter();

  const [tab, setTab] = useState<TabValue>(initialStatus);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<string>("all");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<SocialPost | null>(null);
  const [preview, setPreview] = useState<SocialPost | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTab(initialStatus);
  }, [initialStatus]);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await socialMediaApi.listPosts(workspaceId, {
        search: query.trim() || undefined,
        pageSize: 100,
      });
      setPosts(res.items);
    } catch {
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, query]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(handle);
  }, [load]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (tab !== "all" && p.status !== tab) return false;
      if (platform !== "all" && !p.platforms.some((x) => x.platform === platform)) {
        return false;
      }
      return true;
    });
  }, [posts, tab, platform]);

  const counts = useMemo(() => {
    const base: Record<TabValue, number> = {
      all: posts.length,
      published: 0,
      scheduled: 0,
      draft: 0,
      failed: 0,
      publishing: 0,
      archived: 0,
      pending_approval: 0,
    };
    for (const p of posts) {
      if (p.status in base) base[p.status] += 1;
    }
    return base;
  }, [posts]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const runAction = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      setSelected(new Set());
      await load();
    } catch {
      toast.error("Action failed");
    } finally {
      setBusy(false);
    }
  };

  const bulkDelete = async () => {
    if (!workspaceId || selected.size === 0) return;
    await runAction(async () => {
      await Promise.all(
        [...selected].map((id) => socialMediaApi.deletePost(workspaceId, id)),
      );
    }, `Deleted ${selected.size} post${selected.size === 1 ? "" : "s"}`);
  };

  const bulkDuplicate = async () => {
    if (!workspaceId || selected.size === 0) return;
    await runAction(async () => {
      await Promise.all(
        [...selected].map((id) => socialMediaApi.duplicatePost(workspaceId, id)),
      );
    }, `Duplicated ${selected.size} post${selected.size === 1 ? "" : "s"}`);
  };

  const bulkArchive = async () => {
    if (!workspaceId || selected.size === 0) return;
    await runAction(async () => {
      await Promise.all(
        [...selected].map((id) => socialMediaApi.archivePost(workspaceId, id)),
      );
    }, `Archived ${selected.size} post${selected.size === 1 ? "" : "s"}`);
  };

  const onTabChange = (v: string) => {
    const next = v as TabValue;
    setTab(next);
    setSelected(new Set());
    if (next === "all") router.replace("/dashboard/posts");
    else router.replace(`/dashboard/posts/${next === "draft" ? "drafts" : next}`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
          <p className="text-sm text-muted-foreground">
            Every post across your connected accounts, in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" asChild>
            <Link href="/dashboard/content-studio/generate">
              <Plus className="mr-2 h-4 w-4" />
              New post
            </Link>
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={onTabChange}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="flex h-auto flex-wrap">
            {TAB_META.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}{" "}
                <Badge variant="secondary" className="ml-2">
                  {counts[t.value] ?? 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search posts…"
                className="h-9 w-56 pl-8"
              />
            </div>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="h-9 w-40">
                <Filter className="mr-1 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="x">X</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value={tab} className="mt-4">
          {selected.size > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <span className="font-medium">{selected.size} selected</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void bulkDuplicate()}
                >
                  <Copy className="mr-1 h-4 w-4" />
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void bulkArchive()}
                >
                  <Archive className="mr-1 h-4 w-4" />
                  Archive
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => void bulkDelete()}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <Card>
              <CardContent className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <Checkbox
                          checked={
                            selected.size === filtered.length && filtered.length > 0
                          }
                          onCheckedChange={toggleAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium">Post</th>
                      <th className="px-4 py-3 text-left font-medium">Platform</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-left font-medium">Performance</th>
                      <th className="w-12 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const S = statusMeta[p.status] ?? statusMeta.draft!;
                      const M = mediaIcon[mediaKind(p)];
                      const plat = postPlatform(p);
                      const metrics = postMetrics(p);
                      const err = postError(p);
                      return (
                        <tr
                          key={p.id}
                          className="border-t border-border transition-colors hover:bg-muted/30"
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={selected.has(p.id)}
                              onCheckedChange={() => toggleOne(p.id)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="flex items-start gap-3 text-left"
                              onClick={() => setPreview(p)}
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                {p.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={p.imageUrl}
                                    alt=""
                                    className="h-10 w-10 rounded-md object-cover"
                                  />
                                ) : (
                                  <M className="h-4 w-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="max-w-[280px] truncate font-medium">
                                  {p.title || "Untitled"}
                                </div>
                                <div className="max-w-[280px] truncate text-xs text-muted-foreground">
                                  {postCaption(p)}
                                </div>
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            {plat ? (
                              <PlatformIcon platform={plat} size="sm" />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={cn("gap-1 font-medium", S.className)}
                            >
                              <S.Icon className="h-3 w-3" />
                              {S.label}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {formatDate(p.publishedAt || p.scheduledAt || p.updatedAt)}
                          </td>
                          <td className="px-4 py-3">
                            {metrics ? (
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>
                                  <span className="font-semibold text-foreground">
                                    {metrics.reach.toLocaleString()}
                                  </span>{" "}
                                  reach
                                </span>
                                <span>
                                  <span className="font-semibold text-foreground">
                                    {metrics.likes}
                                  </span>{" "}
                                  likes
                                </span>
                                <span>
                                  <span className="font-semibold text-foreground">
                                    {metrics.comments}
                                  </span>{" "}
                                  comments
                                </span>
                              </div>
                            ) : err ? (
                              <span className="text-xs text-destructive">{err}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <RowMenu
                              post={p}
                              busy={busy}
                              onPreview={() => setPreview(p)}
                              onEdit={() => router.push(`/dashboard/posts/${p.id}`)}
                              onDuplicate={() =>
                                workspaceId &&
                                void runAction(
                                  () => socialMediaApi.duplicatePost(workspaceId, p.id),
                                  "Duplicated",
                                )
                              }
                              onRetry={() =>
                                workspaceId &&
                                void runAction(
                                  () => socialMediaApi.retryPost(workspaceId, p.id),
                                  "Retry queued",
                                )
                              }
                              onPublishNow={() =>
                                workspaceId &&
                                void runAction(
                                  () => socialMediaApi.publishNow(workspaceId, p.id),
                                  "Publishing…",
                                )
                              }
                              onArchive={() =>
                                workspaceId &&
                                void runAction(
                                  () => socialMediaApi.archivePost(workspaceId, p.id),
                                  "Archived",
                                )
                              }
                              onDelete={() => setConfirmDelete(p)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          {preview && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {postPlatform(preview) && (
                    <PlatformIcon platform={postPlatform(preview)!} />
                  )}
                  <div>
                    <DialogTitle>{preview.title || "Untitled"}</DialogTitle>
                    <DialogDescription>
                      {formatDate(
                        preview.publishedAt || preview.scheduledAt || preview.updatedAt,
                      )}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 text-muted-foreground">
                {preview.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-10 w-10" />
                )}
              </div>
              <p className="text-sm leading-relaxed">{postCaption(preview)}</p>
              {postMetrics(preview) && (
                <div className="grid grid-cols-4 gap-2 rounded-lg border border-border p-3 text-center">
                  {(["reach", "likes", "comments", "shares"] as const).map((k) => (
                    <div key={k}>
                      <div className="text-sm font-semibold">
                        {postMetrics(preview)![k].toLocaleString()}
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {k}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>
              This can&apos;t be undone. The post will be removed from OpsBrain, but any
              already-published content stays live on the platform.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (!confirmDelete || !workspaceId) return;
                void runAction(
                  () => socialMediaApi.deletePost(workspaceId, confirmDelete.id),
                  "Post deleted",
                ).then(() => setConfirmDelete(null));
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RowMenu({
  post,
  busy,
  onPreview,
  onEdit,
  onDuplicate,
  onRetry,
  onPublishNow,
  onArchive,
  onDelete,
}: {
  post: SocialPost;
  busy: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRetry: () => void;
  onPublishNow: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onPreview}>
          <Eye className="mr-2 h-4 w-4" />
          Preview
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <FileText className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </DropdownMenuItem>
        {(post.status === "draft" || post.status === "scheduled") && (
          <DropdownMenuItem onClick={onPublishNow}>
            <Send className="mr-2 h-4 w-4" />
            Publish now
          </DropdownMenuItem>
        )}
        {post.status === "failed" && (
          <DropdownMenuItem onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </DropdownMenuItem>
        )}
        {post.status !== "archived" && (
          <DropdownMenuItem onClick={onArchive}>
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">No posts match your filters</h3>
          <p className="text-sm text-muted-foreground">
            Try clearing filters or create a new post.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href="/dashboard/content-studio/generate">
            <Plus className="mr-2 h-4 w-4" />
            New post
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
