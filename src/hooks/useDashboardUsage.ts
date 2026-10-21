"use client";

import { useEffect, useState } from "react";

import {
  fetchDashboardUsageCached,
  getCachedDashboardUsage,
  type DashboardUsage,
} from "@/lib/dashboard-cache";

export function useDashboardUsage(workspaceId: string | undefined, enabled = true) {
  const [usage, setUsage] = useState<DashboardUsage | null>(() =>
    workspaceId && enabled ? getCachedDashboardUsage(workspaceId) : null,
  );

  useEffect(() => {
    if (!workspaceId || !enabled) {
      setUsage(null);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      fetchDashboardUsageCached(workspaceId)
        .then((data) => {
          if (active) setUsage(data);
        })
        .catch(() => undefined);
    }, 50);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [workspaceId, enabled]);

  return usage;
}
