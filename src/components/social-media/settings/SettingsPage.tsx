"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Moon, Save, Sun } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { selectUser } from "@/features/auth/authSlice";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store/hooks";
import type { SocialSettings } from "@/types/social-media.types";

const SETTINGS_TABS = ["general", "notifications", "appearance"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function parseSettingsTab(value: string | null): SettingsTab {
  if (value && (SETTINGS_TABS as readonly string[]).includes(value)) {
    return value as SettingsTab;
  }
  return "general";
}

const TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Singapore",
  "Asia/Tokyo",
];

const NOTIFICATION_ROWS: { key: string; label: string; desc: string }[] = [
  {
    key: "post_published",
    label: "Publishing notifications",
    desc: "When posts publish successfully.",
  },
  {
    key: "post_failed",
    label: "Failure alerts",
    desc: "When posts fail to publish.",
  },
  {
    key: "analytics_weekly",
    label: "Weekly reports",
    desc: "A summary of engagement every Monday.",
  },
  {
    key: "token_expired",
    label: "Token expiry",
    desc: "When a connected account token expires.",
  },
  {
    key: "approval_requested",
    label: "Approval requests",
    desc: "When a post needs your approval.",
  },
];

export default function SettingsPage() {
  const user = useAppSelector(selectUser);
  const workspaceId = user?.workspaceId ?? "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>(() =>
    parseSettingsTab(searchParams.get("tab")),
  );
  const [form, setForm] = useState<SocialSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTab(parseSettingsTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    void socialMediaApi
      .getSettings(workspaceId)
      .then(setForm)
      .catch(() => toast.error("Failed to load settings"));
  }, [workspaceId]);

  const patch = <K extends keyof SocialSettings>(key: K, value: SocialSettings[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!workspaceId || !form) return;
    setSaving(true);
    try {
      const saved = await socialMediaApi.saveSettings(workspaceId, form);
      setForm(saved);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your workspace, notifications, and appearance.
          </p>
        </header>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your workspace, notifications, and appearance.
          </p>
        </div>
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = parseSettingsTab(value);
          setTab(next);
          const params = new URLSearchParams(searchParams.toString());
          if (next === "general") params.delete("tab");
          else params.set("tab", next);
          const qs = params.toString();
          router.replace(qs ? `/dashboard/settings?${qs}` : "/dashboard/settings");
        }}
      >
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">General</CardTitle>
              <CardDescription>Basic workspace information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Workspace name</Label>
                  <Input value={user?.workspaceName ?? ""} disabled />
                  <p className="text-[11px] text-muted-foreground">
                    Managed by your OpsBrain account — contact admin to rename.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Select
                    value={form.timezone}
                    onValueChange={(v) => patch("timezone", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Default language</Label>
                <Select
                  value={form.defaultLanguage}
                  onValueChange={(v) => patch("defaultLanguage", v)}
                >
                  <SelectTrigger className="max-w-xs">
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

              <div className="flex justify-end">
                <Button size="sm" disabled={saving} onClick={() => void save()}>
                  <Save className="mr-2 h-4 w-4" /> Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notifications</CardTitle>
              <CardDescription>Choose what we notify you about.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
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
                {NOTIFICATION_ROWS.map((r) => (
                  <div
                    key={r.key}
                    className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </div>
                    <Switch
                      checked={Boolean(form.notificationEvents?.[r.key])}
                      onCheckedChange={(checked) =>
                        patch("notificationEvents", {
                          ...form.notificationEvents,
                          [r.key]: checked,
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button size="sm" disabled={saving} onClick={() => void save()}>
                  <Save className="mr-2 h-4 w-4" /> Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appearance</CardTitle>
              <CardDescription>Choose your preferred theme (this device).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid max-w-sm grid-cols-2 gap-3">
                {(["light", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTheme(t);
                      document.documentElement.classList.toggle("dark", t === "dark");
                      try {
                        localStorage.setItem("opsbrain-theme", t);
                      } catch {
                        /* ignore */
                      }
                      toast.success(`${t === "light" ? "Light" : "Dark"} theme applied`);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-4 text-sm font-medium capitalize transition-all",
                      theme === t
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    {t === "light" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                    {t}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
