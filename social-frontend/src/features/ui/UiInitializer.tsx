"use client";

import { useEffect, useState } from "react";

import { setSidebarOpen, selectSidebarOpen } from "@/features/ui/uiSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export const SIDEBAR_EXPANDED_KEY = "opsbrain-sidebar-expanded";

export default function UiInitializer() {
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector(selectSidebarOpen);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (stored !== null) {
      dispatch(setSidebarOpen(stored === "true"));
    }
    setHydrated(true);
  }, [dispatch]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, String(sidebarOpen));
  }, [sidebarOpen, hydrated]);

  return null;
}
