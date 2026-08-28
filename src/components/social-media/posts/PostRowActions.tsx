"use client";

import Link from "next/link";
import { IconButton, Tooltip } from "@mui/material";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import PublishOutlinedIcon from "@mui/icons-material/PublishOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import RetryButton from "@/components/social-media/posts/RetryButton";
import type { SocialPost } from "@/types/social-media.types";

type PostRowActionsProps = {
  post: SocialPost;
  onSchedule?: () => void;
  onPublishNow?: () => void;
  onCancelSchedule?: () => void;
  onArchive?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onRetry?: () => void;
  retrying?: boolean;
};

export default function PostRowActions({
  post,
  onSchedule,
  onPublishNow,
  onCancelSchedule,
  onArchive,
  onDuplicate,
  onDelete,
  onRetry,
  retrying,
}: PostRowActionsProps) {
  const editHref = `/dashboard/content-studio/generate?draftId=${post.id}`;
  const viewHref = `/dashboard/posts/${post.id}`;

  return (
    <>
      <Tooltip title="View">
        <IconButton size="small" component={Link} href={viewHref}>
          <VisibilityOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {(post.status === "draft" || post.status === "failed" || post.status === "scheduled") && (
        <Tooltip title="Edit">
          <IconButton size="small" component={Link} href={editHref}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {post.status === "draft" && onSchedule && (
        <Tooltip title="Schedule">
          <IconButton size="small" onClick={onSchedule}>
            <ScheduleOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {(post.status === "draft" || post.status === "scheduled" || post.status === "failed") &&
        onPublishNow && (
          <Tooltip title="Publish now">
            <IconButton size="small" onClick={onPublishNow}>
              <PublishOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

      {post.status === "scheduled" && onCancelSchedule && (
        <Tooltip title="Cancel schedule">
          <IconButton size="small" onClick={onCancelSchedule}>
            <EventBusyOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {post.status === "failed" && onRetry && (
        <RetryButton post={post} loading={retrying} onRetry={onRetry} />
      )}

      {(post.status === "published" || post.status === "failed") && onArchive && (
        <Tooltip title="Archive">
          <IconButton size="small" onClick={onArchive}>
            <ArchiveOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {onDuplicate && (
        <Tooltip title="Duplicate">
          <IconButton size="small" onClick={onDuplicate}>
            <ContentCopyOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {(post.status === "draft" || post.status === "archived" || post.status === "failed") &&
        onDelete && (
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={onDelete}>
              <DeleteOutlineOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
    </>
  );
}
