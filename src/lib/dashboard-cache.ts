import apiClient from "@/api/client";
import socialMediaApi from "@/api/endpoints/social-media.api";
import type {
  SocialActivityItem,
  SocialDashboardStats,
  SocialPost,
} from "@/types/social-media.types";

export type DashboardHomePayload = {
  stats: SocialDashboardStats;
  activity: SocialActivityItem[];
  recommendations: Array<{ topic: string; reason: string }>;
  scheduledPosts: SocialPost[];
};

export type DashboardUsage = SocialDashboardStats["usage"];

const FRESH_MS = 30_000;
const MAX_STALE_MS = 10 * 60_000;

type CacheEntry<T> = {
  data: T;
  at: number;
};

const homeCache = new Map<string, CacheEntry<DashboardHomePayload>>();
const usageCache = new Map<string, CacheEntry<DashboardUsage>>();
const homeInflight = new Map<string, Promise<DashboardHomePayload>>();
const usageInflight = new Map<string, Promise<DashboardUsage>>();

const WORKSPACE_URL = /\/api\/v1\/workspaces\/([^/?#]+)/;

apiClient.interceptors.response.use((response) => {
  const method = (response.config.method ?? "get").toLowerCase();
  if (method !== "get" && method !== "head") {
    const match = WORKSPACE_URL.exec(String(response.config.url ?? ""));
    if (match) invalidateDashboardCache(decodeURIComponent(match[1]));
  }
  return response;
});

function ageOf(entry: CacheEntry<unknown>): number {
  return Date.now() - entry.at;
}

function usable<T>(entry: CacheEntry<T> | undefined): T | null {
  return entry && ageOf(entry) < MAX_STALE_MS ? entry.data : null;
}

function fresh<T>(entry: CacheEntry<T> | undefined): T | null {
  return entry && ageOf(entry) < FRESH_MS ? entry.data : null;
}

export function getCachedDashboardHome(workspaceId: string): DashboardHomePayload | null {
  return usable(homeCache.get(workspaceId));
}

export function isDashboardHomeFresh(workspaceId: string): boolean {
  return fresh(homeCache.get(workspaceId)) !== null;
}

export function getCachedDashboardUsage(workspaceId: string): DashboardUsage | null {
  return usable(usageCache.get(workspaceId));
}

export function invalidateDashboardCache(workspaceId: string): void {
  homeCache.delete(workspaceId);
  usageCache.delete(workspaceId);
  homeInflight.delete(workspaceId);
  usageInflight.delete(workspaceId);
}

export function clearDashboardCache(): void {
  homeCache.clear();
  usageCache.clear();
  homeInflight.clear();
  usageInflight.clear();
}

export function fetchDashboardHomeCached(
  workspaceId: string,
  options: { force?: boolean } = {},
): Promise<DashboardHomePayload> {
  if (!options.force) {
    const cached = fresh(homeCache.get(workspaceId));
    if (cached) return Promise.resolve(cached);
  }

  const inflight = homeInflight.get(workspaceId);
  if (inflight) return inflight;

  const request: Promise<DashboardHomePayload> = socialMediaApi
    .getDashboardHome(workspaceId)
    .then((home) => {
      if (homeInflight.get(workspaceId) === request) {
        const at = Date.now();
        homeCache.set(workspaceId, { data: home, at });
        usageCache.set(workspaceId, { data: home.stats.usage, at });
      }
      return home;
    })
    .finally(() => {
      if (homeInflight.get(workspaceId) === request) homeInflight.delete(workspaceId);
    });

  homeInflight.set(workspaceId, request);
  return request;
}

export function prefetchDashboardHome(workspaceId: string): void {
  fetchDashboardHomeCached(workspaceId).catch(() => undefined);
}

export function fetchDashboardUsageCached(workspaceId: string): Promise<DashboardUsage> {
  const cached = fresh(usageCache.get(workspaceId));
  if (cached) return Promise.resolve(cached);

  const inflightHome = homeInflight.get(workspaceId);
  if (inflightHome) return inflightHome.then((home) => home.stats.usage);

  const inflight = usageInflight.get(workspaceId);
  if (inflight) return inflight;

  const request: Promise<DashboardUsage> = socialMediaApi
    .getUsage(workspaceId)
    .then((usage) => {
      if (usageInflight.get(workspaceId) === request) {
        usageCache.set(workspaceId, { data: usage, at: Date.now() });
      }
      return usage;
    })
    .finally(() => {
      if (usageInflight.get(workspaceId) === request) usageInflight.delete(workspaceId);
    });

  usageInflight.set(workspaceId, request);
  return request;
}
