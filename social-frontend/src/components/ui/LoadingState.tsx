import { Box, Skeleton } from "@mui/material";

import { surfaceSx, tableSurfaceSx, colors } from "@/lib/theme";

type LoadingStateProps = {
  variant?: "card" | "table" | "inline";
  rows?: number;
  columns?: number;
};

export default function LoadingState({
  variant = "inline",
  rows = 5,
  columns = 4,
}: LoadingStateProps) {
  if (variant === "card") {
    return (
      <Box sx={{ ...surfaceSx, p: 2 }}>
        <Skeleton variant="text" width="40%" height={20} sx={{ mb: 2, bgcolor: `${colors.primary}10` }} />
        <Skeleton variant="rounded" height={48} sx={{ mb: 1.5, borderRadius: 2, bgcolor: `${colors.primary}08` }} />
        <Skeleton variant="rounded" height={48} sx={{ mb: 1.5, borderRadius: 2, bgcolor: `${colors.primary}08` }} />
        <Skeleton variant="rounded" height={48} sx={{ borderRadius: 2, bgcolor: `${colors.primary}08` }} />
      </Box>
    );
  }

  if (variant === "table") {
    return (
      <Box sx={{ ...tableSurfaceSx, overflow: "hidden" }}>
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: colors.tableHeader,
          }}
        >
          <Skeleton variant="text" width={180} height={24} />
        </Box>
        <Box sx={{ px: 2, py: 1.25, display: "flex", gap: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={index} variant="text" sx={{ flex: 1 }} height={20} />
          ))}
        </Box>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <Box
            key={rowIndex}
            sx={{
              px: 2,
              py: 1.5,
              display: "flex",
              gap: 2,
              borderBottom: rowIndex < rows - 1 ? "1px solid" : "none",
              borderColor: "divider",
            }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} variant="text" sx={{ flex: 1 }} height={18} />
            ))}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="text" width="45%" />
    </Box>
  );
}
