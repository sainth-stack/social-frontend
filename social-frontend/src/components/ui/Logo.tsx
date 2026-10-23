import Image from "next/image";
import { Box, Typography } from "@mui/material";

import { platformBrand } from "@/lib/brand";
import { displayFont } from "@/lib/theme";

type PlatformLogoProps = {
  size?: number;
  priority?: boolean;
  /** Mark only — for collapsed sidebar */
  compact?: boolean;
  /** Light text for dark backgrounds (auth showcase) */
  tone?: "default" | "light";
};

function PlatformMark({ size, priority }: { size: number; priority?: boolean }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: `${Math.round(size * 0.22)}px`,
        overflow: "hidden",
        display: "inline-flex",
        lineHeight: 0,
      }}
    >
      <Image
        src={platformBrand.mark}
        alt=""
        width={size}
        height={size}
        priority={priority}
        aria-hidden
        style={{ width: size, height: size, objectFit: "cover", display: "block" }}
      />
    </Box>
  );
}

/** OpsBrain mark + wordmark */
export function PlatformLogo({
  size = 32,
  priority = false,
  compact = false,
  tone = "default",
}: PlatformLogoProps) {
  const isLight = tone === "light";

  if (compact) {
    return (
      <Box
        component="span"
        role="img"
        aria-label={`${platformBrand.name} ${platformBrand.suffix}`}
        sx={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        <PlatformMark size={size} priority={priority} />
      </Box>
    );
  }

  return (
    <Box
      component="span"
      role="img"
      aria-label={`${platformBrand.name} ${platformBrand.suffix}`}
      sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}
    >
      <PlatformMark size={size} priority={priority} />
      <Typography
        component="span"
        sx={{
          fontFamily: displayFont,
          fontWeight: 700,
          fontSize: size >= 32 ? "1.125rem" : "0.9375rem",
          letterSpacing: "-0.03em",
          lineHeight: 1,
          color: isLight ? "#fff" : "text.primary",
        }}
      >
        {platformBrand.name}
        <Typography
          component="span"
          sx={{
            ml: 0.5,
            color: isLight ? "rgb(255 255 255 / 0.82)" : "primary.main",
            fontWeight: 700,
          }}
        >
          {platformBrand.suffix}
        </Typography>
      </Typography>
    </Box>
  );
}

type OrgBrandProps = {
  name: string;
  logoUrl?: string | null;
  size?: number;
  compact?: boolean;
};

/** Client organization logo + name (uploaded at org creation) */
export function OrgBrand({ name, logoUrl, size = 32, compact = false }: OrgBrandProps) {
  const avatar = logoUrl ? (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "8px",
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        flexShrink: 0,
        bgcolor: "background.paper",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        style={{ objectFit: "contain" }}
      />
    </Box>
  ) : (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "8px",
        bgcolor: "primary.light",
        color: "primary.main",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: "0.8125rem",
        flexShrink: 0,
      }}
      aria-hidden
    >
      {name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()}
    </Box>
  );

  if (compact) {
    return avatar;
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
      {avatar}
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          letterSpacing: "-0.02em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </Typography>
    </Box>
  );
}
