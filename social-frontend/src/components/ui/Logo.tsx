import Image from "next/image";

import { EarnedVoiceLogo } from "@/components/brand/EarnedVoiceLogo";
import { cn } from "@/lib/utils";

type PlatformLogoProps = {
  size?: number;
  priority?: boolean;
  compact?: boolean;
  tone?: "default" | "light";
};

export function PlatformLogo({
  size = 32,
  priority = false,
  compact = false,
  tone = "default",
}: PlatformLogoProps) {
  return (
    <EarnedVoiceLogo
      size={size}
      priority={priority}
      compact={compact}
      className={cn(
        size >= 32 ? "text-lg" : "text-sm",
        tone === "light" ? "earnedvoice-logo-inverse" : "text-foreground",
      )}
    />
  );
}

type OrgBrandProps = {
  name: string;
  logoUrl?: string | null;
  size?: number;
  compact?: boolean;
};

export function OrgBrand({ name, logoUrl, size = 32, compact = false }: OrgBrandProps) {
  const avatar = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg",
        logoUrl ? "border border-border bg-card" : "bg-primary/10 text-xs font-bold text-primary",
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {logoUrl ? (
        <Image src={logoUrl} alt="" width={size} height={size} className="object-contain" />
      ) : (
        name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()
      )}
    </span>
  );

  if (compact) return avatar;

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {avatar}
      <span className="truncate text-sm font-semibold tracking-tight">{name}</span>
    </span>
  );
}
