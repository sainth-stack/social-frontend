"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { OpsBrainLogo } from "@/components/brand/OpsBrainLogo";
import AuthShowcasePanel from "@/components/auth/AuthShowcasePanel";
import { platformBrand } from "@/lib/brand";

type AuthCardShellProps = { title: string; subtitle: string; children: ReactNode; footer: ReactNode };

export default function AuthCardShell({ title, subtitle, children, footer }: AuthCardShellProps) {
  return <main className="min-h-dvh bg-background text-foreground">
    <div className="mx-auto grid min-h-dvh max-w-screen-2xl lg:grid-cols-2">
      <section aria-label="Account access" className="flex min-w-0 flex-col px-5 py-6 sm:px-10 sm:py-8 lg:px-12 xl:px-20">
        <header className="flex items-center justify-between gap-4"><Link href={platformBrand.marketingUrl} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="OpsBrain AI home"><OpsBrainLogo size={36} priority /></Link><a href={platformBrand.marketingUrl} className="hidden items-center gap-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex">Visit website<ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></a></header>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 sm:py-12">
          <div className="mb-7 space-y-3"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Your next great idea starts here</p><h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1><p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{subtitle}</p></div>
          {children}
          <div className="mt-7 border-t border-border pt-6 text-center text-sm text-muted-foreground">{footer}</div>
        </div>
        <footer className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>© {new Date().getFullYear()} OpsBrain AI</span><span>One workspace. Every channel.</span></footer>
      </section>
      <AuthShowcasePanel />
    </div>
  </main>;
}