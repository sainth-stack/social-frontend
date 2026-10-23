import Image from "next/image";

import { platformBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";

type EarnedVoiceLogoProps = {
  className?: string;
  size?: number;
  compact?: boolean;
  priority?: boolean;
};

export function EarnedVoiceLogo({
  className,
  size = 32,
  compact = false,
  priority = false,
}: EarnedVoiceLogoProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      role="img"
      aria-label="EarnedVoice"
    >
      <Image
        src={platformBrand.mark}
        alt=""
        width={size}
        height={size}
        priority={priority}
        aria-hidden="true"
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
      {!compact ? (
        <span className="font-display font-bold leading-none tracking-tight">
          Earned<span className="text-primary">Voice</span>
        </span>
      ) : null}
    </span>
  );
}