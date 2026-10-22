"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import PhoneFrame from "@/components/social-media/content-studio/PhoneFrame";

export default function ResponsivePhonePreview({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => {
      const available = element.getBoundingClientRect().width;
      if (available > 0) setWidth(Math.max(1, Math.min(390, Math.floor((available - 16) / 1.082))));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={container} className="flex w-full min-w-0 justify-center py-6" aria-label="Mobile post preview" aria-busy={width === null}>
    {width !== null ? <PhoneFrame width={width}>{children}</PhoneFrame> : <div className="h-96 w-full max-w-sm animate-pulse rounded-3xl bg-muted motion-reduce:animate-none" />}
  </div>;
}