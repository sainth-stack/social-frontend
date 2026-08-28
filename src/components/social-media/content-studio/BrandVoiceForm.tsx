"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Chip, CircularProgress, Stack, Typography } from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppTextarea from "@/components/ui/AppTextarea";
import FormSection from "@/components/ui/FormSection";
import PageHeader from "@/components/ui/PageHeader";
import { selectUser } from "@/features/auth/authSlice";
import {
  selectBrandVoice,
  selectBrandVoiceLoading,
  selectBrandVoiceSaving,
  selectBrandVoiceTesting,
  selectBrandVoiceTestSample,
  selectSocialSettingsError,
} from "@/features/social-media/socialSettingsSlice";
import {
  fetchBrandVoice,
  saveBrandVoice,
  testBrandVoice,
} from "@/features/social-media/socialSettingsThunks";
import { enqueueToast } from "@/features/ui/uiSlice";
import { colors, surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { BrandVoicePayload, EmojiUsage, SentenceLength } from "@/types/social-media.types";

const TONE_OPTIONS = [
  "Professional",
  "Warm",
  "Authoritative",
  "Playful",
  "Direct",
  "Inspiring",
];

const emptyForm: BrandVoicePayload = {
  brandName: "",
  industry: "",
  tagline: "",
  targetAudience: "",
  tones: ["Professional"],
  wordsToUse: [],
  wordsToAvoid: [],
  ctaPhrases: [],
  sentenceLength: "medium",
  emojiUsage: "sometimes",
  primaryLanguage: "en",
  systemPromptOverride: null,
};

function listToText(items: string[]): string {
  return items.join(", ");
}

function textToList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function BrandVoiceForm() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const brandVoice = useAppSelector(selectBrandVoice);
  const loading = useAppSelector(selectBrandVoiceLoading);
  const saving = useAppSelector(selectBrandVoiceSaving);
  const testing = useAppSelector(selectBrandVoiceTesting);
  const testSample = useAppSelector(selectBrandVoiceTestSample);
  const error = useAppSelector(selectSocialSettingsError);

  const [form, setForm] = useState<BrandVoicePayload>(emptyForm);

  useEffect(() => {
    if (orgId) void dispatch(fetchBrandVoice(orgId));
  }, [dispatch, orgId]);

  useEffect(() => {
    if (!brandVoice) return;
    setForm({
      brandName: brandVoice.brandName,
      industry: brandVoice.industry,
      tagline: brandVoice.tagline,
      targetAudience: brandVoice.targetAudience,
      tones: brandVoice.tones.length ? brandVoice.tones : ["Professional"],
      wordsToUse: brandVoice.wordsToUse,
      wordsToAvoid: brandVoice.wordsToAvoid,
      ctaPhrases: brandVoice.ctaPhrases,
      sentenceLength: brandVoice.sentenceLength,
      emojiUsage: brandVoice.emojiUsage,
      primaryLanguage: brandVoice.primaryLanguage,
      systemPromptOverride: brandVoice.systemPromptOverride,
    });
  }, [brandVoice]);

  const patch = <K extends keyof BrandVoicePayload>(key: K, value: BrandVoicePayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTone = (tone: string) => {
    setForm((prev) => ({
      ...prev,
      tones: prev.tones.includes(tone)
        ? prev.tones.filter((t) => t !== tone)
        : [...prev.tones, tone],
    }));
  };

  const handleSave = async () => {
    try {
      await dispatch(saveBrandVoice({ orgId, payload: form })).unwrap();
      dispatch(enqueueToast({ message: "Brand voice saved", severity: "success" }));
    } catch (err) {
      dispatch(
        enqueueToast({
          message: typeof err === "string" ? err : "Failed to save",
          severity: "error",
        }),
      );
    }
  };

  const handleTest = async () => {
    try {
      await dispatch(testBrandVoice({ orgId, payload: form })).unwrap();
    } catch (err) {
      dispatch(
        enqueueToast({
          message: typeof err === "string" ? err : "Test failed",
          severity: "error",
        }),
      );
    }
  };

  if (loading && !brandVoice) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Brand Voice"
        subtitle="Configure how AI writes for your brand"
        primaryAction={
          <AppButton variant="primary" loading={saving} onClick={() => void handleSave()}>
            Save
          </AppButton>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ ...surfaceSx, p: 3, mb: 2 }}>
        <FormSection title="Identity" description="Who you are and who you speak to">
          <AppInput
            label="Brand name"
            value={form.brandName}
            onChange={(e) => patch("brandName", e.target.value)}
          />
          <AppInput
            label="Industry"
            value={form.industry}
            onChange={(e) => patch("industry", e.target.value)}
          />
          <AppInput
            label="Tagline"
            value={form.tagline}
            onChange={(e) => patch("tagline", e.target.value)}
          />
          <AppTextarea
            label="Target audience"
            minRows={2}
            value={form.targetAudience}
            onChange={(e) => patch("targetAudience", e.target.value)}
          />
        </FormSection>

        <FormSection title="Tone of voice">
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {TONE_OPTIONS.map((tone) => (
              <Chip
                key={tone}
                label={tone}
                clickable
                color={form.tones.includes(tone) ? "primary" : "default"}
                variant={form.tones.includes(tone) ? "filled" : "outlined"}
                onClick={() => toggleTone(tone)}
              />
            ))}
          </Stack>
        </FormSection>

        <FormSection title="Language rules">
          <AppInput
            label="Words to always use"
            helperText="Comma-separated"
            value={listToText(form.wordsToUse)}
            onChange={(e) => patch("wordsToUse", textToList(e.target.value))}
          />
          <AppInput
            label="Words to avoid"
            helperText="Comma-separated"
            value={listToText(form.wordsToAvoid)}
            onChange={(e) => patch("wordsToAvoid", textToList(e.target.value))}
          />
          <AppInput
            label="Preferred CTA phrases"
            helperText="Comma-separated"
            value={listToText(form.ctaPhrases)}
            onChange={(e) => patch("ctaPhrases", textToList(e.target.value))}
          />
        </FormSection>

        <FormSection title="Writing style">
          <AppSelect
            label="Sentence length"
            value={form.sentenceLength}
            onChange={(e) => patch("sentenceLength", e.target.value as SentenceLength)}
            options={[
              { value: "short", label: "Short" },
              { value: "medium", label: "Medium" },
              { value: "long", label: "Long" },
            ]}
          />
          <AppSelect
            label="Emoji usage"
            value={form.emojiUsage}
            onChange={(e) => patch("emojiUsage", e.target.value as EmojiUsage)}
            options={[
              { value: "never", label: "Never" },
              { value: "sometimes", label: "Sometimes" },
              { value: "often", label: "Often" },
            ]}
          />
          <AppSelect
            label="Primary language"
            value={form.primaryLanguage}
            onChange={(e) => patch("primaryLanguage", String(e.target.value))}
            options={[
              { value: "en", label: "English" },
              { value: "te", label: "Telugu" },
              { value: "hi", label: "Hindi" },
              { value: "other", label: "Other" },
            ]}
          />
        </FormSection>

        <FormSection title="Sample post" description="Test the current settings">
          <AppButton variant="secondary" loading={testing} onClick={() => void handleTest()}>
            Test Brand Voice
          </AppButton>
          {testSample && (
            <Box
              sx={{
                mt: 1,
                p: 2,
                borderRadius: "10px",
                bgcolor: colors.background,
                border: `1px solid ${colors.border}`,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Sample ({testSample.platform})
              </Typography>
              <Typography sx={{ whiteSpace: "pre-wrap", mt: 0.5, fontSize: "0.875rem" }}>
                {testSample.caption}
              </Typography>
              {testSample.hashtags.length > 0 && (
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
                  {testSample.hashtags.map((tag) => (
                    <Chip key={tag} size="small" label={`#${tag}`} />
                  ))}
                </Stack>
              )}
            </Box>
          )}
        </FormSection>
      </Box>
    </Box>
  );
}
