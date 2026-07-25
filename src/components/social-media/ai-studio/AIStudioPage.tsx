"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Copy,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Lock,
  Play,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X as XIcon,
} from "lucide-react";
import { toast } from "sonner";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { PlatformIcon } from "@/components/platform-icon";
import PhoneFrame from "@/components/social-media/content-studio/PhoneFrame";
import PlatformPreview from "@/components/social-media/content-studio/PlatformPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { canUseMultiVariations, contentPlanDayCap, planDisplayName } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type {
  BrandVoicePayload,
  CalendarPost,
  EmojiUsage,
  GeneratedContent,
  MediaAsset,
  MediaAssetType,
  SentenceLength,
  SocialAccount,
  SocialPlatform,
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

const LENGTH_HINT: Record<string, string> = {
  Short: "Keep it concise (1–2 short paragraphs).",
  Medium: "Aim for a medium-length caption.",
  Long: "Write a longer, more detailed caption.",
};

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
      <Sparkles className="h-2.5 w-2.5" /> Pro
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

function extractErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string | { message?: string } } } })
    ?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && typeof detail.message === "string") {
    return detail.message;
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

/* --------------- Generate Tab --------------- */

function GenerateTab({
  orgId,
  prefillMedia,
  onClearMedia,
}: {
  orgId: string;
  prefillMedia: PrefillMedia;
  onClearMedia: () => void;
}) {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const accounts = useAppSelector(selectSocialAccounts);
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
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [variations, setVariations] = useState<Variation[] | null>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    void dispatch(fetchSocialAccounts({ orgId }));
  }, [dispatch, orgId]);

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

  const updateActiveHashtags = (tags: string[]) => {
    if (activeIdx < 0) return;
    setVariations((prev) =>
      prev
        ? prev.map((x, idx) => (idx === activeIdx ? { ...x, hashtags: tags } : x))
        : prev,
    );
    setHashtags(tags);
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

  const buildTopic = () => {
    const parts = [
      prompt.trim(),
      // Backend elevates thin briefs; this nudges length/quality without overriding brand voice.
      "Make it impressive, professional, and conversion-focused even if this brief is short.",
    ];
    if (length) parts.push(LENGTH_HINT[length] ?? "");
    if (type && type !== "Caption") parts.push(`Content type: ${type}.`);
    if (!includeEmojis) parts.push("Do not use emojis.");
    if (prefillMedia) parts.push(`Reference attached media: ${prefillMedia.name}.`);
    return parts.filter(Boolean).join(" ");
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
    if (selectedPlatforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }
    setLoading(true);
    setError(null);
    setVariations(null);
    setPicked(null);
    setGeneratedImageUrl(null);
    try {
      const results: Variation[] = [];
      const allHashtags: string[] = [];

      // Multi-platform (Free/Growth/Enterprise): one API call → one card per platform.
      // Multi-variation (Enterprise + single platform): N API calls → Version A/B/C.
      for (let i = 0; i < effectiveVariations; i++) {
        const topic =
          i === 0
            ? buildTopic()
            : `${buildTopic()} Variation ${i + 1}: rewrite with a distinct angle.`;
        const data: GeneratedContent = await socialMediaApi.generatePost(orgId, {
          topic,
          tone,
          platforms: selectedPlatforms,
          cta: cta.trim() || undefined,
          includeHashtags,
          includeComment: false,
          format: CONTENT_TYPE_TO_FORMAT[type] ?? "single",
        });

        if (multiPlatform || effectiveVariations === 1) {
          for (const p of selectedPlatforms) {
            const pc = data.platforms[p];
            const caption = pc?.caption ?? (selectedPlatforms.length === 1 ? data.caption : "") ?? "";
            if (!caption) continue;
            const tags = pc?.hashtags ?? data.hashtags ?? [];
            results.push({
              label:
                effectiveVariations > 1
                  ? `${PLATFORM_LABELS[p]} · ${String.fromCharCode(65 + i)}`
                  : PLATFORM_LABELS[p],
              caption,
              hashtags: tags,
              platform: p,
              match: brandMatchScore(caption, results.length),
              recommended: results.length === 0,
            });
            allHashtags.push(...tags);
          }
        } else {
          const p = selectedPlatforms[0];
          const pc = data.platforms[p];
          const caption = pc?.caption ?? data.caption ?? "";
          const tags = pc?.hashtags ?? data.hashtags ?? [];
          if (!caption) throw new Error("No caption returned");
          results.push({
            label: `Version ${String.fromCharCode(65 + i)}`,
            caption,
            hashtags: tags,
            platform: p,
            match: brandMatchScore(caption, i),
            recommended: i === 0,
          });
          allHashtags.push(...tags);
        }
      }

      if (results.length === 0) throw new Error("No caption returned");

      setVariations(results);
      setHashtags([...new Set(allHashtags)]);
      const recIdx = results.findIndex((v) => v.recommended);
      setPicked(recIdx >= 0 ? recIdx : 0);
      toast.success(
        multiPlatform
          ? `Generated for ${results.length} platforms`
          : results.length > 1
            ? `${results.length} versions generated`
            : "Content generated",
      );

      // Flow: if the prompt needs a visual (or user opted in) and none attached, generate image.
      const shouldImage =
        alsoGenerateImage &&
        !prefillMedia &&
        !generatedImageUrl;
      if (shouldImage) {
        setImageLoading(true);
        try {
          const imageTopic = [
            prompt.trim(),
            tone ? `Style/tone: ${tone}.` : "",
            type !== "Caption" ? `Format: ${type}.` : "",
            "Premium commercial social image — scroll-stopping, high-end lighting, no text overlays, no watermark.",
          ]
            .filter(Boolean)
            .join(" ");
          const img = await socialMediaApi.generateImage(orgId, {
            topic: imageTopic,
            mode: "create",
            size: "1024x1024",
          });
          setGeneratedImageUrl(img.imageUrl);
          toast.success("Image generated and attached");
        } catch (imgErr) {
          toast.error(extractErrorMessage(imgErr, "Caption ready, but image generation failed"));
        } finally {
          setImageLoading(false);
        }
      }
    } catch (err) {
      const message = extractErrorMessage(err, "Generation failed");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const generateImage = async () => {
    if (!orgId || !prompt.trim()) {
      toast.error("Add a prompt first");
      return;
    }
    setImageLoading(true);
    try {
      const imageTopic = [
        prompt.trim(),
        tone ? `Style/tone: ${tone}.` : "",
        "Premium commercial social image — scroll-stopping, high-end lighting, no text overlays, no watermark.",
      ]
        .filter(Boolean)
        .join(" ");
      const result = await socialMediaApi.generateImage(orgId, {
        topic: imageTopic,
        mode: "create",
        size: "1024x1024",
      });
      setGeneratedImageUrl(result.imageUrl);
      toast.success("Image generated");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Image generation failed"));
    } finally {
      setImageLoading(false);
    }
  };

  const saveDraft = async (variation?: Variation) => {
    if (!orgId || !variations?.length) return;
    setSaving(true);
    try {
      const imageUrl = generatedImageUrl ?? prefillMedia?.url ?? null;
      // Multi-platform: save one draft with all generated platform captions (old AIGenerate).
      // Single card save: only that platform.
      const payloadPlatforms = variation
        ? [
            {
              platform: variation.platform,
              caption: variation.caption,
              hashtags: includeHashtags
                ? [...new Set([...(variation.hashtags ?? []), ...hashtags])]
                : [],
            },
          ]
        : variations.map((v) => ({
            platform: v.platform,
            caption: v.caption,
            hashtags: includeHashtags
              ? [...new Set([...(v.hashtags ?? []), ...hashtags])]
              : [],
          }));

      await socialMediaApi.createPost(orgId, {
        title: prompt.trim().slice(0, 80) || "AI draft",
        status: "draft",
        aiPrompt: prompt.trim() || null,
        imageUrl,
        imageSource: imageUrl ? (generatedImageUrl ? "ai_generated" : "uploaded") : "none",
        platforms: payloadPlatforms,
      });
      toast.success(
        payloadPlatforms.length > 1
          ? `Saved draft for ${payloadPlatforms.length} platforms`
          : "Saved to drafts",
      );
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to save draft"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card className="shadow-soft lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Compose</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
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

          <div className="space-y-2">
            <Label>Prompt</Label>
            <Textarea
              placeholder="e.g. Announce our fall collection launching this Friday…"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Platforms</Label>
              <span className="text-[10px] text-muted-foreground">
                Select one or more — available on all plans
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const active = selectedPlatforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <PlatformIcon platform={p} size="sm" /> {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Content type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
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
              <Label>Length</Label>
              <Select value={length} onValueChange={setLength}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LENGTHS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Call to action</Label>
              <Input
                placeholder="Shop now"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Variations</Label>
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

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={includeHashtags}
                onCheckedChange={(v) => setIncludeHashtags(!!v)}
              />
              Include hashtags
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={includeEmojis}
                onCheckedChange={(v) => setIncludeEmojis(!!v)}
              />
              Include emojis
            </label>
            <label className="col-span-2 flex items-center gap-2 text-xs">
              <Checkbox
                checked={alsoGenerateImage}
                disabled={!!prefillMedia}
                onCheckedChange={(v) => setAlsoGenerateImage(!!v)}
              />
              Also generate image from prompt
              {promptSuggestsImage(prompt, type) && !prefillMedia ? (
                <span className="text-[10px] text-muted-foreground">(suggested)</span>
              ) : null}
            </label>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Button className="w-full" onClick={() => void generate()} disabled={loading || !orgId}>
              {loading ? (
                <>
                  <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Wand2 className="mr-1.5 h-4 w-4" /> Generate content
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={imageLoading || !orgId}
              onClick={() => void generateImage()}
            >
              {imageLoading ? (
                <>
                  <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" /> Generating image…
                </>
              ) : (
                <>
                  <ImageIcon className="mr-1.5 h-4 w-4" /> Generate image
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
                    brandName="Your Brand"
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
                showHashtags={includeHashtags}
                saving={saving}
                onCaptionChange={updateActiveCaption}
                onHashtagsChange={updateActiveHashtags}
                onSaveDraft={() => void saveDraft(activeVariation)}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Edit the active platform/version — only shown after generate. */
function CaptionEditor({
  platform,
  caption,
  hashtags,
  showHashtags,
  saving,
  onCaptionChange,
  onHashtagsChange,
  onSaveDraft,
}: {
  platform: SocialPlatform;
  caption: string;
  hashtags: string[];
  showHashtags: boolean;
  saving: boolean;
  onCaptionChange: (text: string) => void;
  onHashtagsChange: (tags: string[]) => void;
  onSaveDraft: () => void;
}) {
  const limit = PLATFORM_CHAR_LIMITS[platform];
  const count = caption.length;
  const over = count > limit;
  const pct = Math.min(100, (count / limit) * 100);

  const copyAll = () => {
    const tags = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
    void navigator.clipboard.writeText([caption, tags].filter(Boolean).join("\n\n"));
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

      {showHashtags && (
        <div className="space-y-2">
          <Label className="text-xs">Hashtags</Label>
          <Input
            value={hashtags.map((h) => h.replace(/^#/, "")).join(" ")}
            onChange={(e) =>
              onHashtagsChange(
                e.target.value
                  .split(/[\s,]+/)
                  .map((t) => t.replace(/^#/, "").trim())
                  .filter(Boolean),
              )
            }
            placeholder="growth saas marketing"
            className="text-sm"
          />
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {hashtags.map((h) => {
                const tag = h.replace(/^#/, "");
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      onHashtagsChange(
                        hashtags.filter((x) => x.replace(/^#/, "") !== tag),
                      )
                    }
                    className="group inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-accent-foreground hover:bg-accent/70"
                  >
                    #{tag}
                    <XIcon className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

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

/* --------------- Planner Tab --------------- */

type DayBucket = {
  key: string;
  date: Date;
  weekday: string;
  dayNum: number;
  posts: CalendarPost[];
};

function PlannerTab({ orgId }: { orgId: string }) {
  const user = useAppSelector(selectUser);
  const planCap = contentPlanDayCap(user?.plan);
  const [days, setDays] = useState<7 | 15 | 30>(() => planCap);
  const [theme, setTheme] = useState("");
  const [items, setItems] = useState<CalendarPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep selected window within plan allowance.
  useEffect(() => {
    if (days > planCap) setDays(planCap);
  }, [days, planCap]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const months = new Set<string>([monthKey(now)]);
      const end = new Date(now);
      end.setDate(end.getDate() + days + 2);
      months.add(monthKey(end));
      const results = await Promise.all(
        [...months].map((m) => socialMediaApi.getCalendar(orgId, m)),
      );
      const merged = results
        .flatMap((r) => r.items)
        .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
      setItems(merged);
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to load planner"));
    } finally {
      setLoading(false);
    }
  }, [orgId, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayBuckets = useMemo((): DayBucket[] => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const buckets: DayBucket[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      buckets.push({
        key,
        date: d,
        weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
        dayNum: d.getDate(),
        posts: [],
      });
    }
    for (const post of items) {
      const at = post.scheduledAt ?? post.publishedAt;
      if (!at) continue;
      const dt = new Date(at);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      const bucket = buckets.find((b) => b.key === key);
      if (bucket) bucket.posts.push(post);
    }
    for (const b of buckets) {
      b.posts.sort((a, c) => {
        const ta = new Date(a.scheduledAt ?? a.publishedAt ?? 0).getTime();
        const tc = new Date(c.scheduledAt ?? c.publishedAt ?? 0).getTime();
        return ta - tc;
      });
    }
    return buckets;
  }, [items, days]);

  const scheduledInWindow = dayBuckets.reduce((n, b) => n + b.posts.length, 0);

  const generatePlan = async () => {
    if (!orgId) return;
    setPlanning(true);
    try {
      const result = await socialMediaApi.generateContentPlan(orgId, {
        days,
        theme: theme.trim() || undefined,
        autoSchedule: true,
        generateImages: false,
      });
      if (result.calendarItems?.length) {
        setItems((prev) => {
          const ids = new Set(result.calendarItems.map((p) => p.id));
          return [...result.calendarItems, ...prev.filter((p) => !ids.has(p.id))];
        });
      }
      await load();
      toast.success(result.message || `Planned ${result.days} days`);
      if (result.errors?.length) {
        toast.message(result.errors.slice(0, 2).join(" · "));
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to generate plan"));
    } finally {
      setPlanning(false);
    }
  };

  const dayOptions = ([7, 15, 30] as const).filter((d) => d <= planCap);

  return (
    <Card className="shadow-soft">
      <CardHeader className="flex-col gap-4 space-y-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-base">Content planner</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Day-wise plan → AI writes each post → auto-schedules → publishes at the set time.
              Requires a connected Facebook or Instagram account. Celery worker must be running.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5">
              {dayOptions.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition",
                    days === d
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {d} days
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => void load()} disabled={loading || planning}>
              <RefreshCcw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button onClick={() => void generatePlan()} disabled={planning || !orgId}>
              {planning ? (
                <>
                  <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" /> Planning…
                </>
              ) : (
                <>
                  <Wand2 className="mr-1.5 h-4 w-4" /> Generate &amp; schedule
                </>
              )}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Optional campaign theme (e.g. product launch week)"
            className="sm:max-w-md"
            disabled={planning}
          />
          <p className="text-[11px] text-muted-foreground">
            {scheduledInWindow} post{scheduledInWindow === 1 ? "" : "s"} in next {days} days
            {planCap < 30 ? ` · ${planDisplayName(user?.plan)} plan up to ${planCap} days` : ""}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !planning ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: Math.min(days, 8) }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-4">
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                <div className="mt-3 h-16 animate-pulse rounded bg-muted" />
              </div>
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
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {dayBuckets.map((bucket, index) => (
              <DayPlanCard key={bucket.key} bucket={bucket} index={index} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DayPlanCard({ bucket, index }: { bucket: DayBucket; index: number }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const empty = bucket.posts.length === 0;

  return (
    <div
      className={cn(
        "flex min-h-[160px] flex-col rounded-xl border p-3 transition",
        empty ? "border-dashed border-border bg-muted/20" : "border-border bg-card hover:shadow-soft",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Day {index + 1} · {bucket.weekday}
          </p>
          <p className="text-sm font-semibold">
            {bucket.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {empty ? "Open" : `${bucket.posts.length} post${bucket.posts.length > 1 ? "s" : ""}`}
        </Badge>
      </div>

      {empty ? (
        <p className="mt-4 text-xs text-muted-foreground">
          No post yet — Generate &amp; schedule fills this day.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {bucket.posts.map((post) => {
            const platform = post.platforms[0] ?? "instagram";
            const at = post.scheduledAt ?? post.publishedAt;
            const caption = post.captionPreview || post.title || "Untitled";
            const open = expandedId === post.id;
            return (
              <div key={post.id} className="rounded-lg border border-border/80 bg-background p-2.5">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <PlatformIcon platform={platform} size="sm" />
                    <span className="text-[11px] font-medium">{PLATFORM_LABELS[platform]}</span>
                  </div>
                  <Badge variant="secondary" className="text-[9px] capitalize">
                    {post.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className={cn("mt-1.5 text-xs text-muted-foreground", !open && "line-clamp-3")}>
                  {caption}
                </p>
                {caption.length > 100 && (
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : post.id)}
                    className="mt-1 text-[10px] font-medium text-primary hover:underline"
                  >
                    {open ? "Show less" : "Show more"}
                  </button>
                )}
                {at && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {new Date(at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
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
};

function BrandTab({ orgId }: { orgId: string }) {
  const [form, setForm] = useState<BrandVoicePayload>(emptyBrand);
  const [description, setDescription] = useState("");
  const [products, setProducts] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState<string | null>(null);

  const patch = <K extends keyof BrandVoicePayload>(key: K, value: BrandVoicePayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const bv = await socialMediaApi.getBrandVoice(orgId);
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
        systemPromptOverride: bv.systemPromptOverride,
      });
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

  const refreshPreview = async () => {
    if (!orgId) return;
    setRefreshing(true);
    try {
      const result = await socialMediaApi.testBrandVoice(orgId, {
        ...form,
        tagline: description || form.tagline,
      });
      setPreview(result.caption);
      toast.success("Preview refreshed");
    } catch {
      setPreview(
        `At ${form.brandName || "your brand"}, we help ${(form.targetAudience || "customers").split(" ")[0]?.toLowerCase() || "customers"} tell better stories.\n\nHere's what a ${(form.tones[0] || "friendly").toLowerCase()} caption sounds like in your voice.\n\n#${(form.brandName || "brand").replace(/\s+/g, "")}`,
      );
      toast.success("Preview refreshed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    try {
      const keywords = products
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const payload: BrandVoicePayload = {
        ...form,
        tagline: description || form.tagline,
        wordsToUse: keywords.length ? keywords : form.wordsToUse,
        systemPromptOverride: website
          ? `Website: ${website}${form.systemPromptOverride ? `\n${form.systemPromptOverride}` : ""}`
          : form.systemPromptOverride,
      };
      await socialMediaApi.saveBrandVoice(orgId, payload);
      toast.success("Brand profile saved");
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

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-base">Brand profile</CardTitle>
        <p className="text-xs text-muted-foreground">
          The more we know about your business, the better the AI writes for you.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className="rounded-xl border-2 p-4"
          style={{
            borderColor: "color-mix(in oklch, var(--success, #16a34a) 40%, transparent)",
            backgroundColor: "color-mix(in oklch, var(--success, #16a34a) 6%, transparent)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm font-semibold">Brand voice preview</p>
              <Badge variant="secondary" className="text-[10px]">
                Live
              </Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void refreshPreview()}
              disabled={refreshing}
            >
              <RefreshCcw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />
              Refresh preview
            </Button>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
            {preview || "Save your profile and refresh to see a sample caption."}
          </p>
        </div>

        <form className="grid grid-cols-1 gap-5 md:grid-cols-2" onSubmit={(e) => void handleSave(e)}>
          <div className="space-y-2">
            <Label>Business name</Label>
            <Input
              value={form.brandName}
              onChange={(e) => patch("brandName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Input
              value={form.industry}
              onChange={(e) => patch("industry", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="space-y-2">
            <Label>Call to action</Label>
            <Input
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
          <div className="space-y-2 md:col-span-2">
            <Label>Business description</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Target audience</Label>
            <Textarea
              rows={2}
              value={form.targetAudience}
              onChange={(e) => patch("targetAudience", e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Products / services / keywords</Label>
            <Textarea
              rows={2}
              value={products || form.wordsToUse.join(", ")}
              onChange={(e) => setProducts(e.target.value)}
              placeholder="Comma-separated"
            />
          </div>
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
          <div className="space-y-2 md:col-span-2">
            <Label>Things to avoid</Label>
            <Textarea
              rows={2}
              value={form.wordsToAvoid.join(", ")}
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
          <div className="space-y-2 md:col-span-2">
            <Label>Logo</Label>
            <label
              htmlFor="logo"
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-8 text-center hover:bg-muted/50"
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Drop your logo here, or click to upload</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, SVG · up to 5 MB</p>
              <input
                id="logo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={() => toast.message("Logo upload is UI-only for now")}
              />
            </label>
            <p className="text-[11px] text-muted-foreground">
              <ProBadge className="mr-1.5" />
              Managing multiple brand profiles is available on Pro.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 md:col-span-2">
            <Button type="submit" disabled={saving || !orgId}>
              {saving ? (
                <RefreshCcw className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Save brand profile
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Every caption in AI Generate uses this profile automatically.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* --------------- Media Tab --------------- */

function MediaTab({
  orgId,
  onUseInGenerate,
}: {
  orgId: string;
  onUseInGenerate: (asset: MediaAsset) => void;
}) {
  const user = useAppSelector(selectUser);
  const plan = String(user?.plan ?? "starter").toLowerCase();
  const canGenerateVideo = plan === "growth" || plan === "enterprise";

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | MediaAssetType>("all");
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
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

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await socialMediaApi.listMediaAssets(orgId, {
        mediaType: filter === "all" ? undefined : filter,
        search: query.trim() || undefined,
        page: 1,
        pageSize: 48,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to load media"));
    } finally {
      setLoading(false);
    }
  }, [orgId, filter, query]);

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(handle);
  }, [load]);

  const handleUpload = async (file: File, type: MediaAssetType) => {
    if (!orgId) return;
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
    try {
      await socialMediaApi.deleteMediaAsset(orgId, asset.id);
      toast.success("Deleted");
      void load();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Delete failed"));
    }
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

  const imageCount = items.filter((m) => m.mediaType === "image").length;
  const videoCount = items.filter((m) => m.mediaType === "video").length;
  const usedBytes = items.reduce((sum, m) => sum + (m.fileSizeBytes || 0), 0);
  const limitGb = 5;
  const usedGb = usedBytes / (1024 * 1024 * 1024);
  const pct = Math.min(100, Math.round((usedGb / limitGb) * 100));

  return (
    <Card className="shadow-soft">
      <CardHeader className="flex-col gap-4 space-y-0 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-base">Media library</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {loading ? "Loading…" : `${imageCount} images · ${videoCount} videos · ${total} total`}
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
                Creates a short clip with Sora and saves it to your media library.
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
                    <Wand2 className="mr-1.5 h-4 w-4" /> Generate
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Storage (loaded assets)</span>
            <span className="text-muted-foreground">
              {usedGb.toFixed(2)} GB / {limitGb} GB
            </span>
          </div>
          <Progress value={pct} className="mt-2 h-1.5" />
        </div>

        {loading ? (
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
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 p-2 opacity-0 transition group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full text-[11px]"
                      onClick={() => onUseInGenerate(m)}
                    >
                      <Sparkles className="mr-1 h-3 w-3" /> Use in AI Generate
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
                    {formatBytes(m.fileSizeBytes)} · {m.source === "ai_generated" ? "AI" : "Upload"}
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
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const [tab, setTab] = useState<AIStudioTab>(initialTab);
  const [prefillMedia, setPrefillMedia] = useState<PrefillMedia>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate posts, plan calendars, and teach the AI about your brand.
          </p>
        </div>

        {!orgId && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            Sign in with a workspace to use AI Studio.
          </div>
        )}

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as AIStudioTab)}
          className="space-y-6"
        >
          <TabsList className="bg-muted/60 p-1">
            <TabsTrigger value="generate" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> AI Generate
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

          <TabsContent value="generate">
            <GenerateTab
              orgId={orgId}
              prefillMedia={prefillMedia}
              onClearMedia={() => setPrefillMedia(null)}
            />
          </TabsContent>
          <TabsContent value="planner">
            <PlannerTab orgId={orgId} />
          </TabsContent>
          <TabsContent value="brand">
            <BrandTab orgId={orgId} />
          </TabsContent>
          <TabsContent value="media">
            <MediaTab
              orgId={orgId}
              onUseInGenerate={(asset) => {
                setPrefillMedia({
                  name: asset.prompt?.slice(0, 48) || asset.id.slice(0, 8),
                  url: asset.url,
                  mediaType: asset.mediaType,
                });
                setTab("generate");
                toast.success("Media attached — jump to AI Generate");
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
