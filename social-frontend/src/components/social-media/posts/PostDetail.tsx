"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { PlatformIcon } from "@/components/platform-icon";
import RetryButton from "@/components/social-media/posts/RetryButton";
import ScheduleModal from "@/components/social-media/posts/ScheduleModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { selectUser } from "@/features/auth/authSlice";
import {
  selectCurrentSocialPost,
  selectPublishing,
  selectSocialPostsLoading,
} from "@/features/social-media/socialPostsSelectors";
import {
  archiveSocialPost,
  cancelSocialSchedule,
  fetchSocialPost,
  publishSocialPostNow,
  retrySocialPost,
  scheduleSocialPost,
} from "@/features/social-media/socialPostsThunks";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { SocialPlatform, SocialPostStatus } from "@/types/social-media.types";
import { PLATFORM_LABELS } from "@/types/social-media.types";

function postsListHref(status: SocialPostStatus): string {
  const map: Partial<Record<SocialPostStatus, string>> = {
    draft: "/dashboard/posts/drafts",
    scheduled: "/dashboard/posts/scheduled",
    publishing: "/dashboard/posts/publishing",
    published: "/dashboard/posts/published",
    failed: "/dashboard/posts/failed",
    archived: "/dashboard/posts/archived",
  };
  return map[status] ?? "/dashboard/posts";
}

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

