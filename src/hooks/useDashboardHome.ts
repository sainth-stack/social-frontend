"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchDashboardHomeCached,
  invalidateDashboardCache,
  type DashboardHomePayload,
} from "@/lib/dashboard-cache";

export function useDashboardHome(workspaceId: string | undefined) {
  const [data, setData] = useState<DashboardHomePayload | null>(null);
  const [loading, setLoading] = useState(Boolean(workspaceId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!workspaceId) return;
    invalidateDashboardCache(workspaceId);
    setLoading(true);
    setError(null);
    fetchDashboardHomeCached(workspaceId)
      .then(setData)
      .catch(() => setError("We couldn't load your dashboard. Please try again."))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      setData(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetchDashboardHomeCached(workspaceId)
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setError("We couldn't load your dashboard. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [workspaceId]);

  return { data, loading, error, reload };
}
