import type { ReactNode } from "react";
import Link from "next/link";
import { Typography } from "@mui/material";

import { colors } from "@/lib/theme";

type TableLinkActionProps = {
  href: string;
  children: ReactNode;
};

export default function TableLinkAction({ href, children }: TableLinkActionProps) {
  return (
    <Typography
      component={Link}
      href={href}
      sx={{
        fontSize: "0.8125rem",
        fontWeight: 500,
        color: colors.textSecondary,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 0.25,
        transition: "color 0.12s ease",
        "&:hover": { color: colors.primary },
      }}
    >
      {children}
      <span aria-hidden="true">→</span>
    </Typography>
  );
}
