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

const STATS_TTL_MS = 60_000;

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

const statsCache = new Map<string, CacheEntry<SocialDashboardStats>>();
const statsInflight = new Map<string, Promise<SocialDashboardStats>>();
const homeInflight = new Map<string, Promise<DashboardHomePayload>>();

function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return Boolean(entry && entry.expiresAt > Date.now());
}

export function primeDashboardStats(workspaceId: string, stats: SocialDashboardStats): void {
  statsCache.set(workspaceId, { data: stats, expiresAt: Date.now() + STATS_TTL_MS });
}

export function invalidateDashboardCache(workspaceId: string): void {
  statsCache.delete(workspaceId);
  statsInflight.delete(workspaceId);
  homeInflight.delete(workspaceId);
}

export function fetchDashboardStatsCached(workspaceId: string): Promise<SocialDashboardStats> {
  const cached = statsCache.get(workspaceId);
  if (isFresh(cached)) {
    return Promise.resolve(cached.data);
  }

  const inflightHome = homeInflight.get(workspaceId);
  if (inflightHome) {
    return inflightHome.then((home) => home.stats);
  }

  const inflightStats = statsInflight.get(workspaceId);
  if (inflightStats) {
    return inflightStats;
  }

  const request = socialMediaApi
    .getDashboardStats(workspaceId)
    .then((stats) => {
      primeDashboardStats(workspaceId, stats);
      statsInflight.delete(workspaceId);
      return stats;
    })
    .catch((error) => {
      statsInflight.delete(workspaceId);
      throw error;
    });

  statsInflight.set(workspaceId, request);
  return request;
}

export function fetchDashboardHomeCached(workspaceId: string): Promise<DashboardHomePayload> {
  const inflight = homeInflight.get(workspaceId);
  if (inflight) {
    return inflight;
  }

  const request = socialMediaApi
    .getDashboardHome(workspaceId)
    .then((home) => {
      primeDashboardStats(workspaceId, home.stats);
      homeInflight.delete(workspaceId);
      return home;
    })
    .catch((error) => {
      homeInflight.delete(workspaceId);
      throw error;
    });

  homeInflight.set(workspaceId, request);
  return request;
}
