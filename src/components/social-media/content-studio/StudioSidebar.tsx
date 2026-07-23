"use client";

import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import PlayCircleFilledOutlinedIcon from "@mui/icons-material/PlayCircleFilledOutlined";
import { Box, Stack, Tab, Tabs, Typography } from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import ImageStudioPanel from "@/components/social-media/content-studio/ImageStudioPanel";
import TextBriefPanel from "@/components/social-media/content-studio/TextBriefPanel";
import VideoStudioPanel from "@/components/social-media/content-studio/VideoStudioPanel";
import StudioWorkflowStatus from "@/components/social-media/content-studio/shared/StudioWorkflowStatus";
import { colors } from "@/lib/theme";
import type {
  ImageAspectRatio,
  MediaType,
  PostFormat,
  SocialPlatform,
  StudioMode,
  VideoSeconds,
  VideoSize,
  StudioGenerationMode,
} from "@/types/social-media.types";

type StudioSidebarProps = {
  studioMode: StudioMode;
  setStudioMode: (mode: StudioMode) => void;
  topic: string;
  setTopic: (v: string) => void;
  tone: string;
  setTone: (v: string) => void;
  length: string;
  setLength: (v: string) => void;
  platforms: SocialPlatform[];
  togglePlatform: (p: SocialPlatform) => void;
  format: PostFormat;
  setFormat: (f: PostFormat) => void;
  audience: string;
  setAudience: (v: string) => void;
  cta: string;
  setCta: (v: string) => void;
  mediaType: MediaType;
  setMediaType: (t: MediaType) => void;
  imageUrl: string | null;
  videoUrl: string | null;
  imagePrompt: string;
  setImagePrompt: (v: string) => void;
  imageStyle: string;
  setImageStyle: (v: string) => void;
  imageAspectRatio: ImageAspectRatio;
  setImageAspectRatio: (v: ImageAspectRatio) => void;
  selectedImageTemplateId: string | null;
  setSelectedImageTemplateId: (id: string | null) => void;
  videoPrompt: string;
  setVideoPrompt: (v: string) => void;
  videoSize: VideoSize;
  setVideoSize: (v: VideoSize) => void;
  videoDuration: VideoSeconds;
  setVideoDuration: (v: VideoSeconds) => void;
  selectedVideoTemplateId: string | null;
  setSelectedVideoTemplateId: (id: string | null) => void;
  onImageChange: (url: string | null) => void;
  onVideoChange: (url: string | null) => void;
  generatingText: boolean;
  generatingImage: boolean;
  generatingVideo: boolean;
  uploadingImage: boolean;
  uploadingVideo: boolean;
  imageError: string | null;
  setImageError: (v: string | null) => void;
  videoError: string | null;
  setVideoError: (v: string | null) => void;
  soraUnavailable: string | null;
  setSoraUnavailable: (v: string | null) => void;
  formError: string | null;
  hasCopy: boolean;
  onGenerateText: () => void;
  onGenerateImage: () => void;
  onGenerateVideo: () => void;
  onUploadImage: (file: File) => void;
  onUploadVideo: (file: File) => void;
  postImageUrl: string | null;
  videoReferencePreview: string | null;
  usePostImageAsVideoReference: boolean;
  setUsePostImageAsVideoReference: (v: boolean) => void;
  onVideoReferenceImageSelect: (file: File) => void;
  onVideoReferenceImageClear: () => void;
  imageGenerationMode: StudioGenerationMode;
  setImageGenerationMode: (mode: StudioGenerationMode) => void;
  videoGenerationMode: StudioGenerationMode;
  setVideoGenerationMode: (mode: StudioGenerationMode) => void;
  canRefineVideo: boolean;
};

