"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDashboardUsageCached, getCachedDashboardUsage, type DashboardUsage } from "@/lib/dashboard-cache";

export function useDashboardUsage(workspaceId: string | undefined, enabled = true) {
  const key = enabled ? workspaceId : undefined;
  const request = useRef(0);
  const [state, setState] = useState<{
    key: string | undefined;
    usage: DashboardUsage | null;
    loading: boolean;
    error: string | null;
  }>(() => ({ key, usage: key ? getCachedDashboardUsage(key) : null, loading: Boolean(key), error: null }));

  const reload = useCallback(async () => {
    const id = ++request.current;
    if (!key) {
      setState({ key, usage: null, loading: false, error: null });
      return;
    }
    setState((previous) => ({ key, usage: previous.key === key ? previous.usage : getCachedDashboardUsage(key), loading: true, error: null }));
    try {
      const usage = await fetchDashboardUsageCached(key);
      if (id === request.current) setState({ key, usage, loading: false, error: null });
    } catch {
      if (id === request.current) setState((previous) => ({ ...previous, loading: false, error: "Usage is unavailable." }));
    }
  }, [key]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 50);
    return () => { window.clearTimeout(timer); request.current += 1; };
  }, [reload]);

  const current = state.key === key ? state : { usage: key ? getCachedDashboardUsage(key) : null, loading: Boolean(key), error: null };
  return { usage: current.usage, loading: current.loading, error: current.error, reload };
}
