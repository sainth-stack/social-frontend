"use client";

import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
  Alert,
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";

import type { PreviewAccount } from "@/components/social-media/content-studio/PlatformPreview";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppTextarea from "@/components/ui/AppTextarea";
import { colors, surfaceSx } from "@/lib/theme";
import type {
  CarouselSlide,
  GeneratedPlatformContent,
  PollOption,
  PostFormat,
  SocialPlatform,
  ThreadTweet,
} from "@/types/social-media.types";
import { PLATFORM_CHAR_LIMITS, PLATFORM_LABELS } from "@/types/social-media.types";

export type PlatformDraft = GeneratedPlatformContent & { platform: SocialPlatform };

type PostEditorProps = {
  format: PostFormat;
  platforms: SocialPlatform[];
  activePlatform: SocialPlatform;
  onActivePlatformChange: (platform: SocialPlatform) => void;
  drafts: Partial<Record<SocialPlatform, GeneratedPlatformContent>>;
  onChange: (platform: SocialPlatform, value: GeneratedPlatformContent) => void;
  imageUrl?: string | null;
  videoUrl?: string | null;
  brandName?: string;
  previewAccount?: PreviewAccount | null;
  generateError?: string | null;
  onRetryGenerate?: () => void;
  empty?: boolean;
  // Format-specific
  slides?: CarouselSlide[];
  onSlidesChange?: (slides: CarouselSlide[]) => void;
  thread?: ThreadTweet[];
  onThreadChange?: (thread: ThreadTweet[]) => void;
  pollOptions?: PollOption[];
  onPollOptionsChange?: (options: PollOption[]) => void;
  pollQuestion?: string;
  onPollQuestionChange?: (q: string) => void;
};

// ─── Carousel Editor ─────────────────────────────────────────────────────────

function CarouselEditor({
  slides,
  onChange,
}: {
  slides: CarouselSlide[];
  onChange: (slides: CarouselSlide[]) => void;
}) {
  const [active, setActive] = useState(0);

  const update = (i: number, patch: Partial<CarouselSlide>) => {
    const next = slides.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange(next);
  };

  const addSlide = () => {
    const next = [...slides, { id: crypto.randomUUID(), headline: "", body: "", imageUrl: null }];
    onChange(next);
    setActive(next.length - 1);
  };

  const removeSlide = (i: number) => {
    if (slides.length <= 2) return;
    const next = slides.filter((_, idx) => idx !== i);
    onChange(next);
    setActive(Math.max(0, i - 1));
  };

  const slide = slides[active] ?? { id: "", headline: "", body: "", imageUrl: null };

  return (
    <Box>
      {/* Slide tabs */}
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }}>
        {slides.map((s, i) => (
          <Box
            key={s.id}
            onClick={() => setActive(i)}
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: "6px",
              border: `1.5px solid ${active === i ? colors.primary : colors.border}`,
              bgcolor: active === i ? colors.primaryLight : colors.paper,
              cursor: "pointer",
              fontSize: "0.8125rem",
              fontWeight: active === i ? 600 : 400,
              color: active === i ? colors.primary : colors.textSecondary,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            Slide {i + 1}
            {slides.length > 2 && (
              <DeleteOutlineRoundedIcon
                sx={{ fontSize: 14, opacity: 0.6 }}
                onClick={(e) => { e.stopPropagation(); removeSlide(i); }}
              />
            )}
          </Box>
        ))}
        {slides.length < 10 && (
          <Box
            onClick={addSlide}
            sx={{
              px: 1, py: 0.5, borderRadius: "6px", border: `1.5px dashed ${colors.border}`,
              bgcolor: colors.background, cursor: "pointer", display: "flex", alignItems: "center", gap: 0.25,
              fontSize: "0.8125rem", color: colors.textSecondary, "&:hover": { borderColor: colors.primary },
            }}
          >
            <AddIcon sx={{ fontSize: 14 }} /> Add
          </Box>
        )}
      </Stack>

      <Stack spacing={2}>
        <AppInput
          label={`Slide ${active + 1} headline`}
          value={slide.headline}
          onChange={(e) => update(active, { headline: e.target.value })}
          placeholder="Bold, punchy headline"
        />
        <AppTextarea
          label="Body copy"
          minRows={3}
          value={slide.body}
          onChange={(e) => update(active, { body: e.target.value })}
          placeholder="Supporting description for this slide"
        />
      </Stack>

      <Typography variant="caption" sx={{ color: colors.textMuted, mt: 1, display: "block" }}>
        {slides.length} slides · LinkedIn document or Instagram carousel
      </Typography>
    </Box>
  );
}