export default function StudioSidebar(props: StudioSidebarProps) {
  const {
    studioMode,
    setStudioMode,
    topic,
    setTopic,
    tone,
    setTone,
    length,
    setLength,
    platforms,
    togglePlatform,
    format,
    setFormat,
    audience,
    setAudience,
    cta,
    setCta,
    mediaType,
    setMediaType,
    imageUrl,
    videoUrl,
    imagePrompt,
    setImagePrompt,
    imageStyle,
    setImageStyle,
    imageAspectRatio,
    setImageAspectRatio,
    selectedImageTemplateId,
    setSelectedImageTemplateId,
    videoPrompt,
    setVideoPrompt,
    videoSize,
    setVideoSize,
    videoDuration,
    setVideoDuration,
    selectedVideoTemplateId,
    setSelectedVideoTemplateId,
    onImageChange,
    onVideoChange,
    generatingText,
    generatingImage,
    generatingVideo,
    uploadingImage,
    uploadingVideo,
    imageError,
    setImageError,
    videoError,
    setVideoError,
    soraUnavailable,
    setSoraUnavailable,
    formError,
    hasCopy,
    onGenerateText,
    onGenerateImage,
    onGenerateVideo,
    onUploadImage,
    onUploadVideo,
    postImageUrl,
    videoReferencePreview,
    usePostImageAsVideoReference,
    setUsePostImageAsVideoReference,
    onVideoReferenceImageSelect,
    onVideoReferenceImageClear,
    imageGenerationMode,
    setImageGenerationMode,
    videoGenerationMode,
    setVideoGenerationMode,
    canRefineVideo,
  } = props;

  const handleModeChange = (mode: StudioMode) => {
    setStudioMode(mode);
    if (mode === "image" && !imagePrompt.trim() && topic.trim()) {
      setImagePrompt(topic.trim());
    }
    if (mode === "video" && !videoPrompt.trim() && topic.trim()) {
      setVideoPrompt(topic.trim());
    }
  };

  const handleMediaTypeChange = (type: MediaType) => {
    if (type === "none") {
      setMediaType("none");
      onImageChange(null);
      onVideoChange(null);
      setStudioMode("text");
      return;
    }
    if (type === "image") {
      setStudioMode("image");
    } else if (type === "video") {
      setStudioMode("video");
    }
  };

  const attachedMediaLabel = videoUrl ? "Video" : imageUrl ? "Image" : null;
  const hasMedia = Boolean(imageUrl || videoUrl);
  const hasTopic = topic.trim().length >= 5;

  const tabLabel = (label: string, attached: boolean) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {label}
      {attached && (
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            bgcolor: colors.primary,
          }}
        />
      )}
    </Box>
  );

  const footerLoading =
    studioMode === "text"
      ? generatingText
      : studioMode === "image"
        ? generatingImage
        : generatingVideo;

  const footerLabel =
    studioMode === "text"
      ? generatingText
        ? "Generating copy..."
        : "Generate Copy"
      : studioMode === "image"
        ? generatingImage
          ? imageGenerationMode === "refine"
            ? "Refining image..."
            : "Generating image..."
          : imageGenerationMode === "refine"
            ? "Refine Image"
            : imageUrl
              ? "Regenerate Image"
              : "Generate Image"
        : generatingVideo
          ? videoGenerationMode === "refine"
            ? "Refining video..."
            : "Generating video..."
          : videoGenerationMode === "refine"
            ? "Refine Video"
            : videoUrl
              ? "Regenerate Video"
              : "Generate Video";

  const footerAction =
    studioMode === "text"
      ? onGenerateText
      : studioMode === "image"
        ? onGenerateImage
        : onGenerateVideo;

  const footerDisabled =
    studioMode === "text"
      ? generatingText
      : studioMode === "image"
        ? !imagePrompt.trim() ||
          generatingImage ||
          uploadingImage ||
          (imageGenerationMode === "refine" && !imageUrl)
        : !videoPrompt.trim() ||
          generatingVideo ||
          uploadingVideo ||
          (videoGenerationMode === "refine" && !canRefineVideo);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Tabs
        value={studioMode}
        onChange={(_, v: StudioMode) => handleModeChange(v)}
        variant="fullWidth"
        sx={{
          mb: 1,
          minHeight: 40,
          borderBottom: `1px solid ${colors.border}`,
          "& .MuiTab-root": {
            minHeight: 40,
            py: 0.75,
            fontSize: "0.8125rem",
            fontWeight: 600,
            textTransform: "none",
          },
        }}
      >
        <Tab value="text" label={tabLabel("Text", hasCopy)} icon={<ArticleOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
        <Tab
          value="image"
          label={tabLabel("Image", Boolean(imageUrl))}
          icon={<AddPhotoAlternateOutlinedIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
        />
        <Tab
          value="video"
          label={tabLabel("Video", Boolean(videoUrl))}
          icon={<PlayCircleFilledOutlinedIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
        />
      </Tabs>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
        {studioMode === "text"
          ? "Write your post brief and distribution settings"
          : studioMode === "image"
            ? "Pick a template and generate with gpt-image-2"
            : "Pick a template and generate with Sora 2"}
      </Typography>

      <Stack spacing={0} sx={{ flex: 1, overflowY: "auto", pr: 0.5, pb: 2, minHeight: 0 }}>
        {studioMode === "text" && (
          <TextBriefPanel
            topic={topic}
            setTopic={setTopic}
            tone={tone}
            setTone={setTone}
            length={length}
            setLength={setLength}
            platforms={platforms}
            togglePlatform={togglePlatform}
            format={format}
            setFormat={setFormat}
            audience={audience}
            setAudience={setAudience}
            cta={cta}
            setCta={setCta}
            imageUrl={imageUrl}
            videoUrl={videoUrl}
            onMediaTypeChange={handleMediaTypeChange}
            onSwitchToImage={() => handleModeChange("image")}
            onSwitchToVideo={() => handleModeChange("video")}
            formError={formError}
          />
        )}

        {studioMode === "image" && (
          <ImageStudioPanel
            topic={topic}
            imagePrompt={imagePrompt}
            setImagePrompt={setImagePrompt}
            imageStyle={imageStyle}
            setImageStyle={setImageStyle}
            imageAspectRatio={imageAspectRatio}
            setImageAspectRatio={setImageAspectRatio}
            selectedTemplateId={selectedImageTemplateId}
            setSelectedTemplateId={setSelectedImageTemplateId}
            imageUrl={imageUrl}
            onImageChange={onImageChange}
            generating={generatingImage}
            error={imageError}
            setError={setImageError}
            onUpload={onUploadImage}
            uploading={uploadingImage}
            generationMode={imageGenerationMode}
            setGenerationMode={setImageGenerationMode}
          />
        )}

        {studioMode === "video" && (
          <VideoStudioPanel
            topic={topic}
            videoPrompt={videoPrompt}
            setVideoPrompt={setVideoPrompt}
            videoSize={videoSize}
            setVideoSize={setVideoSize}
            videoDuration={videoDuration}
            setVideoDuration={setVideoDuration}
            selectedTemplateId={selectedVideoTemplateId}
            setSelectedTemplateId={setSelectedVideoTemplateId}
            videoUrl={videoUrl}
            onVideoChange={onVideoChange}
            generating={generatingVideo}
            uploading={uploadingVideo}
            error={videoError}
            setError={setVideoError}
            soraUnavailable={soraUnavailable}
            setSoraUnavailable={setSoraUnavailable}
            onUpload={onUploadVideo}
            postImageUrl={postImageUrl}
            referenceImagePreview={videoReferencePreview}
            usePostImageAsReference={usePostImageAsVideoReference}
            setUsePostImageAsReference={setUsePostImageAsVideoReference}
            onReferenceImageSelect={onVideoReferenceImageSelect}
            onReferenceImageClear={onVideoReferenceImageClear}
            generationMode={videoGenerationMode}
            setGenerationMode={setVideoGenerationMode}
            canRefineVideo={canRefineVideo}
          />
        )}
      </Stack>

      <Box sx={{ mt: 1.5, flexShrink: 0 }}>
        <StudioWorkflowStatus
          hasTopic={hasTopic}
          hasMedia={hasMedia}
          hasCopy={hasCopy}
          mediaLabel={attachedMediaLabel}
          onGoToText={() => handleModeChange("text")}
          onGenerateCopy={onGenerateText}
          generatingCopy={generatingText}
          compact
        />
      </Box>

      <Box sx={{ pt: 2, borderTop: `1px solid ${colors.border}`, mt: 1.5, flexShrink: 0 }}>
        <AppButton
          variant="primary"
          size="large"
          fullWidth
          loading={footerLoading}
          disabled={footerDisabled}
          leftIcon={<AutoAwesomeOutlinedIcon />}
          onClick={footerAction}
          sx={{ fontWeight: 700 }}
        >
          {footerLabel}
        </AppButton>
        {studioMode !== "text" && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", textAlign: "center", mt: 1 }}
          >
            {studioMode === "image"
              ? "Uses gpt-image-2 on Azure OpenAI"
              : "Uses Sora 2 on Azure OpenAI (preview)"}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
