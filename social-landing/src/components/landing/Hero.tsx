import Image from "next/image";
import { ArrowDown, ArrowRight, CalendarDays, Check, CheckCheck, Circle, ImageIcon, LayoutGrid, MoreHorizontal, Plus, Users } from "lucide-react";
import { SIGNUP_URL } from "@/content/site";
import { BrandMark, PlatformIcon } from "./Brand";

const week = [
  { day: "Mon", date: 12, title: "Coffee, together.", state: "Scheduled", type: "Brand story", image: "/images/coffee-editorial.webp", alt: "Friends sharing freshly prepared coffee" },
  { day: "Tue", date: 13, title: "Brewed with care.", state: "Scheduled", type: "Product spotlight", image: "/images/coffee-detail.webp", alt: "Fresh coffee prepared for a café's product post" },
  { day: "Wed", date: 14, title: "Room for a break.", state: "Review", type: "Behind the scenes", image: "/images/brand-interior.webp", alt: "Sunlit interior with contemporary furniture" },
];

export function StatusBadge({ s }: { s: string }) {
  const scheduled = s === "Scheduled";
  const review = s === "Review" || s === "Needs review";
  const Icon = scheduled ? CheckCheck : review ? Circle : ImageIcon;
  return <span className={`status-badge inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${scheduled ? "bg-mint-soft text-mint-foreground" : review ? "bg-amber-soft text-amber-foreground" : "bg-muted text-muted-foreground"}`}><Icon className="size-3" />{s}</span>;
}

function ProductPreview() {
  return <div className="hero-art" aria-label="Illustrative OpsBrain weekly planner preview">
    <div className="hero-workspace">
      <div className="workspace-topbar"><div className="flex items-center gap-2.5"><BrandMark size={25} /><span className="text-xs font-semibold">Corner Café <span className="ml-1 text-muted-foreground">/ Workspace</span></span></div><span className="workspace-avatar">CC</span></div>
      <div className="workspace-body">
        <aside className="workspace-rail" aria-hidden="true"><LayoutGrid /><CalendarDays className="rail-active" /><ImageIcon /><Users /><span className="mt-auto"><Plus /></span></aside>
        <div className="workspace-content">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">Content calendar</p><h2 className="mt-1 text-xl font-bold">Your week at a glance</h2></div><span className="workspace-add"><Plus className="size-3.5" />New post</span></div>
          <div className="workspace-brief"><CalendarDays className="size-4 shrink-0 text-primary" /><div><p className="text-xs font-semibold">June content plan</p><p className="mt-1 text-xs text-muted-foreground">7 posts · 3 channels · Ready for review</p></div><Check className="ml-auto size-4 shrink-0 text-primary" /></div>
          <div className="workspace-calendar-label"><span className="font-semibold">June 12–18</span><span className="text-muted-foreground">Week view</span></div>
          <div className="workspace-week">{week.map((day, index) => <div key={day.day} className={`workspace-day ${index === 2 ? "workspace-day-active" : ""}`}><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{day.day}</span><span className={`text-xs font-semibold ${index === 2 ? "text-primary" : ""}`}>{day.date}</span></div><Image src={day.image} alt={day.alt} width={320} height={400} sizes="(min-width: 1024px) 150px, (min-width: 640px) 175px, 27vw" preload={index === 0} className="workspace-post-image" /><p className="mt-3 text-xs font-semibold leading-snug">{day.title}</p><p className="mt-1 text-xs text-muted-foreground">{day.type}</p><span className="mt-3 block"><StatusBadge s={day.state} /></span></div>)}</div>
          <div className="workspace-bottom"><span className="flex items-center gap-1.5"><Check className="size-3.5 shrink-0 text-mint-foreground" />Review every post before it goes live.</span><MoreHorizontal className="size-4 shrink-0" /></div>
        </div>
      </div>
    </div>
    <div className="hero-floating-card"><span className="floating-check"><Check className="size-4" /></span><div><p className="text-sm font-semibold">Content approved</p><p className="mt-1 text-xs text-muted-foreground">Monday’s post is ready to publish.</p></div><PlatformIcon name="Instagram" color="var(--platform-instagram)" size={28} /></div>
    <p className="hero-preview-label">Illustrative product preview</p>
  </div>;
}

export function Hero() {
  return <section id="top" className="hero-section">
    <div className="container-page hero-layout">
      <div className="hero-copy">
        <p className="hero-eyebrow"><span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />Instagram, Facebook & LinkedIn. One workspace.</p>
        <h1>Your next week of social content,<span className="hero-title-accent"> planned.</span></h1>
        <p className="hero-description">Turn your business goals into on-brand posts. Create a seven-day plan, review with your team and schedule on Instagram, Facebook and LinkedIn. More integrations coming soon.</p>
        <div className="hero-actions"><a href={SIGNUP_URL} className="btn btn-primary">Start planning free <ArrowRight className="size-4" /></a><a href="#weekly-planner" className="btn btn-outline">See it in action <ArrowDown className="size-4" /></a></div>
        <p className="hero-microcopy"><Check className="size-3.5 text-mint-foreground" />Free plan available. No credit card required.</p>
      </div>
      <ProductPreview />
    </div>
  </section>;
}