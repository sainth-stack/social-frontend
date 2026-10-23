"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import AppButton from "@/components/ui/AppButton";
import PageHeader from "@/components/ui/PageHeader";
import CalendarDayCell from "@/components/social-media/calendar/CalendarDayCell";
import RescheduleModal from "@/components/social-media/calendar/RescheduleModal";
import PlatformBadge from "@/components/social-media/posts/PlatformBadge";
import PostStatusChip from "@/components/social-media/posts/PostStatusChip";
import socialMediaApi from "@/api/endpoints/social-media.api";
import { selectUser } from "@/features/auth/authSlice";
import { updateSocialPost } from "@/features/social-media/socialPostsThunks";
import { enqueueToast } from "@/features/ui/uiSlice";
import { colors, surfaceSx } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { CalendarPost, SocialPlatform } from "@/types/social-media.types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildMonthGrid(cursor: Date): Date[] {
  const first = startOfMonth(cursor);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function PostCalendar() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector(selectUser);
  const orgId = user?.workspaceId ?? "";

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | "all">("all");
  const [items, setItems] = useState<CalendarPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CalendarPost | null>(null);
  const [reschedulePost, setReschedulePost] = useState<CalendarPost | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await socialMediaApi.getCalendar(orgId, monthKey(cursor));
      setItems(data.items);
    } catch {
      dispatch(enqueueToast({ message: "Failed to load calendar", severity: "error" }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [orgId, cursor]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (platformFilter === "all") return items;
    return items.filter((p) => p.platforms.includes(platformFilter));
  }, [items, platformFilter]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, CalendarPost[]>();
    for (const post of filtered) {
      if (!post.scheduledAt) continue;
      const d = new Date(post.scheduledAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    return map;
  }, [filtered]);

  const days = buildMonthGrid(cursor);
  const today = new Date();

  const handleReschedule = async (scheduledAt: string) => {
    if (!reschedulePost) return;
    setSaving(true);
    try {
      await dispatch(
        updateSocialPost({
          orgId,
          postId: reschedulePost.id,
          payload: { scheduledAt, status: "scheduled" },
        }),
      ).unwrap();
      dispatch(enqueueToast({ message: "Post rescheduled", severity: "success" }));
      setReschedulePost(null);
      setSelected(null);
      await load();
    } catch (err) {
      dispatch(
        enqueueToast({
          message: typeof err === "string" ? err : "Failed to reschedule",
          severity: "error",
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Calendar"
        subtitle="Scheduled and published posts at a glance"
        primaryAction={
          <AppButton
            variant="primary"
            component={Link}
            href="/dashboard/content-studio/generate"
          >
            New Post
          </AppButton>
        }
      />

      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ flexWrap: "wrap", alignItems: "center", mb: 2 }}
      >
        <IconButton onClick={() => setCursor((c) => addMonths(c, -1))}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography sx={{ fontWeight: 600, minWidth: 140, textAlign: "center" }}>
          {cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </Typography>
        <IconButton onClick={() => setCursor((c) => addMonths(c, 1))}>
          <ChevronRightIcon />
        </IconButton>

        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_, v) => v && setView(v)}
          sx={{ ml: 1 }}
        >
          <ToggleButton value="month">Month</ToggleButton>
          <ToggleButton value="week">Week</ToggleButton>
          <ToggleButton value="day">Day</ToggleButton>
        </ToggleButtonGroup>

        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", ml: "auto" }}>
          {(["all", "facebook", "instagram", "linkedin", "x"] as const).map((p) => (
            <Chip
              key={p}
              size="small"
              label={p === "all" ? "All" : p}
              clickable
              color={platformFilter === p ? "primary" : "default"}
              variant={platformFilter === p ? "filled" : "outlined"}
              onClick={() => setPlatformFilter(p)}
            />
          ))}
        </Stack>
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ ...surfaceSx, overflow: "hidden" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: `1px solid ${colors.border}`,
              bgcolor: colors.background,
            }}
          >
            {WEEKDAYS.map((d) => (
              <Box key={d} sx={{ px: 1, py: 1, borderRight: `1px solid ${colors.border}` }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: colors.textSecondary }}>
                  {d}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {days.map((day) => {
              const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
              const dayPosts = postsByDay.get(key) ?? [];
              return (
                <CalendarDayCell
                  key={key}
                  date={day}
                  inMonth={day.getMonth() === cursor.getMonth()}
                  isToday={isSameDay(day, today)}
                  posts={dayPosts}
                  onPostClick={(post) => {
                    setSelected(post);
                  }}
                  onDayClick={(date) => {
                    const iso = new Date(
                      date.getFullYear(),
                      date.getMonth(),
                      date.getDate(),
                      10,
                      0,
                    ).toISOString();
                    router.push(
                      `/dashboard/content-studio/generate?scheduleAt=${encodeURIComponent(iso)}`,
                    );
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {view !== "month" && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Week and day views use the same month grid for now.
        </Typography>
      )}

      <Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)}>
        {selected && (
          <Box sx={{ width: 360, p: 3 }}>
            <Typography sx={{ fontWeight: 600, mb: 1 }}>Post</Typography>
            <PostStatusChip status={selected.status} />
            <Typography sx={{ mt: 2, mb: 1, whiteSpace: "pre-wrap" }}>
              {selected.captionPreview}
            </Typography>
            <PlatformBadge platforms={selected.platforms} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {selected.scheduledAt
                ? new Date(selected.scheduledAt).toLocaleString()
                : "No schedule"}
            </Typography>
            <Stack spacing={1} sx={{ mt: 3 }}>
              <AppButton
                variant="secondary"
                component={Link}
                href={`/dashboard/posts/${selected.id}`}
              >
                View details
              </AppButton>
              {selected.status === "scheduled" && (
                <AppButton variant="primary" onClick={() => setReschedulePost(selected)}>
                  Reschedule
                </AppButton>
              )}
            </Stack>
          </Box>
        )}
      </Drawer>

      <RescheduleModal
        post={reschedulePost}
        loading={saving}
        onClose={() => setReschedulePost(null)}
        onConfirm={(scheduledAt) => void handleReschedule(scheduledAt)}
      />
    </Box>
  );
}
