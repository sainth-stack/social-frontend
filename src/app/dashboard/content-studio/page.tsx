import { Suspense } from "react";

import AIStudioPage from "@/components/social-media/ai-studio/AIStudioPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading AI Studio…</div>}>
      <AIStudioPage />
    </Suspense>
  );
}
