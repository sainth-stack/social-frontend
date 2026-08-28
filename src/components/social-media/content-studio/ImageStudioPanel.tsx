"use client";

import { useRef } from "react";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import AppTextarea from "@/components/ui/AppTextarea";
import GenerationModeToggle from "@/components/social-media/content-studio/shared/GenerationModeToggle";
import GenerationStatusBar from "@/components/social-media/content-studio/shared/GenerationStatusBar";
import DropZone from "@/components/social-media/content-studio/shared/DropZone";
import SectionCard from "@/components/social-media/content-studio/shared/SectionCard";
import TemplateGallery from "@/components/social-media/content-studio/shared/TemplateGallery";
import { fillTemplatePrompt } from "@/components/social-media/content-studio/shared/templateUtils";
import {
  IMAGE_GENERATION_TEMPLATES,
  IMAGE_TEMPLATE_CATEGORIES,
} from "@/data/image-generation-templates";
import { colors, surfaceSx } from "@/lib/theme";
import type { ImageAspectRatio, ImageGenerationTemplate, StudioGenerationMode } from "@/types/social-media.types";

const IMAGE_STYLES = ["None", "Photographic", "Illustration", "Minimalist", "Corporate", "Vivid"];
const ASPECT_RATIOS: { value: ImageAspectRatio; label: string }[] = [
  { value: "1024x1024", label: "Square" },
  { value: "1024x1536", label: "Portrait" },
  { value: "1536x1024", label: "Landscape" },
];

type ImageStudioPanelProps = {
  topic: string;
  imagePrompt: string;
  setImagePrompt: (v: string) => void;
  imageStyle: string;
  setImageStyle: (v: string) => void;
  imageAspectRatio: ImageAspectRatio;
  setImageAspectRatio: (v: ImageAspectRatio) => void;
  selectedTemplateId: string | null;
  setSelectedTemplateId: (id: string | null) => void;
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
  generating: boolean;
  error: string | null;
  setError: (v: string | null) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
  generationMode: StudioGenerationMode;
  setGenerationMode: (mode: StudioGenerationMode) => void;
};

