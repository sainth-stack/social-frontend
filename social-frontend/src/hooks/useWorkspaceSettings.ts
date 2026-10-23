"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { selectUser } from "@/features/auth/authSlice";
import { canManageSettings } from "@/lib/permissions";
import { useAppSelector } from "@/store/hooks";
import { postActionError } from "@/components/social-media/posts/post-presentation";
import type { SocialSettings } from "@/types/social-media.types";

const FIELDS = ["timezone", "defaultLanguage", "approvalRequired", "approverUserIds", "approvalSlaHours", "approvalSlaAction", "defaultPostingTimes", "queueGapMinutes", "blackoutDates", "defaultTone", "defaultCta", "hashtagCount", "autoFirstComment", "imageGenerationStyle", "openaiModel", "systemPromptOverride", "enabledPlatforms", "notificationEvents", "notificationDelivery"] as const satisfies readonly (keyof SocialSettings)[];
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
type State = { scope: string; form: SocialSettings | null; saved: SocialSettings | null; loading: boolean; error: string | null; saveError: string | null; saving: boolean };

export function useWorkspaceSettings() {
  const user = useAppSelector(selectUser);
  const workspaceId = user?.workspaceId ?? "";
  const scope = `${user?.id ?? ""}/${workspaceId}`;
  const canEdit = canManageSettings(user);
  const [state, setState] = useState<State>({ scope, form: null, saved: null, loading: Boolean(workspaceId), error: null, saveError: null, saving: false });
  const latest = useRef(state);
  latest.current = state;
  const active = useRef({ scope, canEdit, mounted: true });
  active.current.scope = scope;
  active.current.canEdit = canEdit;
  const request = useRef(0);
  const saving = useRef(false);
  const current = state.scope === scope ? state : { scope, form: null, saved: null, loading: Boolean(workspaceId), error: null, saveError: null, saving: false };

  const load = useCallback(async (force: boolean) => {
    if (!workspaceId || saving.current) return;
    const id = ++request.current;
    setState((previous) => previous.scope === scope ? { ...previous, loading: true, error: null } : { scope, form: null, saved: null, loading: true, error: null, saveError: null, saving: false });
    try {
      const data = await socialMediaApi.getSettings(workspaceId, { force });
      if (active.current.mounted && active.current.scope === scope && request.current === id) setState({ scope, form: data, saved: data, loading: false, error: null, saveError: null, saving: false });
    } catch (err) {
      if (active.current.mounted && active.current.scope === scope && request.current === id) setState((previous) => ({ ...previous, loading: false, error: postActionError(err, "We couldn’t load workspace settings. Please try again.") }));
    }
  }, [scope, workspaceId]);

  useEffect(() => {
    active.current.mounted = true;
    saving.current = false;
    void load(false);
    return () => { active.current.mounted = false; request.current++; };
  }, [load]);

  const patch = useCallback(<K extends keyof SocialSettings>(key: K, value: SocialSettings[K]) => {
    if (!active.current.canEdit || saving.current || !(FIELDS as readonly string[]).includes(key)) return;
    setState((previous) => previous.scope === scope && previous.form ? { ...previous, form: { ...previous.form, [key]: value }, saveError: null } : previous);
  }, [scope]);

  const reset = useCallback(() => {
    if (saving.current) return;
    setState((previous) => previous.scope === scope ? { ...previous, form: previous.saved, saveError: null } : previous);
  }, [scope]);

  const save = useCallback(async () => {
    const snapshot = latest.current;
    if (!workspaceId || snapshot.scope !== scope || !snapshot.form || !snapshot.saved || !active.current.canEdit || saving.current) return false;
    const payload = Object.fromEntries(FIELDS.filter((field) => !equal(snapshot.form![field], snapshot.saved![field])).map((field) => [field, snapshot.form![field]])) as Partial<SocialSettings>;
    if (!Object.keys(payload).length) return true;
    const rules = [["queueGapMinutes", "Queue gap", 1], ["approvalSlaHours", "Approval SLA", 1], ["hashtagCount", "Hashtag count", 0]] as const;
    for (const [key, label, minimum] of rules) {
      if (key in payload && (!Number.isSafeInteger(snapshot.form[key]) || snapshot.form[key] < minimum)) {
        setState((previous) => ({ ...previous, saveError: `${label} must be a whole number of at least ${minimum}.` }));
        return false;
      }
    }
    saving.current = true;
    const id = ++request.current;
    setState((previous) => ({ ...previous, saving: true, saveError: null }));
    try {
      const data = await socialMediaApi.saveSettings(workspaceId, payload);
      if (!active.current.mounted || active.current.scope !== scope || request.current !== id) return false;
      setState({ scope, form: data, saved: data, loading: false, saving: false, error: null, saveError: null });
      return true;
    } catch (err) {
      if (active.current.mounted && active.current.scope === scope && request.current === id) setState((previous) => ({ ...previous, saving: false, saveError: postActionError(err, "We couldn’t save your changes. Your draft is still here; please try again.") }));
      return false;
    } finally {
      if (active.current.scope === scope) saving.current = false;
    }
  }, [scope, workspaceId]);

  const dirty = Boolean(current.form && current.saved && FIELDS.some((field) => !equal(current.form![field], current.saved![field])));
  const reload = useCallback(() => load(true), [load]);
  return { ...current, canEdit, dirty, patch, save, reset, reload };
}