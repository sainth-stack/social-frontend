"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { selectUser } from "@/features/auth/authSlice";
import { useAppSelector } from "@/store/hooks";
import type { SocialSettings } from "@/types/social-media.types";

type Section = "general" | "schedule" | "ai" | "approval" | "notifications";

const TITLES: Record<Section, { title: string; subtitle: string }> = {
  general: { title: "Social Settings", subtitle: "General social media settings" },
  schedule: {
    title: "Posting Schedule",
    subtitle: "Default posting times and blackouts",
  },
  ai: { title: "AI Configuration", subtitle: "AI generation defaults" },
  approval: { title: "Approval Workflow", subtitle: "Post approval settings" },
  notifications: {
    title: "Notifications",
    subtitle: "Social media notification preferences",
  },
};

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export default function SocialSettingsForm({ section }: { section: Section }) {
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
      toast.success("Settings saved");
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
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
          <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
        </header>
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
          <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
        </div>
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </header>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {section === "general" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General</CardTitle>
            <CardDescription>Timezone, language, and platforms.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select value={form.timezone} onValueChange={(v) => patch("timezone", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default language</Label>
              <Select
                value={form.defaultLanguage}
                onValueChange={(v) => patch("defaultLanguage", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="te">Telugu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Enabled platforms</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["facebook", "instagram", "linkedin", "x"] as const).map((p) => (
                  <label
                    key={p}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm capitalize"
                  >
                    {p === "x" ? "X" : p}
                    <Switch
                      checked={Boolean(form.enabledPlatforms?.[p])}
                      onCheckedChange={(checked) =>
                        patch("enabledPlatforms", {
                          ...form.enabledPlatforms,
                          [p]: checked,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {section === "schedule" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Posting schedule</CardTitle>
            <CardDescription>
              Default slot times and dates when publishing should pause.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Queue gap (minutes)</Label>
              <Input
                type="number"
                className="max-w-xs"
                value={form.queueGapMinutes}
                onChange={(e) => patch("queueGapMinutes", Number(e.target.value))}
              />
            </div>
            {DAYS.map((day) => (
              <div key={day} className="space-y-1.5">
                <Label>{day.toUpperCase()} times (comma-separated HH:MM)</Label>
                <Input
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
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Blackout dates (comma-separated YYYY-MM-DD)</Label>
              <Input
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
            </div>
          </CardContent>
        </Card>
      ) : null}

      {section === "ai" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI defaults</CardTitle>
            <CardDescription>Defaults used when generating captions and images.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Default tone</Label>
                <Input
                  value={form.defaultTone}
                  onChange={(e) => patch("defaultTone", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Default CTA</Label>
                <Input
                  value={form.defaultCta}
                  onChange={(e) => patch("defaultCta", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hashtag count</Label>
                <Input
                  type="number"
                  value={form.hashtagCount}
                  onChange={(e) => patch("hashtagCount", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Image style</Label>
                <Select
                  value={form.imageGenerationStyle}
                  onValueChange={(v) => patch("imageGenerationStyle", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Photographic">Photographic</SelectItem>
                    <SelectItem value="Illustrated">Illustrated</SelectItem>
                    <SelectItem value="Minimal">Minimal</SelectItem>
                    <SelectItem value="Brand">Brand</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Model</Label>
                <Select
                  value={form.openaiModel}
                  onValueChange={(v) => patch("openaiModel", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                    <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              Auto first comment
              <Switch
                checked={form.autoFirstComment}
                onCheckedChange={(checked) => patch("autoFirstComment", checked)}
              />
            </label>
            <div className="space-y-1.5">
              <Label>System prompt override</Label>
              <Textarea
                rows={3}
                value={form.systemPromptOverride || ""}
                onChange={(e) => patch("systemPromptOverride", e.target.value || null)}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {section === "approval" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval workflow</CardTitle>
            <CardDescription>Require review before posts go live.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              Require approval before publishing
              <Switch
                checked={form.approvalRequired}
                onCheckedChange={(checked) => patch("approvalRequired", checked)}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Approval SLA (hours)</Label>
                <Input
                  type="number"
                  value={form.approvalSlaHours}
                  onChange={(e) => patch("approvalSlaHours", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>SLA action</Label>
                <Select
                  value={form.approvalSlaAction}
                  onValueChange={(v) => patch("approvalSlaAction", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Remind only</SelectItem>
                    <SelectItem value="auto_approve">Auto-approve</SelectItem>
                    <SelectItem value="auto_reject">Auto-reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Approver user IDs (comma-separated)</Label>
              <Input
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
              <p className="text-[11px] text-muted-foreground">
                Paste user UUIDs from Team permissions.
              </p>
            </div>
            {form.usage && !form.usage.approvalWorkflow ? (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Approval workflow requires Growth or Growth plan.
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {section === "notifications" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notification events</CardTitle>
            <CardDescription>Choose delivery and which events notify you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Delivery</Label>
              <Select
                value={form.notificationDelivery}
                onValueChange={(v) => patch("notificationDelivery", v)}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_app">In-app</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="divide-y divide-border">
              {(
                [
                  ["post_published", "Post published"],
                  ["post_failed", "Post failed"],
                  ["token_expired", "Token expired"],
                  ["approval_requested", "Approval requested"],
                  ["approval_resolved", "Approval approved/rejected"],
                  ["analytics_weekly", "Weekly analytics report"],
                ] as const
              ).map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <p className="text-sm font-medium">{label}</p>
                  <Switch
                    checked={Boolean(form.notificationEvents?.[key])}
                    onCheckedChange={(checked) =>
                      patch("notificationEvents", {
                        ...form.notificationEvents,
                        [key]: checked,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
