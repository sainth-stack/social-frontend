"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchDashboardHomeCached,
  getCachedDashboardHome,
  isDashboardHomeFresh,
  type DashboardHomePayload,
} from "@/lib/dashboard-cache";

const LOAD_ERROR = "We couldn't load your dashboard. Please try again.";

export function useDashboardHome(workspaceId: string | undefined) {
  const requestId = useRef(0);
  const [state, setState] = useState<{
    workspaceId: string | undefined;
    data: DashboardHomePayload | null;
    error: string | null;
    refreshing: boolean;
  }>(() => ({
    workspaceId,
    data: workspaceId ? getCachedDashboardHome(workspaceId) : null,
    error: null,
    refreshing: false,
  }));

  const load = useCallback(
    (force: boolean) => {
      if (!workspaceId) return;
      const id = ++requestId.current;
      setState((previous) => ({
        workspaceId,
        data: previous.workspaceId === workspaceId ? previous.data : getCachedDashboardHome(workspaceId),
        error: null,
        refreshing: true,
      }));
      return fetchDashboardHomeCached(workspaceId, { force })
        .then((payload) => {
          if (id === requestId.current) {
            setState({ workspaceId, data: payload, error: null, refreshing: false });
          }
        })
        .catch(() => {
          if (id === requestId.current) {
            setState((previous) => ({ ...previous, error: LOAD_ERROR, refreshing: false }));
          }
        });
    },
    [workspaceId],
  );

  const reload = useCallback(() => load(true), [load]);

  useEffect(() => {
    if (!workspaceId) {
      requestId.current += 1;
      setState({ workspaceId, data: null, error: null, refreshing: false });
    } else {
      const cached = getCachedDashboardHome(workspaceId);
      setState({ workspaceId, data: cached, error: null, refreshing: false });
      if (!isDashboardHomeFresh(workspaceId)) void load(false);
    }
    return () => {
      requestId.current += 1;
    };
  }, [workspaceId, load]);

  const data = state.workspaceId === workspaceId ? state.data : null;
  const error = state.workspaceId === workspaceId ? state.error : null;
  const refreshing = state.workspaceId === workspaceId && state.refreshing;
  const loading = !data && Boolean(workspaceId) && !error;

  return { data, loading, refreshing, error, reload };
}
