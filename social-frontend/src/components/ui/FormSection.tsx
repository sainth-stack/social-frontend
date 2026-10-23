import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

import SectionTitle from "@/components/ui/SectionTitle";

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  /** Remove bottom margin when nested inside cards/wizards */
  compact?: boolean;
};

export default function FormSection({ title, description, children, compact = false }: FormSectionProps) {
  return (
    <Box sx={{ mb: compact ? 0 : 3 }}>
      <SectionTitle title={title} subtitle={description} spacing="md" />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>{children}</Box>
    </Box>
  );
}
