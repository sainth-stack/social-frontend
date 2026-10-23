"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Archive, ArrowRight, CalendarDays, Clock, Copy, Eye, FileText, Filter, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Send, Trash2, Video, X } from "lucide-react";
import { toast } from "sonner";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { isVideoMediaUrl } from "@/components/social-media/content-studio/shared/studioMediaHelpers";
import { formatPostDate, postActionError, PostChannels, PostStatusBadge } from "@/components/social-media/posts/post-presentation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { selectUser } from "@/features/auth/authSlice";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import { PLATFORM_LABELS, type SocialPlatform, type SocialPost, type SocialPostListResponse, type SocialPostStatus } from "@/types/social-media.types";

type Status = "all" | SocialPostStatus;
const PAGE_SIZE = 20;
const STATUS_TABS: { value: Status; label: string }[] = [{ value: "all", label: "All posts" }, { value: "draft", label: "Drafts" }, { value: "scheduled", label: "Scheduled" }, { value: "published", label: "Published" }, { value: "failed", label: "Failed" }, { value: "publishing", label: "Publishing" }, { value: "archived", label: "Archived" }];
const caption = (post: SocialPost) => post.platforms[0]?.caption ?? "";
const platforms = (post: SocialPost) => post.platforms.map((item) => item.platform);
const metrics = (post: SocialPost) => post.platforms.reduce((sum, item) => ({ reach: sum.reach + (item.reach ?? 0), likes: sum.likes + (item.likes ?? 0), comments: sum.comments + (item.comments ?? 0), shares: sum.shares + (item.shares ?? 0) }), { reach: 0, likes: 0, comments: 0, shares: 0 });
const postDate = (post: SocialPost) => post.publishedAt || post.scheduledAt || post.updatedAt;

export default function PostsPage({ initialStatus = "all" }: { initialStatus?: Status }) {
  const user = useAppSelector(selectUser);
  return <PostsWorkspace key={user?.workspaceId ?? "none"} workspaceId={user?.workspaceId ?? ""} initialStatus={initialStatus} />;
}

