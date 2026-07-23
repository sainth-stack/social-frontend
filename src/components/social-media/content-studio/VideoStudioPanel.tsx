"use client";

import { useRef } from "react";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PlayCircleFilledOutlinedIcon from "@mui/icons-material/PlayCircleFilledOutlined";
import { Alert, Box, Chip, CircularProgress, FormControlLabel, Stack, Switch, Tooltip, Typography } from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import AppTextarea from "@/components/ui/AppTextarea";
import GenerationModeToggle from "@/components/social-media/content-studio/shared/GenerationModeToggle";
import GenerationStatusBar from "@/components/social-media/content-studio/shared/GenerationStatusBar";
import DropZone from "@/components/social-media/content-studio/shared/DropZone";
import SectionCard from "@/components/social-media/content-studio/shared/SectionCard";
import TemplateGallery from "@/components/social-media/content-studio/shared/TemplateGallery";
import { fillTemplatePrompt } from "@/components/social-media/content-studio/shared/templateUtils";
import {
  VIDEO_GENERATION_TEMPLATES,
  VIDEO_TEMPLATE_CATEGORIES,
} from "@/data/video-generation-templates";
import { colors, surfaceSx } from "@/lib/theme";
import type { StudioGenerationMode, VideoGenerationTemplate, VideoSeconds, VideoSize } from "@/types/social-media.types";

type VideoStudioPanelProps = {
  topic: string;
  videoPrompt: string;
  setVideoPrompt: (v: string) => void;
  videoSize: VideoSize;
  setVideoSize: (v: VideoSize) => void;
  videoDuration: VideoSeconds;
  setVideoDuration: (v: VideoSeconds) => void;
  selectedTemplateId: string | null;
  setSelectedTemplateId: (id: string | null) => void;
  videoUrl: string | null;
  onVideoChange: (url: string | null) => void;
  generating: boolean;
  uploading: boolean;
  error: string | null;
  setError: (v: string | null) => void;
  soraUnavailable: string | null;
  setSoraUnavailable: (v: string | null) => void;
  onUpload: (file: File) => void;
  postImageUrl: string | null;
  referenceImagePreview: string | null;
  usePostImageAsReference: boolean;
  setUsePostImageAsReference: (v: boolean) => void;
  onReferenceImageSelect: (file: File) => void;
  onReferenceImageClear: () => void;
  generationMode: StudioGenerationMode;
  setGenerationMode: (mode: StudioGenerationMode) => void;
  canRefineVideo: boolean;
};