// ─── Thread Editor ────────────────────────────────────────────────────────────

function ThreadEditor({
  thread,
  onChange,
}: {
  thread: ThreadTweet[];
  onChange: (thread: ThreadTweet[]) => void;
}) {
  const LIMIT = 280;

  const update = (i: number, text: string) => {
    const next = thread.map((t, idx) =>
      idx === i ? { ...t, text, characterCount: text.length } : t,
    );
    onChange(next);
  };

  const addTweet = () => {
    onChange([...thread, { id: crypto.randomUUID(), text: "", characterCount: 0 }]);
  };

  const removeTweet = (i: number) => {
    if (thread.length <= 1) return;
    onChange(thread.filter((_, idx) => idx !== i));
  };

  return (
    <Stack spacing={2}>
      {thread.map((tweet, i) => {
        const over = tweet.characterCount > LIMIT;
        return (
          <Box key={tweet.id}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textSecondary }}>
                Tweet {i + 1} {i === 0 ? "(hook)" : ""}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <Typography
                  variant="caption"
                  sx={{ color: over ? colors.error : tweet.characterCount > LIMIT * 0.85 ? colors.warning : colors.textMuted }}
                >
                  {tweet.characterCount} / {LIMIT}
                </Typography>
                {thread.length > 1 && (
                  <IconButton size="small" onClick={() => removeTweet(i)}>
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              </Stack>
            </Stack>
            <AppTextarea
              hideLabel
              minRows={2}
              maxRows={5}
              value={tweet.text}
              onChange={(e) => update(i, e.target.value)}
              error={over}
              placeholder={i === 0 ? "Start with a strong hook…" : "Continue the story…"}
            />
            {over && (
              <LinearProgress
                variant="determinate"
                value={100}
                sx={{ mt: 0.5, height: 2, bgcolor: colors.errorLight, "& .MuiLinearProgress-bar": { bgcolor: colors.error } }}
              />
            )}
            {i < thread.length - 1 && (
              <Box sx={{ ml: 1.5, mt: 0.5, pl: 1.5, borderLeft: `2px solid ${colors.border}`, pb: 0.5 }} />
            )}
          </Box>
        );
      })}

      <AppButton
        variant="ghost"
        size="small"
        leftIcon={<AddIcon sx={{ fontSize: 16 }} />}
        onClick={addTweet}
        sx={{ alignSelf: "flex-start" }}
      >
        Add tweet
      </AppButton>

      <Typography variant="caption" sx={{ color: colors.textMuted }}>
        {thread.length} tweets in thread
      </Typography>
    </Stack>
  );
}

// ─── Poll Editor ──────────────────────────────────────────────────────────────

