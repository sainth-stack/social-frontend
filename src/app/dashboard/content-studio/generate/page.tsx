import { Suspense } from "react";

import AIGenerate from "@/components/social-media/content-studio/AIGenerate";

export default function Page() {
  return (
    <Suspense>
      <AIGenerate />
    </Suspense>
  );
}
