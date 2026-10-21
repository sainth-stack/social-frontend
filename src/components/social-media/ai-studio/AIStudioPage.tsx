"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  Copy,
  Download,
  FileText,
  Film,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  ListOrdered,
  Lock,
  Megaphone,
  MessageSquare,
  Palette,
  Pencil,
  Play,
  Quote,
  RectangleHorizontal,
  RefreshCcw,
  Rocket,
  RotateCcw,
  Save,
  Gem,
  Mic2,
  Search,
  Smartphone,
  Sparkles,
  Square,
  Tag,
  Trash2,
  Upload,
  X as XIcon,
} from "lucide-react";
import { toast } from "sonner";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { ProductAIStudioIcon, ProductGenerateIcon } from "@/components/icons/product-icons";
import { PageHeader } from "@/components/layouts/PageHeader";
import { PlatformIcon } from "@/components/platform-icon";
import PhoneFrame from "@/components/social-media/content-studio/PhoneFrame";
import PlatformPreview from "@/components/social-media/content-studio/PlatformPreview";
import { ContentPlannerSection } from "@/components/social-media/planner/ContentPlannerSection";
import ScheduleModal from "@/components/social-media/posts/ScheduleModal";
import {
  templateApplyStorageKey,
} from "@/components/social-media/content-studio/TemplateUseModal";
import {
  buildPersistMediaPayload,
  isVideoMediaUrl,
  resolveDraftMedia,
} from "@/components/social-media/content-studio/shared/studioMediaHelpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { selectUser } from "@/features/auth/authSlice";
import { selectSocialAccounts } from "@/features/social-media/socialAccountsSelectors";
import { fetchSocialAccounts } from "@/features/social-media/socialAccountsThunks";
import { selectPublishing } from "@/features/social-media/socialPostsSelectors";
import {
  createSocialPost,
  fetchSocialPost,
  publishSocialPostNow,
  scheduleSocialPost,
  updateSocialPost,
} from "@/features/social-media/socialPostsThunks";
import { canUseMultiVariations, contentPlanDayCap, planDisplayName } from "@/lib/plans";
import { formatPostBody, sanitizeCaptionAndHashtags } from "@/lib/socialCaption";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type {
  ApplyTemplateResult,
  BrandVoicePayload,
  CalendarPost,
  CreativeFormat,
  EmojiUsage,
  GenerateImageResult,
  GeneratedContent,
  GeneratedSlide,
  GeneratedTweet,
  LogoPosition,
  MediaAsset,
  MediaAssetType,
  SentenceLength,
  SocialAccount,
  SocialImageSource,
  SocialPlatform,
  SocialPost,
} from "@/types/social-media.types";
import { PLATFORM_CHAR_LIMITS, PLATFORM_LABELS } from "@/types/social-media.types";

export type AIStudioTab = "generate" | "planner" | "brand" | "media";

const PLATFORMS: SocialPlatform[] = ["instagram", "facebook", "linkedin", "x"];
const CONTENT_TYPES = [
  "Caption",
  "Carousel",
  "Thread",
  "Promotional",
  "Educational",
  "Announcement",
];
const TONES = ["Professional", "Friendly", "Luxury", "Casual", "Funny"];
const LENGTHS = ["Short", "Medium", "Long"];

const CONTENT_TYPE_TO_FORMAT: Record<string, string> = {
  Caption: "single",
  Carousel: "carousel",
  Thread: "thread",
  Promotional: "single",
  Educational: "single",
  Announcement: "single",
};

const CONTENT_TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string }>; hint: string }> = {
  Caption: { icon: MessageSquare, hint: "Single post" },
  Carousel: { icon: Layers, hint: "Multi-slide" },
  Thread: { icon: ListOrdered, hint: "X thread" },
  Promotional: { icon: Tag, hint: "Offer & sale" },
  Educational: { icon: GraduationCap, hint: "Tips & how-to" },
  Announcement: { icon: Megaphone, hint: "News & launch" },
};

type VisualFormat = "auto" | Exclude<CreativeFormat, "carousel" | "product">;

const VISUAL_FORMATS: { value: VisualFormat; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "auto", label: "Auto", icon: Sparkles },
  { value: "post", label: "Post", icon: Square },
  { value: "banner", label: "Banner", icon: RectangleHorizontal },
  { value: "story", label: "Story", icon: Smartphone },
  { value: "quote", label: "Quote", icon: Quote },
];

