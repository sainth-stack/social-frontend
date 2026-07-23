"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Stack, Typography } from "@mui/material";

import AppButton from "@/components/ui/AppButton";
import AppCheckbox from "@/components/ui/AppCheckbox";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppTextarea from "@/components/ui/AppTextarea";
import FormSection from "@/components/ui/FormSection";
import PageHeader from "@/components/ui/PageHeader";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { selectUser } from "@/features/auth/authSlice";
import { enqueueToast } from "@/features/ui/uiSlice";
import { formContainerWideSx, surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { SocialSettings } from "@/types/social-media.types";

type Section =
  | "general"
  | "schedule"
  | "ai"
  | "approval"
  | "notifications";

const TITLES: Record<Section, { title: string; subtitle: string }> = {
  general: { title: "Social Settings", subtitle: "General social media settings" },
  schedule: { title: "Posting Schedule", subtitle: "Default posting times and blackouts" },
  ai: { title: "AI Configuration", subtitle: "AI generation defaults" },
  approval: { title: "Approval Workflow", subtitle: "Post approval settings" },
  notifications: { title: "Notifications", subtitle: "Social media notification preferences" },
};

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export default function SocialSettingsForm({ section }: { section: Section }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";
  const [form, setForm] = useState<SocialSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = TITLES[section];

  useEffect(() => {
    if (!orgId) return;
    void socialMediaApi
      .getSettings(orgId)
      .then(setForm)
      .catch(() => setError("Failed to load settings"));
  }, [orgId]);

  const patch = <K extends keyof SocialSettings>(key: K, value: SocialSettings[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!orgId || !form) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await socialMediaApi.saveSettings(orgId, form);
      setForm(saved);
      dispatch(enqueueToast({ message: "Settings saved", severity: "success" }));
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail;
      const message =
        typeof detail === "object" && detail && "message" in detail
          ? String((detail as { message: string }).message)
          : typeof detail === "string"
            ? detail
            : "Failed to save settings";
      setError(message);
      dispatch(enqueueToast({ message, severity: "error" }));
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <Box>
        <PageHeader title={meta.title} subtitle={meta.subtitle} />
        {error && <Alert severity="error">{error}</Alert>}
        <Typography color="text.secondary">Loading…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={formContainerWideSx}>
      <PageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        primaryAction={
          <AppButton variant="primary" loading={saving} onClick={() => void save()}>
            Save
          </AppButton>
        }
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ ...surfaceSx, p: 3 }}>
        {section === "general" && (
          <FormSection title="General">
            <AppSelect
              label="Timezone"
              value={form.timezone}
              onChange={(e) => patch("timezone", String(e.target.value))}
              options={[
                { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
                { value: "UTC", label: "UTC" },
                { value: "America/New_York", label: "America/New_York" },
              ]}
            />
            <AppSelect
              label="Default language"
              value={form.defaultLanguage}
              onChange={(e) => patch("defaultLanguage", String(e.target.value))}
              options={[
                { value: "en", label: "English" },
                { value: "hi", label: "Hindi" },
                { value: "te", label: "Telugu" },
              ]}
            />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Enabled platforms
            </Typography>
            <Stack spacing={0.25}>
              {(["facebook", "instagram", "linkedin", "x"] as const).map((p) => (
                <AppCheckbox
                  key={p}
                  size="small"
                  checked={Boolean(form.enabledPlatforms?.[p])}
                  onChange={(e) =>
                    patch("enabledPlatforms", {
                      ...form.enabledPlatforms,
                      [p]: e.target.checked,
                    })
                  }
                  label={p}
                />
              ))}
            </Stack>
          </FormSection>
        )}

        {section === "schedule" && (
          <FormSection title="Posting schedule">
            <AppInput
              type="number"
              label="Queue gap (minutes)"
              value={form.queueGapMinutes}
              onChange={(e) => patch("queueGapMinutes", Number(e.target.value))}
            />
            {DAYS.map((day) => (
              <AppInput
                key={day}
                label={`${day.toUpperCase()} times (comma-separated HH:MM)`}
                value={(form.defaultPostingTimes?.[day] || []).join(", ")}
                onChange={(e) =>
                  patch("defaultPostingTimes", {
                    ...form.defaultPostingTimes,
                    [day]: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            ))}
            <AppInput
              label="Blackout dates (comma-separated YYYY-MM-DD)"
              value={(form.blackoutDates || []).join(", ")}
              onChange={(e) =>
                patch(
                  "blackoutDates",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </FormSection>
        )}

        {section === "ai" && (
          <FormSection title="AI defaults">
            <AppInput
              label="Default tone"
              value={form.defaultTone}
              onChange={(e) => patch("defaultTone", e.target.value)}
            />
            <AppInput
              label="Default CTA"
              value={form.defaultCta}
              onChange={(e) => patch("defaultCta", e.target.value)}
            />
            <AppInput
              type="number"
              label="Hashtag count"
              value={form.hashtagCount}
              onChange={(e) => patch("hashtagCount", Number(e.target.value))}
            />
            <AppCheckbox
              size="small"
              checked={form.autoFirstComment}
              onChange={(e) => patch("autoFirstComment", e.target.checked)}
              label="Auto first comment"
            />
            <AppSelect
              label="Image style"
              value={form.imageGenerationStyle}
              onChange={(e) => patch("imageGenerationStyle", String(e.target.value))}
              options={[
                { value: "Photographic", label: "Photographic" },
                { value: "Illustrated", label: "Illustrated" },
                { value: "Minimal", label: "Minimal" },
                { value: "Brand", label: "Brand" },
              ]}
            />
            <AppSelect
              label="Model"
              value={form.openaiModel}
              onChange={(e) => patch("openaiModel", String(e.target.value))}
              options={[
                { value: "gpt-4o-mini", label: "gpt-4o-mini" },
                { value: "gpt-4o", label: "gpt-4o" },
              ]}
            />
            <AppTextarea
              label="System prompt override"
              minRows={3}
              value={form.systemPromptOverride || ""}
              onChange={(e) => patch("systemPromptOverride", e.target.value || null)}
            />
          </FormSection>
        )}

        {section === "approval" && (
          <FormSection title="Approval workflow">
            <AppCheckbox
              size="small"
              checked={form.approvalRequired}
              onChange={(e) => patch("approvalRequired", e.target.checked)}
              label="Require approval before publishing"
            />
            <AppInput
              type="number"
              label="Approval SLA (hours)"
              value={form.approvalSlaHours}
              onChange={(e) => patch("approvalSlaHours", Number(e.target.value))}
            />
            <AppSelect
              label="SLA action"
              value={form.approvalSlaAction}
              onChange={(e) => patch("approvalSlaAction", String(e.target.value))}
              options={[
                { value: "none", label: "Remind only" },
                { value: "auto_approve", label: "Auto-approve" },
                { value: "auto_reject", label: "Auto-reject" },
              ]}
            />
            <AppInput
              label="Approver user IDs (comma-separated)"
              helperText="Paste user UUIDs from Team permissions"
              value={(form.approverUserIds || []).join(", ")}
              onChange={(e) =>
                patch(
                  "approverUserIds",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
            {form.usage && !form.usage.approvalWorkflow && (
              <Alert severity="info">
                Approval workflow requires Growth or Enterprise plan.
              </Alert>
            )}
          </FormSection>
        )}

        {section === "notifications" && (
          <FormSection title="Notification events">
            <AppSelect
              label="Delivery"
              value={form.notificationDelivery}
              onChange={(e) => patch("notificationDelivery", String(e.target.value))}
              options={[
                { value: "in_app", label: "In-app" },
                { value: "email", label: "Email" },
                { value: "both", label: "Both" },
              ]}
            />
            <Stack spacing={0.25}>
              {[
                ["post_published", "Post published"],
                ["post_failed", "Post failed"],
                ["token_expired", "Token expired"],
                ["approval_requested", "Approval requested"],
                ["approval_resolved", "Approval approved/rejected"],
                ["analytics_weekly", "Weekly analytics report"],
              ].map(([key, label]) => (
                <AppCheckbox
                  key={key}
                  size="small"
                  checked={Boolean(form.notificationEvents?.[key])}
                  onChange={(e) =>
                    patch("notificationEvents", {
                      ...form.notificationEvents,
                      [key]: e.target.checked,
                    })
                  }
                  label={label}
                />
              ))}
            </Stack>
          </FormSection>
        )}
      </Box>
    </Box>
  );
}
