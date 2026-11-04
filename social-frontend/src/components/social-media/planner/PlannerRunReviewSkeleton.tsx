"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { plannerPath } from "./planner-review";
import Link from "next/link";

export default function PlannerRunReviewSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24" role="status" aria-label="Loading plan review">
      <span className="sr-only">Loading your content plan</span>
      <Link href={plannerPath} className="inline-flex min-h-11 items-center text-sm text-primary">
        ← Content planner
      </Link>
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-14 w-28 rounded-lg" />
        <Skeleton className="h-14 w-28 rounded-lg" />
      </div>
      <div className="space-y-4 rounded-xl border bg-background p-6">
        <Skeleton className="h-6 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
          <Skeleton className="mx-auto h-80 w-full max-w-xs rounded-[2rem]" />
        </div>
      </div>
    </div>
  );
}
