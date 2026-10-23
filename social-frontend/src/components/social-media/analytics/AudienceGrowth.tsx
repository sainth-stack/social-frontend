"use client";

import { Box, Typography } from "@mui/material";

import PageHeader from "@/components/ui/PageHeader";
import { surfaceSx } from "@/lib/theme";

export default function AudienceGrowth() {
  return (
    <Box>
      <PageHeader
        title="Audience Growth"
        subtitle="Audience metrics are temporarily unavailable"
      />
      <Box sx={{ ...surfaceSx, p: 6, textAlign: "center" }}>
        <Typography color="text.secondary">
          Follower and audience growth charts are hidden for now. Use Analytics for reach and
          engagement.
        </Typography>
      </Box>
    </Box>
  );
}