const LOGO_POSITIONS: { value: LogoPosition; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

const QUICK_STARTS = [
  "Announce our new product launching this week",
  "Share 3 practical tips for our audience",
  "Promote a limited-time 20% discount",
  "Celebrate a customer success story",
];

const MAX_CAROUSEL_VISUALS = 8;

type BrandKit = {
  brandName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
};

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1 rounded-lg border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition",
            value === o ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function ComposerSection({
  step,
  title,
  aside,
  children,
}: {
  step: number;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
            {step}
          </span>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

type PrefillMedia = { name: string; url: string; mediaType: MediaAssetType } | null;

type Variation = {
  label: string;
  caption: string;
  hashtags: string[];
  platform: SocialPlatform;
  match: number;
  recommended?: boolean;
};

function pickPreviewAccount(accounts: SocialAccount[], platform: SocialPlatform) {
  const active = accounts.filter((a) => a.platform === platform && a.isActive);
  return active.find((a) => a.isDefault) ?? active[0] ?? null;
}

function StudioEmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function ProBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary",
        className,
      )}
    >
      <Gem className="h-2.5 w-2.5" /> Pro
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function brandMatchScore(caption: string, index: number): number {
  const base = 88 - index * 9;
  const bonus = Math.min(8, Math.floor(caption.length / 80));
  return Math.max(62, Math.min(97, base + bonus));
}

function extractPlanError(err: unknown, fallback: string): string {
  const resp = (err as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  const detail = resp?.data?.detail;
  if (resp?.status === 402 && detail && typeof detail === "object") {
    const d = detail as { message?: string; code?: string };
    return d.message || "Plan limit reached — upgrade your plan or wait until next month.";
  }
  return extractErrorMessage(err, fallback);
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (first && typeof first.msg === "string") return first.msg.replace(/^Value error, /, "");
  }
  if (detail && typeof detail === "object" && typeof (detail as { message?: unknown }).message === "string") {
    return (detail as { message: string }).message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Prompt / content-type suggests an accompanying image should be generated. */
function promptSuggestsImage(prompt: string, contentType: string): boolean {
  if (["Carousel", "Promotional", "Announcement"].includes(contentType)) return true;
  const t = prompt.toLowerCase();
  return /\b(image|photo|picture|visual|graphic|illustration|thumbnail|banner|flyer|poster|artwork|render)\b/.test(
    t,
  );
}

function flattenThreadCaption(tweets: GeneratedTweet[]): string {
  return tweets
    .map((t, i) => `${i + 1}/${tweets.length} ${t.text}`)
    .join("\n\n");
}

function flattenCarouselCaption(slides: GeneratedSlide[], intro?: string): string {
  const slideText = slides
    .map((s, i) => `Slide ${i + 1}: ${s.headline}\n${s.body}`)
    .join("\n\n");
  return [intro?.trim(), slideText].filter(Boolean).join("\n\n---\n\n");
}

function flattenPollCaption(
  question: string,
  options: string[],
  intro?: string,
): string {
  const pollBlock = [
    question,
    ...options.map((o, i) => `${i + 1}. ${o}`),
  ].join("\n");
  return [pollBlock, intro?.trim()].filter(Boolean).join("\n\n");
}

function withCleanCaption(
  caption: string,
  hashtags: string[],
  rest: Omit<Variation, "caption" | "hashtags">,
): Variation {
  const clean = sanitizeCaptionAndHashtags(caption, hashtags);
  return { ...rest, caption: clean.caption, hashtags: clean.hashtags };
}

function parseGeneratedContent(
  data: GeneratedContent,
  formatKey: string,
  selectedPlatforms: SocialPlatform[],
  startIndex: number,
): Variation[] {
  const results: Variation[] = [];

  if (formatKey === "thread" && data.tweets?.length) {
    const caption = flattenThreadCaption(data.tweets);
    const tags = data.hashtags ?? [];
    results.push(
      withCleanCaption(caption, tags, {
        label: "Thread",
        platform: "x",
        match: brandMatchScore(caption, startIndex),
        recommended: startIndex === 0,
      }),
    );
    return results;
  }

  if (formatKey === "carousel" && (data.slides?.length || data.caption)) {
    const caption = flattenCarouselCaption(data.slides ?? [], data.caption);
    const tags = data.hashtags ?? [];
    for (const p of selectedPlatforms) {
      results.push(
        withCleanCaption(caption, tags, {
          label: PLATFORM_LABELS[p],
          platform: p,
          match: brandMatchScore(caption, startIndex + results.length),
          recommended: results.length === 0,
        }),
      );
    }
    return results;
  }

  if (formatKey === "poll" && data.pollQuestion) {
    const caption = flattenPollCaption(
      data.pollQuestion,
      data.pollOptions ?? [],
      data.caption,
    );
    const tags = data.hashtags ?? [];
    for (const p of selectedPlatforms) {
      results.push(
        withCleanCaption(caption, tags, {
          label: PLATFORM_LABELS[p],
          platform: p,
          match: brandMatchScore(caption, startIndex + results.length),
          recommended: results.length === 0,
        }),
      );
    }
    return results;
  }

  for (const p of selectedPlatforms) {
    const pc = data.platforms[p];
    const caption =
      pc?.caption ?? (selectedPlatforms.length === 1 ? data.caption : "") ?? "";
    if (!caption) continue;
    const tags = pc?.hashtags ?? data.hashtags ?? [];
    results.push(
      withCleanCaption(caption, tags, {
        label: PLATFORM_LABELS[p],
        platform: p,
        match: brandMatchScore(caption, startIndex + results.length),
        recommended: results.length === 0,
      }),
    );
  }

  return results;
}

/* --------------- Generate Tab --------------- */

function GenerateTab({
  orgId,
  prefillMedia,
  onClearMedia,
  onSetPrefillMedia,
  draftId,
  templateId,
  assetId,
  scheduleAtParam,
  onOpenBrand,
  brandVersion,
}: {
  orgId: string;
  prefillMedia: PrefillMedia;
  onClearMedia: () => void;
  onSetPrefillMedia: (media: NonNullable<PrefillMedia>) => void;
  draftId: string | null;
  templateId: string | null;
  assetId: string | null;
  scheduleAtParam: string | null;
  onOpenBrand: () => void;
  brandVersion: number;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const accounts = useAppSelector(selectSocialAccounts);
  const publishing = useAppSelector(selectPublishing);
  // Multi A/B/C versions: Pro + Growth. Free stays at 1.
  // Multi-platform generation is available on every plan.
  const canMultiVariation = canUseMultiVariations(user?.plan);

  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([
    "linkedin",
    "facebook",
  ]);
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>("linkedin");
  const [type, setType] = useState("Caption");
  const [tone, setTone] = useState("Friendly");
  const [length, setLength] = useState("Medium");
  const [prompt, setPrompt] = useState("");
  const [cta, setCta] = useState("");
  const [variationsWanted, setVariationsWanted] = useState<1 | 2 | 3>(1);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [alsoGenerateImage, setAlsoGenerateImage] = useState(false);
  const [visualFormat, setVisualFormat] = useState<VisualFormat>("auto");
  const [headlineOnImage, setHeadlineOnImage] = useState(true);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [logoPosition, setLogoPosition] = useState<LogoPosition>("top-right");
  const [imageMeta, setImageMeta] = useState<GenerateImageResult | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [slides, setSlides] = useState<GeneratedSlide[] | null>(null);
  const [slideImages, setSlideImages] = useState<(string | null)[]>([]);
  const [slidesLoading, setSlidesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [variations, setVariations] = useState<Variation[] | null>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [mediaSource, setMediaSource] = useState<SocialImageSource>("none");
  const [error, setError] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(draftId);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(templateId);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(Boolean(scheduleAtParam));
  const templateBootstrappedRef = useRef(false);
  const assetBootstrappedRef = useRef(false);
  const draftLoadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (scheduleAtParam) setScheduleOpen(true);
  }, [scheduleAtParam]);

  useEffect(() => {
    setEditingPostId(draftId);
  }, [draftId]);

  // Template bootstrap from sessionStorage
  useEffect(() => {
    if (!orgId || !templateId || draftId || templateBootstrappedRef.current) return;
    templateBootstrappedRef.current = true;
    const stored = sessionStorage.getItem(templateApplyStorageKey(orgId, templateId));
    if (!stored) return;
    try {
      const applied = JSON.parse(stored) as ApplyTemplateResult;
      setActiveTemplateId(applied.templateId);
      setTemplateName(applied.name);
      setPrompt(applied.topic);
      setTone(applied.suggestedTone || "Professional");
      setCta(applied.suggestedCta || "");
      if (applied.platforms.length) {
        setSelectedPlatforms(applied.platforms);
        setActivePlatform(applied.platforms[0]);
      }
      if (applied.generateImage) setAlsoGenerateImage(true);
      toast.success(`Template "${applied.name}" loaded`);
    } catch {
      toast.error("Could not load template data");
    }
  }, [orgId, templateId, draftId]);

  // Draft resume
  useEffect(() => {
    if (!orgId || !draftId || draftLoadedRef.current === draftId) return;
    draftLoadedRef.current = draftId;
    void dispatch(fetchSocialPost({ orgId, postId: draftId }))
      .unwrap()
      .then((post) => {
        setEditingPostId(post.id);
        setPrompt(post.aiPrompt || post.title || "");
        const draftMedia = resolveDraftMedia(post.imageUrl);
        if (draftMedia.mediaType === "video" && draftMedia.videoUrl) {
          onSetPrefillMedia({
            name: post.title?.slice(0, 48) || "Draft video",
            url: draftMedia.videoUrl,
            mediaType: "video",
          });
          setGeneratedImageUrl(null);
        } else if (draftMedia.imageUrl) {
          setGeneratedImageUrl(draftMedia.imageUrl);
          onClearMedia();
        }
        setMediaSource(post.imageSource ?? "none");
        const pList = post.platforms.map((p) => p.platform);
        setSelectedPlatforms(pList.length ? pList : ["linkedin"]);
        setActivePlatform(pList[0] ?? "linkedin");
        const vars: Variation[] = post.platforms.map((pp, i) => ({
          label: PLATFORM_LABELS[pp.platform],
          caption: pp.caption,
          hashtags: pp.hashtags ?? [],
          platform: pp.platform,
          match: brandMatchScore(pp.caption, i),
          recommended: i === 0,
        }));
        setVariations(vars.length ? vars : null);
        setPicked(0);
        if (post.templateId) setActiveTemplateId(post.templateId);
      })
      .catch(() => toast.error("Could not load draft"));
  }, [dispatch, orgId, draftId, onSetPrefillMedia, onClearMedia]);

  // Media library asset bootstrap
  useEffect(() => {
    if (!orgId || !assetId || draftId || assetBootstrappedRef.current) return;
    assetBootstrappedRef.current = true;
    void socialMediaApi
      .getMediaAsset(orgId, assetId)
      .then((asset) => {
        onSetPrefillMedia({
          name: asset.prompt?.slice(0, 48) || asset.id.slice(0, 8),
          url: asset.url,
          mediaType: asset.mediaType,
        });
        setMediaSource(asset.source === "uploaded" ? "uploaded" : "ai_generated");
        toast.success("Media attached from library");
      })
      .catch(() => toast.error("Could not load media asset"));
  }, [orgId, assetId, draftId, onSetPrefillMedia]);

  useEffect(() => {
    if (!orgId || accounts.length > 0) return;
    void dispatch(fetchSocialAccounts({ orgId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, orgId]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void socialMediaApi
      .getBrandVoice(orgId)
      .then((bv) => {
        if (cancelled) return;
        setBrandKit({
          brandName: bv.brandName,
          logoUrl: bv.logoUrl ?? null,
          primaryColor: bv.primaryColor ?? null,
          accentColor: bv.accentColor ?? null,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [orgId, brandVersion]);

  // Keep preview tab on a selected platform.
  useEffect(() => {
    if (!selectedPlatforms.includes(activePlatform)) {
      setActivePlatform(selectedPlatforms[0] ?? "linkedin");
    }
  }, [selectedPlatforms, activePlatform]);

  // Auto-enable image generation when the prompt/type implies a visual is needed.
  useEffect(() => {
    if (prefillMedia?.mediaType === "image") {
      setAlsoGenerateImage(false);
      return;
    }
    if (promptSuggestsImage(prompt, type)) {
      setAlsoGenerateImage(true);
    }
  }, [prompt, type, prefillMedia]);

  const multiPlatform = selectedPlatforms.length > 1;
  // A/B versions only when a single platform is selected on Enterprise.
  const effectiveVariations =
    canMultiVariation && !multiPlatform ? variationsWanted : 1;

  const previewPlatform = selectedPlatforms.includes(activePlatform)
    ? activePlatform
    : (selectedPlatforms[0] ?? "linkedin");

  /** Indexes into `variations` for the active platform (for A/B/C switching). */
  const platformVariationIndexes = useMemo(() => {
    if (!variations) return [] as number[];
    return variations
      .map((v, i) => (v.platform === previewPlatform ? i : -1))
      .filter((i) => i >= 0);
  }, [variations, previewPlatform]);

  const activeIdx =
    picked != null && variations?.[picked]?.platform === previewPlatform
      ? picked
      : (platformVariationIndexes[0] ?? -1);

  const activeVariation =
    activeIdx >= 0 && variations ? variations[activeIdx] : null;

  const previewCaption = activeVariation?.caption ?? "";
  const previewHashtags = includeHashtags ? (activeVariation?.hashtags ?? []) : [];
  const previewImageUrl =
    generatedImageUrl ??
    (prefillMedia?.mediaType === "image" ? prefillMedia.url : null) ??
    null;
  const previewVideoUrl =
    prefillMedia?.mediaType === "video" ? prefillMedia.url : null;

  const previewAccount = useMemo(() => {
    const acc = pickPreviewAccount(accounts, previewPlatform);
    return acc
      ? { accountName: acc.accountName, accountPictureUrl: acc.accountPictureUrl }
      : null;
  }, [accounts, previewPlatform]);

  const selectPlatformTab = (p: SocialPlatform) => {
    setActivePlatform(p);
    if (!variations) return;
    const first = variations.findIndex((v) => v.platform === p);
    if (first >= 0) setPicked(first);
  };

  const selectVariationTab = (globalIdx: number) => {
    setPicked(globalIdx);
  };

  const updateActiveCaption = (text: string) => {
    if (activeIdx < 0) return;
    setVariations((prev) =>
      prev
        ? prev.map((x, idx) => (idx === activeIdx ? { ...x, caption: text } : x))
        : prev,
    );
  };

  const togglePlatform = (p: SocialPlatform) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(p)) {
        if (prev.length === 1) {
          toast.error("Select at least one platform");
          return prev;
        }
        return prev.filter((x) => x !== p);
      }
      return [...prev, p];
    });
  };

  const buildTopic = (variationIndex = 0) => {
    const base = prompt.trim();
    if (variationIndex <= 0) return base;
    return `${base}\n\nVariation ${variationIndex + 1}: same core message, different hook and structure.`;
  };

  const generationMeta = () => ({
    contentType: type,
    length,
    includeEmojis,
    mediaNote: prefillMedia ? prefillMedia.name : undefined,
  });

  const buildImageTopic = (withFormat: boolean) => {
    const suffix = [
      tone ? `Mood: ${tone}.` : "",
      withFormat && type !== "Caption" ? `Post type: ${type}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const room = Math.max(5, 500 - suffix.length - 1);
    return `${prompt.trim().slice(0, room)} ${suffix}`.trim().slice(0, 500);
  };

  const resolvedVisualFormat: CreativeFormat =
    visualFormat !== "auto"
      ? visualFormat
      : type === "Promotional"
        ? "product"
        : "post";

  const runImageGeneration = async (
    withFormat: boolean,
    successMessage: string,
    failMessage: string,
    captionContext?: string,
  ) => {
    setImageLoading(true);
    try {
      const img = await socialMediaApi.generateImage(orgId, {
        topic: buildImageTopic(withFormat),
        mode: "create",
        format: resolvedVisualFormat,
        platform: previewPlatform,
        caption: (captionContext ?? activeVariation?.caption ?? "").slice(0, 3000) || undefined,
        cta: cta.trim().slice(0, 40) || undefined,
        textOverlay: headlineOnImage,
        includeLogo,
        logoPosition,
      });
      setGeneratedImageUrl(img.imageUrl);
      setImageMeta(img);
      setMediaSource("ai_generated");
      toast.success(successMessage);
    } catch (err) {
      toast.error(extractPlanError(err, failMessage));
    } finally {
      setImageLoading(false);
    }
  };

  const generateSlideVisuals = async (list: GeneratedSlide[], captionContext: string) => {
    const count = Math.min(list.length, MAX_CAROUSEL_VISUALS);
    if (count === 0) return;
    const results: (string | null)[] = Array(count).fill(null);
    setSlideImages([...results]);
    setSlidesLoading(true);
    let next = 0;
    let failed = 0;
    const worker = async () => {
      while (next < count) {
        const i = next++;
        const slide = list[i];
        const topic = (slide.imagePrompt || `${slide.headline}. ${prompt.trim()}`).trim().slice(0, 500);
        try {
          const img = await socialMediaApi.generateImage(orgId, {
            topic: topic.length >= 3 ? topic : prompt.trim().slice(0, 500),
            mode: "create",
            format: "carousel",
            platform: previewPlatform,
            headline: slide.headline.slice(0, 160),
            subtext: slide.body.slice(0, 220),
            cta: i === count - 1 ? cta.trim().slice(0, 40) || undefined : undefined,
            caption: captionContext.slice(0, 3000) || undefined,
            textOverlay: headlineOnImage,
            autoCopy: false,
            includeLogo,
            logoPosition,
            slideIndex: i + 1,
            slideCount: count,
          });
          results[i] = img.imageUrl;
          setSlideImages([...results]);
          if (i === 0) {
            setGeneratedImageUrl(img.imageUrl);
            setImageMeta(img);
            setMediaSource("ai_generated");
          }
        } catch (err) {
          failed += 1;
          if (failed === 1) toast.error(extractPlanError(err, `Slide ${i + 1} visual failed`));
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setSlidesLoading(false);
    const done = results.filter(Boolean).length;
    if (done > 0) {
      toast.success(`${done} of ${count} slide visuals ready — all saved to your media library`);
    }
  };

  const selectSlideImage = (url: string | null) => {
    if (!url) return;
    setGeneratedImageUrl(url);
    setMediaSource("ai_generated");
  };

  const removeGeneratedImage = () => {
    setGeneratedImageUrl(null);
    setImageMeta(null);
    setMediaSource("none");
  };

  const generate = async () => {
    if (!orgId) {
      toast.error("Workspace not ready");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Add a prompt to generate content");
      return;
    }
    if (prompt.trim().length < 5) {
      toast.error("Prompt must be at least 5 characters");
      return;
    }
    if (type === "Thread") {
      setSelectedPlatforms(["x"]);
    } else if (selectedPlatforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }
    const platformsForGen =
      type === "Thread" ? (["x"] as SocialPlatform[]) : selectedPlatforms;
    if (platformsForGen.length === 0) {
      toast.error("Select at least one platform");
      return;
    }
    setLoading(true);
    setError(null);
    setVariations(null);
    setPicked(null);
    setSlides(null);
    setSlideImages([]);
    const shouldImage = alsoGenerateImage && !prefillMedia;
    if (shouldImage) {
      setGeneratedImageUrl(null);
      setImageMeta(null);
    }
    let captionForImage = "";
    let generatedSlides: GeneratedSlide[] = [];
    let captionsOk = false;
    try {
      const results: Variation[] = [];
      const allHashtags: string[] = [];
      const formatKey = CONTENT_TYPE_TO_FORMAT[type] ?? "single";

      const responses = await Promise.all(
        Array.from({ length: effectiveVariations }, (_, i) =>
          socialMediaApi.generatePost(orgId, {
            topic: buildTopic(i),
            tone,
            platforms: platformsForGen,
            cta: cta.trim() || undefined,
            includeHashtags,
            includeComment: false,
            format: formatKey,
            ...generationMeta(),
          }),
        ),
      );

      responses.forEach((data: GeneratedContent, i) => {
        const parsed = parseGeneratedContent(data, formatKey, platformsForGen, results.length);
        if (effectiveVariations > 1 && parsed.length === 1 && formatKey === "single") {
          parsed[0] = {
            ...parsed[0],
            label: `Version ${String.fromCharCode(65 + i)}`,
          };
        }
        for (const v of parsed) {
          results.push(v);
          allHashtags.push(...v.hashtags);
        }
      });

      if (results.length === 0) throw new Error("No caption returned");

      setVariations(results);
      setHashtags([...new Set(allHashtags)]);
      const recIdx = results.findIndex((v) => v.recommended);
      setPicked(recIdx >= 0 ? recIdx : 0);
      captionForImage = results[recIdx >= 0 ? recIdx : 0]?.caption ?? "";
      generatedSlides = formatKey === "carousel" ? (responses[0]?.slides ?? []) : [];
      if (generatedSlides.length) setSlides(generatedSlides);
      captionsOk = true;
      toast.success(
        formatKey === "thread"
          ? `Thread generated (${results[0]?.caption.split("\n\n").length ?? 0} tweets)`
          : multiPlatform
            ? `Generated for ${results.length} platforms`
            : results.length > 1
              ? `${results.length} versions generated`
              : "Content generated",
      );
    } catch (err) {
      const message = extractErrorMessage(err, "Generation failed");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
    if (!shouldImage || !captionsOk) return;
    if (generatedSlides.length) {
      await generateSlideVisuals(generatedSlides, captionForImage);
    } else {
      await runImageGeneration(
        true,
        "Visual generated and attached",
        "Caption ready, but the visual could not be generated",
        captionForImage,
      );
    }
  };

  const generateImage = async () => {
    if (!orgId || prompt.trim().length < 5) {
      toast.error("Add a prompt (at least 5 characters) first");
      return;
    }
    await runImageGeneration(false, "Image generated", "Image generation failed");
  };

  const buildPlatformPayload = (variation?: Variation) => {
    if (variation) {
      return [
        {
          platform: variation.platform,
          caption: variation.caption,
          hashtags: includeHashtags
            ? [...new Set([...(variation.hashtags ?? []), ...hashtags])]
            : [],
        },
      ];
    }
    return (variations ?? []).map((v) => ({
      platform: v.platform,
      caption: v.caption,
      hashtags: includeHashtags
        ? [...new Set([...(v.hashtags ?? []), ...hashtags])]
        : [],
    }));
  };

  const resolvePersistMedia = () => {
    const mediaType = prefillMedia?.mediaType === "video"
      ? "video"
      : generatedImageUrl || prefillMedia?.mediaType === "image"
        ? "image"
        : "none";
    const imageUrl =
      mediaType === "video"
        ? prefillMedia?.url ?? null
        : generatedImageUrl ?? (prefillMedia?.mediaType === "image" ? prefillMedia.url : null);
    const source: SocialImageSource =
      mediaType === "none"
        ? "none"
        : generatedImageUrl && !prefillMedia
          ? "ai_generated"
          : mediaSource !== "none"
            ? mediaSource
            : prefillMedia
              ? "uploaded"
              : "ai_generated";
    return buildPersistMediaPayload(
      mediaType === "video" ? "video" : mediaType === "image" ? "image" : "none",
      imageUrl,
      prefillMedia?.mediaType === "video" ? prefillMedia.url : null,
      source,
    );
  };

  const hasMediaAttached = Boolean(
    generatedImageUrl || prefillMedia?.url,
  );
  const hasContent = Boolean(variations?.length || hasMediaAttached);
  const hasVideoAttached =
    prefillMedia?.mediaType === "video" ||
    isVideoMediaUrl(generatedImageUrl) ||
    isVideoMediaUrl(prefillMedia?.url);
  const xWithImageConflict =
    selectedPlatforms.includes("x") &&
    Boolean(previewImageUrl) &&
    !hasVideoAttached;

  const persistDraft = async (quiet = false, variation?: Variation): Promise<SocialPost | null> => {
    let platformPayload = buildPlatformPayload(variation);
    const persistMedia = resolvePersistMedia();
    if (platformPayload.length === 0 && persistMedia.imageUrl) {
      platformPayload = selectedPlatforms.map((p) => ({
        platform: p,
        caption: "",
        hashtags: [],
      }));
    }
    const hasText = platformPayload.some((p) => p.caption.trim());
    if (!hasText && !persistMedia.imageUrl) {
      if (!quiet) toast.error("Generate copy or attach media first");
      return null;
    }
    const payload = {
      title: prompt.trim().slice(0, 80) || "AI draft",
      status: "draft" as const,
      aiPrompt: prompt.trim() || null,
      templateId: activeTemplateId,
      imageUrl: persistMedia.imageUrl,
      imageSource: persistMedia.imageSource,
      platforms: platformPayload,
    };
    try {
      const post = editingPostId
        ? await dispatch(
            updateSocialPost({ orgId, postId: editingPostId, payload }),
          ).unwrap()
        : await dispatch(createSocialPost({ orgId, payload })).unwrap();
      setEditingPostId(post.id);
      if (!quiet) {
        toast.success(
          platformPayload.length > 1
            ? `Saved draft for ${platformPayload.length} platforms`
            : "Draft saved",
        );
      }
      draftLoadedRef.current = post.id;
      if (draftId !== post.id) {
        router.replace(`/dashboard/content-studio/generate?draftId=${post.id}`);
      }
      return post;
    } catch (err) {
      if (!quiet) toast.error(extractErrorMessage(err, "Failed to save draft"));
      return null;
    }
  };

  const saveDraft = async (variation?: Variation) => {
    if (!orgId || (!variations?.length && !hasMediaAttached)) return;
    setSaving(true);
    try {
      await persistDraft(false, variation);
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async (scheduledAt: string) => {
    if (hasVideoAttached) {
      toast.error("Video publishing is not supported yet — save as draft only");
      return;
    }
    if (xWithImageConflict) {
      toast.error("Remove the image before publishing to X (text-only on free tier)");
      return;
    }
    setSaving(true);
    try {
      const post = await persistDraft(true);
      if (!post) return;
      await dispatch(scheduleSocialPost({ orgId, postId: post.id, scheduledAt })).unwrap();
      toast.success("Post scheduled");
      setScheduleOpen(false);
      router.push("/dashboard/posts/scheduled");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to schedule"));
    } finally {
      setSaving(false);
    }
  };

  const handlePublishNow = async () => {
    if (hasVideoAttached) {
      toast.error("Video publishing is not supported yet — save as draft only");
      return;
    }
    if (xWithImageConflict) {
      toast.error("Remove the image before publishing to X (text-only on free tier)");
      return;
    }
    setSaving(true);
    try {
      const post = await persistDraft(true);
      if (!post) return;
      await dispatch(publishSocialPostNow({ orgId, postId: post.id })).unwrap();
      toast.success("Publishing started");
      router.push(`/dashboard/posts/${post.id}`);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to publish"));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitApproval = async () => {
    setSaving(true);
    try {
      const post = await persistDraft(true);
      if (!post) return;
      await socialMediaApi.submitApproval(orgId, post.id);
      toast.success("Submitted for approval");
      router.push(`/dashboard/posts/${post.id}`);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Submit failed"));
    } finally {
      setSaving(false);
    }
  };

  const resetStudio = () => {
    setEditingPostId(null);
    setActiveTemplateId(null);
    setTemplateName(null);
    setPrompt("");
    setCta("");
    setVariations(null);
    setPicked(null);
    setGeneratedImageUrl(null);
    setImageMeta(null);
    setSlides(null);
    setSlideImages([]);
    setMediaSource("none");
    setError(null);
    templateBootstrappedRef.current = false;
    assetBootstrappedRef.current = false;
    draftLoadedRef.current = null;
    onClearMedia();
    router.push("/dashboard/content-studio/generate");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {editingPostId ? (
            <Badge variant="secondary" className="text-[10px]">
              Editing draft
            </Badge>
          ) : templateName ? (
            <p className="text-xs text-muted-foreground">
              Template: <span className="font-medium text-foreground">{templateName}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={resetStudio}>
            New
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasContent || saving}
            onClick={() => void saveDraft()}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save draft
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasContent || saving || publishing || hasVideoAttached}
            onClick={() => setScheduleOpen(true)}
          >
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            Schedule
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasContent || saving}
            onClick={() => void handleSubmitApproval()}
          >
            Submit for approval
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!hasContent || saving || publishing || hasVideoAttached}
            onClick={() => void handlePublishNow()}
          >
            <Rocket className="mr-1.5 h-3.5 w-3.5" />
            Publish now
          </Button>
        </div>
      </div>

      {hasVideoAttached && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-100">
          Video is attached. Publishing video to social platforms is not supported yet — you can save as a draft.
        </div>
      )}

      {xWithImageConflict && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          X (free tier) is text-only. Remove the image or deselect X before scheduling or publishing.
        </div>
      )}

      <ScheduleModal
        open={scheduleOpen}
        loading={saving}
        initialValue={scheduleAtParam ?? undefined}
        onClose={() => setScheduleOpen(false)}
        onConfirm={(iso) => void handleSchedule(iso)}
      />

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card className="shadow-soft lg:col-span-2 lg:self-start">
        <CardHeader className="space-y-1 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-base">Create with AI</CardTitle>
              <p className="text-xs text-muted-foreground">On-brand copy and visuals in one pass.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          {prefillMedia && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-accent/40 px-3 py-2 text-xs">
              <span className="flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium truncate max-w-[180px]">{prefillMedia.name}</span>
                <span className="text-muted-foreground">attached</span>
              </span>
              <button
                type="button"
                onClick={onClearMedia}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove attached media"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <ComposerSection step={1} title="Format">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CONTENT_TYPES.map((t) => {
                const meta = CONTENT_TYPE_META[t];
                const Icon = meta.icon;
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setType(t)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition",
                      active
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/40 hover:bg-muted/50",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-xs font-semibold">{t}</span>
                    <span className="text-[10px] text-muted-foreground">{meta.hint}</span>
                  </button>
                );
              })}
            </div>
          </ComposerSection>

          <ComposerSection
            step={2}
            title="Brief"
            aside={<span className="text-[10px] text-muted-foreground">{prompt.length}/2000</span>}
          >
            <Textarea
              aria-label="Brief"
              placeholder="What should this post say? Include the offer, audience, key facts and any must-have details…"
              rows={5}
              maxLength={2000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            {!prompt.trim() && (
              <div className="flex flex-wrap gap-1.5">
                {QUICK_STARTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setPrompt(q)}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </ComposerSection>

          <ComposerSection
            step={3}
            title="Channels"
            aside={<span className="text-[10px] text-muted-foreground">{selectedPlatforms.length} selected</span>}
          >
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const active = selectedPlatforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={active}
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <PlatformIcon platform={p} size="sm" /> {PLATFORM_LABELS[p]}
                  </button>
                );
              })}
            </div>
          </ComposerSection>

          <ComposerSection step={4} title="Voice & style">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tone</Label>
                <SegmentedControl ariaLabel="Tone" value={tone} options={TONES} onChange={setTone} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Length</Label>
                  <SegmentedControl ariaLabel="Length" value={length} options={LENGTHS} onChange={setLength} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="studio-cta" className="text-xs text-muted-foreground">
                    Call to action
                  </Label>
                  <Input
                    id="studio-cta"
                    placeholder="Shop now"
                    maxLength={40}
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Versions</Label>
                  {!canMultiVariation ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      Pro plan <ProBadge />
                    </span>
                  ) : multiPlatform ? (
                    <span className="text-[10px] text-muted-foreground">
                      Locked to 1 while multi-platform
                    </span>
                  ) : null}
                </div>
                <div className="flex rounded-lg border border-border p-0.5">
                  {([1, 2, 3] as const).map((n) => {
                    const locked =
                      n > 1 && (!canMultiVariation || multiPlatform);
                    const active = effectiveVariations === n;
                    const btn = (
                      <button
                        key={n}
                        type="button"
                        onClick={() => !locked && setVariationsWanted(n)}
                        disabled={locked}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition",
                          active && !locked
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted",
                          locked && "cursor-not-allowed opacity-60 hover:bg-transparent",
                        )}
                      >
                        {n} {locked && <Lock className="h-3 w-3" />}
                      </button>
                    );
                    return locked ? (
                      <Tooltip key={n}>
                        <TooltipTrigger asChild>{btn}</TooltipTrigger>
                        <TooltipContent>
                          {multiPlatform
                            ? "Pick a single platform to generate A/B versions"
                            : "Upgrade to Pro to generate multiple versions"}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      btn
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2.5 rounded-lg border border-border p-3">
                <ToggleRow
                  id="studio-hashtags"
                  label="Hashtags"
                  checked={includeHashtags}
                  onChange={setIncludeHashtags}
                />
                <ToggleRow
                  id="studio-emojis"
                  label="Emojis"
                  checked={includeEmojis}
                  onChange={setIncludeEmojis}
                />
              </div>
            </div>
          </ComposerSection>

          <ComposerSection
            step={5}
            title="Visual"
            aside={
              promptSuggestsImage(prompt, type) && !prefillMedia ? (
                <Badge variant="secondary" className="text-[10px]">
                  Suggested
                </Badge>
              ) : null
            }
          >
            <div className="space-y-3 rounded-lg border border-border p-3">
              <ToggleRow
                id="studio-visual"
                label={type === "Carousel" ? "Create slide visuals" : "Create a visual"}
                hint={
                  prefillMedia
                    ? "Media already attached"
                    : type === "Carousel"
                      ? `Up to ${MAX_CAROUSEL_VISUALS} branded slides, sized for ${PLATFORM_LABELS[previewPlatform]}`
                      : "Generated after the copy so it matches the caption"
                }
                checked={alsoGenerateImage}
                disabled={!!prefillMedia}
                onChange={setAlsoGenerateImage}
              />
              {type !== "Carousel" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Size</Label>
                  <div className="grid grid-cols-5 gap-1">
                    {VISUAL_FORMATS.map((f) => {
                      const Icon = f.icon;
                      const active = visualFormat === f.value;
                      return (
                        <button
                          key={f.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setVisualFormat(f.value)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[10px] font-medium transition",
                            active
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted/60",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <ToggleRow
                id="studio-headline"
                label="Headline on image"
                hint="Adds a short headline and CTA in your brand colors"
                checked={headlineOnImage}
                onChange={setHeadlineOnImage}
              />
              <ToggleRow
                id="studio-logo"
                label="Brand logo"
                hint={brandKit?.logoUrl ? undefined : "Upload a logo in Brand profile"}
                checked={includeLogo && Boolean(brandKit?.logoUrl)}
                disabled={!brandKit?.logoUrl}
                onChange={setIncludeLogo}
              />
              {includeLogo && brandKit?.logoUrl ? (
                <Select value={logoPosition} onValueChange={(v) => setLogoPosition(v as LogoPosition)}>
                  <SelectTrigger className="h-8 text-xs" aria-label="Logo position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOGO_POSITIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  {brandKit?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brandKit.logoUrl} alt="" className="h-6 w-6 rounded object-contain" />
                  ) : (
                    <Palette className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="truncate text-[11px] font-medium">
                    {brandKit?.brandName || "Brand kit"}
                  </span>
                  {[brandKit?.primaryColor, brandKit?.accentColor].filter(Boolean).map((c) => (
                    <span
                      key={c as string}
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: c as string }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onOpenBrand}
                  className="shrink-0 text-[11px] font-medium text-primary hover:underline"
                >
                  {brandKit?.logoUrl && brandKit?.primaryColor ? "Edit" : "Set up"}
                </button>
              </div>
            </div>
          </ComposerSection>

          {error && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="sticky bottom-0 -mx-6 space-y-2 border-t border-border bg-card/95 px-6 pb-1 pt-4 backdrop-blur">
            <Button className="w-full" size="lg" onClick={() => void generate()} disabled={loading || !orgId}>
              {loading ? (
                <>
                  <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" /> Writing copy…
                </>
              ) : (
                <>
                  <ProductGenerateIcon className="mr-1.5 h-4 w-4" />
                  {alsoGenerateImage && !prefillMedia ? "Generate copy + visual" : "Generate copy"}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={imageLoading || slidesLoading || !orgId}
              onClick={() => void generateImage()}
            >
              {imageLoading ? (
                <>
                  <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" /> Creating visual…
                </>
              ) : (
                <>
                  <ImageIcon className="mr-1.5 h-4 w-4" /> Visual only
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft lg:col-span-3">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Generated content</CardTitle>
            {variations && (
              <Badge variant="secondary" className="text-[10px]">
                {multiPlatform
                  ? `${selectedPlatforms.length} platforms`
                  : effectiveVariations > 1
                    ? `${effectiveVariations} versions`
                    : PLATFORM_LABELS[previewPlatform]}
              </Badge>
            )}
          </div>
          {variations && variations.length > 1 ? (
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void saveDraft()}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save all to drafts
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Platform switch — only when more than one platform */}
          {selectedPlatforms.length > 1 && (
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1">
              {selectedPlatforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => selectPlatformTab(p)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                    previewPlatform === p
                      ? "bg-background text-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <PlatformIcon platform={p} size="sm" />
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          )}

          {/* Variation switch — Version A/B/C when multiple generations */}
          {platformVariationIndexes.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Version
              </span>
              <div className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1">
                {platformVariationIndexes.map((globalIdx, localIdx) => (
                  <button
                    key={globalIdx}
                    type="button"
                    onClick={() => selectVariationTab(globalIdx)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                      activeIdx === globalIdx
                        ? "bg-primary text-primary-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {String.fromCharCode(65 + localIdx)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Before generate: phone only. After: phone + editor to edit the active tab. */}
          <div
            className={cn(
              "grid items-start gap-6",
              (loading || activeVariation) && "xl:grid-cols-[auto_minmax(0,1fr)]",
            )}
          >
            <div className="flex justify-center xl:sticky xl:top-4">
              {loading ? (
                <div className="h-[720px] w-[360px] animate-pulse rounded-[2.5rem] bg-muted" />
              ) : (
                <PhoneFrame width={360}>
                  <PlatformPreview
                    platform={previewPlatform}
                    caption={previewCaption}
                    hashtags={previewHashtags}
                    imageUrl={previewImageUrl}
                    videoUrl={previewVideoUrl}
                    brandName={brandKit?.brandName || "Your Brand"}
                    account={previewAccount}
                  />
                </PhoneFrame>
              )}
            </div>

            {loading ? (
              <div className="space-y-2 rounded-xl border border-border p-4">
                {[...Array(8)].map((_, j) => (
                  <div
                    key={j}
                    className="h-3 animate-pulse rounded bg-muted"
                    style={{ width: `${100 - j * 7}%` }}
                  />
                ))}
              </div>
            ) : activeVariation ? (
              <CaptionEditor
                platform={previewPlatform}
                caption={activeVariation.caption}
                hashtags={includeHashtags ? activeVariation.hashtags : []}
                saving={saving}
                onCaptionChange={updateActiveCaption}
                onSaveDraft={() => void saveDraft(activeVariation)}
              />
            ) : null}
          </div>

          {(imageLoading || generatedImageUrl || slideImages.length > 0) && !prefillMedia && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Visual</p>
                  {imageMeta?.width && imageMeta?.height ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {imageMeta.width}×{imageMeta.height}
                    </Badge>
                  ) : null}
                  {imageMeta?.format ? (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {imageMeta.format}
                    </Badge>
                  ) : null}
                  {imageMeta?.logoApplied ? (
                    <Badge variant="outline" className="border-success/30 bg-success/10 text-[10px] text-success">
                      Logo applied
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={imageLoading || slidesLoading}
                    onClick={() =>
                      slides?.length && type === "Carousel"
                        ? void generateSlideVisuals(slides, previewCaption)
                        : void generateImage()
                    }
                  >
                    <RefreshCcw className={cn("mr-1 h-3.5 w-3.5", (imageLoading || slidesLoading) && "animate-spin")} />
                    Regenerate
                  </Button>
                  {generatedImageUrl ? (
                    <>
                      <Button size="sm" variant="outline" asChild>
                        <a href={generatedImageUrl} target="_blank" rel="noopener noreferrer" download>
                          <Download className="mr-1 h-3.5 w-3.5" /> Download
                        </a>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={removeGeneratedImage}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              {imageMeta?.headline ? (
                <p className="text-xs text-muted-foreground">
                  Headline: <span className="font-medium text-foreground">{imageMeta.headline}</span>
                  {imageMeta.cta ? <> · CTA: <span className="font-medium text-foreground">{imageMeta.cta}</span></> : null}
                </p>
              ) : null}
              {imageLoading && !generatedImageUrl ? (
                <div className="h-40 animate-pulse rounded-lg bg-muted" />
              ) : null}
              {slideImages.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">
                    Slides — click to preview. The selected slide is attached to the post; all slides are saved to your media library.
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {slideImages.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        disabled={!url}
                        onClick={() => selectSlideImage(url)}
                        aria-label={`Preview slide ${i + 1}`}
                        className={cn(
                          "relative h-24 w-20 shrink-0 overflow-hidden rounded-md border bg-muted transition",
                          url && url === generatedImageUrl ? "border-primary ring-2 ring-primary" : "border-border",
                        )}
                      >
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt={`Slide ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <span className="absolute inset-0 animate-pulse bg-muted" />
                        )}
                        <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1 text-[9px] font-semibold">
                          {i + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </div>
  );
}

/** Edit the active platform/version — only shown after generate. */
function CaptionEditor({
  platform,
  caption,
  hashtags,
  saving,
  onCaptionChange,
  onSaveDraft,
}: {
  platform: SocialPlatform;
  caption: string;
  hashtags: string[];
  saving: boolean;
  onCaptionChange: (text: string) => void;
  onSaveDraft: () => void;
}) {
  const limit = PLATFORM_CHAR_LIMITS[platform];
  const count = caption.length;
  const over = count > limit;
  const pct = Math.min(100, (count / limit) * 100);

  const copyAll = () => {
    void navigator.clipboard.writeText(formatPostBody(caption, hashtags));
    toast.success("Copied");
  };

  return (
    <div className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{PLATFORM_LABELS[platform]}</p>
        <span className={cn("text-[11px] text-muted-foreground", over && "font-medium text-destructive")}>
          {count} / {limit}
        </span>
      </div>

      <div>
        <Textarea
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          rows={12}
          className="resize-none text-sm"
          placeholder={`Write your ${PLATFORM_LABELS[platform]} post…`}
        />
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              over ? "bg-destructive" : pct > 85 ? "bg-amber-500" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="ghost" disabled={!caption} onClick={copyAll}>
          <Copy className="mr-1 h-3.5 w-3.5" /> Copy
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={saving || !caption}
          onClick={onSaveDraft}
        >
          <Save className="mr-1 h-3.5 w-3.5" /> Save draft
        </Button>
      </div>
    </div>
  );
}


/* --------------- Brand Tab --------------- */

const emptyBrand: BrandVoicePayload = {
  brandName: "",
  industry: "",
  tagline: "",
  targetAudience: "",
  tones: ["Friendly"],
  wordsToUse: [],
  wordsToAvoid: [],
  ctaPhrases: [],
  sentenceLength: "medium",
  emojiUsage: "sometimes",
  primaryLanguage: "en",
  systemPromptOverride: null,
  logoUrl: null,
  primaryColor: "",
  accentColor: "",
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function BrandColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const valid = HEX_COLOR.test(value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        />
        <Input
          id={id}
          value={value}
          maxLength={7}
          placeholder="#1E40AF"
          onChange={(e) => {
            const next = e.target.value.trim();
            onChange(next && !next.startsWith("#") ? `#${next}` : next);
          }}
          className={cn("h-9 font-mono text-xs uppercase", value && !valid && "border-destructive")}
        />
      </div>
    </div>
  );
}

function BrandTab({ orgId, onSaved }: { orgId: string; onSaved?: () => void }) {
  const [form, setForm] = useState<BrandVoicePayload>(emptyBrand);
  const [description, setDescription] = useState("");
  const [products, setProducts] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const patch = <K extends keyof BrandVoicePayload>(key: K, value: BrandVoicePayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const bv = await socialMediaApi.getBrandVoice(orgId);
      const override = bv.systemPromptOverride ?? "";
      const websiteMatch = override.match(/^Website: ([^\n]*)\n?/);
      const restOverride = websiteMatch ? override.slice(websiteMatch[0].length) : override;
      setForm({
        brandName: bv.brandName,
        industry: bv.industry,
        tagline: bv.tagline,
        targetAudience: bv.targetAudience,
        tones: bv.tones.length ? bv.tones : ["Friendly"],
        wordsToUse: bv.wordsToUse,
        wordsToAvoid: bv.wordsToAvoid,
        ctaPhrases: bv.ctaPhrases,
        sentenceLength: bv.sentenceLength,
        emojiUsage: bv.emojiUsage,
        primaryLanguage: bv.primaryLanguage,
        systemPromptOverride: restOverride || null,
        logoUrl: bv.logoUrl ?? null,
        primaryColor: bv.primaryColor ?? "",
        accentColor: bv.accentColor ?? "",
      });
      setWebsite(websiteMatch?.[1]?.trim() ?? "");
      setProducts(bv.wordsToUse.join(", "));
      setDescription(bv.tagline || "");
      setPreview(
        bv.tagline ||
          `At ${bv.brandName || "your brand"}, we speak to ${bv.targetAudience || "your audience"} with a ${(bv.tones[0] || "friendly").toLowerCase()} voice.`,
      );
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to load brand profile"));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const buildBrandPayload = (): BrandVoicePayload => {
    const keywords = products
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const site = website.trim();
    return {
      ...form,
      tagline: description,
      wordsToUse: keywords,
      primaryColor: HEX_COLOR.test(form.primaryColor ?? "") ? form.primaryColor : "",
      accentColor: HEX_COLOR.test(form.accentColor ?? "") ? form.accentColor : "",
      systemPromptOverride:
        [site ? `Website: ${site}` : "", form.systemPromptOverride ?? ""].filter(Boolean).join("\n") || null,
    };
  };

  const refreshPreview = async () => {
    if (!orgId) return;
    setRefreshing(true);
    try {
      const result = await socialMediaApi.testBrandVoice(orgId, buildBrandPayload());
      setPreview(result.caption);
      toast.success("Preview refreshed");
    } catch (err) {
      toast.error(extractPlanError(err, "Could not refresh preview"));
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogoUpload = async (file: File | null) => {
    if (!file || !orgId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5 MB");
      return;
    }
    setUploadingLogo(true);
    try {
      const { logoUrl } = await socialMediaApi.uploadLogo(orgId, file);
      patch("logoUrl", logoUrl);
      toast.success("Logo uploaded");
      onSaved?.();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Logo upload failed"));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    try {
      const payload = buildBrandPayload();
      await socialMediaApi.saveBrandVoice(orgId, payload);
      setForm((prev) => ({ ...prev, tagline: payload.tagline, wordsToUse: payload.wordsToUse }));
      toast.success("Brand profile saved");
      onSaved?.();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to save brand profile"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-soft">
        <CardContent className="space-y-3 py-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error && !form.brandName) {
    return (
      <Card className="shadow-soft">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const tone = form.tones[0] || "Friendly";

  const primary = HEX_COLOR.test(form.primaryColor ?? "") ? (form.primaryColor as string) : "";
  const accent = HEX_COLOR.test(form.accentColor ?? "") ? (form.accentColor as string) : "";

  return (
    <form
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      onSubmit={(e) => void handleSave(e)}
    >
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Brand profile</CardTitle>
          <p className="text-xs text-muted-foreground">
            The more we know about your business, the better the AI writes and designs for you.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          <ComposerSection step={1} title="Identity">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brand-name">Business name</Label>
                <Input
                  id="brand-name"
                  value={form.brandName}
                  onChange={(e) => patch("brandName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand-industry">Industry</Label>
                <Input
                  id="brand-industry"
                  value={form.industry}
                  onChange={(e) => patch("industry", e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="brand-website">Website</Label>
                <Input
                  id="brand-website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="brand-description">Business description</Label>
                  <span className="text-[11px] text-muted-foreground">{description.length}/255</span>
                </div>
                <Textarea
                  id="brand-description"
                  rows={3}
                  value={description}
                  maxLength={255}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          </ComposerSection>

          <ComposerSection step={2} title="Audience & offer">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="brand-audience">Target audience</Label>
                <Textarea
                  id="brand-audience"
                  rows={2}
                  value={form.targetAudience}
                  onChange={(e) => patch("targetAudience", e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="brand-products">Products / services / keywords</Label>
                <Textarea
                  id="brand-products"
                  rows={2}
                  value={products}
                  onChange={(e) => setProducts(e.target.value)}
                  placeholder="Comma-separated"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="brand-cta">Default call to action</Label>
                <Input
                  id="brand-cta"
                  value={form.ctaPhrases[0] ?? ""}
                  onChange={(e) =>
                    patch(
                      "ctaPhrases",
                      e.target.value.trim() ? [e.target.value.trim()] : [],
                    )
                  }
                  placeholder="Book a discovery call"
                />
              </div>
            </div>
          </ComposerSection>

          <ComposerSection step={3} title="Voice">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Brand tone</Label>
            <Select
              value={tone}
              onValueChange={(v) => patch("tones", [v])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sentence length</Label>
            <Select
              value={form.sentenceLength}
              onValueChange={(v) => patch("sentenceLength", v as SentenceLength)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="long">Long</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Emoji usage</Label>
            <Select
              value={form.emojiUsage}
              onValueChange={(v) => patch("emojiUsage", v as EmojiUsage)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="sometimes">Sometimes</SelectItem>
                <SelectItem value="often">Often</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </div>
          </ComposerSection>

          <ComposerSection step={4} title="Guardrails">
            <div className="space-y-2">
              <Label htmlFor="brand-avoid">Things to avoid</Label>
              <Textarea
                id="brand-avoid"
                rows={2}
                value={form.wordsToAvoid.join(", ")}
                placeholder="Comma-separated words, topics or claims"
                onChange={(e) =>
                  patch(
                    "wordsToAvoid",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
              />
            </div>
          </ComposerSection>
        </CardContent>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Brand kit</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              Applied to every AI visual — logo stamp, headline accents and CTA buttons.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              htmlFor="logo"
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center transition hover:bg-muted/50"
            >
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logoUrl}
                  alt={`${form.brandName || "Brand"} logo`}
                  className="mb-2 max-h-16 max-w-[160px] object-contain"
                />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
              <p className="mt-1 text-sm font-medium">
                {uploadingLogo
                  ? "Uploading…"
                  : form.logoUrl
                    ? "Click to replace logo"
                    : "Upload your logo"}
              </p>
              <p className="text-[11px] text-muted-foreground">PNG with transparency works best · up to 5 MB</p>
              <input
                id="logo"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                className="hidden"
                disabled={uploadingLogo || !orgId}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  void handleLogoUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <BrandColorField
                id="brand-primary"
                label="Primary"
                value={form.primaryColor ?? ""}
                onChange={(v) => patch("primaryColor", v)}
              />
              <BrandColorField
                id="brand-accent"
                label="Accent"
                value={form.accentColor ?? ""}
                onChange={(v) => patch("accentColor", v)}
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <div
                className="flex h-20 flex-col justify-end gap-1.5 bg-muted p-3"
                style={primary ? { backgroundColor: primary } : undefined}
              >
                <span
                  className="h-1 w-8 rounded-full bg-primary"
                  style={accent ? { backgroundColor: accent } : undefined}
                />
                <span className="text-xs font-semibold text-white drop-shadow">
                  {form.brandName || "Your headline"}
                </span>
              </div>
              <p className="bg-card px-3 py-1.5 text-[10px] text-muted-foreground">
                {primary || accent ? "Creative preview" : "No colors set — the AI picks a palette per image"}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-success/30 bg-success/10 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-success text-white">
                <Mic2 className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm font-semibold">Voice preview</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void refreshPreview()}
              disabled={refreshing}
            >
              <RefreshCcw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
            {preview || "Refresh to see a sample caption in your voice."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Button type="submit" className="w-full" disabled={saving || !orgId}>
            {saving ? (
              <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Save brand profile
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Every caption and visual in AI Generate uses this profile.
          </p>
        </div>
      </div>
    </form>
  );
}

/* --------------- Media Tab --------------- */

function MediaTab({
  orgId,
  active,
  onUseInGenerate,
}: {
  orgId: string;
  active: boolean;
  onUseInGenerate: (asset: MediaAsset) => void;
}) {
  const user = useAppSelector(selectUser);
  const plan = String(user?.plan ?? "starter").toLowerCase();
  const canGenerateVideo = plan === "growth" || plan === "enterprise";

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | MediaAssetType>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "ai_generated" | "uploaded">("all");
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ images: 0, videos: 0, totalBytes: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoSeconds, setVideoSeconds] = useState<"4" | "8" | "12">("4");
  const [videoSize, setVideoSize] = useState<"1280x720" | "720x1280">("1280x720");
  const [videoLoading, setVideoLoading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const requestSeqRef = useRef(0);

  const load = useCallback(async () => {
    if (!orgId) return;
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await socialMediaApi.listMediaAssets(orgId, {
        mediaType: filter === "all" ? undefined : filter,
        source: sourceFilter === "all" ? undefined : sourceFilter,
        search: query.trim() || undefined,
        page: 1,
        pageSize: 48,
      });
      if (seq !== requestSeqRef.current) return;
      setItems(data.items);
      setTotal(data.total);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setError(extractErrorMessage(err, "Failed to load media"));
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  }, [orgId, filter, sourceFilter, query]);

  useEffect(() => {
    if (!active) return;
    const handle = window.setTimeout(() => void load(), query.trim() ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [load, active, query]);

  const handleUpload = async (file: File, type: MediaAssetType) => {
    if (!orgId) return;
    const maxMb = type === "image" ? 8 : 200;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`${type === "image" ? "Image" : "Video"} must be under ${maxMb} MB`);
      return;
    }
    setUploading(true);
    try {
      if (type === "image") await socialMediaApi.uploadImage(orgId, file);
      else await socialMediaApi.uploadVideo(orgId, file);
      toast.success("Uploaded to media library");
      void load();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (asset: MediaAsset) => {
    if (!orgId) return;
    setItems((prev) => prev.filter((m) => m.id !== asset.id));
    try {
      await socialMediaApi.deleteMediaAsset(orgId, asset.id);
      toast.success("Deleted");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Delete failed"));
    }
    void load();
  };

  const handleGenerateVideo = async () => {
    if (!orgId) return;
    if (!canGenerateVideo) {
      toast.error("Video generation requires Pro or Growth plan");
      return;
    }
    if (!videoPrompt.trim()) {
      toast.error("Enter a video prompt");
      return;
    }
    setVideoLoading(true);
    try {
      await socialMediaApi.generateVideo(orgId, {
        prompt: videoPrompt.trim(),
        size: videoSize,
        seconds: videoSeconds,
        mode: "create",
      });
      toast.success("Video generated and saved to library");
      setVideoOpen(false);
      setVideoPrompt("");
      void load();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Video generation failed"));
    } finally {
      setVideoLoading(false);
    }
  };

  const imageCount = stats.images;
  const videoCount = stats.videos;
  const usedBytes = stats.totalBytes;
  const limitGb = 5;
  const usedGb = usedBytes / (1024 * 1024 * 1024);
  const pct = Math.min(100, Math.round((usedGb / limitGb) * 100));

  return (
    <Card className="shadow-soft">
      <CardHeader className="flex-col gap-4 space-y-0 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-base">Media library</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {loading && items.length === 0
              ? "Loading…"
              : `${imageCount} images · ${videoCount} videos · ${total} ${filter === "all" && sourceFilter === "all" && !query.trim() ? "total" : "matching"}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assets"
              className="h-9 w-56 pl-9"
            />
          </div>
          <div className="flex rounded-lg border border-border p-0.5">
            {(["all", "image", "video"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize transition",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border p-0.5">
            {([
              ["all", "Any source"],
              ["ai_generated", "AI"],
              ["uploaded", "Uploaded"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSourceFilter(value)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition",
                  sourceFilter === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            disabled={uploading || !orgId}
            onClick={() => imageInputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file, "image");
              e.target.value = "";
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file, "video");
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading || !orgId}
            onClick={() => videoInputRef.current?.click()}
          >
            Upload video
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!orgId || videoLoading}
                  onClick={() => {
                    if (!canGenerateVideo) {
                      toast.error(
                        `Video AI is available on Pro / Growth (current: ${planDisplayName(plan)})`,
                      );
                      return;
                    }
                    setVideoOpen(true);
                  }}
                >
                  <Film className="mr-1.5 h-4 w-4" />
                  Generate video
                  {!canGenerateVideo ? <Lock className="ml-1.5 h-3 w-3" /> : null}
                </Button>
              </span>
            </TooltipTrigger>
            {!canGenerateVideo ? (
              <TooltipContent>Upgrade to Pro to generate AI video</TooltipContent>
            ) : null}
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Generate AI video</DialogTitle>
              <DialogDescription>
                Creates a short clip and saves it to your media library.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="video-prompt">Prompt</Label>
                <Textarea
                  id="video-prompt"
                  rows={4}
                  placeholder="e.g. Slow pan across a modern product on a marble desk, soft daylight…"
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Select
                    value={videoSeconds}
                    onValueChange={(v) => setVideoSeconds(v as "4" | "8" | "12")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 seconds</SelectItem>
                      <SelectItem value="8">8 seconds</SelectItem>
                      <SelectItem value="12">12 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aspect</Label>
                  <Select
                    value={videoSize}
                    onValueChange={(v) => setVideoSize(v as "1280x720" | "720x1280")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1280x720">Landscape 16:9</SelectItem>
                      <SelectItem value="720x1280">Portrait 9:16</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVideoOpen(false)} disabled={videoLoading}>
                Cancel
              </Button>
              <Button onClick={() => void handleGenerateVideo()} disabled={videoLoading}>
                {videoLoading ? (
                  <>
                    <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <ProductGenerateIcon className="mr-1.5 h-4 w-4" /> Generate
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Storage</span>
            <span className="text-muted-foreground">
              {usedGb.toFixed(2)} GB / {limitGb} GB
            </span>
          </div>
          <Progress value={pct} className="mt-2 h-1.5" />
        </div>

        {loading && items.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
            {error}
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <StudioEmptyState
            icon={ImageIcon}
            title="No assets found"
            body="Upload an image/video, generate an image in AI Generate, or create a video here."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((m) => (
              <div key={m.id} className="group overflow-hidden rounded-xl border border-border">
                <div className="relative flex aspect-square items-center justify-center bg-muted">
                  {m.mediaType === "video" ? (
                    <>
                      <video
                        src={m.url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                      <Play className="pointer-events-none absolute h-8 w-8 text-white/90 drop-shadow" />
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt={m.prompt ?? "Asset"}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span
                    className={cn(
                      "pointer-events-none absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      m.source === "ai_generated"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background/90 text-foreground",
                    )}
                  >
                    {m.source === "ai_generated" ? "AI" : "Upload"}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-end gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-2 transition focus-within:opacity-100 md:inset-0 md:justify-center md:bg-black/60 md:opacity-0 md:group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full text-[11px]"
                      onClick={() => onUseInGenerate(m)}
                    >
                      <ProductGenerateIcon className="mr-1 h-3 w-3" /> Use in AI Generate
                    </Button>
                    <div className="flex gap-1.5">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7"
                        asChild
                      >
                        <a href={m.url} target="_blank" rel="noreferrer" aria-label="Open">
                          <Film className="h-3 w-3" />
                        </a>
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7"
                        asChild
                      >
                        <a href={m.url} download aria-label="Download">
                          <Download className="h-3 w-3" />
                        </a>
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-7 w-7"
                        onClick={() => void handleDelete(m)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-medium">
                    {m.prompt?.slice(0, 40) || m.mimeType || m.id.slice(0, 8)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatBytes(m.fileSizeBytes)} · {m.mediaType === "video" ? "Video" : "Image"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------- Page shell --------------- */

export default function AIStudioPage({
  initialTab = "generate",
}: {
  initialTab?: AIStudioTab;
}) {
  const searchParams = useSearchParams();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const [tab, setTab] = useState<AIStudioTab>(initialTab);
  const [visited, setVisited] = useState<Set<AIStudioTab>>(() => new Set([initialTab]));
  const [prefillMedia, setPrefillMedia] = useState<PrefillMedia>(null);

  const draftId = searchParams.get("draftId");
  const templateId = searchParams.get("templateId");
  const assetId = searchParams.get("assetId");
  const scheduleAtParam = searchParams.get("scheduleAt");

  const changeTab = useCallback((next: AIStudioTab) => {
    setTab(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  }, []);

  const clearPrefillMedia = useCallback(() => setPrefillMedia(null), []);
  const [brandVersion, setBrandVersion] = useState(0);
  const bumpBrandVersion = useCallback(() => setBrandVersion((v) => v + 1), []);
  const openBrand = useCallback(() => changeTab("brand"), [changeTab]);

  useEffect(() => {
    changeTab(initialTab);
  }, [initialTab, changeTab]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          icon={ProductAIStudioIcon}
          title="AI Studio"
          description="Generate posts, plan calendars, and teach the AI about your brand."
        />

        {!orgId && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            Sign in with a workspace to use AI Studio.
          </div>
        )}

        <Tabs
          value={tab}
          onValueChange={(v) => changeTab(v as AIStudioTab)}
          className="space-y-6"
        >
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="generate" className="gap-1.5">
              <ProductGenerateIcon className="h-3.5 w-3.5" /> AI Generate
            </TabsTrigger>
            <TabsTrigger value="planner" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Content Planner
            </TabsTrigger>
            <TabsTrigger value="brand" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Brand Profile
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" /> Media Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" forceMount className="data-[state=inactive]:hidden">
            {visited.has("generate") && (
              <GenerateTab
                orgId={orgId}
                prefillMedia={prefillMedia}
                onClearMedia={clearPrefillMedia}
                onSetPrefillMedia={setPrefillMedia}
                draftId={draftId}
                templateId={templateId}
                assetId={assetId}
                scheduleAtParam={scheduleAtParam}
                onOpenBrand={openBrand}
                brandVersion={brandVersion}
              />
            )}
          </TabsContent>
          <TabsContent value="planner" forceMount className="data-[state=inactive]:hidden">
            {visited.has("planner") && <ContentPlannerSection orgId={orgId} />}
          </TabsContent>
          <TabsContent value="brand" forceMount className="data-[state=inactive]:hidden">
            {visited.has("brand") && <BrandTab orgId={orgId} onSaved={bumpBrandVersion} />}
          </TabsContent>
          <TabsContent value="media" forceMount className="data-[state=inactive]:hidden">
            {visited.has("media") && (
              <MediaTab
                orgId={orgId}
                active={tab === "media"}
                onUseInGenerate={(asset) => {
                  setPrefillMedia({
                    name: asset.prompt?.slice(0, 48) || asset.id.slice(0, 8),
                    url: asset.url,
                    mediaType: asset.mediaType,
                  });
                  changeTab("generate");
                  toast.success("Media attached — jump to AI Generate");
                }}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
