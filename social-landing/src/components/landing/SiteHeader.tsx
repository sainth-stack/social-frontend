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

  const go = (href: string) => {
    setOpen(false);
    setTimeout(() => document.querySelector(href)?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <header className={`sticky top-0 z-50 border-b bg-background/90 backdrop-blur transition-shadow ${scrolled ? "shadow-card border-border" : "border-transparent"}`}>
      <div className="container-page flex h-[68px] items-center justify-between gap-4">
        <a href="#top" aria-label="OpsBrain AI home"><BrandLockup /></a>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              Features <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 rounded-xl p-1.5">
              {featureLinks.map((f) => (
                <DropdownMenuItem key={f.href} className="cursor-pointer rounded-lg px-3 py-2.5" onSelect={() => go(f.href)}>
                  {f.label}
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
            <SheetContent side="right" className="w-[88vw] max-w-sm p-0 [&>button]:hidden">
              <div className="flex h-[68px] items-center justify-between border-b px-5">
                <SheetTitle><BrandLockup /></SheetTitle>
                <button className="btn btn-outline px-3" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
              </div>
              <nav aria-label="Mobile" className="flex flex-col p-5">
                <p className="eyebrow mb-2">Features</p>
                {featureLinks.map((f) => (
                  <button key={f.href} onClick={() => go(f.href)} className="min-h-11 rounded-lg px-2 text-left font-medium hover:bg-muted">{f.label}</button>
                ))}
                <div className="my-4 h-px bg-border" />
                {navLinks.map((l) => (
                  <button key={l.href} onClick={() => go(l.href)} className="min-h-11 rounded-lg px-2 text-left font-medium hover:bg-muted">{l.label}</button>
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
