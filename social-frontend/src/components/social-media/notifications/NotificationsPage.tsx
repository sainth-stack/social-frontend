"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Notifications inbox UI mirrored from Social Spark AI.
 * There is no dedicated notifications API yet — show a clear empty state
 * and point users to the dashboard activity feed.
 */
export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">Workspace activity is available on your dashboard.</p>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center sm:py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">Nothing here yet</p>
            <p className="text-xs text-muted-foreground">
              A dedicated notifications API is not available yet. Recent workspace activity
              already shows on your dashboard.
            </p>
          </div>
          <Button className="w-full sm:w-auto" variant="outline" asChild>
            <Link href="/dashboard">View dashboard activity</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
