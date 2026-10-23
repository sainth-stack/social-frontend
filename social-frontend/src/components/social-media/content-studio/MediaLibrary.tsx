"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import PlayCircleFilledOutlinedIcon from "@mui/icons-material/PlayCircleFilledOutlined";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { socialMediaApi } from "@/api/endpoints/social-media.api";
import AppButton from "@/components/ui/AppButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import SearchFilterBar from "@/components/ui/SearchFilterBar";
import { selectUser } from "@/features/auth/authSlice";
import { enqueueToast } from "@/features/ui/uiSlice";
import { colors, surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { MediaAsset, MediaAssetType } from "@/types/social-media.types";

type FilterTab = "all" | MediaAssetType;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function canEditAsset(asset: MediaAsset): boolean {
  if (asset.mediaType === "image") return true;
  return Boolean(asset.soraVideoId);
}

function editPromptLimit(asset: MediaAsset): number {
  return asset.mediaType === "video" ? 1000 : 500;
}

function AssetCard({
  asset,
  onPreview,
  onUse,
  onEdit,
  onDelete,
}: {
  asset: MediaAsset;
  onPreview: (asset: MediaAsset) => void;
  onUse: (asset: MediaAsset) => void;
  onEdit: (asset: MediaAsset) => void;
  onDelete: (asset: MediaAsset) => void;
}) {
  const isVideo = asset.mediaType === "video";

  return (
    <Box
      sx={{
        ...surfaceSx,
        borderRadius: "10px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Box
        onClick={() => onPreview(asset)}
        sx={{
          position: "relative",
          aspectRatio: isVideo ? "16/9" : "1",
          bgcolor: colors.background,
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        {isVideo ? (
          <>
            <video
              src={asset.url}
              muted
              playsInline
              preload="metadata"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(0,0,0,0.2)",
              }}
            >
              <PlayCircleFilledOutlinedIcon sx={{ fontSize: 40, color: "#fff" }} />
            </Box>
          </>
        ) : (
          <Box
            component="img"
            src={asset.url}
            alt={asset.prompt ?? "Media asset"}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <Box sx={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 0.5 }}>
          <Chip
            label={asset.source === "ai_generated" ? "AI" : "Upload"}
            size="small"
            color={asset.source === "ai_generated" ? "primary" : "default"}
            sx={{ height: 20, fontSize: "0.625rem" }}
          />
          {isVideo && asset.durationSeconds && (
            <Chip label={`${asset.durationSeconds}s`} size="small" sx={{ height: 20, fontSize: "0.625rem" }} />
          )}
        </Box>
      </Box>

      <Box sx={{ p: 1.25, flex: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
        <Typography
          variant="caption"
          sx={{
            color: colors.textSecondary,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: "2.4em",
            lineHeight: 1.3,
          }}
        >
          {asset.prompt?.trim() || (isVideo ? "Video asset" : "Image asset")}
        </Typography>
        <Typography variant="caption" sx={{ color: colors.textMuted, fontSize: "0.6875rem" }}>
          {formatDate(asset.createdAt)} · {formatBytes(asset.fileSizeBytes)}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ mt: "auto" }}>
          <AppButton variant="primary" size="small" onClick={() => onUse(asset)} sx={{ flex: 1 }}>
            Use in post
          </AppButton>
          <Tooltip title={canEditAsset(asset) ? "Edit with AI" : "Only AI-generated videos can be refined"}>
            <span>
              <AppButton
                variant="secondary"
                size="small"
                disabled={!canEditAsset(asset)}
                onClick={() => onEdit(asset)}
                sx={{ minWidth: 0, px: 1 }}
                aria-label="Edit asset"
              >
                <EditOutlinedIcon sx={{ fontSize: 16 }} />
              </AppButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => onDelete(asset)} aria-label="Delete asset">
              <DeleteOutlineOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );
}

export default function MediaLibrary() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";

  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const [editTarget, setEditTarget] = useState<MediaAsset | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await socialMediaApi.listMediaAssets(orgId, {
        mediaType: filter === "all" ? undefined : filter,
        search: search.trim() || undefined,
        page,
        pageSize: 24,
      });
      setItems(data.items);
      setTotalPages(data.totalPages);
    } catch {
      dispatch(enqueueToast({ message: "Failed to load media library", severity: "error" }));
    } finally {
      setLoading(false);
    }
  }, [dispatch, filter, orgId, page, search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadAssets();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [loadAssets]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const handleUse = (asset: MediaAsset) => {
    router.push(`/dashboard/content-studio/generate?assetId=${asset.id}`);
  };

  const openEdit = (asset: MediaAsset) => {
    setEditTarget(asset);
    setEditPrompt("");
    setEditError(null);
    setPreview(null);
  };

  const closeEdit = () => {
    if (editing) return;
    setEditTarget(null);
    setEditPrompt("");
    setEditError(null);
  };

  const handleEditSubmit = async () => {
    if (!editTarget || !orgId) return;
    const instruction = editPrompt.trim();
    if (instruction.length < 3) {
      setEditError("Describe what to change (at least 3 characters)");
      return;
    }
    const limit = editPromptLimit(editTarget);
    if (instruction.length > limit) {
      setEditError(`Edit instruction must be at most ${limit} characters`);
      return;
    }

    setEditing(true);
    setEditError(null);
    try {
      if (editTarget.mediaType === "image") {
        await socialMediaApi.generateImage(orgId, {
          topic: instruction,
          mode: "edit",
          sourceImageUrl: editTarget.url,
        });
        dispatch(enqueueToast({ message: "Image refined and saved to library", severity: "success" }));
      } else {
        await socialMediaApi.generateVideo(orgId, {
          prompt: instruction,
          mode: "remix",
          remixVideoId: editTarget.soraVideoId!,
        });
        dispatch(enqueueToast({ message: "Video refined and saved to library", severity: "success" }));
      }
      setEditTarget(null);
      setEditPrompt("");
      void loadAssets();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string | { message?: string } } } })?.response?.data
        ?.detail;
      if (typeof detail === "string") {
        setEditError(detail);
      } else if (detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string") {
        setEditError(detail.message);
      } else {
        setEditError(editTarget.mediaType === "image" ? "Image edit failed. Try again." : "Video refine failed. Try again.");
      }
    } finally {
      setEditing(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !orgId) return;
    setDeleting(true);
    try {
      await socialMediaApi.deleteMediaAsset(orgId, deleteTarget.id);
      dispatch(enqueueToast({ message: "Asset removed from library", severity: "success" }));
      setDeleteTarget(null);
      if (preview?.id === deleteTarget.id) setPreview(null);
      void loadAssets();
    } catch {
      dispatch(enqueueToast({ message: "Failed to delete asset", severity: "error" }));
    } finally {
      setDeleting(false);
    }
  };

  const handleUpload = async (file: File, type: MediaAssetType) => {
    if (!orgId) return;
    setUploading(true);
    try {
      if (type === "image") {
        await socialMediaApi.uploadImage(orgId, file);
      } else {
        await socialMediaApi.uploadVideo(orgId, file);
      }
      dispatch(enqueueToast({ message: "Uploaded to media library", severity: "success" }));
      void loadAssets();
    } catch {
      dispatch(enqueueToast({ message: "Upload failed", severity: "error" }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Media Library"
        subtitle="All AI-generated and uploaded images and videos for your organization"
        primaryAction={
          <AppButton
            variant="primary"
            component={Link}
            href="/dashboard/content-studio/generate"
          >
            AI Studio
          </AppButton>
        }
      />

      <Box sx={{ ...surfaceSx, p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mb: 1.5, alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          <Tabs
            value={filter}
            onChange={(_, v: FilterTab) => setFilter(v)}
            sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, textTransform: "none", fontSize: "0.8125rem" } }}
          >
            <Tab value="all" label="All" />
            <Tab value="image" label="Images" />
            <Tab value="video" label="Videos" />
          </Tabs>
          <Stack direction="row" spacing={1}>
            <AppButton
              variant="secondary"
              size="small"
              leftIcon={<CloudUploadOutlinedIcon sx={{ fontSize: 16 }} />}
              loading={uploading}
              onClick={() => imageInputRef.current?.click()}
            >
              Upload image
            </AppButton>
            <AppButton
              variant="secondary"
              size="small"
              leftIcon={<CloudUploadOutlinedIcon sx={{ fontSize: 16 }} />}
              loading={uploading}
              onClick={() => videoInputRef.current?.click()}
            >
              Upload video
            </AppButton>
          </Stack>
        </Stack>

        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by prompt..."
        />
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress size={32} />
        </Box>
      ) : items.length === 0 ? (
        <Box sx={{ ...surfaceSx, p: 4, textAlign: "center" }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            No media yet. Generate images or videos in AI Studio, or upload files above.
          </Typography>
          <AppButton variant="primary" component={Link} href="/dashboard/content-studio/generate">
            Open AI Studio
          </AppButton>
        </Box>
      ) : (
        <>
          <Grid container spacing={2}>
            {items.map((asset) => (
              <Grid key={asset.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <AssetCard
                  asset={asset}
                  onPreview={setPreview}
                  onUse={handleUse}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              </Grid>
            ))}
          </Grid>

          {totalPages > 1 && (
            <Stack direction="row" spacing={1} sx={{ mt: 3, justifyContent: "center" }}>
              <AppButton variant="secondary" size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </AppButton>
              <Typography variant="caption" sx={{ alignSelf: "center", color: colors.textMuted }}>
                Page {page} of {totalPages}
              </Typography>
              <AppButton
                variant="secondary"
                size="small"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </AppButton>
            </Stack>
          )}
        </>
      )}

      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} maxWidth="md" fullWidth>
        {preview && (
          <>
            <DialogTitle sx={{ pr: 6 }}>
              {preview.mediaType === "video" ? "Video preview" : "Image preview"}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ borderRadius: "8px", overflow: "hidden", bgcolor: "#000", mb: 2 }}>
                {preview.mediaType === "video" ? (
                  <video src={preview.url} controls style={{ width: "100%", maxHeight: 420 }} />
                ) : (
                  <Box
                    component="img"
                    src={preview.url}
                    alt={preview.prompt ?? "Preview"}
                    sx={{ width: "100%", maxHeight: 420, objectFit: "contain" }}
                  />
                )}
              </Box>
              {preview.prompt && (
                <Typography variant="body2" sx={{ mb: 1, color: colors.textSecondary }}>
                  {preview.prompt}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {formatDate(preview.createdAt)} · {formatBytes(preview.fileSizeBytes)} ·{" "}
                {preview.source === "ai_generated" ? "AI generated" : "Uploaded"}
              </Typography>
            </DialogContent>
            <DialogActions>
              <AppButton variant="ghost" onClick={() => setPreview(null)}>
                Close
              </AppButton>
              <AppButton
                variant="secondary"
                leftIcon={<OpenInNewOutlinedIcon sx={{ fontSize: 16 }} />}
                onClick={() => window.open(preview.url, "_blank")}
              >
                Open URL
              </AppButton>
              <AppButton variant="primary" onClick={() => handleUse(preview)}>
                Use in post
              </AppButton>
              <Tooltip title={canEditAsset(preview) ? "Edit with AI" : "Only AI-generated videos can be refined"}>
                <span>
                  <AppButton
                    variant="secondary"
                    leftIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />}
                    disabled={!canEditAsset(preview)}
                    onClick={() => openEdit(preview)}
                  >
                    Edit
                  </AppButton>
                </span>
              </Tooltip>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog open={Boolean(editTarget)} onClose={closeEdit} maxWidth="sm" fullWidth>
        {editTarget && (
          <>
            <DialogTitle>
              {editTarget.mediaType === "video" ? "Refine video" : "Edit image"}
            </DialogTitle>
            <DialogContent>
              <Box
                sx={{
                  borderRadius: "8px",
                  overflow: "hidden",
                  bgcolor: "#000",
                  mb: 2,
                  maxHeight: 200,
                }}
              >
                {editTarget.mediaType === "video" ? (
                  <video
                    src={editTarget.url}
                    muted
                    playsInline
                    style={{ width: "100%", maxHeight: 200, objectFit: "contain" }}
                  />
                ) : (
                  <Box
                    component="img"
                    src={editTarget.url}
                    alt={editTarget.prompt ?? "Source"}
                    sx={{ width: "100%", maxHeight: 200, objectFit: "contain" }}
                  />
                )}
              </Box>

              {editTarget.prompt?.trim() && (
                <Box sx={{ mb: 2, p: 1.25, borderRadius: "8px", bgcolor: colors.background }}>
                  <Typography variant="caption" sx={{ color: colors.textMuted, display: "block", mb: 0.5 }}>
                    Original prompt
                  </Typography>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: "0.8125rem" }}>
                    {editTarget.prompt}
                  </Typography>
                </Box>
              )}

              {editTarget.mediaType === "video" && !editTarget.soraVideoId && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Uploaded videos cannot be refined. Generate a new video in AI Studio, or upload a
                  replacement.
                </Alert>
              )}

              <TextField
                label={editTarget.mediaType === "video" ? "What should change?" : "Edit instruction"}
                placeholder={
                  editTarget.mediaType === "video"
                    ? "e.g. Warmer lighting, slower pacing, teal color grade"
                    : "e.g. Warmer lighting, add logo in corner, shift background to navy"
                }
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                multiline
                minRows={3}
                maxRows={6}
                fullWidth
                disabled={editing || (editTarget.mediaType === "video" && !editTarget.soraVideoId)}
                helperText={`${editPrompt.length}/${editPromptLimit(editTarget)} characters`}
                error={Boolean(editError)}
              />

              {editError && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  {editError}
                </Alert>
              )}

              {editing && (
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 2 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    {editTarget.mediaType === "video"
                      ? "Refining video — this can take several minutes"
                      : "Applying edit with gpt-image-2"}
                  </Typography>
                </Stack>
              )}
            </DialogContent>
            <DialogActions>
              <AppButton variant="ghost" onClick={closeEdit} disabled={editing}>
                Cancel
              </AppButton>
              <AppButton
                variant="primary"
                onClick={() => void handleEditSubmit()}
                loading={editing}
                disabled={editTarget.mediaType === "video" && !editTarget.soraVideoId}
              >
                {editTarget.mediaType === "video" ? "Refine video" : "Apply edit"}
              </AppButton>
            </DialogActions>
          </>
        )}
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove from library?"
        description="This hides the asset from your media library. Posts already using it are not affected."
        confirmLabel="Remove"
        danger
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleUpload(f, "image");
          e.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleUpload(f, "video");
          e.target.value = "";
        }}
      />
    </Box>
  );
}
