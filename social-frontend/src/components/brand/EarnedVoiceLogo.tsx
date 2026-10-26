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
}: EarnedVoiceLogoProps) {
  return (
    <span role="img" aria-label="EarnedVoice" className={cn("earnedvoice-logo", className)} style={{ height: size, gap: size * 0.22 }}>
      <svg width={size} height={size} viewBox="4 16 112 98" fill="none" aria-hidden="true" focusable="false" className="earnedvoice-symbol">
        <path d="M9 27Q6 20 14 20H37L65 78L51 106Q48 111 44 103Z" fill="var(--brand-ribbon-deep)" />
        <path d="M51 106L88 20H109Q116 20 112 28L77 104Q75 110 68 110H55Q49 110 51 106Z" fill="var(--brand-ribbon)" />
        <path d="M14 32H40L45 43H19ZM23 52H49L54 63H28Z" fill="var(--brand-cutout)" />
      </svg>
      {!compact && <span aria-hidden="true" className="earnedvoice-wordmark" style={{ fontSize: size * 0.76 }}>EarnedVoice</span>}
    </span>
  );
}