export default function VideoStudioPanel({
  topic,
  videoPrompt,
  setVideoPrompt,
  videoSize,
  setVideoSize,
  videoDuration,
  setVideoDuration,
  selectedTemplateId,
  setSelectedTemplateId,
  videoUrl,
  onVideoChange,
  generating,
  uploading,
  error,
  setError,
  soraUnavailable,
  setSoraUnavailable,
  onUpload,
  postImageUrl,
  referenceImagePreview,
  usePostImageAsReference,
  setUsePostImageAsReference,
  onReferenceImageSelect,
  onReferenceImageClear,
  generationMode,
  setGenerationMode,
  canRefineVideo,
}: VideoStudioPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  const hasReference = Boolean(referenceImagePreview || (usePostImageAsReference && postImageUrl));
  const activeReferencePreview = usePostImageAsReference && postImageUrl ? postImageUrl : referenceImagePreview;

  const handleSelectTemplate = (template: VideoGenerationTemplate) => {
    setSelectedTemplateId(template.id);
    setVideoPrompt(fillTemplatePrompt(template.promptTemplate, topic));
    setVideoSize(template.size);
    setVideoDuration(template.seconds);
    setError(null);
    setSoraUnavailable(null);
  };

  const handleSyncTopic = () => {
    if (selectedTemplateId) {
      const template = VIDEO_GENERATION_TEMPLATES.find((t) => t.id === selectedTemplateId);
      if (template) {
        setVideoPrompt(fillTemplatePrompt(template.promptTemplate, topic));
        return;
      }
    }
    setVideoPrompt(topic.trim());
  };

  return (
    <Stack spacing={2}>
      {videoUrl && (
        <Alert severity="success" sx={{ fontSize: "0.8125rem" }}>
          Video attached to your post. It appears in the preview on the right. Switch to the Text tab and click <strong>Generate Copy</strong> to create captions.
        </Alert>
      )}

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        <Chip label="Sora 2" size="small" color="primary" variant="outlined" sx={{ fontSize: "0.6875rem" }} />
        <Chip label="Preview" size="small" variant="outlined" sx={{ fontSize: "0.6875rem" }} />
        <Tooltip
          title="Sora 2 is in gated preview on Azure. Access requires applying at aka.ms/oai/sora2access."
          arrow
        >
          <InfoOutlinedIcon sx={{ fontSize: 14, color: colors.textMuted, cursor: "help" }} />
        </Tooltip>
      </Box>

      {soraUnavailable && (
        <Alert
          severity="info"
          icon={<InfoOutlinedIcon fontSize="small" />}
          onClose={() => setSoraUnavailable(null)}
          sx={{ fontSize: "0.8125rem" }}
        >
          <strong>Sora 2 not available for your subscription.</strong> {soraUnavailable} You can still upload a
          video manually below.
        </Alert>
      )}

      <SectionCard title="Choose a template" description="Start from a video scenario">
        <TemplateGallery
          templates={VIDEO_GENERATION_TEMPLATES}
          categories={VIDEO_TEMPLATE_CATEGORIES}
          selectedId={selectedTemplateId}
          onSelect={handleSelectTemplate}
        />
      </SectionCard>

      <SectionCard title="Customize">
        <Stack spacing={1.5}>
          <GenerationModeToggle
            mode={generationMode}
            onChange={setGenerationMode}
            canRefine={canRefineVideo}
            refineHint="Keeps motion and framing from your last AI video. Describe one change — e.g. warmer lighting or teal color grade."
            disabled={generating || uploading}
          />

          {!canRefineVideo && videoUrl && (
            <Alert severity="info" sx={{ fontSize: "0.8125rem" }}>
              Refine is available for AI-generated videos only. Uploaded videos cannot be edited with Sora.
            </Alert>
          )}

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
              {generationMode === "refine" ? "Edit instruction" : "Video description"}
            </Typography>
            <Typography
              onClick={handleSyncTopic}
              sx={{ fontSize: "0.6875rem", color: colors.primary, cursor: "pointer", fontWeight: 600 }}
            >
              Use post topic
            </Typography>
          </Box>
          <AppTextarea
            hideLabel
            minRows={3}
            maxRows={6}
            value={videoPrompt}
            onChange={(e) => setVideoPrompt(e.target.value)}
            placeholder={
              generationMode === "refine"
                ? "Describe what to change in the current video"
                : "Describe the video you want to generate"
            }
            disabled={generating || uploading}
          />

          {generationMode === "create" && (
          <Box>
            <Typography variant="caption" sx={{ color: colors.textSecondary, display: "block", mb: 0.5, fontWeight: 600 }}>
              Orientation
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {(
                [
                  { value: "1280x720" as VideoSize, label: "Landscape 16:9" },
                  { value: "720x1280" as VideoSize, label: "Portrait 9:16" },
                ] as const
              ).map(({ value, label }) => (
                <Box
                  key={value}
                  onClick={() => !generating && setVideoSize(value)}
                  sx={{
                    flex: 1,
                    textAlign: "center",
                    py: 0.625,
                    borderRadius: "6px",
                    cursor: generating ? "default" : "pointer",
                    border: `1.5px solid ${videoSize === value ? colors.primary : colors.border}`,
                    bgcolor: videoSize === value ? colors.primaryLight : "transparent",
                    fontSize: "0.75rem",
                    fontWeight: videoSize === value ? 600 : 400,
                    color: videoSize === value ? colors.primary : colors.textSecondary,
                    transition: "all 0.1s",
                    opacity: generating ? 0.6 : 1,
                    "&:hover": generating ? undefined : { borderColor: colors.primary },
                  }}
                >
                  {label}
                </Box>
              ))}
            </Box>
          </Box>
          )}

          {generationMode === "create" && (
          <Box>
            <Typography variant="caption" sx={{ color: colors.textSecondary, display: "block", mb: 0.5, fontWeight: 600 }}>
              Duration
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
              {(["4", "8", "12"] as const).map((sec) => (
                <Box
                  key={sec}
                  onClick={() => !generating && setVideoDuration(sec)}
                  sx={{
                    flex: 1,
                    textAlign: "center",
                    py: 0.625,
                    borderRadius: "6px",
                    cursor: generating ? "default" : "pointer",
                    border: `1.5px solid ${videoDuration === sec ? colors.primary : colors.border}`,
                    bgcolor: videoDuration === sec ? colors.primaryLight : "transparent",
                    fontSize: "0.75rem",
                    fontWeight: videoDuration === sec ? 600 : 400,
                    color: videoDuration === sec ? colors.primary : colors.textSecondary,
                    transition: "all 0.1s",
                    opacity: generating ? 0.6 : 1,
                    "&:hover": generating ? undefined : { borderColor: colors.primary },
                  }}
                >
                  {sec}s
                </Box>
              ))}
            </Box>
          </Box>
          )}
        </Stack>
      </SectionCard>

      {generationMode === "create" && (
      <SectionCard
        title="Reference image (optional)"
        description="Guide Sora with a logo, brand asset, or first frame. Resized automatically to match orientation."
      >
        <Stack spacing={1.25}>
          {postImageUrl && (
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={usePostImageAsReference}
                  onChange={(e) => {
                    setUsePostImageAsReference(e.target.checked);
                    if (e.target.checked) onReferenceImageClear();
                  }}
                  disabled={generating || uploading}
                />
              }
              label={
                <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                  Use post image as reference
                </Typography>
              }
              sx={{ ml: 0, mr: 0 }}
            />
          )}

          <Box
            sx={{
              ...surfaceSx,
              minHeight: 100,
              aspectRatio: videoSize === "720x1280" ? "9/16" : "16/9",
              maxHeight: 140,
              mx: "auto",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderStyle: activeReferencePreview ? "solid" : "dashed",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            {activeReferencePreview ? (
              <Box
                component="img"
                src={activeReferencePreview}
                alt="Video reference"
                sx={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <Stack sx={{ alignItems: "center" }} spacing={0.5}>
                <ImageOutlinedIcon sx={{ fontSize: 28, color: colors.textMuted }} />
                <Typography variant="caption" color="text.secondary">
                  Logo or brand image
                </Typography>
              </Stack>
            )}
          </Box>

          <Stack direction="row" spacing={1}>
            <AppButton
              variant="secondary"
              size="small"
              leftIcon={<CloudUploadOutlinedIcon sx={{ fontSize: 15 }} />}
              onClick={() => referenceInputRef.current?.click()}
              disabled={generating || uploading || usePostImageAsReference}
            >
              Upload reference
            </AppButton>
            {hasReference && (
              <AppButton
                variant="ghost"
                size="small"
                onClick={() => {
                  setUsePostImageAsReference(false);
                  onReferenceImageClear();
                }}
                disabled={generating || uploading}
              >
                Remove
              </AppButton>
            )}
          </Stack>

          <Typography variant="caption" sx={{ color: colors.textMuted, lineHeight: 1.4 }}>
            JPEG, PNG, or WebP. Sora requires the reference to match video resolution — we crop and resize it for you.
          </Typography>
        </Stack>
      </SectionCard>
      )}

      <SectionCard title="Preview">
        <Stack spacing={1.25}>
          <Box
            sx={{
              ...surfaceSx,
              minHeight: 220,
              aspectRatio: videoSize === "720x1280" ? "9/16" : "16/9",
              maxHeight: 280,
              mx: "auto",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderStyle: videoUrl ? "solid" : "dashed",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            {videoUrl ? (
              <video src={videoUrl} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : generating ? (
              <Stack sx={{ alignItems: "center" }} spacing={0.5}>
                <CircularProgress size={28} />
                <Typography variant="caption" color="text.secondary">
                  Generating video
                </Typography>
              </Stack>
            ) : (
              <Stack sx={{ alignItems: "center" }} spacing={0.5}>
                <PlayCircleFilledOutlinedIcon sx={{ fontSize: 32, color: colors.textMuted }} />
                <Typography variant="caption" color="text.secondary">
                  {selectedTemplateId ? "Ready to generate" : "Select a template or describe your video"}
                </Typography>
              </Stack>
            )}
          </Box>

          <GenerationStatusBar
            loading={generating || uploading}
            loadingLabel={generating ? (generationMode === "refine" ? "Refining with Sora 2" : "Generating with Sora 2") : "Uploading video"}
            loadingHint={generating ? (generationMode === "refine" ? "Refining can take several minutes" : "This can take up to 10 minutes for longer clips") : undefined}
            error={error}
            onDismissError={() => setError(null)}
          />

          <Stack direction="row" spacing={1}>
            <AppButton
              variant="secondary"
              size="small"
              leftIcon={<CloudUploadOutlinedIcon sx={{ fontSize: 15 }} />}
              onClick={() => inputRef.current?.click()}
              loading={uploading}
              disabled={generating}
            >
              Browse
            </AppButton>
            {videoUrl && (
              <AppButton variant="ghost" size="small" onClick={() => onVideoChange(null)} disabled={generating || uploading}>
                Remove
              </AppButton>
            )}
          </Stack>

          <DropZone
            onFile={onUpload}
            accept="MP4, MOV up to 200 MB"
            disabled={generating || uploading}
            label="Drag and drop a video"
            hint="or use Browse above"
          />
        </Stack>
      </SectionCard>

      <input
        ref={referenceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setUsePostImageAsReference(false);
            onReferenceImageSelect(f);
          }
          e.target.value = "";
        }}
      />

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/mov,video/quicktime,video/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
    </Stack>
  );
}