function PostsWorkspace({ workspaceId, initialStatus }: { workspaceId: string; initialStatus: Status }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform | "all">("all");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<{ key: string; result: SocialPostListResponse } | null>(null);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [deleteFromPlatforms, setDeleteFromPlatforms] = useState(true);
  const [preview, setPreview] = useState<SocialPost | null>(null);
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  const actionLock = useRef(false);
  const mounted = useRef(true);
  const key = `${status}|${query.trim()}|${page}`;
  const result = payload?.key === key ? payload.result : null;
  const posts = result?.items ?? [];
  const visible = useMemo(() => posts.filter((post) => platform === "all" || post.platforms.some((item) => item.platform === platform)), [posts, platform]);
  const allSelected = visible.length > 0 && visible.every((post) => selected.has(post.id));

  useEffect(() => { setStatus(initialStatus); setPage(1); setSelected(new Set()); }, [initialStatus]);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await socialMediaApi.listPosts(workspaceId, { status: status === "all" ? undefined : status, search: query.trim() || undefined, page, pageSize: PAGE_SIZE });
      if (id !== requestId.current) return;
      setPayload({ key, result: data });
      if (page > Math.max(1, data.totalPages)) setPage(Math.max(1, data.totalPages));
    } catch (err) {
      if (id === requestId.current) setError(postActionError(err, "We couldn’t load your posts. Please try again."));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [workspaceId, status, query, page, key]);
  const latestLoad = useRef(load);
  useEffect(() => { latestLoad.current = load; }, [load]);
  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => void load(), query.trim() ? 250 : 0);
    return () => { window.clearTimeout(timer); requestId.current += 1; mounted.current = false; };
  }, [load, query]);

  const changeStatus = (value: string) => {
    const next = value as Status;
    setStatus(next); setPage(1); setSelected(new Set()); setActionError(null);
    router.replace(next === "all" ? "/dashboard/posts" : `/dashboard/posts/${next === "draft" ? "drafts" : next}`);
  };
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visible.map((post) => post.id)));
  const toggleOne = (id: string) => setSelected((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const changePage = (next: number) => { setPage(next); setSelected(new Set()); };

  const runAction = async (action: () => Promise<unknown>, message: string) => {
    if (actionLock.current) return false;
    actionLock.current = true;
    setBusy(true); setActionError(null);
    let succeeded = false;
    try {
      await action();
      succeeded = true;
      if (mounted.current) toast.success(message);
    } catch (err) {
      if (mounted.current) setActionError(postActionError(err, "This action couldn’t be completed. Please try again."));
    } finally {
      if (mounted.current) { setSelected(new Set()); await latestLoad.current(); setBusy(false); }
      actionLock.current = false;
    }
    return succeeded;
  };

  const bulkAction = async (ids: string[], action: (id: string) => Promise<unknown>) => {
    const queue = [...ids];
    let failed = 0;
    const worker = async () => { for (let id = queue.shift(); id; id = queue.shift()) { try { await action(id); } catch { failed += 1; } } };
    await Promise.all(Array.from({ length: Math.min(3, ids.length) }, worker));
    if (failed) throw new Error(`${ids.length - failed} of ${ids.length} posts updated. ${failed} could not be completed. Review the refreshed list before trying again.`);
  };
  const duplicate = (id: string) => socialMediaApi.duplicatePost(workspaceId, id);
  const archive = (id: string) => socialMediaApi.archivePost(workspaceId, id);
  const publish = (id: string) => socialMediaApi.publishNow(workspaceId, id);

  const rowMenu = (post: SocialPost) => <PostMenu post={post} busy={busy} onPreview={() => setPreview(post)} onEdit={() => router.push(`/dashboard/posts/${post.id}`)} onDuplicate={() => void runAction(() => duplicate(post.id), "Post duplicated")} onRetry={() => void runAction(() => socialMediaApi.retryPost(workspaceId, post.id), "Retry queued")} onPublish={() => void runAction(() => publish(post.id), "Publishing started")} onArchive={() => void runAction(() => archive(post.id), "Post archived")} onDelete={() => setDeleteIds([post.id])} />;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><PageHeader icon={FileText} title="Your posts" description="From first draft to published. Keep every channel moving in one place." /><div className="flex gap-2"><Button variant="outline" asChild><Link href="/dashboard/calendar"><CalendarDays className="mr-2 h-4 w-4" />Calendar</Link></Button><Button asChild><Link href="/dashboard/content-studio/generate"><Plus className="mr-2 h-4 w-4" />Create a post</Link></Button></div></header>

      <section aria-label="Post overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[{ label: "Total results", value: result?.total, detail: "Current status and search", icon: FileText }, { label: "Drafts on this page", value: result ? visible.filter((post) => post.status === "draft").length : undefined, detail: "Ready for your next edit", icon: Pencil }, { label: "Scheduled on this page", value: result ? visible.filter((post) => post.status === "scheduled").length : undefined, detail: "Waiting to go live", icon: Clock }, { label: "Failed on this page", value: result ? visible.filter((post) => post.status === "failed").length : undefined, detail: "Review before retrying", icon: AlertCircle }].map(({ label, value, detail, icon: Icon }) => <Card key={label} className="shadow-soft"><CardContent className="p-4"><div className="flex items-start justify-between gap-2"><h2 className="text-xs text-muted-foreground">{label}</h2><Icon className="h-4 w-4 shrink-0 text-primary" /></div><p className="mt-3 text-2xl font-semibold tabular-nums">{value?.toLocaleString() ?? "—"}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>)}</section>

      <Tabs value={status} onValueChange={changeStatus} className="min-w-0 space-y-4">
        <Card className="min-w-0 shadow-soft"><div className="overflow-x-auto border-b border-border p-2"><TabsList aria-label="Post status" className="h-auto w-max min-w-full justify-start bg-transparent">{STATUS_TABS.map((tab) => <TabsTrigger key={tab.value} value={tab.value} disabled={busy} className="px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">{tab.label}{tab.value === status && result && <Badge variant="secondary" className="ml-2 text-xs">{result.total}</Badge>}</TabsTrigger>)}</TabsList></div><div className="flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center"><div className="relative min-w-0 flex-1 md:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search posts" placeholder="Search titles and AI briefs…" value={query} disabled={busy} onChange={(event) => { setQuery(event.target.value); setPage(1); setSelected(new Set()); }} className="pl-9 pr-9" />{query && <button type="button" aria-label="Clear search" disabled={busy} onClick={() => { setQuery(""); setPage(1); setSelected(new Set()); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4 text-muted-foreground" /></button>}</div><div className="flex flex-wrap items-center gap-2"><Select value={platform} disabled={busy} onValueChange={(value) => { setPlatform(value as SocialPlatform | "all"); setSelected(new Set()); }}><SelectTrigger aria-label="Filter channels on this page" className="w-full sm:w-52"><Filter className="mr-2 h-3.5 w-3.5" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All channels · this page</SelectItem>{(["instagram", "facebook", "linkedin", "x"] as const).map((value) => <SelectItem key={value} value={value}>{PLATFORM_LABELS[value]}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" aria-label="Refresh posts" disabled={loading || busy || !workspaceId} onClick={() => void load()}><RefreshCw className={cn("h-4 w-4", loading && "motion-safe:animate-spin")} /></Button></div></div></Card>

        <TabsContent value={status} className="space-y-4">
          {(error || actionError) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span>{actionError || error}{error && result ? " Previously loaded posts remain visible." : ""}</span></span>{error && <Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}>Try again</Button>}</div>}

          {selected.size > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3"><span role="status" className="text-sm font-medium">{selected.size} selected on this page</span><div className="flex flex-wrap gap-1"><Button variant="ghost" size="sm" disabled={busy} onClick={() => void runAction(() => bulkAction([...selected], duplicate), "Posts duplicated")}><Copy className="mr-1.5 h-4 w-4" />Duplicate</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => void runAction(() => bulkAction([...selected], archive), "Posts archived")}><Archive className="mr-1.5 h-4 w-4" />Archive</Button><Button variant="ghost" size="sm" disabled={busy} className="text-destructive" onClick={() => setDeleteIds([...selected])}><Trash2 className="mr-1.5 h-4 w-4" />Delete</Button><Button variant="ghost" size="icon" disabled={busy} aria-label="Clear selection" onClick={() => setSelected(new Set())}><X className="h-4 w-4" /></Button></div></div>}

          {!workspaceId ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Select a workspace to manage its posts.</CardContent></Card> : !result && !error ? <Card role="status" aria-label="Loading posts"><CardContent className="space-y-3 p-4">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}</CardContent></Card> : result ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><label className="flex items-center gap-2"><Checkbox aria-label="Select all posts on this page" checked={allSelected ? true : selected.size ? "indeterminate" : false} disabled={busy || visible.length === 0} onCheckedChange={toggleAll} />Select page</label><span aria-live="polite">Showing {visible.length} of {posts.length} on this page · {result.total} total results</span></div>
              {platform !== "all" && <p className="text-xs text-muted-foreground">Channel filtering applies to the current page. Use pagination to browse other results.</p>}
              {visible.length === 0 ? <Card className="border-dashed shadow-soft"><CardContent className="flex flex-col items-center gap-3 px-5 py-14 text-center"><span className="rounded-2xl bg-primary/10 p-4 text-primary"><FileText className="h-6 w-6" /></span><h3 className="font-semibold">{query || platform !== "all" ? "No posts match these filters" : "Your next post starts here"}</h3><p className="max-w-sm text-sm text-muted-foreground">{query || platform !== "all" ? "Try a different search or channel. You can also browse another page." : "Create a draft, shape it for your channels, and publish when you’re ready."}</p><div className="flex flex-wrap justify-center gap-2">{(query || platform !== "all") && <Button variant="outline" disabled={busy} onClick={() => { setQuery(""); setPlatform("all"); setPage(1); setSelected(new Set()); }}>Clear filters</Button>}<Button asChild><Link href="/dashboard/content-studio/generate">Create a post<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div></CardContent></Card> : (
                <div className="space-y-3" aria-busy={busy}>{visible.map((post) => {
                  const performance = metrics(post);
                  const failure = post.platforms.find((item) => item.errorMessage)?.errorMessage;
                  return <Card key={post.id} className={cn("min-w-0 shadow-soft transition-colors", selected.has(post.id) && "border-primary/40 bg-primary/5")}><CardContent className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5"><Checkbox className="mt-1" aria-label={`Select ${post.title || "Untitled post"}`} checked={selected.has(post.id)} disabled={busy} onCheckedChange={() => toggleOne(post.id)} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><button type="button" onClick={() => setPreview(post)} className="flex min-w-0 items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MediaThumbnail post={post} /><span className="min-w-0"><span className="block break-words text-sm font-semibold">{post.title || "Untitled post"}</span><span className="mt-1 line-clamp-2 break-words text-sm leading-relaxed text-muted-foreground">{caption(post) || "No caption yet"}</span></span></button>{rowMenu(post)}</div><div className="mt-3 flex flex-wrap items-center gap-3"><PostStatusBadge status={post.status} /><PostChannels platforms={platforms(post)} /><span className="text-xs text-muted-foreground">{post.publishedAt ? "Published" : post.scheduledAt ? "Scheduled" : "Updated"} · {formatPostDate(postDate(post))}</span></div>{post.status === "published" && <p className="mt-3 text-xs text-muted-foreground">{performance.reach.toLocaleString()} reach · {performance.likes.toLocaleString()} likes · {performance.comments.toLocaleString()} comments · {performance.shares.toLocaleString()} shares</p>}{failure && <p className="mt-3 flex items-start gap-1.5 break-words text-xs text-destructive"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{failure}</p>}<div className="mt-3 flex flex-wrap gap-3 text-xs font-medium"><Link href={`/dashboard/posts/${post.id}`} className="rounded text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View details</Link>{(post.status === "draft" || post.status === "failed" || post.status === "scheduled") && <Link href={`/dashboard/content-studio/generate?draftId=${post.id}`} className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Edit in AI Studio</Link>}</div></div></CardContent></Card>;
                })}</div>
              )}
              {result.totalPages > 1 && <nav aria-label="Posts pagination" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Page {page} of {result.totalPages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || busy || page <= 1} onClick={() => changePage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={loading || busy || page >= result.totalPages} onClick={() => changePage(page + 1)}>Next</Button></div></nav>}
            </>
          ) : null}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}><DialogContent className="max-h-screen overflow-y-auto sm:max-w-xl">{preview && <><DialogHeader><DialogTitle className="break-words pr-4">{preview.title || "Untitled post"}</DialogTitle><DialogDescription>{formatPostDate(postDate(preview))}</DialogDescription></DialogHeader><div className="flex flex-wrap items-center gap-3"><PostStatusBadge status={preview.status} /><PostChannels platforms={platforms(preview)} /></div>{preview.imageUrl && (isVideoMediaUrl(preview.imageUrl) ? <video src={preview.imageUrl} controls preload="metadata" className="max-h-72 w-full rounded-xl" /> : <img src={preview.imageUrl} alt="Post media" className="max-h-72 w-full rounded-xl object-contain" />)}<p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{caption(preview) || "No caption yet"}</p>{preview.status === "published" && <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4 sm:grid-cols-4">{Object.entries(metrics(preview)).map(([label, value]) => <div key={label}><dt className="text-xs capitalize text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{value.toLocaleString()}</dd></div>)}</dl>}<DialogFooter><Button variant="outline" asChild><Link href={`/dashboard/posts/${preview.id}`}>View details</Link></Button><Button asChild><Link href={`/dashboard/content-studio/generate?draftId=${preview.id}`}>Open in AI Studio</Link></Button></DialogFooter></>}</DialogContent></Dialog>

      <Dialog open={deleteIds.length > 0} onOpenChange={(open) => { if (!open && !busy) setDeleteIds([]); }}><DialogContent><DialogHeader><DialogTitle>Delete {deleteIds.length === 1 ? "this post" : `${deleteIds.length} posts`}?</DialogTitle><DialogDescription>This can’t be undone. {deleteFromPlatforms ? "We will also try to remove published copies from connected platforms that support deletion." : "Published copies will stay live on social networks."}</DialogDescription></DialogHeader><label className="flex items-start gap-2 text-sm text-muted-foreground"><Checkbox aria-label="Also remove from connected platforms" checked={deleteFromPlatforms} disabled={busy} onCheckedChange={(value) => setDeleteFromPlatforms(value === true)} />Also remove from connected platforms, where supported</label><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDeleteIds([])}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={() => { void runAction(() => bulkAction(deleteIds, (id) => socialMediaApi.deletePost(workspaceId, id, { deleteFromPlatforms })), "Posts deleted").then(() => { if (mounted.current) setDeleteIds([]); }); }}>{busy ? "Deleting…" : "Delete posts"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function MediaThumbnail({ post }: { post: SocialPost }) {
  return <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-muted-foreground sm:h-16 sm:w-16">{post.imageUrl && !isVideoMediaUrl(post.imageUrl) ? <img src={post.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : post.imageUrl ? <Video className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span>;
}

function PostMenu({ post, busy, onPreview, onEdit, onDuplicate, onRetry, onPublish, onArchive, onDelete }: { post: SocialPost; busy: boolean; onPreview: () => void; onEdit: () => void; onDuplicate: () => void; onRetry: () => void; onPublish: () => void; onArchive: () => void; onDelete: () => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${post.title || "Untitled post"}`} disabled={busy} className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={onPreview}><Eye className="mr-2 h-4 w-4" />Preview</DropdownMenuItem><DropdownMenuItem onClick={onEdit}><FileText className="mr-2 h-4 w-4" />View details / edit</DropdownMenuItem><DropdownMenuItem onClick={onDuplicate}><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem>{["draft", "scheduled", "publishing"].includes(post.status) && <DropdownMenuItem onClick={onPublish}><Send className="mr-2 h-4 w-4" />{post.status === "publishing" ? "Retry publish" : "Publish now"}</DropdownMenuItem>}{post.status === "failed" && <DropdownMenuItem onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Retry</DropdownMenuItem>}{post.status !== "archived" && <DropdownMenuItem onClick={onArchive}><Archive className="mr-2 h-4 w-4" />Archive</DropdownMenuItem>}<DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}