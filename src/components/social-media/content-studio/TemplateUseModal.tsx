"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { Alert, Box, Chip, Stack, Typography } from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";
import AppTextarea from "@/components/ui/AppTextarea";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { selectBrandVoice } from "@/features/social-media/socialSettingsSlice";
import { fetchBrandVoice } from "@/features/social-media/socialSettingsThunks";
import { enqueueToast } from "@/features/ui/uiSlice";
import { colors, surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { SocialTemplate } from "@/types/social-media.types";
import { PLATFORM_LABELS } from "@/types/social-media.types";

const GOAL_LABELS: Record<string, string> = {
  lead_gen: "Lead Generation",
  trust: "Trust & Proof",
  conversion: "Conversion",
  awareness: "Awareness",
  general: "General",
};

type TemplateUseModalProps = {
  open: boolean;
  template: SocialTemplate | null;
  orgId: string;
  onClose: () => void;
};

export function templateApplyStorageKey(orgId: string, templateId: string) {
  return `socialTemplateApply:${orgId}:${templateId}`;
}

export default function TemplateUseModal({ open, template, orgId, onClose }: TemplateUseModalProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const brandVoice = useAppSelector(selectBrandVoice);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    void dispatch(fetchBrandVoice(orgId));
  }, [dispatch, orgId]);

  const placeholders = useMemo(() => template?.placeholders ?? [], [template]);

  useEffect(() => {
    if (!template || !open) return;
    const initial: Record<string, string> = {};
    for (const ph of placeholders) {
      if (ph.key === "company_name" && brandVoice?.brandName) {
        initial[ph.key] = brandVoice.brandName;
      } else if (ph.example) {
        initial[ph.key] = ph.example;
      } else {
        initial[ph.key] = "";
      }
    }
    setValues(initial);
    setError(null);
  }, [template, open, placeholders, brandVoice?.brandName]);

  const handleGenerate = async () => {
    if (!template || !orgId) return;

    const missing = placeholders.filter(
      (ph) => ph.required && !String(values[ph.key] ?? "").trim(),
    );
    if (missing.length) {
      setError(`Please fill: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await socialMediaApi.applyTemplate(orgId, template.id, values);
      sessionStorage.setItem(
        templateApplyStorageKey(orgId, template.id),
        JSON.stringify(result),
      );
      onClose();
      router.push(
        `/dashboard/content-studio/generate?templateId=${template.id}`,
      );
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      setError(typeof detail === "string" ? detail : "Failed to apply template");
    } finally {
      setSubmitting(false);
    }
  };

  if (!template) return null;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={`Use: ${template.name}`}
      maxWidth="md"
      footer={
        <>
          <AppButton variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </AppButton>
          <AppButton
            variant="primary"
            onClick={() => void handleGenerate()}
            loading={submitting}
            leftIcon={<AutoAwesomeOutlinedIcon />}
          >
            Generate Post
          </AppButton>
        </>
      }
    >
      <Stack spacing={2.5}>
        <Box sx={{ ...surfaceSx, p: 2, bgcolor: colors.background }}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
            <Chip size="small" label={template.category} color="primary" variant="outlined" />
            {template.goal && (
              <Chip
                size="small"
                label={GOAL_LABELS[template.goal] ?? template.goal}
                variant="outlined"
              />
            )}
            {template.platforms.map((p) => (
              <Chip key={p} size="small" label={PLATFORM_LABELS[p] ?? p} />
            ))}
            {template.generateImage && (
              <Chip
                size="small"
                icon={<ImageOutlinedIcon sx={{ fontSize: 14 }} />}
                label="AI Image"
                variant="outlined"
              />
            )}
          </Stack>
          {template.description && (
            <Typography variant="body2" color="text.secondary">
              {template.description}
            </Typography>
          )}
        </Box>

        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Fill in your details — AI will create platform-native posts
          {template.generateImage ? " and generate an image" : ""}.
        </Typography>

        {placeholders.length === 0 ? (
          <AppTextarea
            label="Post content"
            minRows={6}
            value={values.content ?? template.captionTemplate}
            onChange={(e) => setValues((v) => ({ ...v, content: e.target.value }))}
          />
        ) : (
          placeholders.map((ph) => (
            <AppInput
              key={ph.key}
              label={ph.label}
              required={ph.required}
              value={values[ph.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [ph.key]: e.target.value }))}
              placeholder={ph.example}
            />
          ))
        )}

        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </AppModal>
  );
}

export { GOAL_LABELS };
