"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { EarnedVoiceLogo } from "@/components/brand/EarnedVoiceLogo";
import { platformBrand } from "@/lib/brand";

type AuthCardShellProps = { title: string; subtitle: string; children: ReactNode; footer: ReactNode };

export default function AuthCardShell({ title, subtitle, children, footer }: AuthCardShellProps) {
  return <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12">
    <section aria-label="Account access" className="w-full min-w-0 max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <header className="mb-8 flex justify-center"><Link href={platformBrand.marketingUrl} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="EarnedVoice"><EarnedVoiceLogo size={32} priority /></Link></header>
      <div className="mb-6 space-y-2 text-center"><h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1><p className="break-words text-sm leading-relaxed text-muted-foreground">{subtitle}</p></div>
      {children}
      <div className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">{footer}</div>
    </section>
  </main>;
}