"use client";

import { useEffect, useState } from "react";

import { fetchDashboardStatsCached } from "@/lib/dashboard-cache";
import type { SocialDashboardStats } from "@/types/social-media.types";

export function useDashboardStats(workspaceId: string | undefined, enabled = true) {
  const [stats, setStats] = useState<SocialDashboardStats | null>(null);

  useEffect(() => {
    if (!workspaceId || !enabled) {
      setStats(null);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      fetchDashboardStatsCached(workspaceId)
        .then((data) => {
          if (active) setStats(data);
        })
        .catch(() => {
          if (active) setStats(null);
        });
    }, 50);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [workspaceId, enabled]);

  return stats;
}
