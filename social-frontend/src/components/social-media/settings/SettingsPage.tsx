"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Moon, Save, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { selectUser } from "@/features/auth/authSlice";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";
import { useAppSelector } from "@/store/hooks";
import type { SocialSettings } from "@/types/social-media.types";
import SettingsShell, { type SettingsSection } from "./SettingsShell";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const TIMEZONES = ["Asia/Kolkata", "UTC", "America/Los_Angeles", "America/New_York", "Europe/London", "Europe/Berlin", "Asia/Singapore", "Asia/Tokyo"];
const EVENTS = [
  ["post_published", "Publishing notifications", "When posts publish successfully."],
  ["post_failed", "Failure alerts", "When posts fail to publish."],
  ["token_expired", "Token expiry", "When a connected account token expires."],
  ["approval_requested", "Approval requests", "When a post needs review."],
  ["approval_resolved", "Approval decisions", "When a post is approved or rejected."],
  ["analytics_weekly", "Weekly reports", "A weekly summary of engagement."],
] as const;
const META: Record<SettingsSection, [string, string]> = {
  general: ["General", "Workspace essentials and the channels you publish to."],
  notifications: ["Notifications", "Choose which events reach your team and how they are delivered."],
  appearance: ["Appearance", "A comfortable workspace, on this device only."],
  schedule: ["Posting schedule", "Set your default publishing rhythm and blackout dates."],
  ai: ["AI defaults", "Your starting point for captions, calls to action, and images."],
  approval: ["Approval workflow", "Give your team a clear review process before publishing."],
};

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

