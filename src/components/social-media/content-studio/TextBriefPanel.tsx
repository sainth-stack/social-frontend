"use client";

import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import PlayCircleFilledOutlinedIcon from "@mui/icons-material/PlayCircleFilledOutlined";
import { Box, Stack, Typography } from "@mui/material";

import AppInput from "@/components/ui/AppInput";
import AppTextarea from "@/components/ui/AppTextarea";
import PostFormatSelector from "@/components/social-media/content-studio/PostFormatSelector";
import SectionCard from "@/components/social-media/content-studio/shared/SectionCard";
import { colors } from "@/lib/theme";
import type { MediaType, PostFormat, SocialPlatform } from "@/types/social-media.types";
import { PLATFORM_LABELS } from "@/types/social-media.types";

const ALL_PLATFORMS: SocialPlatform[] = ["linkedin", "facebook", "instagram", "x"];
const TONES = ["Professional", "Casual", "Witty", "Inspiring", "Urgent"];
const LENGTHS = ["Short", "Medium", "Long"] as const;

function PlatformPill({
  platform,
  selected,
  onToggle,
}: {
  platform: SocialPlatform;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Box
      onClick={onToggle}
      sx={{
        px: 1.25,
        py: 0.5,
        borderRadius: "6px",
        cursor: "pointer",
        userSelect: "none",
        transition: "all 0.12s",
        border: `1.5px solid ${selected ? colors.primary : colors.border}`,
        bgcolor: selected ? colors.primaryLight : "transparent",
        "&:hover": { borderColor: colors.primary, bgcolor: colors.primaryLight },
      }}
    >
      <Typography
        sx={{
          fontSize: "0.8125rem",
          fontWeight: selected ? 600 : 400,
          color: selected ? colors.primary : colors.textSecondary,
        }}
      >
        {PLATFORM_LABELS[platform]}
      </Typography>
    </Box>
  );
}

type TextBriefPanelProps = {
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
  imageUrl: string | null;
  videoUrl: string | null;
  onMediaTypeChange: (t: MediaType) => void;
  onSwitchToImage: () => void;
  onSwitchToVideo: () => void;
  formError: string | null;
};

export default function TextBriefPanel({
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
  imageUrl,
  videoUrl,
  onMediaTypeChange,
  onSwitchToImage,
  onSwitchToVideo,
  formError,
}: TextBriefPanelProps) {
  const attachedType: MediaType = videoUrl ? "video" : imageUrl ? "image" : "none";

  return (
    <Stack spacing={2}>
      <SectionCard title="Post brief" description="Describe what you want to publish">
        <Stack spacing={1.5}>
          <AppTextarea
            label="What is this post about?"
            required
            minRows={4}
            maxRows={8}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Describe your topic, product, offer, or idea"
            error={Boolean(formError)}
            helperText={formError ?? undefined}
          />
          <AppInput
            label="Target audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. SaaS founders, HR managers"
          />
          <AppInput
            label="Call to action"
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            placeholder="e.g. Book a demo, Sign up free"
          />
        </Stack>
      </SectionCard>

      <SectionCard title="Format and distribution">
        <Stack spacing={1.5}>
          <PostFormatSelector value={format} onChange={setFormat} activePlatforms={platforms} />

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textSecondary, mb: 0.75, display: "block" }}>
              Tone
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {TONES.map((label) => (
                <Box
                  key={label}
                  onClick={() => setTone(label)}
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    borderRadius: "6px",
                    cursor: "pointer",
                    border: `1.5px solid ${tone === label ? colors.primary : colors.border}`,
                    bgcolor: tone === label ? colors.primaryLight : "transparent",
                    fontSize: "0.8125rem",
                    fontWeight: tone === label ? 600 : 400,
                    color: tone === label ? colors.primary : colors.textSecondary,
                    whiteSpace: "nowrap",
                    transition: "all 0.1s",
                    "&:hover": { borderColor: colors.primary, bgcolor: colors.primaryLight },
                  }}
                >
                  {label}
                </Box>
              ))}
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textSecondary, mb: 0.75, display: "block" }}>
              Platforms
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {ALL_PLATFORMS.map((p) => (
                <PlatformPill
                  key={p}
                  platform={p}
                  selected={platforms.includes(p)}
                  onToggle={() => togglePlatform(p)}
                />
              ))}
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textSecondary, mb: 0.75, display: "block" }}>
              Length
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {LENGTHS.map((l) => (
                <Box
                  key={l}
                  onClick={() => setLength(l)}
                  sx={{
                    flex: 1,
                    textAlign: "center",
                    py: 0.625,
                    borderRadius: "6px",
                    cursor: "pointer",
                    border: `1.5px solid ${length === l ? colors.primary : colors.border}`,
                    bgcolor: length === l ? colors.primaryLight : "transparent",
                    fontSize: "0.8125rem",
                    fontWeight: length === l ? 600 : 400,
                    color: length === l ? colors.primary : colors.textSecondary,
                    transition: "all 0.1s",
                    "&:hover": { borderColor: colors.primary },
                  }}
                >
                  {l}
                </Box>
              ))}
            </Box>
          </Box>
        </Stack>
      </SectionCard>

      <SectionCard title="Media attachment" description="Optional image or video for this post">
        <Stack spacing={1.25}>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {(["none", "image", "video"] as const).map((type) => (
              <Box
                key={type}
                onClick={() => onMediaTypeChange(type)}
                sx={{
                  flex: 1,
                  textAlign: "center",
                  py: 0.75,
                  borderRadius: "6px",
                  cursor: "pointer",
                  border: `1.5px solid ${attachedType === type ? colors.primary : colors.border}`,
                  bgcolor: attachedType === type ? colors.primaryLight : "transparent",
                  fontSize: "0.75rem",
                  fontWeight: attachedType === type ? 600 : 400,
                  color: attachedType === type ? colors.primary : colors.textSecondary,
                  textTransform: "capitalize",
                  transition: "all 0.1s",
                  "&:hover": { borderColor: colors.primary },
                }}
              >
                {type === "none" ? "No media" : type}
              </Box>
            ))}
          </Box>

          {imageUrl && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                p: 1,
                borderRadius: "8px",
                border: `1px solid ${colors.border}`,
                bgcolor: colors.background,
              }}
            >
              {imageUrl ? (
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "6px",
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 20, color: colors.textMuted }} />
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                  {imageUrl ? "Image attached" : "No image yet"}
                </Typography>
                <Typography
                  onClick={onSwitchToImage}
                  sx={{ fontSize: "0.6875rem", color: colors.primary, cursor: "pointer", fontWeight: 600 }}
                >
                  {imageUrl ? "Edit in Image tab" : "Create in Image tab"}
                </Typography>
              </Box>
            </Box>
          )}

          {videoUrl && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                p: 1,
                borderRadius: "8px",
                border: `1px solid ${colors.border}`,
                bgcolor: colors.background,
              }}
            >
              {videoUrl ? (
                <Box
                  component="video"
                  src={videoUrl}
                  sx={{ width: 40, height: 40, borderRadius: "6px", objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <PlayCircleFilledOutlinedIcon sx={{ fontSize: 20, color: colors.textMuted }} />
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                  {videoUrl ? "Video attached" : "No video yet"}
                </Typography>
                <Typography
                  onClick={onSwitchToVideo}
                  sx={{ fontSize: "0.6875rem", color: colors.primary, cursor: "pointer", fontWeight: 600 }}
                >
                  {videoUrl ? "Edit in Video tab" : "Create in Video tab"}
                </Typography>
              </Box>
            </Box>
          )}
        </Stack>
      </SectionCard>
    </Stack>
  );
}
