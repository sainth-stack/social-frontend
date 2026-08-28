"use client";

import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { tableSurfaceSx } from "@/lib/theme";
import type { PlatformComparisonRow } from "@/types/social-media.types";
import { PLATFORM_LABELS } from "@/types/social-media.types";

export default function PlatformComparisonTable({ rows }: { rows: PlatformComparisonRow[] }) {
  return (
    <Box sx={tableSurfaceSx}>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography sx={{ fontWeight: 600 }}>Platform comparison</Typography>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Platform</TableCell>
            <TableCell align="right">Posts</TableCell>
            <TableCell align="right">Reach</TableCell>
            <TableCell align="right">Impressions</TableCell>
            <TableCell align="right">Eng. rate</TableCell>
            <TableCell>Top post</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.platform}>
              <TableCell>{PLATFORM_LABELS[row.platform] ?? row.platform}</TableCell>
              <TableCell align="right">{row.posts}</TableCell>
              <TableCell align="right">{row.reach.toLocaleString()}</TableCell>
              <TableCell align="right">{row.impressions.toLocaleString()}</TableCell>
              <TableCell align="right">{(row.engagementRate * 100).toFixed(1)}%</TableCell>
              <TableCell sx={{ maxWidth: 220 }}>
                <Typography
                  sx={{
                    fontSize: "0.8125rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.topPost || "—"}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
