"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import AIStudioPage, { type AIStudioTab } from "@/components/social-media/ai-studio/AIStudioPage";
import { selectUser } from "@/features/auth/authSlice";
import { useAppSelector } from "@/store/hooks";

export default function StudioRouteWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const user = useAppSelector(selectUser);
  let initialTab: AIStudioTab;

  switch (pathname) {
    case "/dashboard/content-studio":
    case "/dashboard/content-studio/generate":
      initialTab = "generate";
      break;
    case "/dashboard/content-studio/brand-voice":
      initialTab = "brand";
      break;
    case "/dashboard/content-studio/media":
      initialTab = "media";
      break;
    default:
      return children;
  }

  return <AIStudioPage key={JSON.stringify([user?.id, user?.workspaceId])} initialTab={initialTab} />;
}