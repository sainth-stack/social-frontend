"use client";

import Link from "next/link";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from "@mui/material";

import { tableSurfaceSx } from "@/lib/theme";
import type { PostPerformanceItem } from "@/types/social-media.types";
import { PLATFORM_LABELS } from "@/types/social-media.types";

type TopPostsTableProps = {
  items: PostPerformanceItem[];
  sortKey: string;
  sortOrder: "asc" | "desc";
  onSort: (key: string) => void;
};

export default function TopPostsTable({
  items,
  sortKey,
  sortOrder,
  onSort,
}: TopPostsTableProps) {
  const head = (
    key: string,
    label: string,
    align: "left" | "right" = "left",
  ) => (
    <TableCell align={align} sortDirection={sortKey === key ? sortOrder : false}>
      <TableSortLabel
        active={sortKey === key}
        direction={sortKey === key ? sortOrder : "desc"}
        onClick={() => onSort(key)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box sx={tableSurfaceSx}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {head("caption", "Caption")}
            {head("platform", "Platform")}
            {head("publishedAt", "Published")}
            {head("reach", "Reach", "right")}
            {head("impressions", "Impressions", "right")}
            {head("likes", "Likes", "right")}
            {head("comments", "Comments", "right")}
            {head("shares", "Shares", "right")}
            {head("engagementRate", "Eng. rate", "right")}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.platformRowId} hover>
              <TableCell sx={{ maxWidth: 240 }}>
                <Typography
                  component={Link}
                  href={`/dashboard/posts/${item.postId}`}
                  sx={{
                    fontSize: "0.875rem",
                    color: "inherit",
                    textDecoration: "none",
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.caption || "Untitled"}
                </Typography>
              </TableCell>
              <TableCell>{PLATFORM_LABELS[item.platform]}</TableCell>
              <TableCell>
                {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "—"}
              </TableCell>
              <TableCell align="right">{item.reach.toLocaleString()}</TableCell>
              <TableCell align="right">{item.impressions.toLocaleString()}</TableCell>
              <TableCell align="right">{item.likes.toLocaleString()}</TableCell>
              <TableCell align="right">{item.comments.toLocaleString()}</TableCell>
              <TableCell align="right">{item.shares.toLocaleString()}</TableCell>
              <TableCell align="right">{(item.engagementRate * 100).toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
