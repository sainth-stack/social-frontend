"use client";

import ScheduleModal from "@/components/social-media/posts/ScheduleModal";
import type { CalendarPost } from "@/types/social-media.types";

type RescheduleModalProps = {
  post: CalendarPost | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (scheduledAt: string) => void;
};

export default function RescheduleModal({
  post,
  loading,
  onClose,
  onConfirm,
}: RescheduleModalProps) {
  return (
    <ScheduleModal
      open={Boolean(post)}
      loading={loading}
      initialValue={post?.scheduledAt ?? undefined}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