function PollEditor({
  question,
  options,
  onQuestionChange,
  onOptionsChange,
}: {
  question: string;
  options: PollOption[];
  onQuestionChange: (q: string) => void;
  onOptionsChange: (opts: PollOption[]) => void;
}) {
  const updateOption = (id: string, text: string) => {
    onOptionsChange(options.map((o) => (o.id === id ? { ...o, text } : o)));
  };

  const addOption = () => {
    if (options.length >= 4) return;
    onOptionsChange([...options, { id: crypto.randomUUID(), text: "" }]);
  };

  const removeOption = (id: string) => {
    if (options.length <= 2) return;
    onOptionsChange(options.filter((o) => o.id !== id));
  };

  return (
    <Stack spacing={2}>
      <AppInput
        label="Poll question"
        value={question}
        onChange={(e) => onQuestionChange(e.target.value)}
        placeholder="What's your biggest challenge in 2025?"
      />
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          Options ({options.length}/4)
        </Typography>
        <Stack spacing={1}>
          {options.map((opt, i) => (
            <Stack key={opt.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <AppInput
                hideLabel
                value={opt.text}
                onChange={(e) => updateOption(opt.id, e.target.value)}
                placeholder={`Option ${i + 1}`}
                sx={{ flex: 1 }}
              />
              {options.length > 2 && (
                <IconButton size="small" onClick={() => removeOption(opt.id)}>
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              )}
            </Stack>
          ))}
        </Stack>
        {options.length < 4 && (
          <AppButton
            variant="ghost"
            size="small"
            leftIcon={<AddIcon sx={{ fontSize: 16 }} />}
            onClick={addOption}
            sx={{ mt: 1 }}
          >
            Add option
          </AppButton>
        )}
      </Box>
      <Typography variant="caption" sx={{ color: colors.textMuted }}>
        Polls are available on LinkedIn and X (Twitter).
      </Typography>
    </Stack>
  );
}

// ─── Single post editor ───────────────────────────────────────────────────────

function SingleEditor({
  activePlatform,
  current,
  onUpdate,
}: {
  activePlatform: SocialPlatform;
  current: GeneratedPlatformContent;
  onUpdate: (patch: Partial<GeneratedPlatformContent>) => void;
}) {
  const limit = PLATFORM_CHAR_LIMITS[activePlatform];
  const overLimit = current.caption.length > limit;
  const pct = Math.min(100, (current.caption.length / limit) * 100);

  const copyCaption = async () => {
    const tags = current.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
    await navigator.clipboard.writeText([current.caption, tags].filter(Boolean).join("\n\n"));
  };

  return (
    <Stack spacing={2}>
      {/* Caption */}
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Caption</Typography>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Typography variant="caption" sx={{ color: overLimit ? colors.error : colors.textMuted }}>
              {current.caption.length} / {limit}
            </Typography>
            <Tooltip title="Copy caption + hashtags">
              <IconButton size="small" onClick={() => void copyCaption()}>
                <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
        <AppTextarea
          hideLabel
          minRows={6}
          value={current.caption}
          onChange={(e) => onUpdate({ caption: e.target.value })}
          placeholder={`Write your ${PLATFORM_LABELS[activePlatform]} post…`}
          error={overLimit}
        />
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            mt: 0.5,
            height: 2,
            borderRadius: 1,
            bgcolor: colors.border,
            "& .MuiLinearProgress-bar": {
              bgcolor: overLimit ? colors.error : pct > 85 ? colors.warning : colors.primary,
            },
          }}
        />
      </Box>

      {/* Hashtags */}
      <Box>
        <AppInput
          label="Hashtags"
          value={current.hashtags.join(" ")}
          onChange={(e) =>
            onUpdate({
              hashtags: e.target.value.split(/[\s,]+/).map((t) => t.replace(/^#/, "")).filter(Boolean),
            })
          }
          placeholder="growth saas marketing"
          helperText="Space-separated, without #"
        />
        {current.hashtags.length > 0 && (
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mt: 0.75 }}>
            {current.hashtags.map((tag) => (
              <Chip
                key={tag}
                size="small"
                label={`#${tag}`}
                onDelete={() =>
                  onUpdate({ hashtags: current.hashtags.filter((h) => h !== tag) })
                }
                sx={{ fontSize: "0.75rem" }}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* First comment */}
      <AppTextarea
        label="First comment"
        minRows={2}
        value={current.firstComment}
        onChange={(e) => onUpdate({ firstComment: e.target.value })}
        placeholder="Optional — e.g. link, thread continuation, or CTA"
      />
    </Stack>
  );
}

// ─── Main PostEditor ──────────────────────────────────────────────────────────

export default function PostEditor({
  format,
  platforms,
  activePlatform,
  onActivePlatformChange,
  drafts,
  onChange,
  imageUrl,
  videoUrl,
  brandName,
  previewAccount,
  generateError,
  onRetryGenerate,
  empty,
  slides = [],
  onSlidesChange,
  thread = [],
  onThreadChange,
  pollOptions = [],
  onPollOptionsChange,
  pollQuestion = "",
  onPollQuestionChange,
}: PostEditorProps) {
  const current: GeneratedPlatformContent = drafts[activePlatform] ?? {
    caption: "",
    hashtags: [],
    firstComment: "",
    characterCount: 0,
  };

  const update = (patch: Partial<GeneratedPlatformContent>) => {
    const next = { ...current, ...patch, characterCount: (patch.caption ?? current.caption).length };
    onChange(activePlatform, next);
  };

  if (empty && platforms.length === 0) {
    return (
      <Box sx={{ ...surfaceSx, p: 6, textAlign: "center", minHeight: 320 }}>
        <Typography color="text.secondary">Select platforms and generate content.</Typography>
      </Box>
    );
  }

  const isCarousel = format === "carousel";
  const isThread = format === "thread";
  const isPoll = format === "poll";
  const isReel = format === "reel";
  const isStory = format === "story";
  const isSingle = !isCarousel && !isThread && !isPoll;

  return (
    <Box sx={{ ...surfaceSx, overflow: "hidden", minHeight: 500 }}>
      {/* Platform tabs */}
      {!isThread && (
        <Box sx={{ borderBottom: `1px solid ${colors.border}`, px: 2, pt: 1 }}>
          <Tabs
            value={activePlatform}
            onChange={(_, v: SocialPlatform) => onActivePlatformChange(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 40 }}
          >
            {platforms.map((p) => (
              <Tab key={p} value={p} label={PLATFORM_LABELS[p]} sx={{ minHeight: 40, fontSize: "0.8125rem" }} />
            ))}
          </Tabs>
        </Box>
      )}

      <Box sx={{ p: 2.5 }}>
        {generateError && (
          <Alert severity="error" sx={{ mb: 2 }}
            action={onRetryGenerate ? (
              <AppButton variant="ghost" size="small" onClick={onRetryGenerate}>Retry</AppButton>
            ) : undefined}
          >
            {generateError}
          </Alert>
        )}

        {isReel && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>Reel</strong> — Upload a short vertical video (9:16) in the Media panel on the left. Add your caption and hashtags below.
          </Alert>
        )}

        {isStory && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>Story</strong> — Upload a vertical 9:16 image or video in the Media panel. Stories don&apos;t show captions to viewers but are used internally.
          </Alert>
        )}

        {/* Format-specific editors */}
        {isCarousel && (
          <CarouselEditor
            slides={slides.length > 0 ? slides : [
              { id: "s1", headline: "", body: "", imageUrl: null },
              { id: "s2", headline: "", body: "", imageUrl: null },
            ]}
            onChange={onSlidesChange ?? (() => {})}
          />
        )}

        {isThread && (
          <ThreadEditor
            thread={thread.length > 0 ? thread : [
              { id: "t1", text: current.caption, characterCount: current.caption.length },
            ]}
            onChange={onThreadChange ?? (() => {})}
          />
        )}

        {isPoll && (
          <PollEditor
            question={pollQuestion}
            options={pollOptions.length > 0 ? pollOptions : [
              { id: "p1", text: "" },
              { id: "p2", text: "" },
            ]}
            onQuestionChange={onPollQuestionChange ?? (() => {})}
            onOptionsChange={onPollOptionsChange ?? (() => {})}
          />
        )}

        {isSingle && (
          <SingleEditor
            activePlatform={activePlatform}
            current={current}
            onUpdate={update}
          />
        )}

        {activePlatform === "x" && imageUrl && isSingle && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            X free tier is text-only. The image won&apos;t publish to X.
          </Alert>
        )}
      </Box>
    </Box>
  );
}
