"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import RocketLaunchOutlinedIcon from "@mui/icons-material/RocketLaunchOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppTextarea from "@/components/ui/AppTextarea";
import { getAvailableFormats } from "@/components/social-media/content-studio/PostFormatSelector";
import StudioSidebar from "@/components/social-media/content-studio/StudioSidebar";
import { fillTemplatePrompt } from "@/components/social-media/content-studio/shared/templateUtils";
import {
  buildPersistMediaPayload,
  INITIAL_STUDIO_MEDIA,
  isVideoMediaUrl,
  mediaSourceFromApi,
  resolveDraftMedia,
} from "@/components/social-media/content-studio/shared/studioMediaHelpers";
import { VIDEO_GENERATION_TEMPLATES } from "@/data/video-generation-templates";
import PhoneFrame from "@/components/social-media/content-studio/PhoneFrame";
import CarouselSlideRenderer, {
  LAYOUT_PRESETS, BG_PRESETS, TEXT_PRESETS, ACCENT_PRESETS,
} from "@/components/social-media/content-studio/CarouselSlideRenderer";
import PlatformPreview from "@/components/social-media/content-studio/PlatformPreview";
import ScheduleModal from "@/components/social-media/posts/ScheduleModal";
import { templateApplyStorageKey } from "@/components/social-media/content-studio/TemplateUseModal";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { selectUser } from "@/features/auth/authSlice";
import {
  selectGenerateError,
  selectGenerating,
  selectPublishing,
} from "@/features/social-media/socialPostsSelectors";
import { clearGeneratedContent } from "@/features/social-media/socialPostsSlice";
import {
  createSocialPost,
  fetchSocialPost,
  generateSocialContent,
  publishSocialPostNow,
  scheduleSocialPost,
  updateSocialPost,
} from "@/features/social-media/socialPostsThunks";
import { selectSocialAccounts } from "@/features/social-media/socialAccountsSelectors";
import { fetchSocialAccounts } from "@/features/social-media/socialAccountsThunks";
import { selectBrandVoice } from "@/features/social-media/socialSettingsSlice";
import { fetchBrandVoice } from "@/features/social-media/socialSettingsThunks";
import { enqueueToast } from "@/features/ui/uiSlice";
import { colors, surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { DEFAULT_SLIDE_STYLE } from "@/types/social-media.types";
import type {
  ApplyTemplateResult,
  CarouselSlide,
  CarouselSlideStyle,
  CarouselSlideLayout,
  GeneratedContent,
  GeneratedPlatformContent,
  ImageAspectRatio,
  MediaType,
  PollOption,
  PostFormat,
  SocialAccount,
  SocialImageSource,
  SocialPlatform,
  SocialPost,
  StudioMode,
  StudioGenerationMode,
  ThreadTweet,
  VideoSeconds,
  VideoSize,
} from "@/types/social-media.types";
import { PLATFORM_LABELS } from "@/types/social-media.types";

// ─── Constants ────────────────────────────────────────────────────────────────

// ─── Draggable phone simulator ────────────────────────────────────────────────

function DraggablePhonePreview({ children }: { children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement | null>(null);

  // Default position: right side of viewport, vertically centered
  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setPos({ x: vw - 460, y: Math.max(80, (vh - 860) / 2) });
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 430, clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isDragging]);

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || !pos) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragOffset.current = { x: clientX - pos.x, y: clientY - pos.y };
    setIsDragging(true);
  };

  if (!pos) return null;

  return (
    <Box
      ref={frameRef}
      sx={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 1200,
        userSelect: "none",
        filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.3))",
      }}
    >
      {/* Drag handle bar */}
      <Box
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        sx={{
          height: 32,
          bgcolor: "#1a1a1a",
          borderRadius: "14px 14px 0 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isDragging ? "grabbing" : "grab",
          gap: 0.75,
          "&:active": { cursor: "grabbing" },
        }}
      >
        {/* Drag dots */}
        <Box sx={{ display: "flex", gap: "3px" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Box key={i} sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.35)" }} />
          ))}
        </Box>
        <Typography sx={{ fontSize: "0.625rem", color: "rgba(255,255,255,0.5)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Preview
        </Typography>
        <Box sx={{ display: "flex", gap: "3px" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Box key={i} sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.35)" }} />
          ))}
        </Box>
      </Box>

      {/* Phone frame */}
      {children}
    </Box>
  );
}

function pickPreviewAccount(accounts: SocialAccount[], platform: SocialPlatform) {
  const active = accounts.filter((a) => a.platform === platform && a.isActive);
  return active.find((a) => a.isDefault) ?? active[0] ?? null;
}

// ─── Carousel editor (right panel) ───────────────────────────────────────────

