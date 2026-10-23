"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Checkbox,
  CircularProgress,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import PageTabs from "@/components/ui/PageTabs";
import SearchFilterBar from "@/components/ui/SearchFilterBar";
import PlatformBadge from "@/components/social-media/posts/PlatformBadge";
import PostRowActions from "@/components/social-media/posts/PostRowActions";
import PostStatusChip from "@/components/social-media/posts/PostStatusChip";
import ScheduleModal from "@/components/social-media/posts/ScheduleModal";
import { selectUser } from "@/features/auth/authSlice";
import {
  selectPublishing,
  selectSocialPostsByStatus,
  selectSocialPostsLoading,
  selectSocialPostsPagination,
} from "@/features/social-media/socialPostsSelectors";
import {
  archiveSocialPost,
  bulkRetrySocialPosts,
  cancelSocialSchedule,
  deleteSocialPost,
  duplicateSocialPost,
  fetchSocialPosts,
  publishSocialPostNow,
  retrySocialPost,
  scheduleSocialPost,
} from "@/features/social-media/socialPostsThunks";
import {
  failedPlatforms,
  hasRetryableFailure,
} from "@/components/social-media/posts/RetryButton";
import { enqueueToast } from "@/features/ui/uiSlice";
import { colors, tableSurfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { SocialPost, SocialPostStatus } from "@/types/social-media.types";

const TABS: { status: SocialPostStatus; label: string; href: string }[] = [
  { status: "draft", label: "Drafts", href: "/dashboard/posts/drafts" },
  { status: "scheduled", label: "Scheduled", href: "/dashboard/posts/scheduled" },
  { status: "publishing", label: "Publishing", href: "/dashboard/posts/publishing" },
  { status: "published", label: "Published", href: "/dashboard/posts/published" },
  { status: "failed", label: "Failed", href: "/dashboard/posts/failed" },
  { status: "archived", label: "Archived", href: "/dashboard/posts/archived" },
];

export function postsListHref(status: SocialPostStatus): string {
  return TABS.find((tab) => tab.status === status)?.href ?? TABS[0].href;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PostsListProps = {
  status: SocialPostStatus;
};

export default function PostsList({ status }: PostsListProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const activeStatus = status;
  const posts = useAppSelector(selectSocialPostsByStatus(activeStatus));
  const loading = useAppSelector(selectSocialPostsLoading);
  const pagination = useAppSelector(selectSocialPostsPagination(activeStatus));
  const publishing = useAppSelector(selectPublishing);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [schedulePost, setSchedulePost] = useState<SocialPost | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    const handle = window.setTimeout(() => {
      void dispatch(
        fetchSocialPosts({
          orgId,
          status: activeStatus,
          search: search.trim() || undefined,
          page,
          pageSize: 25,
        }),
      );
    }, 200);
    return () => window.clearTimeout(handle);
  }, [dispatch, orgId, activeStatus, search, page]);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      dispatch(enqueueToast({ message: success, severity: "success" }));
      void dispatch(
        fetchSocialPosts({ orgId, status: activeStatus, page, pageSize: 25 }),
      );
    } catch (err) {
      dispatch(
        enqueueToast({
          message: typeof err === "string" ? err : "Action failed",
          severity: "error",
        }),
      );
    }
  };

  const tabIndex = Math.max(
    0,
    TABS.findIndex((t) => t.status === activeStatus),
  );

  return (
    <Box>
      <PageHeader
        title="Posts"
        subtitle="Manage posts across every lifecycle stage"
        primaryAction={
          <AppButton
            variant="primary"
            component={Link}
            href="/dashboard/content-studio/generate"
          >
            New Post
          </AppButton>
        }
      />

      <PageTabs
        tabs={TABS.map((tab) => ({ label: tab.label, href: tab.href }))}
        value={tabIndex}
        onChange={(idx) => router.push(TABS[idx].href)}
        scrollable
      />

      <SearchFilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search captions…"
            rightAction={
              activeStatus === "failed" ? (
                <AppButton
                  variant="secondary"
                  loading={publishing}
                  disabled={selectedIds.length === 0}
                  onClick={() => {
                    const ids = selectedIds.filter((id) => {
                      const post = posts.find((p) => p.id === id);
                      return post && hasRetryableFailure(post);
                    });
                    if (!ids.length) {
                      dispatch(
                        enqueueToast({
                          message: "No retryable posts selected",
                          severity: "error",
                        }),
                      );
                      return;
                    }
                    void run(
                      () =>
                        dispatch(bulkRetrySocialPosts({ orgId, postIds: ids })).unwrap(),
                      `Retrying ${ids.length} post(s)`,
                    ).then(() => setSelectedIds([]));
                  }}
                >
                  Bulk retry ({selectedIds.length})
                </AppButton>
              ) : undefined
            }
          />

          {loading && posts.length === 0 ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : posts.length === 0 ? (
            <Box sx={{ ...tableSurfaceSx, p: 6, textAlign: "center" }}>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>No {activeStatus} posts</Typography>
              <AppButton
                variant="primary"
                component={Link}
                href="/dashboard/content-studio/generate"
              >
                Create post
              </AppButton>
            </Box>
          ) : (
            <Box sx={tableSurfaceSx}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {activeStatus === "failed" && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={
                            posts.length > 0 &&
                            posts.every((p) => selectedIds.includes(p.id))
                          }
                          indeterminate={
                            selectedIds.length > 0 &&
                            selectedIds.length < posts.length
                          }
                          onChange={(e) => {
                            setSelectedIds(
                              e.target.checked ? posts.map((p) => p.id) : [],
                            );
                          }}
                        />
                      </TableCell>
                    )}
                    <TableCell>Caption</TableCell>
                    <TableCell>Platforms</TableCell>
                    <TableCell>Scheduled</TableCell>
                    <TableCell>Published</TableCell>
                    <TableCell>Status</TableCell>
                    {activeStatus === "failed" && <TableCell>Error / Retry</TableCell>}
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {posts.map((post) => {
                    const preview =
                      post.platforms[0]?.caption || post.title || post.aiPrompt || "Untitled";
                    const failed = failedPlatforms(post);
                    const errorMsg = failed[0]?.errorMessage;
                    const attempts = Math.max(0, ...failed.map((p) => p.retryCount));
                    const nextRetry = failed
                      .map((p) => p.nextRetryAt)
                      .filter(Boolean)
                      .sort()[0];
                    return (
                      <TableRow key={post.id} hover>
                        {activeStatus === "failed" && (
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={selectedIds.includes(post.id)}
                              onChange={(e) => {
                                setSelectedIds((prev) =>
                                  e.target.checked
                                    ? [...prev, post.id]
                                    : prev.filter((id) => id !== post.id),
                                );
                              }}
                            />
                          </TableCell>
                        )}
                        <TableCell sx={{ maxWidth: 280 }}>
                          <Typography
                            component={Link}
                            href={`/dashboard/posts/${post.id}`}
                            sx={{
                              fontSize: "0.875rem",
                              color: "inherit",
                              textDecoration: "none",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              "&:hover": { color: colors.primary },
                            }}
                          >
                            {preview}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <PlatformBadge platforms={post.platforms.map((p) => p.platform)} />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", color: colors.textSecondary }}>
                          {formatDate(post.scheduledAt)}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", color: colors.textSecondary }}>
                          {formatDate(post.publishedAt)}
                        </TableCell>
                        <TableCell>
                          <PostStatusChip status={post.status} />
                        </TableCell>
                        {activeStatus === "failed" && (
                          <TableCell sx={{ maxWidth: 240, fontSize: "0.8125rem" }}>
                            <Typography sx={{ color: colors.error, fontSize: "0.8125rem" }}>
                              {errorMsg || "—"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Attempts: {attempts}
                              {nextRetry
                                ? ` · Next: ${new Date(nextRetry).toLocaleString()}`
                                : ""}
                            </Typography>
                          </TableCell>
                        )}
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          <PostRowActions
                            post={post}
                            retrying={retryingId === post.id || publishing}
                            onRetry={() => {
                              setRetryingId(post.id);
                              void run(
                                () =>
                                  dispatch(
                                    retrySocialPost({ orgId, postId: post.id }),
                                  ).unwrap(),
                                "Retry started",
                              ).finally(() => setRetryingId(null));
                            }}
                            onSchedule={() => setSchedulePost(post)}
                            onPublishNow={() =>
                              void run(
                                () =>
                                  dispatch(
                                    publishSocialPostNow({ orgId, postId: post.id }),
                                  ).unwrap(),
                                "Publishing started",
                              )
                            }
                            onCancelSchedule={() =>
                              void run(
                                () =>
                                  dispatch(
                                    cancelSocialSchedule({ orgId, postId: post.id }),
                                  ).unwrap(),
                                "Schedule cancelled",
                              )
                            }
                            onArchive={() =>
                              void run(
                                () =>
                                  dispatch(
                                    archiveSocialPost({ orgId, postId: post.id }),
                                  ).unwrap(),
                                "Post archived",
                              )
                            }
                            onDuplicate={() =>
                              void run(async () => {
                                const copy = await dispatch(
                                  duplicateSocialPost({ orgId, postId: post.id }),
                                ).unwrap();
                                router.push(
                                  `/dashboard/content-studio/generate?draftId=${copy.id}`,
                                );
                              }, "Draft duplicated")
                            }
                            onDelete={() => setDeleteId(post.id)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {pagination.totalPages > 1 && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <Pagination
                    page={page}
                    count={pagination.totalPages}
                    onChange={(_, p) => setPage(p)}
                  />
                </Box>
              )}
            </Box>
          )}

      <ScheduleModal
        open={Boolean(schedulePost)}
        loading={publishing}
        onClose={() => setSchedulePost(null)}
        onConfirm={(scheduledAt) => {
          if (!schedulePost) return;
          void run(
            () =>
              dispatch(
                scheduleSocialPost({
                  orgId,
                  postId: schedulePost.id,
                  scheduledAt,
                }),
              ).unwrap(),
            "Post scheduled",
          ).then(() => setSchedulePost(null));
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete post?"
        description="This post will be permanently deleted."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          void run(
            () => dispatch(deleteSocialPost({ orgId, postId: deleteId })).unwrap(),
            "Post deleted",
          ).then(() => setDeleteId(null));
        }}
      />
    </Box>
  );
}
