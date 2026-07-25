"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
          <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
        </div>
        <Button variant="outline" size="sm" disabled>
          <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input placeholder="Search notifications…" disabled className="pl-3" />
        </div>
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread" disabled>
              Unread
            </TabsTrigger>
            <TabsTrigger value="published" disabled>
              Published
            </TabsTrigger>
            <TabsTrigger value="failed" disabled>
              Failed
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
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
          <Button size="sm" variant="outline" asChild>
            <Link href="/dashboard">Coming from activity feed → Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
