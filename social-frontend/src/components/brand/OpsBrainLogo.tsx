"use client";

import Image from "next/image";

import { platformBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";

type OpsBrainLogoProps = {
  className?: string;
  /** Icon size in px */
  size?: number;
  /** Mark only */
  compact?: boolean;
  priority?: boolean;
};

/** OpsBrain mark + wordmark — same asset as opsbrain-landing. */
export function OpsBrainLogo({
  className,
  size = 32,
  compact = false,
  priority = false,
}: OpsBrainLogoProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      role="img"
      aria-label={`${platformBrand.name} ${platformBrand.suffix}`}
    >
      <Image
        src={platformBrand.mark}
        alt=""
        width={size}
        height={size}
        priority={priority}
        aria-hidden
        className="shrink-0 rounded-[22%] object-cover"
        style={{ width: size, height: size }}
      />
      {!compact ? (
        <span className="font-semibold leading-none tracking-tight text-foreground">
          {platformBrand.name}
          <span className="ml-1 text-primary">{platformBrand.suffix}</span>
        </span>
      ) : null}
    </span>
  );
}
