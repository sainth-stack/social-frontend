"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

import AppButton from "@/components/ui/AppButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import SearchFilterBar from "@/components/ui/SearchFilterBar";
import { selectUser } from "@/features/auth/authSlice";
import {
  selectSocialPostsByStatus,
  selectSocialPostsLoading,
} from "@/features/social-media/socialPostsSelectors";
import {
  deleteSocialPost,
  duplicateSocialPost,
  fetchSocialPosts,
} from "@/features/social-media/socialPostsThunks";
import { enqueueToast } from "@/features/ui/uiSlice";
import { colors, tableSurfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { PLATFORM_LABELS } from "@/types/social-media.types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DraftsList() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const drafts = useAppSelector(selectSocialPostsByStatus("draft"));
  const loading = useAppSelector(selectSocialPostsLoading);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    const handle = window.setTimeout(() => {
      void dispatch(
        fetchSocialPosts({
          orgId,
          status: "draft",
          search: search.trim() || undefined,
          pageSize: 50,
        }),
      );
    }, 250);
    return () => window.clearTimeout(handle);
  }, [dispatch, orgId, search]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    setBusy(true);
    try {
      await dispatch(deleteSocialPost({ orgId, postId: deleteId })).unwrap();
      dispatch(enqueueToast({ message: "Draft deleted", severity: "success" }));
      setDeleteId(null);
    } catch (err) {
      dispatch(
        enqueueToast({
          message: typeof err === "string" ? err : "Failed to delete",
          severity: "error",
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async (postId: string) => {
    try {
      const post = await dispatch(duplicateSocialPost({ orgId, postId })).unwrap();
      dispatch(enqueueToast({ message: "Draft duplicated", severity: "success" }));
      router.push(`/dashboard/content-studio/generate?draftId=${post.id}`);
    } catch (err) {
      dispatch(
        enqueueToast({
          message: typeof err === "string" ? err : "Failed to duplicate",
          severity: "error",
        }),
      );
    }
  };

  return (
    <Box>
      <PageHeader
        title="Drafts"
        subtitle={`${drafts.length} draft${drafts.length === 1 ? "" : "s"}`}
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

      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search drafts…"
      />

      {loading && drafts.length === 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : drafts.length === 0 ? (
        <Box sx={{ ...tableSurfaceSx, p: 6, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>No drafts yet</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Start creating content with AI Generate.
          </Typography>
          <AppButton
            variant="primary"
            component={Link}
            href="/dashboard/content-studio/generate"
          >
            AI Generate
          </AppButton>
        </Box>
      ) : (
        <Box sx={tableSurfaceSx}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Caption</TableCell>
                <TableCell>Platforms</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {drafts.map((draft) => {
                const preview =
                  draft.platforms[0]?.caption || draft.title || draft.aiPrompt || "Untitled";
                return (
                  <TableRow key={draft.id} hover>
                    <TableCell sx={{ maxWidth: 360 }}>
                      <Typography
                        sx={{
                          fontSize: "0.875rem",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {preview}
                      </Typography>
                      <Chip label="Draft" size="small" sx={{ mt: 0.5 }} color="default" />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                        {draft.platforms.map((p) => (
                          <Chip
                            key={p.id}
                            size="small"
                            label={PLATFORM_LABELS[p.platform]}
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ color: colors.textSecondary, whiteSpace: "nowrap" }}>
                      {formatDate(draft.createdAt)}
                    </TableCell>
                    <TableCell sx={{ color: colors.textSecondary, whiteSpace: "nowrap" }}>
                      {formatDate(draft.updatedAt)}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          component={Link}
                          href={`/dashboard/content-studio/generate?draftId=${draft.id}`}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Duplicate">
                        <IconButton size="small" onClick={() => void handleDuplicate(draft.id)}>
                          <ContentCopyOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteId(draft.id)}>
                          <DeleteOutlineOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete draft?"
        description="This draft will be permanently deleted."
        confirmLabel="Delete"
        danger
        loading={busy}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />
    </Box>
  );
}
