import { cn } from "@/lib/utils";
import type { SocialPlatform } from "@/types/social-media.types";

function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M14 8h2.5V5.5A12.4 12.4 0 0 0 13.4 5C10.8 5 9 6.7 9 9.7V12H6.5v3H9v7h3.5v-7H15l.5-3H12.5V9.8c0-.9.2-1.8 1.5-1.8Z" />
    </svg>
  );
}

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkedinGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M6.5 9H3.7v11h2.8V9ZM5.1 3.5A1.7 1.7 0 1 0 5.1 6.9 1.7 1.7 0 0 0 5.1 3.5ZM20.3 12.3c0-2.6-1.4-4.3-3.8-4.3-1.3 0-2.2.7-2.6 1.4h-.1V9H11v11h2.8v-5.6c0-1.5.3-2.9 2.1-2.9s1.8 1.6 1.8 3V20h2.8v-7.7Z" />
    </svg>
  );
}

function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.5 3h3l-6.6 7.5L21.5 21h-5.8l-4.5-5.9L5.7 21H2.7l7-8L2.5 3h6l4.1 5.4L17.5 3Zm-1 16.2h1.7L7.6 4.7H5.8l10.7 14.5Z" />
    </svg>
  );
}

const map = {
  instagram: {
    Icon: InstagramGlyph,
    bg: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
  },
  facebook: {
    Icon: FacebookGlyph,
    bg: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  linkedin: {
    Icon: LinkedinGlyph,
    bg: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  x: {
    Icon: XGlyph,
    bg: "bg-neutral-100 text-neutral-800 dark:bg-neutral-500/15 dark:text-neutral-200",
  },
} as const;

export function PlatformIcon({
  platform,
  size = "md",
  className,
}: {
  platform: SocialPlatform;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { Icon, bg } = map[platform];
  const sizes = { sm: "h-7 w-7", md: "h-9 w-9", lg: "h-12 w-12" }[size];
  const icon = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" }[size];
  return (
    <span className={cn("inline-flex items-center justify-center rounded-lg", sizes, bg, className)}>
      <Icon className={icon} />
    </span>
  );
}
