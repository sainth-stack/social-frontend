import { Chip } from "@mui/material";

import { statusChipColors } from "@/lib/theme";

export type StatusChipVariant =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "active"
  | "inactive"
  | "qualified"
  | "failed"
  | "warning"
  | "success"
  | "prospecting"
  | "negotiation";

/** @deprecated Use StatusChipVariant */
export type StatusVariant = StatusChipVariant | "default" | "error" | "info";

const legacyMap: Record<string, StatusChipVariant> = {
  default: "inactive",
  error: "failed",
  info: "qualified",
};

const dottedVariants = new Set<StatusChipVariant>([
  "running",
  "active",
  "qualified",
  "failed",
  "paused",
  "warning",
  "success",
  "prospecting",
  "negotiation",
]);

type StatusChipProps = {
  label: string;
  variant?: StatusChipVariant | StatusVariant;
};

export default function StatusChip({ label, variant = "inactive" }: StatusChipProps) {
  const resolvedVariant =
    variant in legacyMap
      ? legacyMap[variant as string]
      : (variant as StatusChipVariant);
  const styles = statusChipColors[resolvedVariant] ?? statusChipColors.inactive;
  const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);
  const showDot = dottedVariants.has(resolvedVariant) && "dot" in styles && styles.dot;

  return (
    <Chip
      label={
        showDot ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: styles.dot,
                flexShrink: 0,
              }}
            />
            {displayLabel}
          </span>
        ) : (
          displayLabel
        )
      }
      size="small"
      sx={{
        bgcolor: styles.bg,
        color: styles.color,
        fontWeight: 500,
        fontSize: "0.75rem",
        height: 24,
        borderRadius: 999,
        border: "none",
        "& .MuiChip-label": {
          px: 1,
          textTransform: "capitalize",
        },
      }}
    />
  );
}

export function getCampaignStatusVariant(status: string): StatusChipVariant {
  switch (status.toLowerCase()) {
    case "running":
      return "running";
    case "active":
      return "active";
    case "paused":
    case "pending":
      return "paused";
    case "completed":
    case "closed":
      return "completed";
    case "draft":
      return "draft";
    case "suspended":
    case "failed":
      return "failed";
    case "qualified":
    case "qualification":
      return "qualified";
    case "prospecting":
      return "prospecting";
    case "negotiation":
      return "negotiation";
    case "warning":
      return "warning";
    case "success":
      return "success";
    case "inactive":
      return "inactive";
    default:
      return "inactive";
  }
}

export function PlanBadge({ plan }: { plan: string }) {
  return (
    <Chip
      label={plan}
      size="small"
      variant="outlined"
      sx={{
        height: 24,
        fontSize: "0.75rem",
        fontWeight: 500,
        color: "text.secondary",
        borderColor: "divider",
        bgcolor: "background.paper",
        "& .MuiChip-label": { px: 1 },
      }}
    />
  );
}
