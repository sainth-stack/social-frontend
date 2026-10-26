import { Instagram, Youtube } from "lucide-react";

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg role="img" aria-label="EarnedVoice" width={size} height={size} viewBox="4 16 112 98" fill="none" focusable="false" className="earnedvoice-symbol brand-mark">
      <path d="M9 27Q6 20 14 20H37L65 78L51 106Q48 111 44 103Z" fill="var(--brand-ribbon-deep)" />
      <path d="M51 106L88 20H109Q116 20 112 28L77 104Q75 110 68 110H55Q49 110 51 106Z" fill="var(--brand-ribbon)" />
      <path d="M14 32H40L45 43H19ZM23 52H49L54 63H28Z" fill="var(--brand-cutout)" />
    </svg>
  );
}

export function BrandLockup({ height = 36 }: { height?: number }) {
  return (
    <span role="img" aria-label="EarnedVoice" className="earnedvoice-logo" style={{ height, gap: height * 0.22 }}>
      <span aria-hidden="true"><BrandMark size={height} /></span>
      <span aria-hidden="true" className="earnedvoice-wordmark" style={{ fontSize: height * 0.76 }}>EarnedVoice</span>
    </span>
  );
}

export function PlatformIcon({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const iconSize = Math.round(size * 0.53);
  const props = { width: iconSize, height: iconSize, strokeWidth: 1.8, "aria-hidden": true as const };
  const icon = name === "Instagram" ? <Instagram {...props} />
    : name === "Facebook" ? <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.7 22v-9.1h3.1l.5-3.6h-3.6V7c0-1 .3-1.8 1.8-1.8h1.9V2.1a24 24 0 0 0-2.8-.1c-2.8 0-4.7 1.7-4.7 4.8v2.6H6.8V13h3.1v9h3.8Z" /></svg>
    : name === "LinkedIn" ? <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5.4 7.8H1.8V22h3.6V7.8ZM3.6 2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2ZM22.2 13.8c0-4.3-2.3-6.3-5.3-6.3-2.4 0-3.5 1.3-4.1 2.2V7.8H9.2V22h3.6v-7.9c0-2.1.4-4.1 3-4.1s2.8 2.4 2.8 4.2V22h3.6v-8.2Z" /></svg>
    : name === "YouTube" ? <Youtube {...props} />
    : <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {name === "X" ? <path d="M18.9 2H22l-6.8 7.8L23.2 22H17l-4.9-7.4L5.6 22H2.4l8.2-9.4L.8 2h6.4l4.4 6.7L18.9 2Zm-1.1 18h1.7L6.2 3.9H4.4L17.8 20Z" />
        : name === "TikTok" ? <path d="M16.6 2c.4 2.5 1.8 4 4.4 4.2v3.7a9 9 0 0 1-4.4-1.3v7.5a6.4 6.4 0 1 1-5.5-6.3v3.8a2.7 2.7 0 1 0 1.8 2.5V2h3.7Z" />
          : name === "Pinterest" ? <path d="M12 2a10 10 0 0 0-3.7 19.3c0-.8 0-1.8.2-2.7l1.3-5.5s-.3-.7-.3-1.7c0-1.6.9-2.8 2.1-2.8 1 0 1.5.8 1.5 1.7 0 1.1-.7 2.8-1 4.4-.3 1.3.7 2.3 2 2.3 2.4 0 4-3.1 4-6.7 0-2.8-1.9-4.9-5.3-4.9-3.9 0-6.3 2.9-6.3 6.1 0 1.1.3 1.9.8 2.5.2.2.2.4.2.7l-.3 1c0 .3-.3.4-.6.3-1.8-.7-2.6-2.6-2.6-4.7 0-3.5 3-7.7 9.1-7.7 4.9 0 8.1 3.5 8.1 7.2 0 4.9-2.7 8.6-6.6 8.6-1.3 0-2.6-.7-3-1.5l-.8 3.1c-.3.9-.8 1.9-1.3 2.6A10 10 0 1 0 12 2Z" />
            : name === "Bluesky" ? <path d="M12 11.7C10.7 9 7.2 4.6 4.5 3.2 2.3 2 1 2.7 1 5c0 1.7.6 5.8 1 7.2.8 2.6 3.5 3.1 6.2 2.6-4.7.8-5.8 3.1-3.4 5.6 3.9 4 6.3-1.3 7.2-3.8.9 2.5 3.3 7.8 7.2 3.8 2.4-2.5 1.3-4.8-3.4-5.6 2.7.5 5.4 0 6.2-2.6.4-1.4 1-5.5 1-7.2 0-2.3-1.3-3-3.5-1.8-2.7 1.4-6.2 5.8-7.5 8.5Z" />
              : name === "Threads" ? <path d="M12 2C6 2 3 6.1 3 12c0 6.1 3 10 9 10 4.8 0 8-2.8 8-6.6 0-3-1.8-5-5-5.4-.2-2.7-1.7-4.2-4.1-4.2-1.7 0-3.1.7-4 2.1l1.8 1.2c.5-.9 1.2-1.3 2.2-1.3 1.3 0 2 .7 2.2 2-4.5-.1-7 1.6-7 4.5 0 2.4 1.7 4 4.2 4 2.8 0 4.5-1.8 4.7-5.1 1.7.4 2.7 1.6 2.7 3.2 0 2.6-2.2 4.4-5.7 4.4-4.5 0-6.8-3-6.8-8.2 0-5 2.2-8 6.8-8 3.2 0 5.5 1.6 6.6 4.6l2-.8C19.3 4.2 16.3 2 12 2Zm-.8 14.2c-1.3 0-2.1-.7-2.1-1.8 0-1.5 1.6-2.3 4.2-2.2-.1 2.7-.7 4-2.1 4Z" /> : null}
    </svg>;

  return <span className="platform-icon inline-flex shrink-0 items-center justify-center rounded-xl border bg-background" style={{ width: size, height: size, color }} aria-hidden="true">{icon}</span>;
}
