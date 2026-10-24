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
  if (compact) {
    return (
      <Image
        src={platformBrand.mark}
        alt="EarnedVoice"
        width={size}
        height={size}
        priority={priority}
        className={cn("shrink-0 object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  const height = size;
  const width = Math.round(size * platformBrand.lockupAspect);

  return (
    <Image
      src={platformBrand.lockup}
      alt="EarnedVoice"
      width={width}
      height={height}
      priority={priority}
      className={cn("h-auto w-auto max-h-[var(--ev-logo-h)] shrink-0 object-contain object-left", className)}
      style={{ ["--ev-logo-h" as string]: `${height}px`, maxWidth: width }}
    />
  );
}