function StatusBadge({ status }: { status: SocialPostStatus }) {
  const meta = statusMeta[status] ?? statusMeta.draft!;
  const Icon = meta.Icon;
  return (
    <Badge variant="outline" className={cn("gap-1", meta.className)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

function PlatformStatusBadge({
  status,
}: {
  status: "published" | "failed" | "publishing" | "draft";
}) {
  return <StatusBadge status={status} />;
}

type PostDetailProps = {
  postId: string;
};

export default function PostDetail({ postId }: PostDetailProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const post = useAppSelector(selectCurrentSocialPost);
  const loading = useAppSelector(selectSocialPostsLoading);
  const publishing = useAppSelector(selectPublishing);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  useEffect(() => {
    if (orgId && postId) void dispatch(fetchSocialPost({ orgId, postId }));
  }, [dispatch, orgId, postId]);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
      void dispatch(fetchSocialPost({ orgId, postId }));
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Action failed");
    }
  };

  if (loading && !post) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!post || post.id !== postId) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Post not found
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 px-2 text-muted-foreground"
            onClick={() => router.push(postsListHref(post.status))}
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to posts
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {post.title || "Post detail"}
            </h1>
            <StatusBadge status={post.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Publish results and platform copy
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(post.status === "draft" || post.status === "failed") && (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/content-studio/generate?draftId=${post.id}`}>
                Edit
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
              Schedule
            </Button>
            <Button
              size="sm"
              disabled={publishing}
              onClick={() =>
                void run(
                  () =>
                    dispatch(publishSocialPostNow({ orgId, postId: post.id })).unwrap(),
                  "Publishing started",
                )
              }
            >
              {publishing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
              Publish now
            </Button>
          </>
        )}
        {post.status === "scheduled" && (
          <>
            <Button
              size="sm"
              disabled={publishing}
              onClick={() =>
                void run(
                  () =>
                    dispatch(publishSocialPostNow({ orgId, postId: post.id })).unwrap(),
                  "Publishing started",
                )
              }
            >
              Publish now
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void run(
                  () =>
                    dispatch(cancelSocialSchedule({ orgId, postId: post.id })).unwrap(),
                  "Schedule cancelled",
                )
              }
            >
              Cancel schedule
            </Button>
          </>
        )}
        {post.status === "publishing" && (
          <Button
            size="sm"
            disabled={publishing}
            onClick={() =>
              void run(
                () =>
                  dispatch(publishSocialPostNow({ orgId, postId: post.id })).unwrap(),
                "Publishing started",
              )
            }
          >
            {publishing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Retry publish
          </Button>
        )}
        {(post.status === "published" || post.status === "failed") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void run(
                () => dispatch(archiveSocialPost({ orgId, postId: post.id })).unwrap(),
                "Post archived",
              )
            }
          >
            <Archive className="mr-2 h-3.5 w-3.5" />
            Archive
          </Button>
        )}
        {post.status === "failed" && (
          <RetryButton
            post={post}
            loading={publishing}
            onRetry={() =>
              void run(
                () => dispatch(retrySocialPost({ orgId, postId: post.id })).unwrap(),
                "Retry started",
              )
            }
          />
        )}
        {post.status === "pending_approval" && (
          <>
            <Button
              size="sm"
              onClick={() =>
                void socialMediaApi
                  .approvePost(orgId, post.id)
                  .then(() => {
                    toast.success("Post approved");
                    return dispatch(fetchSocialPost({ orgId, postId: post.id }));
                  })
                  .catch((err) =>
                    toast.error(typeof err === "string" ? err : "Approve failed"),
                  )
              }
            >
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void socialMediaApi
                  .requestChanges(orgId, post.id, "Please revise")
                  .then(() => {
                    toast.message("Changes requested");
                    return dispatch(fetchSocialPost({ orgId, postId: post.id }));
                  })
              }
            >
              Request changes
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                void socialMediaApi
                  .rejectPost(orgId, post.id, "Rejected")
                  .then(() => {
                    toast.message("Post rejected");
                    return dispatch(fetchSocialPost({ orgId, postId: post.id }));
                  })
              }
            >
              Reject
            </Button>
          </>
        )}
        {post.status === "draft" && post.approvalStatus === "not_required" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void socialMediaApi
                .submitApproval(orgId, post.id)
                .then(() => {
                  toast.success("Submitted for approval");
                  return dispatch(fetchSocialPost({ orgId, postId: post.id }));
                })
                .catch((err: unknown) => {
                  const detail = (err as { response?: { data?: { detail?: unknown } } })
                    ?.response?.data?.detail;
                  const message =
                    typeof detail === "object" && detail && "message" in detail
                      ? String((detail as { message: string }).message)
                      : typeof detail === "string"
                        ? detail
                        : "Submit failed";
                  toast.error(message);
                })
            }
          >
            Submit for approval
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Timing</CardTitle>
          <CardDescription>When this post is scheduled or went live.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Scheduled: </span>
            {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Published: </span>
            {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : "—"}
          </p>
          {post.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.imageUrl}
              alt=""
              className="mt-3 max-h-60 max-w-full rounded-lg border border-border object-cover"
            />
          ) : null}
        </CardContent>
      </Card>

      {post.platforms.map((pp) => {
        const platformStatus =
          pp.status === "published"
            ? "published"
            : pp.status === "failed"
              ? "failed"
              : pp.status === "publishing"
                ? "publishing"
                : "draft";
        return (
          <Card key={pp.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <PlatformIcon platform={pp.platform as SocialPlatform} size="sm" />
                <CardTitle className="text-base">
                  {PLATFORM_LABELS[pp.platform] ?? pp.platform}
                </CardTitle>
                <PlatformStatusBadge status={platformStatus} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-wrap text-sm">{pp.caption}</p>
              {pp.hashtags.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {pp.hashtags.map((h) => `#${h}`).join(" ")}
                </p>
              ) : null}
              {pp.firstComment ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">First comment: </span>
                  {pp.firstComment}
                </p>
              ) : null}
              <Separator />
              <p className="text-xs text-muted-foreground">
                Platform post ID: {pp.platformPostId || "—"}
              </p>
              {pp.errorMessage ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <strong>{pp.errorCode || "Error"}</strong> — {pp.errorMessage}
                  {pp.retryCount > 0 ? ` · Attempts: ${pp.retryCount}` : ""}
                  {pp.nextRetryAt
                    ? ` · Next retry: ${new Date(pp.nextRetryAt).toLocaleString()}`
                    : ""}
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      <ScheduleModal
        open={scheduleOpen}
        loading={publishing}
        onClose={() => setScheduleOpen(false)}
        onConfirm={(scheduledAt) => {
          void run(
            () =>
              dispatch(
                scheduleSocialPost({ orgId, postId: post.id, scheduledAt }),
              ).unwrap(),
            "Post scheduled",
          ).then(() => setScheduleOpen(false));
        }}
      />
    </div>
  );
}
