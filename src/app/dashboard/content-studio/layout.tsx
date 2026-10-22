import { Suspense, type ReactNode } from "react";

import StudioRouteWorkspace from "@/components/social-media/ai-studio/StudioRouteWorkspace";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading AI Studio…</div>}>
      <StudioRouteWorkspace>{children}</StudioRouteWorkspace>
    </Suspense>
  );
}