function CarouselOutput({
  slides, onChange, onRegenSlide, onRegenImage,
  orgId, topic, tone,
}: {
  slides: CarouselSlide[];
  onChange: (slides: CarouselSlide[]) => void;
  onRegenSlide: (idx: number) => void;
  onRegenImage: (idx: number) => void;
  orgId: string;
  topic: string;
  tone: string;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [styleTab, setStyleTab] = useState<"content" | "design">("content");
  const [applyToAll, setApplyToAll] = useState(false);

  const slide = slides[activeIdx] ?? slides[0];
  const slideStyle: CarouselSlideStyle = { ...DEFAULT_SLIDE_STYLE, ...(slide?.style ?? {}) };

  const update = (i: number, patch: Partial<CarouselSlide>) =>
    onChange(slides.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const updateStyle = (patch: Partial<CarouselSlideStyle>) => {
    const newStyle = { ...slideStyle, ...patch };
    if (applyToAll) {
      onChange(slides.map((s) => ({ ...s, style: newStyle })));
    } else {
      update(activeIdx, { style: newStyle });
    }
  };

  const addSlide = () => {
    const next = [...slides, { id: crypto.randomUUID(), headline: "", body: "", imageUrl: null, style: slideStyle }];
    onChange(next);
    setActiveIdx(next.length - 1);
  };

  const removeSlide = (i: number) => {
    if (slides.length <= 2) return;
    onChange(slides.filter((_, idx) => idx !== i));
    setActiveIdx(Math.max(0, i - 1));
  };

  if (!slide) return null;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2.5, alignItems: "start" }}>
      {/* Left — Canva-style slide preview */}
      <Box>
        {/* Slide thumbnail row */}
        <Box sx={{ display: "flex", gap: 0.75, mb: 1.5, overflowX: "auto", pb: 0.5 }}>
          {slides.map((s, i) => (
            <Box
              key={s.id}
              onClick={() => setActiveIdx(i)}
              sx={{
                flexShrink: 0,
                width: 64, height: 48, borderRadius: "8px", overflow: "hidden",
                border: `2.5px solid ${activeIdx === i ? colors.primary : colors.border}`,
                cursor: "pointer", transition: "border-color 0.15s", position: "relative",
              }}
            >
              <CarouselSlideRenderer slide={s} slideNum={i + 1} totalSlides={slides.length} compact />
              {slides.length > 2 && (
                <Box
                  onClick={(e) => { e.stopPropagation(); removeSlide(i); }}
                  sx={{ position: "absolute", top: 2, right: 2, width: 14, height: 14, borderRadius: "50%", bgcolor: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", "&:hover": { bgcolor: "rgba(0,0,0,0.85)" } }}
                >
                  <Typography sx={{ color: "#fff", fontSize: "0.5rem", lineHeight: 1 }}>✕</Typography>
                </Box>
              )}
            </Box>
          ))}
          {slides.length < 10 && (
            <Box
              onClick={addSlide}
              sx={{ flexShrink: 0, width: 64, height: 48, borderRadius: "8px", border: `1.5px dashed ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", "&:hover": { borderColor: colors.primary, bgcolor: colors.primaryLight } }}
            >
              <AddIcon sx={{ fontSize: 18, color: colors.textMuted }} />
            </Box>
          )}
        </Box>

        {/* Large slide preview canvas */}
        <Box sx={{ aspectRatio: "4/3", borderRadius: "12px", overflow: "hidden", border: `1px solid ${colors.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
          <CarouselSlideRenderer
            slide={slide}
            slideNum={activeIdx + 1}
            totalSlides={slides.length}
          />
        </Box>

        {/* Regen this slide */}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Box
            onClick={() => onRegenSlide(activeIdx)}
            sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, py: 0.875, borderRadius: "8px", border: `1.5px solid ${colors.border}`, cursor: "pointer", "&:hover": { borderColor: colors.primary, bgcolor: colors.primaryLight } }}
          >
            <RefreshIcon sx={{ fontSize: 15, color: colors.primary }} />
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: colors.primary }}>Regenerate text</Typography>
          </Box>
          <Box
            onClick={() => onRegenImage(activeIdx)}
            sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, py: 0.875, borderRadius: "8px", border: `1.5px solid ${colors.border}`, cursor: "pointer", "&:hover": { borderColor: colors.primary, bgcolor: colors.primaryLight } }}
          >
            <ImageOutlinedIcon sx={{ fontSize: 15, color: colors.primary }} />
            <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: colors.primary }}>Regenerate image</Typography>
          </Box>
        </Stack>
      </Box>

      {/* Right — Content + Design tabs */}
      <Box>
        {/* Tab switcher */}
        <Box sx={{ display: "flex", border: `1.5px solid ${colors.border}`, borderRadius: "8px", overflow: "hidden", mb: 2 }}>
          {(["content", "design"] as const).map((t) => (
            <Box key={t} onClick={() => setStyleTab(t)} sx={{ flex: 1, py: 0.875, textAlign: "center", cursor: "pointer", bgcolor: styleTab === t ? colors.primary : "transparent", transition: "background 0.15s" }}>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: styleTab === t ? "#fff" : colors.textSecondary, textTransform: "capitalize" }}>{t}</Typography>
            </Box>
          ))}
        </Box>

        {styleTab === "content" ? (
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textSecondary, mb: 0.5, display: "block" }}>
                Slide {activeIdx + 1} — Headline
              </Typography>
              <AppInput
                hideLabel
                value={slide.headline}
                onChange={(e) => update(activeIdx, { headline: e.target.value })}
                placeholder="Bold punchy headline…"
              />
            </Box>
            <AppTextarea
              label="Body copy"
              minRows={3}
              value={slide.body}
              onChange={(e) => update(activeIdx, { body: e.target.value })}
              placeholder="Supporting description for this slide…"
            />
          </Stack>
        ) : (
          /* ─── Design panel ─────────────────────────────── */
          <Stack spacing={2.5}>
            {/* Layout templates */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textSecondary, mb: 1, display: "block" }}>Layout</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 0.75 }}>
                {LAYOUT_PRESETS.map((lp) => (
                  <Box
                    key={lp.id}
                    onClick={() => updateStyle({ layout: lp.id as CarouselSlideLayout })}
                    sx={{
                      borderRadius: "8px", overflow: "hidden", cursor: "pointer",
                      border: `2.5px solid ${slideStyle.layout === lp.id ? colors.primary : colors.border}`,
                      transition: "border-color 0.12s",
                      aspectRatio: "1/1",
                    }}
                  >
                    <CarouselSlideRenderer
                      slide={{ id: "preview", headline: "T", body: "preview", style: { ...slideStyle, layout: lp.id as CarouselSlideLayout } }}
                      slideNum={1}
                      totalSlides={1}
                      compact
                    />
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
                {LAYOUT_PRESETS.map((lp) => (
                  <Typography key={lp.id} sx={{ fontSize: "0.625rem", color: colors.textMuted, flex: "1 0 0", textAlign: "center" }}>{lp.label}</Typography>
                ))}
              </Box>
            </Box>

            {/* Background color */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textSecondary, mb: 1, display: "block" }}>Background</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                {BG_PRESETS.map((p) => (
                  <Tooltip key={p.color} title={p.label}>
                    <Box
                      onClick={() => updateStyle({ bgColor: p.color, bgColor2: p.color2 })}
                      sx={{
                        width: 28, height: 28, borderRadius: "6px", cursor: "pointer",
                        background: `linear-gradient(135deg, ${p.color} 0%, ${p.color2} 100%)`,
                        border: `2.5px solid ${slideStyle.bgColor === p.color ? colors.primary : "transparent"}`,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                        transition: "border-color 0.12s",
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
              {/* Custom hex input */}
              <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                <Box component="input" type="color" value={slideStyle.bgColor} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateStyle({ bgColor: e.target.value })}
                  style={{ width: 36, height: 36, padding: 2, border: `1px solid ${colors.border}`, borderRadius: 8, cursor: "pointer", background: "none" }}
                />
                <AppInput hideLabel value={slideStyle.bgColor} onChange={(e) => updateStyle({ bgColor: e.target.value })} placeholder="#000000" />
              </Box>
            </Box>

            {/* Text color */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textSecondary, mb: 1, display: "block" }}>Text color</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                {TEXT_PRESETS.map((p) => (
                  <Tooltip key={p.color} title={p.label}>
                    <Box
                      onClick={() => updateStyle({ textColor: p.color })}
                      sx={{ width: 28, height: 28, borderRadius: "6px", cursor: "pointer", bgcolor: p.color, border: `2.5px solid ${slideStyle.textColor === p.color ? colors.primary : colors.border}`, transition: "border-color 0.12s" }}
                    />
                  </Tooltip>
                ))}
              </Box>
              <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                <Box component="input" type="color" value={slideStyle.textColor} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateStyle({ textColor: e.target.value })}
                  style={{ width: 36, height: 36, padding: 2, border: `1px solid ${colors.border}`, borderRadius: 8, cursor: "pointer", background: "none" }}
                />
                <AppInput hideLabel value={slideStyle.textColor} onChange={(e) => updateStyle({ textColor: e.target.value })} placeholder="#ffffff" />
              </Box>
            </Box>

            {/* Accent color */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textSecondary, mb: 1, display: "block" }}>Accent / Highlight</Typography>
              <Box sx={{ display: "flex", gap: 0.75 }}>
                {ACCENT_PRESETS.map((p) => (
                  <Box
                    key={p.color}
                    onClick={() => updateStyle({ accentColor: p.color })}
                    sx={{ width: 28, height: 28, borderRadius: "6px", cursor: "pointer", bgcolor: p.color, border: `2.5px solid ${slideStyle.accentColor === p.color ? colors.primary : colors.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", transition: "border-color 0.12s" }}
                  />
                ))}
                <Box component="input" type="color" value={slideStyle.accentColor} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateStyle({ accentColor: e.target.value })}
                  style={{ width: 28, height: 28, padding: 2, border: `1px solid ${colors.border}`, borderRadius: 8, cursor: "pointer", background: "none" }}
                />
              </Box>
            </Box>

            {/* Apply to all */}
            <Box
              onClick={() => setApplyToAll(!applyToAll)}
              sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer", py: 0.875, px: 1.25, borderRadius: "8px", border: `1.5px solid ${applyToAll ? colors.primary : colors.border}`, bgcolor: applyToAll ? colors.primaryLight : "transparent", transition: "all 0.15s" }}
            >
              <Box sx={{ width: 16, height: 16, borderRadius: "4px", border: `1.5px solid ${applyToAll ? colors.primary : colors.border}`, bgcolor: applyToAll ? colors.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {applyToAll && <Typography sx={{ color: "#fff", fontSize: "0.625rem", lineHeight: 1 }}>✓</Typography>}
              </Box>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, color: applyToAll ? colors.primary : colors.textSecondary }}>Apply style to all slides</Typography>
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

// ─── Thread editor (right panel) ─────────────────────────────────────────────

function ThreadOutput({
  thread, onChange, onRegenTweet,
}: {
  thread: ThreadTweet[];
  onChange: (thread: ThreadTweet[]) => void;
  onRegenTweet: (idx: number) => void;
}) {
  const LIMIT = 280;
  const update = (i: number, text: string) =>
    onChange(thread.map((t, idx) => idx === i ? { ...t, text, characterCount: text.length } : t));

  const addTweet = () => onChange([...thread, { id: crypto.randomUUID(), text: "", characterCount: 0 }]);
  const removeTweet = (i: number) => { if (thread.length <= 1) return; onChange(thread.filter((_, idx) => idx !== i)); };

  return (
    <Stack spacing={2}>
      {thread.map((tweet, i) => {
        const over = tweet.characterCount > LIMIT;
        return (
          <Box key={tweet.id}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textSecondary }}>
                {i === 0 ? "Hook" : `Tweet ${i + 1}`}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: over ? colors.error : colors.textMuted }}>
                  {tweet.characterCount}/{LIMIT}
                </Typography>
                <Tooltip title="Regenerate this tweet">
                  <IconButton size="small" onClick={() => onRegenTweet(i)}>
                    <RefreshIcon sx={{ fontSize: 15, color: colors.primary }} />
                  </IconButton>
                </Tooltip>
                {thread.length > 1 && (
                  <IconButton size="small" onClick={() => removeTweet(i)}>
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                )}
              </Box>
            </Box>
            <AppTextarea
              hideLabel minRows={2} maxRows={5}
              value={tweet.text}
              onChange={(e) => update(i, e.target.value)}
              error={over}
              placeholder={i === 0 ? "Arresting hook…" : "Continue the story…"}
            />
            {over && <LinearProgress variant="determinate" value={100} sx={{ mt: 0.25, height: 2, bgcolor: "transparent", "& .MuiLinearProgress-bar": { bgcolor: colors.error } }} />}
          </Box>
        );
      })}
      <AppButton variant="ghost" size="small" leftIcon={<AddIcon sx={{ fontSize: 15 }} />} onClick={addTweet} sx={{ alignSelf: "flex-start" }}>
        Add tweet
      </AppButton>
    </Stack>
  );
}

// ─── Poll editor (right panel) ────────────────────────────────────────────────

function PollOutput({
  question, options, caption, hashtags,
  onQuestionChange, onOptionsChange, onCaptionChange,
  onRegenAll,
}: {
  question: string; options: PollOption[]; caption: string; hashtags: string[];
  onQuestionChange: (q: string) => void;
  onOptionsChange: (opts: PollOption[]) => void;
  onCaptionChange: (c: string) => void;
  onRegenAll: () => void;
}) {
  const updateOption = (id: string, text: string) =>
    onOptionsChange(options.map((o) => (o.id === id ? { ...o, text } : o)));

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>Poll</Typography>
        <Tooltip title="Regenerate entire poll">
          <IconButton size="small" onClick={onRegenAll}>
            <RefreshIcon sx={{ fontSize: 16, color: colors.primary }} />
          </IconButton>
        </Tooltip>
      </Box>
      <AppInput label="Poll question" value={question} onChange={(e) => onQuestionChange(e.target.value)} placeholder="What's your biggest challenge?" />
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textSecondary, mb: 0.5, display: "block" }}>
          Options ({options.length}/4)
        </Typography>
        <Stack spacing={1}>
          {options.map((opt, i) => (
            <Box key={opt.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <AppInput
                hideLabel value={opt.text}
                onChange={(e) => updateOption(opt.id, e.target.value)}
                placeholder={`Option ${i + 1}`}
                sx={{ flex: 1 }}
              />
              {options.length > 2 && (
                <IconButton size="small" onClick={() => onOptionsChange(options.filter((o) => o.id !== opt.id))}>
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                </IconButton>
              )}
            </Box>
          ))}
        </Stack>
        {options.length < 4 && (
          <AppButton variant="ghost" size="small" leftIcon={<AddIcon sx={{ fontSize: 15 }} />} onClick={() => onOptionsChange([...options, { id: crypto.randomUUID(), text: "" }])} sx={{ mt: 0.75 }}>
            Add option
          </AppButton>
        )}
      </Box>
      <AppTextarea label="Intro caption" minRows={3} value={caption} onChange={(e) => onCaptionChange(e.target.value)} placeholder="Compelling reason to vote…" />
      <AppInput
        label="Hashtags"
        value={hashtags.join(" ")}
        onChange={(e) => {
          /* read-only chips — we could add edit but keep simple */
        }}
        helperText="Auto-generated"
      />
      {hashtags.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {hashtags.map((h) => <Chip key={h} label={`#${h}`} size="small" sx={{ fontSize: "0.75rem" }} />)}
        </Box>
      )}
    </Stack>
  );
}

// ─── Single caption editor (right panel) ─────────────────────────────────────

function SingleOutput({
  activePlatform, drafts, onChange,
}: {
  activePlatform: SocialPlatform;
  drafts: Partial<Record<SocialPlatform, GeneratedPlatformContent>>;
  onChange: (p: SocialPlatform, v: GeneratedPlatformContent) => void;
}) {
  const LIMITS: Record<SocialPlatform, number> = { linkedin: 3000, instagram: 2200, facebook: 2200, x: 280 };
  const current = drafts[activePlatform] ?? { caption: "", hashtags: [], firstComment: "", characterCount: 0 };
  const limit = LIMITS[activePlatform];
  const pct = Math.min(100, (current.caption.length / limit) * 100);
  const over = current.caption.length > limit;

  const update = (patch: Partial<GeneratedPlatformContent>) =>
    onChange(activePlatform, { ...current, ...patch, characterCount: (patch.caption ?? current.caption).length });

  const copyAll = async () => {
    const tags = current.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
    await navigator.clipboard.writeText([current.caption, tags].filter(Boolean).join("\n\n"));
  };

  return (
    <Stack spacing={2}>
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Caption</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography variant="caption" sx={{ color: over ? colors.error : colors.textMuted }}>{current.caption.length} / {limit}</Typography>
            <Tooltip title="Copy caption + hashtags">
              <IconButton size="small" onClick={() => void copyAll()}>
                <ContentCopyOutlinedIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        <AppTextarea hideLabel minRows={6} value={current.caption} onChange={(e) => update({ caption: e.target.value })} placeholder={`Write your ${PLATFORM_LABELS[activePlatform]} post…`} error={over} />
        <LinearProgress variant="determinate" value={pct} sx={{ mt: 0.5, height: 2, borderRadius: 1, bgcolor: colors.border, "& .MuiLinearProgress-bar": { bgcolor: over ? colors.error : pct > 85 ? colors.warning : colors.primary } }} />
      </Box>
      <AppInput
        label="Hashtags"
        value={current.hashtags.join(" ")}
        onChange={(e) => update({ hashtags: e.target.value.split(/[\s,]+/).map((t) => t.replace(/^#/, "")).filter(Boolean) })}
        placeholder="growth saas marketing"
        helperText="Space-separated, without #"
      />
      {current.hashtags.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {current.hashtags.map((h) => (
            <Chip key={h} size="small" label={`#${h}`} onDelete={() => update({ hashtags: current.hashtags.filter((x) => x !== h) })} sx={{ fontSize: "0.75rem" }} />
          ))}
        </Box>
      )}
      <AppTextarea label="First comment" minRows={2} value={current.firstComment} onChange={(e) => update({ firstComment: e.target.value })} placeholder="Optional link or CTA in first comment…" />
    </Stack>
  );
}

// ─── Main AIGenerate ──────────────────────────────────────────────────────────

export default function AIGenerate() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId");
  const assetIdParam = searchParams.get("assetId");
  const refineParam = searchParams.get("mode") === "refine";
  const scheduleAtParam = searchParams.get("scheduleAt");
  const templateId = searchParams.get("templateId");

  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const generating = useAppSelector(selectGenerating);
  const generateError = useAppSelector(selectGenerateError);
  const publishing = useAppSelector(selectPublishing);
  const brandVoice = useAppSelector(selectBrandVoice);
  const accounts = useAppSelector(selectSocialAccounts);

  // Brief
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("Professional");
  const [length, setLength] = useState("Medium");
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(["linkedin", "facebook"]);
  const [audience, setAudience] = useState("");
  const [cta, setCta] = useState("");
  const [format, setFormat] = useState<PostFormat>("single");

  // Media
  const [mediaType, setMediaType] = useState<MediaType>("none");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [imageStyle, setImageStyle] = useState("None");
  const [imageAspectRatio, setImageAspectRatio] = useState<ImageAspectRatio>("1024x1024");
  const [videoSize, setVideoSize] = useState<VideoSize>("1280x720");
  const [videoDuration, setVideoDuration] = useState<VideoSeconds>("4");
  const [studioMode, setStudioMode] = useState<StudioMode>("text");
  const [selectedImageTemplateId, setSelectedImageTemplateId] = useState<string | null>(null);
  const [selectedVideoTemplateId, setSelectedVideoTemplateId] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [soraUnavailable, setSoraUnavailable] = useState<string | null>(null);
  const [mediaSource, setMediaSource] = useState<SocialImageSource>("none");
  const [videoReferenceFile, setVideoReferenceFile] = useState<File | null>(null);
  const [videoReferencePreview, setVideoReferencePreview] = useState<string | null>(null);
  const [usePostImageAsVideoReference, setUsePostImageAsVideoReference] = useState(false);
  const videoReferencePreviewRef = useRef<string | null>(null);
  const [imageGenerationMode, setImageGenerationMode] = useState<StudioGenerationMode>("create");
  const [videoGenerationMode, setVideoGenerationMode] = useState<StudioGenerationMode>("create");
  const [soraVideoId, setSoraVideoId] = useState<string | null>(null);

  // Content state — all formats
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>("linkedin");
  const [drafts, setDrafts] = useState<Partial<Record<SocialPlatform, GeneratedPlatformContent>>>({});
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [thread, setThread] = useState<ThreadTweet[]>([]);
  const [pollOptions, setPollOptions] = useState<PollOption[]>([{ id: "p1", text: "" }, { id: "p2", text: "" }]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollCaption, setPollCaption] = useState("");
  const [pollHashtags, setPollHashtags] = useState<string[]>([]);
  const [carouselHashtags, setCarouselHashtags] = useState<string[]>([]);
  const [carouselCaption, setCarouselCaption] = useState("");

  // UI
  const [activeSlidePreview, setActiveSlidePreview] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(Boolean(scheduleAtParam));
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(templateId);
  const [regenLoading, setRegenLoading] = useState<Record<string, boolean>>({});
  const resetStudio = () => {
    dispatch(clearGeneratedContent());
    setDrafts({});
    setSlides([]);
    setThread([]);
    setPollQuestion("");
    setPollCaption("");
    setPollHashtags([]);
    setCarouselCaption("");
    setCarouselHashtags([]);
    setEditingPostId(null);
    setTemplateName(null);
    setActiveTemplateId(null);
    setTopic("");
    setTone("Professional");
    setLength("Medium");
    setPlatforms(["linkedin", "facebook"]);
    setAudience("");
    setCta("");
    setFormat("single");
    setFormError(null);
    setImageError(null);
    setVideoError(null);
    setSoraUnavailable(null);
    setMediaType(INITIAL_STUDIO_MEDIA.mediaType);
    setImageUrl(INITIAL_STUDIO_MEDIA.imageUrl);
    setVideoUrl(INITIAL_STUDIO_MEDIA.videoUrl);
    setImagePrompt(INITIAL_STUDIO_MEDIA.imagePrompt);
    setVideoPrompt(INITIAL_STUDIO_MEDIA.videoPrompt);
    setImageStyle(INITIAL_STUDIO_MEDIA.imageStyle);
    setImageAspectRatio(INITIAL_STUDIO_MEDIA.imageAspectRatio);
    setVideoSize(INITIAL_STUDIO_MEDIA.videoSize);
    setVideoDuration(INITIAL_STUDIO_MEDIA.videoDuration);
    setStudioMode(INITIAL_STUDIO_MEDIA.studioMode);
    setSelectedImageTemplateId(INITIAL_STUDIO_MEDIA.selectedImageTemplateId);
    setSelectedVideoTemplateId(INITIAL_STUDIO_MEDIA.selectedVideoTemplateId);
    setMediaSource(INITIAL_STUDIO_MEDIA.mediaSource);
    if (videoReferencePreviewRef.current) {
      URL.revokeObjectURL(videoReferencePreviewRef.current);
      videoReferencePreviewRef.current = null;
    }
    setVideoReferenceFile(null);
    setVideoReferencePreview(null);
    setUsePostImageAsVideoReference(false);
    setImageGenerationMode("create");
    setVideoGenerationMode("create");
    setSoraVideoId(null);
  };

  const templateBootstrappedRef = useRef(false);
  const assetBootstrappedRef = useRef(false);

  const previewAccount = useMemo(() => {
    const acc = pickPreviewAccount(accounts, activePlatform);
    return acc ? { accountName: acc.accountName, accountPictureUrl: acc.accountPictureUrl } : null;
  }, [accounts, activePlatform]);

  useEffect(() => {
    if (!orgId) return;
    void dispatch(fetchBrandVoice(orgId));
    void dispatch(fetchSocialAccounts({ orgId }));
  }, [dispatch, orgId]);

  useEffect(
    () => () => {
      if (videoReferencePreviewRef.current) {
        URL.revokeObjectURL(videoReferencePreviewRef.current);
      }
    },
    [],
  );

  const postImageUrlForReference = imageUrl && !isVideoMediaUrl(imageUrl) ? imageUrl : null;
  const canRefineVideo = Boolean(soraVideoId);

  const handleVideoReferenceImageSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setVideoError("Reference must be an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setVideoError("Reference image must be under 8 MB");
      return;
    }
    if (videoReferencePreviewRef.current) {
      URL.revokeObjectURL(videoReferencePreviewRef.current);
    }
    const url = URL.createObjectURL(file);
    videoReferencePreviewRef.current = url;
    setVideoReferencePreview(url);
    setVideoReferenceFile(file);
    setUsePostImageAsVideoReference(false);
    setVideoError(null);
  };

  const handleVideoReferenceImageClear = () => {
    if (videoReferencePreviewRef.current) {
      URL.revokeObjectURL(videoReferencePreviewRef.current);
      videoReferencePreviewRef.current = null;
    }
    setVideoReferencePreview(null);
    setVideoReferenceFile(null);
    setUsePostImageAsVideoReference(false);
  };

  // Template bootstrap
  useEffect(() => {
    if (!orgId || !templateId || draftId || templateBootstrappedRef.current) return;
    templateBootstrappedRef.current = true;
    const stored = sessionStorage.getItem(templateApplyStorageKey(orgId, templateId));
    if (stored) {
      const applied = JSON.parse(stored) as ApplyTemplateResult;
      setActiveTemplateId(applied.templateId);
      setTemplateName(applied.name);
      setTopic(applied.topic);
      setTone(applied.suggestedTone || "Professional");
      setCta(applied.suggestedCta || "");
      if (applied.platforms.length) { setPlatforms(applied.platforms); setActivePlatform(applied.platforms[0]); }
      if (applied.generateImage) {
        setStudioMode("image");
        setImagePrompt(applied.imagePrompt || applied.topic);
      }
      if (brandVoice?.targetAudience) setAudience(brandVoice.targetAudience);
    }
  }, [orgId, templateId, draftId, brandVoice?.targetAudience]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draft load
  useEffect(() => {
    if (!orgId || !draftId) return;
    void dispatch(fetchSocialPost({ orgId, postId: draftId })).unwrap().then((post) => {
      setEditingPostId(post.id);
      setTopic(post.aiPrompt || post.title || "");
      const draftMedia = resolveDraftMedia(post.imageUrl);
      setMediaType(draftMedia.mediaType);
      setImageUrl(draftMedia.imageUrl);
      setVideoUrl(draftMedia.videoUrl);
      if (draftMedia.mediaType === "image") setStudioMode("image");
      if (draftMedia.mediaType === "video") setStudioMode("video");
      setMediaSource(post.imageSource ?? "none");
      const pList = post.platforms.map((p) => p.platform);
      setPlatforms(pList.length ? pList : ["linkedin"]);
      setActivePlatform(pList[0] ?? "linkedin");
      const map: Partial<Record<SocialPlatform, GeneratedPlatformContent>> = {};
      for (const pp of post.platforms) {
        map[pp.platform] = { caption: pp.caption, hashtags: pp.hashtags, firstComment: pp.firstComment ?? "", characterCount: pp.characterCount };
      }
      setDrafts(map);
    });
  }, [dispatch, orgId, draftId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Media library asset bootstrap
  useEffect(() => {
    if (!orgId || !assetIdParam || draftId || assetBootstrappedRef.current) return;
    assetBootstrappedRef.current = true;
    void socialMediaApi.getMediaAsset(orgId, assetIdParam).then((asset) => {
      if (asset.mediaType === "video") {
        setVideoUrl(asset.url);
        setImageUrl(null);
        setMediaType("video");
        setStudioMode("video");
        if (asset.soraVideoId) setSoraVideoId(asset.soraVideoId);
        if (asset.prompt) setVideoPrompt(asset.prompt);
        if (refineParam && asset.soraVideoId) {
          setVideoGenerationMode("refine");
          setVideoPrompt("");
        }
      } else {
        setImageUrl(asset.url);
        setVideoUrl(null);
        setMediaType("image");
        setStudioMode("image");
        if (asset.prompt) setImagePrompt(asset.prompt);
        if (refineParam) {
          setImageGenerationMode("refine");
          setImagePrompt("");
        }
      }
      setMediaSource(asset.source === "uploaded" ? "uploaded" : "ai_generated");
      dispatch(
        enqueueToast({
          message: refineParam ? "Ready to refine — describe what to change" : "Media attached from library",
          severity: "success",
        }),
      );
    }).catch(() => {
      dispatch(enqueueToast({ message: "Could not load media asset", severity: "error" }));
    });
  }, [dispatch, orgId, assetIdParam, draftId, refineParam]);

  const togglePlatform = (p: SocialPlatform) => {
    setPlatforms((prev) => {
      const next = prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p];
      if (!next.includes(activePlatform) && next.length > 0) setActivePlatform(next[0]);
      const available = getAvailableFormats(next);
      setFormat((f) => available.includes(f) ? f : "single");
      return next;
    });
  };

  const handleImageChange = (url: string | null) => {
    setImageUrl(url);
    if (!url) {
      setMediaSource((prev) => (mediaType === "video" && videoUrl ? prev : "none"));
      setImageGenerationMode("create");
    }
  };

  const handleVideoChange = (url: string | null) => {
    setVideoUrl(url);
    if (!url) {
      setMediaSource((prev) => (mediaType === "image" && imageUrl ? prev : "none"));
      setSoraVideoId(null);
      setVideoGenerationMode("create");
    }
  };

  const handleFormatChange = (nextFormat: PostFormat) => {
    setFormat(nextFormat);
    if (nextFormat === "reel" || nextFormat === "story") {
      setMediaType("video");
      setStudioMode("video");
      setVideoSize("720x1280");
      const teaser = VIDEO_GENERATION_TEMPLATES.find((t) => t.id === "vid_social_teaser");
      if (teaser) {
        setSelectedVideoTemplateId(teaser.id);
        setVideoPrompt(fillTemplatePrompt(teaser.promptTemplate, topic));
        setVideoDuration(teaser.seconds);
      }
    }
  };

  const runGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      setImageError(imageGenerationMode === "refine" ? "Enter what to change" : "Enter a description for the image");
      return;
    }
    if (imageGenerationMode === "refine" && !imageUrl) {
      setImageError("Generate or upload an image first, then refine it");
      return;
    }
    setImageError(null);
    setGeneratingImage(true);
    try {
      const result = await socialMediaApi.generateImage(orgId, {
        topic: imagePrompt.trim(),
        style: imageStyle === "None" ? undefined : imageStyle,
        size: imageAspectRatio,
        mode: imageGenerationMode === "refine" ? "edit" : "create",
        sourceImageUrl: imageGenerationMode === "refine" ? imageUrl : null,
      });
      setImageUrl(result.imageUrl);
      setVideoUrl(null);
      setMediaType("image");
      setMediaSource(mediaSourceFromApi(result.source));
      dispatch(
        enqueueToast({
          message: imageGenerationMode === "refine" ? "Image refined" : "Image saved to library and attached",
          severity: "success",
        }),
      );
      if (imageGenerationMode === "create") setStudioMode("text");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setImageError(typeof detail === "string" ? detail : "Image generation failed. Try again.");
    } finally {
      setGeneratingImage(false);
    }
  };

  const runGenerateVideo = async () => {
    if (!videoPrompt.trim()) {
      setVideoError(videoGenerationMode === "refine" ? "Enter what to change" : "Enter a description for the video");
      return;
    }
    if (videoGenerationMode === "refine" && !soraVideoId) {
      setVideoError("Generate a video with AI first to refine it. Uploaded videos cannot be edited.");
      return;
    }
    setVideoError(null);
    setSoraUnavailable(null);
    setGeneratingVideo(true);
    try {
      const isRefine = videoGenerationMode === "refine";
      const result = await socialMediaApi.generateVideo(orgId, {
        prompt: videoPrompt.trim(),
        mode: isRefine ? "remix" : "create",
        remixVideoId: isRefine ? soraVideoId : null,
        size: videoSize,
        seconds: videoDuration,
        referenceImageFile: isRefine || usePostImageAsVideoReference ? null : videoReferenceFile,
        referenceImageUrl:
          !isRefine && usePostImageAsVideoReference && postImageUrlForReference
            ? postImageUrlForReference
            : null,
      });
      setVideoUrl(result.videoUrl);
      setImageUrl(null);
      setMediaType("video");
      setMediaSource(mediaSourceFromApi(result.source));
      if (result.soraVideoId) setSoraVideoId(result.soraVideoId);
      dispatch(
        enqueueToast({
          message: isRefine ? "Video refined" : "Video saved to library and attached",
          severity: "success",
        }),
      );
      if (!isRefine) setStudioMode("text");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: { error?: string; message?: string } | string } } };
      const detail = axiosErr?.response?.data?.detail;
      if (detail && typeof detail === "object" && detail.error === "sora_unavailable") {
        setSoraUnavailable(detail.message ?? "Sora 2 is not available for your Azure subscription.");
      } else {
        const msg = typeof detail === "string" ? detail : "Video generation failed. You can upload a video instead.";
        setVideoError(msg);
      }
    } finally {
      setGeneratingVideo(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setImageError("Please select an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setImageError("Image must be under 8 MB");
      return;
    }
    setImageError(null);
    setUploadingImage(true);
    try {
      const result = await socialMediaApi.uploadImage(orgId, file);
      setImageUrl(result.imageUrl);
      setVideoUrl(null);
      setMediaType("image");
      setMediaSource(mediaSourceFromApi(result.source));
      dispatch(enqueueToast({ message: "Image attached to your post", severity: "success" }));
      setStudioMode("text");
    } catch {
      setImageError("Upload failed. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUploadVideo = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      setVideoError("Please select a video file");
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setVideoError("Video must be under 200 MB");
      return;
    }
    setVideoError(null);
    setSoraUnavailable(null);
    setUploadingVideo(true);
    try {
      const result = await socialMediaApi.uploadVideo(orgId, file);
      setVideoUrl(result.videoUrl);
      setImageUrl(null);
      setMediaType("video");
      setMediaSource(mediaSourceFromApi(result.source));
      setSoraVideoId(null);
      setVideoGenerationMode("create");
      dispatch(enqueueToast({ message: "Video attached to your post", severity: "success" }));
      setStudioMode("text");
    } catch {
      setVideoError("Video upload failed. Please try again.");
    } finally {
      setUploadingVideo(false);
    }
  };

  // ── Format-aware generate ─────────────────────────────────────────────────
  const runGenerate = async () => {
    setFormError(null);
    if (topic.trim().length < 5) { setFormError("Topic must be at least 5 characters"); return; }
    if (platforms.length === 0) { setFormError("Select at least one platform"); return; }

    const lengthHint = length === "Short" ? " Be very concise, 1-2 sentences." : length === "Long" ? " Write detailed, long-form content." : "";
    const fullTopic = topic.trim() + lengthHint;

    try {
      const result: GeneratedContent = await dispatch(generateSocialContent({
        orgId,
        payload: {
          topic: fullTopic,
          tone,
          platforms,
          audience: audience.trim() || undefined,
          cta: cta.trim() || undefined,
          includeHashtags: true,
          includeComment: true,
          format,
        },
      })).unwrap();

      if (format === "carousel" && result.slides?.length) {
        const newSlides = result.slides.map((s, i) => ({
          id: `slide-${i}`,
          headline: s.headline,
          body: s.body,
          imageUrl: null as string | null,
          imagePromptText: s.imagePrompt,
          style: { ...DEFAULT_SLIDE_STYLE },
        }));
        setSlides(newSlides);
        setCarouselCaption(result.caption || "");
        setCarouselHashtags(result.hashtags || []);
        setActiveSlidePreview(0);
        // Auto-generate images for each slide in the background
        void autoGenerateSlideImages(newSlides, result.slides);
      } else if (format === "thread" && result.tweets?.length) {
        setThread(result.tweets.map((t, i) => ({ id: `tweet-${i}`, text: t.text, characterCount: t.text.length })));
        // Also set the X draft caption to first tweet so preview works
        setDrafts((prev) => ({ ...prev, x: { caption: result.tweets![0].text, hashtags: result.hashtags || [], firstComment: "", characterCount: result.tweets![0].text.length } }));
      } else if (format === "poll" && result.pollQuestion) {
        setPollQuestion(result.pollQuestion);
        setPollOptions((result.pollOptions || []).map((o, i) => ({ id: `poll-${i}`, text: o })));
        setPollCaption(result.caption || "");
        setPollHashtags(result.hashtags || []);
      } else if (result.platforms) {
        setDrafts(result.platforms);
        const keys = Object.keys(result.platforms) as SocialPlatform[];
        if (keys.length) setActivePlatform(keys[0]);
      }
    } catch (err) {
      dispatch(enqueueToast({ message: typeof err === "string" ? err : "Generation failed", severity: "error" }));
    }
  };

  // Auto-generate all slide images in background
  const autoGenerateSlideImages = async (
    current: (CarouselSlide & { imagePromptText?: string })[],
    original: { imagePrompt: string }[],
  ) => {
    const updated = [...current];
    await Promise.allSettled(
      original.map(async (orig, i) => {
        try {
          const result = await socialMediaApi.generateImage(orgId, { topic: orig.imagePrompt });
          updated[i] = { ...updated[i], imageUrl: result.imageUrl };
          setSlides([...updated]);
        } catch {
          /* individual slide image failure is non-fatal */
        }
      }),
    );
  };

  // ── Per-item regen ────────────────────────────────────────────────────────
  const regenSlideText = async (idx: number) => {
    setRegenLoading((p) => ({ ...p, [`slide-${idx}`]: true }));
    try {
      const res = await socialMediaApi.generatePost(orgId, {
        topic: `Rewrite slide ${idx + 1} for a carousel about: ${topic}. Other slides: ${slides.filter((_, i) => i !== idx).map((s) => s.headline).join(", ")}`,
        tone,
        platforms: ["linkedin"],
        format: "carousel",
        includeHashtags: false,
      });
      if (res.slides?.[idx]) {
        const s = res.slides[idx];
        setSlides((prev) => prev.map((sl, i) => i === idx ? { ...sl, headline: s.headline, body: s.body } : sl));
      }
    } catch { /* no-op */ }
    setRegenLoading((p) => ({ ...p, [`slide-${idx}`]: false }));
  };

  const regenSlideImage = async (idx: number) => {
    const slide = slides[idx];
    if (!slide) return;
    setRegenLoading((p) => ({ ...p, [`img-${idx}`]: true }));
    try {
      const imagePromptText = (slide as CarouselSlide & { imagePromptText?: string }).imagePromptText || topic;
      const res = await socialMediaApi.generateImage(orgId, { topic: imagePromptText });
      setSlides((prev) => prev.map((s, i) => i === idx ? { ...s, imageUrl: res.imageUrl } : s));
    } catch { /* no-op */ }
    setRegenLoading((p) => ({ ...p, [`img-${idx}`]: false }));
  };

  const regenTweet = async (idx: number) => {
    setRegenLoading((p) => ({ ...p, [`tweet-${idx}`]: true }));
    try {
      const res = await socialMediaApi.generatePost(orgId, {
        topic: `Rewrite tweet ${idx + 1} in a ${thread.length}-tweet thread about: ${topic}. Thread context: ${thread.map((t) => t.text).join(" | ")}`,
        tone,
        platforms: ["x"],
        format: "thread",
        includeHashtags: false,
      });
      if (res.tweets?.[0]) {
        const newText = res.tweets[0].text;
        setThread((prev) => prev.map((t, i) => i === idx ? { ...t, text: newText, characterCount: newText.length } : t));
      }
    } catch { /* no-op */ }
    setRegenLoading((p) => ({ ...p, [`tweet-${idx}`]: false }));
  };

  const regenPoll = async () => {
    setRegenLoading((p) => ({ ...p, poll: true }));
    try {
      const res = await socialMediaApi.generatePost(orgId, { topic, tone, platforms, format: "poll", includeHashtags: true });
      if (res.pollQuestion) {
        setPollQuestion(res.pollQuestion);
        setPollOptions((res.pollOptions || []).map((o, i) => ({ id: `poll-regen-${i}`, text: o })));
        if (res.caption) setPollCaption(res.caption);
        if (res.hashtags) setPollHashtags(res.hashtags);
      }
    } catch { /* no-op */ }
    setRegenLoading((p) => ({ ...p, poll: false }));
  };

  // ── Save / publish ────────────────────────────────────────────────────────
  const persistMedia = buildPersistMediaPayload(mediaType, imageUrl, videoUrl, mediaSource);

  const buildPlatformPayload = () =>
    platforms.map((p) => {
      const d = drafts[p] ?? { caption: pollCaption || carouselCaption || "", hashtags: pollHashtags || carouselHashtags || [], firstComment: "", characterCount: 0 };
      return { platform: p, caption: d.caption, hashtags: d.hashtags, firstComment: d.firstComment || null };
    });

  const hasTextContent = Boolean(
    Object.values(drafts).some((d) => d?.caption?.trim()) ||
    slides.length > 0 ||
    thread.length > 0 ||
    pollQuestion.trim(),
  );

  const hasMediaAttached = Boolean(
    (mediaType === "image" && imageUrl) || (mediaType === "video" && videoUrl),
  );

  const hasContent = hasTextContent || hasMediaAttached;

  const persistDraft = async (quiet = false): Promise<SocialPost | null> => {
    const platformPayload = buildPlatformPayload();
    const hasText = platformPayload.some((p) => p.caption.trim());
    if (!hasText && !persistMedia.imageUrl) {
      dispatch(enqueueToast({ message: "Generate copy or attach media first", severity: "error" }));
      return null;
    }
    const payload = {
      title: topic.trim().slice(0, 255) || "Untitled draft",
      status: "draft" as const,
      aiPrompt: topic.trim(),
      templateId: activeTemplateId,
      imageUrl: persistMedia.imageUrl,
      imageSource: persistMedia.imageSource,
      platforms: platformPayload,
    };
    const post = editingPostId
      ? await dispatch(updateSocialPost({ orgId, postId: editingPostId, payload })).unwrap()
      : await dispatch(createSocialPost({ orgId, payload })).unwrap();
    setEditingPostId(post.id);
    if (!quiet) dispatch(enqueueToast({ message: "Draft saved", severity: "success" }));
    router.replace(`/dashboard/content-studio/generate?draftId=${post.id}`);
    return post;
  };

  const saveDraft = async () => {
    setSaving(true);
    try { await persistDraft(); }
    catch { dispatch(enqueueToast({ message: "Failed to save draft", severity: "error" })); }
    finally { setSaving(false); }
  };

  const handleSchedule = async (scheduledAt: string) => {
    setSaving(true);
    try {
      const post = await persistDraft(true);
      if (!post) return;
      await dispatch(scheduleSocialPost({ orgId, postId: post.id, scheduledAt })).unwrap();
      dispatch(enqueueToast({ message: "Post scheduled", severity: "success" }));
      setScheduleOpen(false);
      router.push("/dashboard/posts/scheduled");
    } catch { dispatch(enqueueToast({ message: "Failed to schedule", severity: "error" })); }
    finally { setSaving(false); }
  };

  const handlePublishNow = async () => {
    try {
      const post = await persistDraft(true);
      if (!post) return;
      await dispatch(publishSocialPostNow({ orgId, postId: post.id })).unwrap();
      dispatch(enqueueToast({ message: "Publishing started", severity: "success" }));
      router.push(`/dashboard/posts/${post.id}`);
    } catch { dispatch(enqueueToast({ message: "Failed to publish", severity: "error" })); }
  };

  // ── Preview caption for phone frame ───────────────────────────────────────
  const previewCaption =
    format === "poll" ? pollQuestion :
    format === "thread" ? thread.map((t) => t.text).join("\n\n") :
    format === "carousel" ? carouselCaption :
    (drafts[activePlatform]?.caption ?? "");

  const previewHashtags =
    format === "poll" ? pollHashtags :
    format === "carousel" ? carouselHashtags :
    format === "thread" ? (drafts.x?.hashtags ?? []) :
    (drafts[activePlatform]?.hashtags ?? []);

  const previewSlides = format === "carousel" && slides.length > 0
    ? slides.map((s, i) => ({ ...s, id: `preview-${i}`, isActive: i === activeSlidePreview }))
    : undefined;

  const isAnyRegenLoading = Object.values(regenLoading).some(Boolean);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* ── Top bar ── */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4" sx={{ fontSize: "1.375rem", fontWeight: 700, mb: 0.25 }}>AI Studio</Typography>
          <Typography variant="body2" color="text.secondary">
            {templateName ? `Template: ${templateName}` : "Create platform-native posts"}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <AppButton variant="ghost" size="small" onClick={() => {
            resetStudio();
            router.push("/dashboard/content-studio/generate");
          }}>New</AppButton>
          <AppButton variant="secondary" size="small" leftIcon={<SaveOutlinedIcon sx={{ fontSize: 16 }} />} onClick={() => void saveDraft()} loading={saving && !publishing} disabled={!hasContent}>Save Draft</AppButton>
          <AppButton variant="secondary" size="small" leftIcon={<CalendarMonthOutlinedIcon sx={{ fontSize: 16 }} />} onClick={() => setScheduleOpen(true)} disabled={!hasContent || saving || publishing}>Schedule</AppButton>
          <AppButton variant="secondary" size="small" disabled={!hasContent} onClick={() => {
            void (async () => {
              try {
                const post = await persistDraft(true);
                if (!post) return;
                await socialMediaApi.submitApproval(orgId, post.id);
                dispatch(enqueueToast({ message: "Submitted for approval", severity: "success" }));
                router.push(`/dashboard/posts/${post.id}`);
              } catch { dispatch(enqueueToast({ message: "Submit failed", severity: "error" })); }
            })();
          }}>Submit for Approval</AppButton>
          <AppButton variant="primary" size="small" leftIcon={<RocketLaunchOutlinedIcon sx={{ fontSize: 16 }} />} onClick={() => void handlePublishNow()} loading={publishing} disabled={!hasContent || saving}>Publish Now</AppButton>
        </Stack>
      </Box>

      {/* ── 2-Panel Studio ── */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(420px, 480px) 1fr", xl: "minmax(460px, 520px) 1fr" },
          gap: 2,
          flex: 1,
          minHeight: 0,
          alignItems: "start",
        }}
      >
        {/* Left: Creation studio sidebar */}
        <Box
          sx={{
            ...surfaceSx,
            p: 2.5,
            display: "flex",
            flexDirection: "column",
            maxHeight: { lg: "calc(100vh - 140px)" },
            minHeight: { lg: "calc(100vh - 140px)" },
            position: { lg: "sticky" },
            top: { lg: 16 },
          }}
        >
          <StudioSidebar
            studioMode={studioMode}
            setStudioMode={setStudioMode}
            topic={topic}
            setTopic={setTopic}
            tone={tone}
            setTone={setTone}
            length={length}
            setLength={setLength}
            platforms={platforms}
            togglePlatform={togglePlatform}
            format={format}
            setFormat={handleFormatChange}
            audience={audience}
            setAudience={setAudience}
            cta={cta}
            setCta={setCta}
            mediaType={mediaType}
            setMediaType={setMediaType}
            imageUrl={imageUrl}
            videoUrl={videoUrl}
            imagePrompt={imagePrompt}
            setImagePrompt={setImagePrompt}
            imageStyle={imageStyle}
            setImageStyle={setImageStyle}
            imageAspectRatio={imageAspectRatio}
            setImageAspectRatio={setImageAspectRatio}
            selectedImageTemplateId={selectedImageTemplateId}
            setSelectedImageTemplateId={setSelectedImageTemplateId}
            videoPrompt={videoPrompt}
            setVideoPrompt={setVideoPrompt}
            videoSize={videoSize}
            setVideoSize={setVideoSize}
            videoDuration={videoDuration}
            setVideoDuration={setVideoDuration}
            selectedVideoTemplateId={selectedVideoTemplateId}
            setSelectedVideoTemplateId={setSelectedVideoTemplateId}
            onImageChange={handleImageChange}
            onVideoChange={handleVideoChange}
            generatingText={generating}
            generatingImage={generatingImage}
            generatingVideo={generatingVideo}
            uploadingImage={uploadingImage}
            uploadingVideo={uploadingVideo}
            imageError={imageError}
            setImageError={setImageError}
            videoError={videoError}
            setVideoError={setVideoError}
            soraUnavailable={soraUnavailable}
            setSoraUnavailable={setSoraUnavailable}
            formError={formError}
            hasCopy={hasTextContent}
            onGenerateText={() => void runGenerate()}
            onGenerateImage={() => void runGenerateImage()}
            onGenerateVideo={() => void runGenerateVideo()}
            onUploadImage={(file) => void handleUploadImage(file)}
            onUploadVideo={(file) => void handleUploadVideo(file)}
            postImageUrl={postImageUrlForReference}
            videoReferencePreview={videoReferencePreview}
            usePostImageAsVideoReference={usePostImageAsVideoReference}
            setUsePostImageAsVideoReference={setUsePostImageAsVideoReference}
            onVideoReferenceImageSelect={handleVideoReferenceImageSelect}
            onVideoReferenceImageClear={handleVideoReferenceImageClear}
            imageGenerationMode={imageGenerationMode}
            setImageGenerationMode={setImageGenerationMode}
            videoGenerationMode={videoGenerationMode}
            setVideoGenerationMode={setVideoGenerationMode}
            canRefineVideo={canRefineVideo}
          />
        </Box>

        {/* ── Right: Phone frame + Editor ── */}
        <Box>
          {/* Platform tabs */}
          {format !== "thread" && (
            <Box sx={{ ...surfaceSx, mb: 2, px: 2, pt: 1, pb: 0 }}>
              <Tabs
                value={platforms.includes(activePlatform) ? activePlatform : platforms[0] ?? "linkedin"}
                onChange={(_, v: SocialPlatform) => setActivePlatform(v)}
                variant="scrollable" scrollButtons="auto"
                sx={{ minHeight: 40 }}
              >
                {platforms.map((p) => (
                  <Tab key={p} value={p} label={PLATFORM_LABELS[p]} sx={{ minHeight: 40, fontSize: "0.8125rem" }} />
                ))}
              </Tabs>
            </Box>
          )}

          {(generating || isAnyRegenLoading) && <LinearProgress sx={{ mb: 1.5, borderRadius: 1 }} />}

          {generateError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {generateError}
              <AppButton variant="ghost" size="small" onClick={() => void runGenerate()} sx={{ ml: 1 }}>Retry</AppButton>
            </Alert>
          )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 3,
              alignItems: "start",
            }}
          >
            {/* ── Floating draggable phone simulator ── */}
            <DraggablePhonePreview>
              <PhoneFrame width={390}>
                <PlatformPreview
                  platform={format === "thread" ? "x" : (platforms.includes(activePlatform) ? activePlatform : platforms[0] ?? "linkedin")}
                  caption={previewCaption}
                  hashtags={previewHashtags}
                  imageUrl={mediaType === "image" && imageUrl ? (format === "carousel" && slides[activeSlidePreview]?.imageUrl ? slides[activeSlidePreview].imageUrl : imageUrl) : null}
                  videoUrl={mediaType === "video" && videoUrl ? videoUrl : null}
                  brandName={brandVoice?.brandName || "Your Brand"}
                  account={previewAccount}
                  slides={previewSlides}
                  pollOptions={format === "poll" ? pollOptions.map((o) => o.text) : undefined}
                />
              </PhoneFrame>
            </DraggablePhonePreview>

            {/* Editor zone */}
            <Box sx={{ minWidth: 0 }}>
              {!hasTextContent && !generating ? (
                <Box sx={{ ...surfaceSx, p: 4, textAlign: "center" }}>
                  <AutoAwesomeOutlinedIcon sx={{ fontSize: 32, color: colors.textMuted, mb: 1 }} />
                  {hasMediaAttached ? (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        Your {mediaType === "video" ? "video" : "image"} is attached and visible in the preview.
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                        Add a post topic on the Text tab, then click Generate Copy to create platform captions.
                      </Typography>
                      <AppButton variant="primary" size="small" onClick={() => void runGenerate()} loading={generating} disabled={topic.trim().length < 5}>
                        Generate Copy
                      </AppButton>
                    </>
                  ) : (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        Start on the Text tab with your post brief, or create media on the Image / Video tabs first.
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Recommended: brief, then media (optional), then Generate Copy
                      </Typography>
                    </>
                  )}
                </Box>
              ) : (
                <Box sx={{ ...surfaceSx, p: 2.5 }}>
                  {format === "carousel" && (
                    <CarouselOutput
                      slides={slides}
                      onChange={(newSlides) => { setSlides(newSlides); setActiveSlidePreview(0); }}
                      onRegenSlide={regenSlideText}
                      onRegenImage={regenSlideImage}
                      orgId={orgId}
                      topic={topic}
                      tone={tone}
                    />
                  )}
                  {format === "thread" && (
                    <ThreadOutput
                      thread={thread}
                      onChange={setThread}
                      onRegenTweet={regenTweet}
                    />
                  )}
                  {format === "poll" && (
                    <PollOutput
                      question={pollQuestion}
                      options={pollOptions}
                      caption={pollCaption}
                      hashtags={pollHashtags}
                      onQuestionChange={setPollQuestion}
                      onOptionsChange={setPollOptions}
                      onCaptionChange={setPollCaption}
                      onRegenAll={regenPoll}
                    />
                  )}
                  {(format === "single" || format === "reel" || format === "story") && (
                    <SingleOutput
                      activePlatform={platforms.includes(activePlatform) ? activePlatform : platforms[0] ?? "linkedin"}
                      drafts={drafts}
                      onChange={(p, v) => setDrafts((prev) => ({ ...prev, [p]: v }))}
                    />
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      <ScheduleModal
        open={scheduleOpen} loading={saving}
        initialValue={scheduleAtParam ?? undefined}
        onClose={() => setScheduleOpen(false)}
        onConfirm={(at) => void handleSchedule(at)}
      />
    </Box>
  );
}
