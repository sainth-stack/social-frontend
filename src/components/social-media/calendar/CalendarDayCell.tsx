"use client";

import { Box, Typography } from "@mui/material";

import CalendarPostChip from "@/components/social-media/calendar/CalendarPostChip";
import { colors } from "@/lib/theme";
import type { CalendarPost } from "@/types/social-media.types";

type CalendarDayCellProps = {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  posts: CalendarPost[];
  onPostClick: (post: CalendarPost) => void;
  onDayClick: (date: Date) => void;
};

export default function CalendarDayCell({
  date,
  inMonth,
  isToday,
  posts,
  onPostClick,
  onDayClick,
}: CalendarDayCellProps) {
  const visible = posts.slice(0, 3);
  const overflow = posts.length - visible.length;

  return (
    <Box
      onClick={() => onDayClick(date)}
      sx={{
        minHeight: 110,
        p: 0.75,
        borderRight: `1px solid ${colors.border}`,
        borderBottom: `1px solid ${colors.border}`,
        bgcolor: inMonth ? colors.paper : colors.background,
        opacity: inMonth ? 1 : 0.55,
        cursor: "pointer",
        position: "relative",
        "&:hover .add-hint": { opacity: 1 },
      }}
    >
      <Typography
        sx={{
          fontSize: "0.75rem",
          fontWeight: isToday ? 700 : 500,
          width: 24,
          height: 24,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: isToday ? colors.primary : "transparent",
          color: isToday ? "#fff" : colors.textSecondary,
          mb: 0.5,
        }}
      >
        {date.getDate()}
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.4 }}>
        {visible.map((post) => (
          <Box
            key={post.id}
            onClick={(e) => {
              e.stopPropagation();
              onPostClick(post);
            }}
          >
            <CalendarPostChip post={post} />
          </Box>
        ))}
        {overflow > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
            +{overflow} more
          </Typography>
        )}
      </Box>

      {posts.length === 0 && (
        <Typography
          className="add-hint"
          variant="caption"
          sx={{
            position: "absolute",
            bottom: 6,
            right: 8,
            opacity: 0,
            color: colors.primary,
            fontWeight: 600,
          }}
        >
          +
        </Typography>
      )}
    </Box>
  );
}
