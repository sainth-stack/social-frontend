import { Suspense } from "react";

import SettingsPage from "@/components/social-media/settings/SettingsPage";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      }
    >
      <SettingsPage />
    </Suspense>
  );
}
