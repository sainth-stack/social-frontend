"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLockup } from "./Brand";
import { featureLinks, LOGIN_URL, navLinks, SIGNUP_URL } from "@/content/site";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? "site-header-scrolled" : ""}`}>
      <div className="container-page flex h-20 items-center justify-between gap-4">
        <a href="#top" aria-label="OpsBrain AI home"><BrandLockup /></a>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              Features <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 rounded-xl p-1.5">
              {featureLinks.map((f) => (
                <DropdownMenuItem key={f.href} asChild className="cursor-pointer rounded-lg px-3 py-2.5">
                  <a href={f.href}>{f.label}</a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">{l.label}</a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a href={LOGIN_URL} className="btn text-sm text-foreground hover:text-primary">Sign in</a>
          <a href={SIGNUP_URL} className="btn btn-primary">Start free</a>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <a href={SIGNUP_URL} className="btn btn-primary hidden px-4 sm:inline-flex">Start free</a>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="btn btn-outline px-3" aria-label="Open menu"><Menu className="h-5 w-5" /></SheetTrigger>
            <SheetContent side="right" aria-describedby={undefined} className="w-[88vw] max-w-sm overflow-y-auto p-0 [&>button]:hidden">
              <div className="flex h-[68px] items-center justify-between border-b px-5">
                <SheetTitle><BrandLockup /></SheetTitle>
                <button className="btn btn-outline px-3" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
              </div>
              <nav aria-label="Mobile" className="flex flex-col p-5">
                <p className="eyebrow mb-2">Features</p>
                {featureLinks.map((f) => (
                  <a key={f.href} href={f.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-lg px-2 text-left font-medium hover:bg-muted">{f.label}</a>
                ))}
                <div className="my-4 h-px bg-border" />
                {navLinks.map((l) => (
                  <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-lg px-2 text-left font-medium hover:bg-muted">{l.label}</a>
                ))}
                <div className="mt-6 grid gap-2">
                  <a href={SIGNUP_URL} className="btn btn-primary">Start free</a>
                  <a href={LOGIN_URL} className="btn btn-outline">Sign in</a>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