function Choice({ id, value, options, onChange, hint }: { id: string; value: string; options: readonly (string | readonly [string, string])[]; onChange: (value: string) => void; hint?: boolean }) {
  const values = options.map((option) => typeof option === "string" ? [option, option] : option);
  if (value && !values.some(([key]) => key === value)) values.push([value, value]);
  return <Select value={value} onValueChange={onChange}><SelectTrigger id={id} aria-describedby={hint ? `${id}-hint` : undefined}><SelectValue /></SelectTrigger><SelectContent>{values.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>;
}

function Toggle({ id, label, description, checked, onChange }: { id: string; label: string; description?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4"><div><Label htmlFor={id}>{label}</Label>{description && <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">{description}</p>}</div><Switch id={id} aria-describedby={description ? `${id}-hint` : undefined} checked={checked} onCheckedChange={onChange} /></div>;
}

const split = (value: string) => value.split(",").map((part) => part.trim()).filter(Boolean);
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default function SettingsPage({ section }: { section?: SettingsSection }) {
  const user = useAppSelector(selectUser);
  return <WorkspaceSettings key={user?.workspaceId ?? "no-workspace"} section={section} />;
}

function WorkspaceSettings({ section: explicitSection }: { section?: SettingsSection }) {
  const user = useAppSelector(selectUser);
  const params = useSearchParams();
  const tab = params.get("tab");
  const section = explicitSection ?? (tab === "notifications" || tab === "appearance" ? tab : "general");
  const { form, loading, error, saveError, saving, dirty, canEdit, patch, save, reset, reload } = useWorkspaceSettings();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeError, setThemeError] = useState<string | null>(null);
  const [submitRequested, setSubmitRequested] = useState(false);
  const savingRef = useRef(false);
  const alive = useRef(true);
  const hasDrafts = Object.keys(drafts).length > 0;
  const discard = () => { setDrafts({}); setValidation(null); reset(); };

  useEffect(() => { setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light"); }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!submitRequested) return;
    setSubmitRequested(false);
    void save().then((success: boolean) => {
      if (success && alive.current) { setDrafts({}); toast.success("Settings saved"); }
    }).catch(() => { if (alive.current) setValidation("Settings could not be saved. Your draft is preserved; try saving again."); }).finally(() => { savingRef.current = false; });
  }, [submitRequested, save]);

  const commitDrafts = () => {
    if (!form) return false;
    const times = { ...form.defaultPostingTimes };
    for (const day of DAYS) {
      if (!(day in drafts)) continue;
      const values = split(drafts[day]);
      if (values.some((value) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) {
        setValidation(`${day.toUpperCase()} times must use HH:MM (00:00–23:59).`);
        return false;
      }
      times[day] = values;
    }
    if ("blackoutDates" in drafts && split(drafts.blackoutDates).some((value) => !validDate(value))) {
      setValidation("Blackout dates must be valid dates in YYYY-MM-DD format.");
      return false;
    }
    if (DAYS.some((day) => day in drafts)) patch("defaultPostingTimes", times);
    if ("blackoutDates" in drafts) patch("blackoutDates", split(drafts.blackoutDates));
    if ("approverUserIds" in drafts) patch("approverUserIds", split(drafts.approverUserIds));
    setValidation(null);
    return true;
  };

  const submit = () => {
    if (savingRef.current || saving || !canEdit || !form || !commitDrafts()) return;
    savingRef.current = true;
    setSubmitRequested(true);
  };
  const rawInput = (key: string, value: string[], label: string, hint: string) => <Field id={`settings-${key}`} label={label} hint={hint}><Input id={`settings-${key}`} aria-describedby={`settings-${key}-hint`} value={drafts[key] ?? value.join(", ")} onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))} onBlur={commitDrafts} /></Field>;
  const textInput = (key: "defaultTone" | "defaultCta", label: string) => <Field id={key} label={label}><Input id={key} value={form?.[key] ?? ""} onChange={(event) => patch(key, event.target.value)} /></Field>;
  const numberInput = (key: "queueGapMinutes" | "hashtagCount" | "approvalSlaHours", label: string) => <Field id={key} label={label}><Input id={key} type="number" step={1} required value={form?.[key] ?? 0} onChange={(event) => patch(key, Number(event.target.value))} /></Field>;
  const choice = (key: "timezone" | "defaultLanguage" | "notificationDelivery" | "imageGenerationStyle" | "openaiModel" | "approvalSlaAction", label: string, options: readonly (string | readonly [string, string])[], hint?: string) => <Field id={key} label={label} hint={hint}><Choice id={key} value={form?.[key] ?? ""} options={options} hint={Boolean(hint)} onChange={(value) => patch(key, value)} /></Field>;
  const [title, description] = META[section];
  const approvalLocked = form?.usage?.approvalWorkflow === false;

  return <SettingsShell section={section} dirty={dirty || hasDrafts} saving={saving} onDiscard={discard}>
    {section === "appearance" ? <Card><CardHeader><h2 className="text-lg font-semibold">{title}</h2><CardDescription>{description}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{(["light", "dark"] as const).map((value) => <Button key={value} type="button" variant={theme === value ? "default" : "outline"} aria-pressed={theme === value} className="h-24 gap-3" disabled={saving} onClick={() => {
      setTheme(value);
      document.documentElement.classList.toggle("dark", value === "dark");
      try { localStorage.setItem("opsbrain-theme", value); setThemeError(null); } catch { setThemeError("Theme applied for this visit. Your browser could not remember it on this device."); }
    }}>{value === "light" ? <Sun aria-hidden="true" className="h-5 w-5" /> : <Moon aria-hidden="true" className="h-5 w-5" />}{value === "light" ? "Light" : "Dark"}</Button>)}</div><p className="text-sm text-muted-foreground">Theme changes apply immediately and do not change workspace settings.</p>{themeError && <p role="status" className="text-sm text-muted-foreground">{themeError}</p>}</CardContent></Card> : <>
      {!user?.workspaceId ? <p role="status" className="rounded-xl border border-border p-6 text-sm text-muted-foreground">Select a workspace to view settings.</p> : loading ? <div role="status" aria-label="Loading settings" aria-busy="true" className="space-y-4 rounded-xl border border-border p-6"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-64 max-w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><span className="sr-only">Loading settings</span></div> : error ? <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6"><h2 className="font-semibold">Settings could not be loaded</h2><p className="text-sm">{error}</p><Button variant="outline" onClick={() => void reload()}>Retry loading settings</Button></div> : form ? <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="space-y-5">
        {!canEdit && <p role="status" className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Read-only access. Only workspace owners and social admins can edit workspace settings.</p>}
        <Card><CardHeader><h2 className="text-lg font-semibold">{title}</h2><CardDescription>{description}</CardDescription></CardHeader><CardContent>
          <fieldset disabled={saving || !canEdit} className="min-w-0 space-y-5">
            <legend className="sr-only">{title} settings</legend>
            {section === "general" && <>
              <Field id="workspaceName" label="Workspace name" hint="Managed by your EarnedVoice account. Contact your administrator to rename it."><Input id="workspaceName" value={user?.workspaceName ?? ""} disabled aria-describedby="workspaceName-hint" /></Field>
              <div className="grid gap-5 sm:grid-cols-2">{choice("timezone", "Timezone", TIMEZONES)}{choice("defaultLanguage", "Default language", [["en", "English"], ["hi", "Hindi"], ["te", "Telugu"]])}</div>
              <div className="space-y-3"><h3 className="text-sm font-medium">Enabled platforms</h3><div className="grid gap-3 sm:grid-cols-2">{(["facebook", "instagram", "linkedin", "x"] as const).map((platform) => <Toggle key={platform} id={`platform-${platform}`} label={platform === "x" ? "X" : platform[0].toUpperCase() + platform.slice(1)} checked={Boolean(form.enabledPlatforms?.[platform])} onChange={(value) => patch("enabledPlatforms", { ...form.enabledPlatforms, [platform]: value })} />)}</div></div>
            </>}
            {section === "notifications" && <>{choice("notificationDelivery", "Delivery", [["in_app", "In-app"], ["email", "Email"], ["both", "Both"]])}<div className="space-y-3">{EVENTS.map(([key, label, hint]) => <Toggle key={key} id={`event-${key}`} label={label} description={hint} checked={Boolean(form.notificationEvents?.[key])} onChange={(value) => patch("notificationEvents", { ...form.notificationEvents, [key]: value })} />)}</div></>}
            {section === "schedule" && <>
              {numberInput("queueGapMinutes", "Queue gap (minutes)")}
              <p className="text-sm text-muted-foreground">Times use your workspace timezone: {form.timezone}. Leave a day empty for no default slots.</p>
              <div className="grid gap-5 sm:grid-cols-2">{DAYS.map((day) => <div key={day}>{rawInput(day, form.defaultPostingTimes?.[day] ?? [], `${day.toUpperCase()} times`, "Comma-separated HH:MM, for example 09:00, 18:30.")}</div>)}</div>
              {rawInput("blackoutDates", form.blackoutDates ?? [], "Blackout dates", "Comma-separated YYYY-MM-DD dates when publishing should pause.")}
            </>}
            {section === "ai" && <>
              <div className="grid gap-5 sm:grid-cols-2">{textInput("defaultTone", "Default tone")}{textInput("defaultCta", "Default CTA")}{numberInput("hashtagCount", "Hashtag count")}{choice("imageGenerationStyle", "Image style", ["Photographic", "Illustrated", "Minimal", "Brand"])}</div>
              {choice("openaiModel", "Legacy model preference", ["gpt-4o-mini", "gpt-4o"], "Stored for compatibility only. AI generation uses backend-managed AWS Bedrock; this preference does not change the active provider or model.")}
              <Toggle id="autoFirstComment" label="Auto first comment" checked={form.autoFirstComment} onChange={(value) => patch("autoFirstComment", value)} />
              <Field id="systemPromptOverride" label="System prompt override" hint="Optional instructions for generated content."><Textarea id="systemPromptOverride" rows={5} value={form.systemPromptOverride ?? ""} aria-describedby="systemPromptOverride-hint" onChange={(event) => patch("systemPromptOverride", event.target.value || null)} /></Field>
            </>}
            {section === "approval" && <>
              {approvalLocked && <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Approval workflow is not included in your current plan. Upgrade to a plan that includes approval workflows to edit these settings.</p>}
              <fieldset disabled={approvalLocked} className="min-w-0 space-y-5"><legend className="sr-only">Approval rules</legend>
                <Toggle id="approvalRequired" label="Require approval before publishing" checked={form.approvalRequired} onChange={(value) => patch("approvalRequired", value)} />
                <div className="grid gap-5 sm:grid-cols-2">{numberInput("approvalSlaHours", "Approval SLA (hours)")}{choice("approvalSlaAction", "SLA action", [["none", "Remind only"], ["auto_approve", "Auto-approve"], ["auto_reject", "Auto-reject"]])}</div>
                {rawInput("approverUserIds", form.approverUserIds ?? [], "Approver user IDs", "Enter comma-separated workspace user IDs. Find IDs under Team permissions. Existing IDs are preserved; this does not invite new members.")}
                {form.approvalRequired && !(drafts.approverUserIds !== undefined ? split(drafts.approverUserIds).length : form.approverUserIds?.length) && <p role="status" className="text-sm text-muted-foreground">No approvers selected. Add workspace user IDs so your team knows who should review posts.</p>}
              </fieldset>
            </>}
          </fieldset>
        </CardContent></Card>
        {validation && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{validation}</p>}
        {saveError && <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><p>{saveError}</p><Button type="submit" variant="outline" disabled={saving || !canEdit}>Retry saving settings</Button></div>}
        {(dirty || hasDrafts || saving) && <footer className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"><p role="status" className="text-sm text-muted-foreground">{saving ? "Saving your changes…" : "You have unsaved changes"}</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={saving || !canEdit} onClick={discard}>Reset changes</Button><Button type="submit" disabled={saving || !canEdit}><Save aria-hidden="true" className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save changes"}</Button></div></footer>}
      </form> : <div role="status" className="space-y-3 rounded-xl border border-border p-6"><p>No settings are available for this workspace.</p><Button variant="outline" onClick={() => void reload()}>Reload settings</Button></div>}
    </>}
  </SettingsShell>;
}
