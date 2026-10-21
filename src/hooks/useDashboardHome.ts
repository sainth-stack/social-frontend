"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchDashboardHomeCached,
  getCachedDashboardHome,
  isDashboardHomeFresh,
  type DashboardHomePayload,
} from "@/lib/dashboard-cache";

const LOAD_ERROR = "We couldn't load your dashboard. Please try again.";

export function useDashboardHome(workspaceId: string | undefined) {
  const [data, setData] = useState<DashboardHomePayload | null>(() =>
    workspaceId ? getCachedDashboardHome(workspaceId) : null,
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (force: boolean, isActive: () => boolean = () => true) => {
      if (!workspaceId) return;
      setError(null);
      fetchDashboardHomeCached(workspaceId, { force })
        .then((payload) => {
          if (isActive()) setData(payload);
        })
        .catch(() => {
          if (isActive()) setError(LOAD_ERROR);
        });
    },
    [workspaceId],
  );

  const reload = useCallback(() => load(true), [load]);

  useEffect(() => {
    if (!workspaceId) {
      setData(null);
      return;
    }

    setData(getCachedDashboardHome(workspaceId));
    if (isDashboardHomeFresh(workspaceId)) return;

    let active = true;
    load(false, () => active);
    return () => {
      active = false;
    };
  }, [workspaceId, load]);

  const loading = !data && Boolean(workspaceId) && !error;

  return { data, loading, error, reload };
}
