"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, AudioLines, CalendarDays, CalendarRange, ChartNoAxesCombined, FilePenLine, Menu, UsersRound, X, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandLockup } from "./Brand";
import { ThemeControl } from "./ThemeControl";
import { brand, featureLinks, LOGIN_URL, navLinks, SIGNUP_URL } from "@/content/site";

const featureDetails = {
  "#ai-content-studio": { icon: FilePenLine, description: "Turn your brief into editable social content." },
  "#weekly-planner": { icon: CalendarRange, description: "Shape your next seven days of content." },
  "#brand-voice": { icon: AudioLines, description: "Guide every draft with your brand’s voice." },
  "#publishing-calendar": { icon: CalendarDays, description: "Review, schedule and publish your posts." },
  "#analytics": { icon: ChartNoAxesCombined, description: "See how your published content performs." },
  "#teams-approvals": { icon: UsersRound, description: "Bring your team into the review process." },
};

const navigationFeatures = featureLinks.map((feature) => ({
  ...feature,
  ...featureDetails[feature.href as keyof typeof featureDetails],
}));

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const featuresTrigger = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpened = useRef(false);
  const hoverClosed = useRef(false);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const changeFeaturesOpen = (nextOpen: boolean) => {
    cancelClose();
    hoverOpened.current = false;
    hoverClosed.current = false;
    setFeaturesOpen(nextOpen);
  };

  const scheduleClose = () => {
    cancelClose();
    if (!featuresOpen || !hoverOpened.current) return;
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      hoverOpened.current = false;
      hoverClosed.current = true;
      setFeaturesOpen(false);
    }, 180);
  };

  const useKeyboard = () => {
    cancelClose();
    hoverOpened.current = false;
  };

  useEffect(() => () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? "site-header-scrolled" : ""}`}>
      <div className="container-page flex h-20 items-center justify-between gap-4">
        <a href="#top" aria-label={`${brand.name} home`}><BrandLockup /></a>

        <nav aria-label="Main" className="hidden items-center gap-1 xl:flex">
          <DropdownMenu modal={false} open={featuresOpen} onOpenChange={changeFeaturesOpen}>
            <DropdownMenuTrigger
              ref={featuresTrigger}
              onPointerEnter={(event) => {
                if (event.pointerType !== "mouse") return;
                cancelClose();
                if (!featuresOpen) {
                  hoverOpened.current = true;
                  hoverClosed.current = false;
                  setFeaturesOpen(true);
                }
              }}
              onPointerLeave={scheduleClose}
              onPointerDown={(event) => {
                if (event.button === 0 && !event.ctrlKey && hoverOpened.current) {
                  event.preventDefault();
                  cancelClose();
                  hoverOpened.current = false;
                }
              }}
              onKeyDown={useKeyboard}
              className="group inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:bg-primary-soft data-[state=open]:text-primary"
            >
              Features <ChevronDown aria-hidden="true" className="size-4 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={12}
              collisionPadding={16}
              onPointerEnter={cancelClose}
              onPointerLeave={scheduleClose}
              onKeyDown={useKeyboard}
              onInteractOutside={(event) => {
                if (event.target instanceof Node && featuresTrigger.current?.contains(event.target)) event.preventDefault();
              }}
              onCloseAutoFocus={(event) => {
                if (hoverClosed.current) event.preventDefault();
                hoverClosed.current = false;
              }}
              className="w-xl max-w-[calc(100vw-2rem)] rounded-2xl border-border bg-popover p-0 shadow-xl"
            >
              <div className="border-b border-border px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Your content workflow</p>
                <p className="mt-1 text-sm text-muted-foreground">From the first idea to your next published post.</p>
              </div>
              <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
                {navigationFeatures.map(({ href, label, icon: Icon, description }) => (
                  <DropdownMenuItem key={href} asChild className="group cursor-pointer items-start gap-3 rounded-xl p-3 focus:bg-primary-soft focus:text-foreground">
                    <a href={href} aria-label={label}>
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-primary transition-colors group-focus:border-primary/20 group-focus:bg-background">
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-5">{label}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
                      </span>
                    </a>
                  </DropdownMenuItem>
                ))}
              </div>
              <div className="border-t border-border bg-surface p-2">
                <DropdownMenuItem asChild className="group cursor-pointer justify-between gap-4 rounded-xl px-3 py-3 focus:bg-primary-soft focus:text-primary">
                  <a href="#weekly-planner" className="font-semibold text-primary">
                    Explore planner <ArrowRight aria-hidden="true" className="size-4 transition-transform group-focus:translate-x-1 motion-reduce:transition-none" />
                  </a>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">{l.label}</a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeControl />
          <div className="hidden items-center gap-2 xl:flex">
            <a href={LOGIN_URL} className="btn text-sm text-foreground hover:text-primary">Sign in</a>
            <a href={SIGNUP_URL} className="btn btn-primary">Start free</a>
          </div>

        <div className="flex items-center gap-2 xl:hidden">
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
                {navigationFeatures.map(({ href, label, icon: Icon, description }) => (
                  <a key={href} href={href} aria-label={label} onClick={() => setOpen(false)} className="flex min-h-11 items-start gap-3 rounded-xl px-2 py-3 text-left hover:bg-muted focus-visible:bg-primary-soft">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon aria-hidden="true" className="size-4" /></span>
                    <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span></span>
                  </a>
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
      </div>
    </header>
  );
}
