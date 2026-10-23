import { Brain } from "lucide-react";

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Brain style={{ width: size * 0.58, height: size * 0.58 }} strokeWidth={1.8} />
      <span className="absolute right-[18%] top-[18%] h-1.5 w-1.5 rounded-full bg-mint" />
    </span>
  );
}

export function BrandLockup() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      <span className="font-display text-lg font-extrabold tracking-tight">
        OpsBrain <span className="text-primary">AI</span>
      </span>
    </span>
  );
}

export function PlatformIcon({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl font-display font-bold text-primary-foreground"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {name === "X" ? "𝕏" : name.charAt(0)}
    </span>
  );
}