export default function ImageStudioPanel({
  topic,
  imagePrompt,
  setImagePrompt,
  imageStyle,
  setImageStyle,
  imageAspectRatio,
  setImageAspectRatio,
  selectedTemplateId,
  setSelectedTemplateId,
  imageUrl,
  onImageChange,
  generating,
  error,
  setError,
  onUpload,
  uploading,
  generationMode,
  setGenerationMode,
}: ImageStudioPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelectTemplate = (template: ImageGenerationTemplate) => {
    setSelectedTemplateId(template.id);
    setImagePrompt(fillTemplatePrompt(template.promptTemplate, topic));
    setImageStyle(template.style);
    setImageAspectRatio(template.aspectRatio);
    setError(null);
  };

  const handleSyncTopic = () => {
    if (selectedTemplateId) {
      const template = IMAGE_GENERATION_TEMPLATES.find((t) => t.id === selectedTemplateId);
      if (template) {
        setImagePrompt(fillTemplatePrompt(template.promptTemplate, topic));
        return;
      }
    }
    setImagePrompt(topic.trim());
  };

  return (
    <Stack spacing={2}>
      {imageUrl && (
        <Alert severity="success" sx={{ fontSize: "0.8125rem" }}>
          Image attached to your post. It appears in the preview on the right. Switch to the Text tab and click <strong>Generate Copy</strong> to create captions.
        </Alert>
      )}

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
        <Chip label="gpt-image-2" size="small" color="primary" variant="outlined" sx={{ fontSize: "0.6875rem" }} />
        <Chip label="Azure OpenAI" size="small" variant="outlined" sx={{ fontSize: "0.6875rem" }} />
      </Box>

      <SectionCard title="Choose a template" description="Start from a visual style">
        <TemplateGallery
          templates={IMAGE_GENERATION_TEMPLATES}
          categories={IMAGE_TEMPLATE_CATEGORIES}
          selectedId={selectedTemplateId}
          onSelect={handleSelectTemplate}
        />
      </SectionCard>

      <SectionCard title="Customize">
        <Stack spacing={1.5}>
          <GenerationModeToggle
            mode={generationMode}
            onChange={setGenerationMode}
            canRefine={Boolean(imageUrl)}
            refineHint="Describe one focused change — e.g. warmer lighting, add logo, shift background color."
            disabled={generating || uploading}
          />

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="caption" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
              {generationMode === "refine" ? "Edit instruction" : "Image description"}
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
            maxRows={5}
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            placeholder={
              generationMode === "refine"
                ? "Describe what to change in the current image"
                : "Describe the image you want to generate"
            }
            disabled={generating || uploading}
          />

          {generationMode === "create" && (
            <Box>
              <Typography variant="caption" sx={{ color: colors.textSecondary, display: "block", mb: 0.5, fontWeight: 600 }}>
                Style
              </Typography>
              <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                {IMAGE_STYLES.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    size="small"
                    clickable
                    variant={imageStyle === s ? "filled" : "outlined"}
                    color={imageStyle === s ? "primary" : "default"}
                    onClick={() => setImageStyle(s)}
                    sx={{ fontSize: "0.6875rem" }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {generationMode === "create" && (
            <Box>
              <Typography variant="caption" sx={{ color: colors.textSecondary, display: "block", mb: 0.5, fontWeight: 600 }}>
                Aspect ratio
              </Typography>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {ASPECT_RATIOS.map(({ value, label }) => (
                <Box
                  key={value}
                  onClick={() => setImageAspectRatio(value)}
                  sx={{
                    flex: 1,
                    textAlign: "center",
                    py: 0.625,
                    borderRadius: "6px",
                    cursor: "pointer",
                    border: `1.5px solid ${imageAspectRatio === value ? colors.primary : colors.border}`,
                    bgcolor: imageAspectRatio === value ? colors.primaryLight : "transparent",
                    fontSize: "0.75rem",
                    fontWeight: imageAspectRatio === value ? 600 : 400,
                    color: imageAspectRatio === value ? colors.primary : colors.textSecondary,
                    transition: "all 0.1s",
                    "&:hover": { borderColor: colors.primary },
                  }}
                >
                  {label}
                </Box>
              ))}
            </Box>
          </Box>
          )}
        </Stack>
      </SectionCard>

      <SectionCard title="Preview">
        <Stack spacing={1.25}>
          <Box
            sx={{
              ...surfaceSx,
              minHeight: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              borderRadius: "10px",
              borderStyle: imageUrl ? "solid" : "dashed",
              backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {!imageUrl && !generating && (
              <Typography variant="caption" color="text.secondary">
                {selectedTemplateId ? "Ready to generate" : "Select a template or describe your image"}
              </Typography>
            )}
            {generating && (
              <Stack sx={{ alignItems: "center" }} spacing={0.5}>
                <CircularProgress size={28} />
                <Typography variant="caption" color="text.secondary">
                  Generating image
                </Typography>
              </Stack>
            )}
          </Box>

          <GenerationStatusBar
            loading={generating || uploading}
            loadingLabel={generating ? "Generating with gpt-image-2" : "Uploading image"}
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
            {imageUrl && (
              <AppButton variant="ghost" size="small" onClick={() => onImageChange(null)} disabled={generating || uploading}>
                Remove
              </AppButton>
            )}
          </Stack>

          <DropZone
            onFile={onUpload}
            accept="PNG, JPG, WebP up to 8 MB"
            disabled={generating || uploading}
            label="Drag and drop an image"
            hint="or use Browse above"
          />
        </Stack>
      </SectionCard>

      {!selectedTemplateId && !imagePrompt.trim() && (
        <Alert severity="info" sx={{ fontSize: "0.8125rem" }}>
          Pick a template above or enter a description to generate an image.
        </Alert>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
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
