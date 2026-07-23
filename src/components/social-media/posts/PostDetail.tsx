"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import PageHeader from "@/components/ui/PageHeader";
import PlatformBadge from "@/components/social-media/posts/PlatformBadge";
import PostStatusChip from "@/components/social-media/posts/PostStatusChip";
import ScheduleModal from "@/components/social-media/posts/ScheduleModal";
import { selectUser } from "@/features/auth/authSlice";
import {
  selectCurrentSocialPost,
  selectPublishing,
  selectSocialPostsLoading,
} from "@/features/social-media/socialPostsSelectors";
import RetryButton from "@/components/social-media/posts/RetryButton";
import { postsListHref } from "@/components/social-media/posts/PostsList";
import socialMediaApi from "@/api/endpoints/social-media.api";
import {
  archiveSocialPost,
  cancelSocialSchedule,
  fetchSocialPost,
  publishSocialPostNow,
  retrySocialPost,
  scheduleSocialPost,
} from "@/features/social-media/socialPostsThunks";
import { enqueueToast } from "@/features/ui/uiSlice";
import { colors, surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

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
      dispatch(enqueueToast({ message: success, severity: "success" }));
      void dispatch(fetchSocialPost({ orgId, postId }));
    } catch (err) {
      dispatch(
        enqueueToast({
          message: typeof err === "string" ? err : "Action failed",
          severity: "error",
        }),
      );
    }
  };

  if (loading && !post) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!post || post.id !== postId) {
    return <Alert severity="error">Post not found</Alert>;
  }

  return (
    <Box>
      <PageHeader
        title={post.title || "Post detail"}
        subtitle="Publish results and platform copy"
        primaryAction={<PostStatusChip status={post.status} />}
        secondaryAction={
          <AppButton
            variant="secondary"
            onClick={() => router.push(postsListHref(post.status))}
          >
            Back
          </AppButton>
        }
      />

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
        {(post.status === "draft" || post.status === "failed") && (
          <>
            <AppButton
              variant="secondary"
              component={Link}
              href={`/dashboard/content-studio/generate?draftId=${post.id}`}
            >
              Edit
            </AppButton>
            <AppButton variant="secondary" onClick={() => setScheduleOpen(true)}>
              Schedule
            </AppButton>
            <AppButton
              variant="primary"
              loading={publishing}
              onClick={() =>
                void run(
                  () => dispatch(publishSocialPostNow({ orgId, postId: post.id })).unwrap(),
                  "Publishing started",
                )
              }
            >
              Publish now
            </AppButton>
          </>
        )}
        {post.status === "scheduled" && (
          <>
            <AppButton
              variant="primary"
              loading={publishing}
              onClick={() =>
                void run(
                  () => dispatch(publishSocialPostNow({ orgId, postId: post.id })).unwrap(),
                  "Publishing started",
                )
              }
            >
              Publish now
            </AppButton>
            <AppButton
              variant="secondary"
              onClick={() =>
                void run(
                  () => dispatch(cancelSocialSchedule({ orgId, postId: post.id })).unwrap(),
                  "Schedule cancelled",
                )
              }
            >
              Cancel schedule
            </AppButton>
          </>
        )}
        {(post.status === "published" || post.status === "failed") && (
          <AppButton
            variant="secondary"
            onClick={() =>
              void run(
                () => dispatch(archiveSocialPost({ orgId, postId: post.id })).unwrap(),
                "Post archived",
              )
            }
          >
            Archive
          </AppButton>
        )}
        {post.status === "failed" && (
          <RetryButton
            post={post}
            loading={publishing}
            size="medium"
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
            <AppButton
              variant="primary"
              onClick={() =>
                void socialMediaApi
                  .approvePost(orgId, post.id)
                  .then(() => {
                    dispatch(enqueueToast({ message: "Post approved", severity: "success" }));
                    return dispatch(fetchSocialPost({ orgId, postId: post.id }));
                  })
                  .catch((err) =>
                    dispatch(
                      enqueueToast({
                        message: typeof err === "string" ? err : "Approve failed",
                        severity: "error",
                      }),
                    ),
                  )
              }
            >
              Approve
            </AppButton>
            <AppButton
              variant="secondary"
              onClick={() =>
                void socialMediaApi
                  .requestChanges(orgId, post.id, "Please revise")
                  .then(() => {
                    dispatch(enqueueToast({ message: "Changes requested", severity: "info" }));
                    return dispatch(fetchSocialPost({ orgId, postId: post.id }));
                  })
              }
            >
              Request changes
            </AppButton>
            <AppButton
              variant="danger"
              onClick={() =>
                void socialMediaApi
                  .rejectPost(orgId, post.id, "Rejected")
                  .then(() => {
                    dispatch(enqueueToast({ message: "Post rejected", severity: "info" }));
                    return dispatch(fetchSocialPost({ orgId, postId: post.id }));
                  })
              }
            >
              Reject
            </AppButton>
          </>
        )}
        {post.status === "draft" && post.approvalStatus === "not_required" && (
          <AppButton
            variant="secondary"
            onClick={() =>
              void socialMediaApi
                .submitApproval(orgId, post.id)
                .then(() => {
                  dispatch(enqueueToast({ message: "Submitted for approval", severity: "success" }));
                  return dispatch(fetchSocialPost({ orgId, postId: post.id }));
                })
                .catch((err: unknown) => {
                  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response
                    ?.data?.detail;
                  const message =
                    typeof detail === "object" && detail && "message" in detail
                      ? String((detail as { message: string }).message)
                      : typeof detail === "string"
                        ? detail
                        : "Submit failed";
                  dispatch(enqueueToast({ message, severity: "error" }));
                })
            }
          >
            Submit for approval
          </AppButton>
        )}
      </Stack>

      <Box sx={{ ...surfaceSx, p: 3, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Scheduled: {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString() : "—"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Published: {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : "—"}
        </Typography>
        {post.imageUrl && (
          <Box
            component="img"
            src={post.imageUrl}
            alt=""
            sx={{ mt: 2, maxWidth: "100%", maxHeight: 240, borderRadius: "10px" }}
          />
        )}
      </Box>

      {post.platforms.map((pp) => (
        <Box key={pp.id} sx={{ ...surfaceSx, p: 3, mb: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
            <PlatformBadge platforms={[pp.platform]} />
            <PostStatusChip
              status={
                pp.status === "published"
                  ? "published"
                  : pp.status === "failed"
                    ? "failed"
                    : pp.status === "publishing"
                      ? "publishing"
                      : "draft"
              }
            />
          </Stack>
          <Typography sx={{ whiteSpace: "pre-wrap", mb: 1 }}>{pp.caption}</Typography>
          {pp.hashtags.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {pp.hashtags.map((h) => `#${h}`).join(" ")}
            </Typography>
          )}
          {pp.firstComment && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              First comment: {pp.firstComment}
            </Typography>
          )}
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" color="text.secondary">
            Platform post ID: {pp.platformPostId || "—"}
          </Typography>
          {pp.errorMessage && (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              <strong>{pp.errorCode || "Error"}</strong> — {pp.errorMessage}
              {pp.retryCount > 0 ? ` · Attempts: ${pp.retryCount}` : ""}
              {pp.nextRetryAt
                ? ` · Next retry: ${new Date(pp.nextRetryAt).toLocaleString()}`
                : ""}
            </Alert>
          )}
        </Box>
      ))}

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
    </Box>
  );
}
