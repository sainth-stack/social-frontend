import type { ContentPlanDay, ContentPlanGenerateResponse, SocialPlatform } from "@/types/social-media.types";

const MAX_ENTRIES = 30;

export type ContentPlanHistoryEntry = {
  id: string;
  jobId: string;
  createdAt: string;
  promptPreview: string;
  days: number;
  message: string;
  scheduledCount: number;
  platforms: SocialPlatform[];
  items: ContentPlanDay[];
  errors: string[];
};

function storageKey(orgId: string): string {
  return `opsbrain:contentPlanHistory:${orgId}`;
}

export function loadContentPlanHistory(orgId: string): ContentPlanHistoryEntry[] {
  if (typeof window === "undefined" || !orgId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(orgId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ContentPlanHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveContentPlanHistoryRun(
  orgId: string,
  input: {
    jobId: string;
    prompt: string;
    platforms: SocialPlatform[];
    result: ContentPlanGenerateResponse;
  },
): ContentPlanHistoryEntry {
  const entry: ContentPlanHistoryEntry = {
    id: `${input.jobId}-${Date.now()}`,
    jobId: input.jobId,
    createdAt: new Date().toISOString(),
    promptPreview: input.prompt.slice(0, 160),
    days: input.result.days,
    message: input.result.message,
    scheduledCount: input.result.scheduledCount ?? 0,
    platforms: input.platforms,
    items: input.result.items ?? [],
    errors: input.result.errors ?? [],
  };
  const prev = loadContentPlanHistory(orgId);
  const next = [entry, ...prev.filter((e) => e.jobId !== input.jobId)].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(storageKey(orgId), JSON.stringify(next));
  } catch {
    /* quota */
  }
  return entry;
}

function persistHistory(orgId: string, entries: ContentPlanHistoryEntry[]): void {
  try {
    window.localStorage.setItem(storageKey(orgId), JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota */
  }
}

export function removeContentPlanHistoryEntry(orgId: string, entryId: string): void {
  if (typeof window === "undefined" || !orgId) return;
  const next = loadContentPlanHistory(orgId).filter((e) => e.id !== entryId);
  persistHistory(orgId, next);
}

export function clearContentPlanHistory(orgId: string): void {
  if (typeof window === "undefined" || !orgId) return;
  try {
    window.localStorage.removeItem(storageKey(orgId));
  } catch {
    /* ignore */
  }
}

export function postIdsFromHistoryEntry(entry: ContentPlanHistoryEntry): string[] {
  return [...new Set(entry.items.map((i) => i.postId).filter(Boolean) as string[])];
}
