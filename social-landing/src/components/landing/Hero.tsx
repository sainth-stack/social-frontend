import { ArrowDown, ArrowRight, CalendarDays, Check, CheckCheck, Circle, ImageIcon } from "lucide-react";
import { SIGNUP_URL } from "@/content/site";
import { BrandMark, PlatformIcon } from "./Brand";

export function StatusBadge({ s }: { s: string }) {
  const scheduled = s === "Scheduled";
  const review = s === "Review" || s === "Needs review";
  const Icon = scheduled ? CheckCheck : review ? Circle : ImageIcon;
  return <span className={`status-badge inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${scheduled ? "bg-mint-soft text-mint-foreground" : review ? "bg-amber-soft text-amber-foreground" : "bg-muted text-muted-foreground"}`}><Icon className="size-3" />{s}</span>;
}

function ProductPreview() {
  return <figure className="hero-campaign" aria-label="Illustrative EarnedVoice campaign workspace">
    <div className="hero-product-stage">
      <div className="hero-product-window">
        <div className="hero-product-topbar"><span className="hero-product-brand"><BrandMark size={25} />Content Studio</span><span className="hero-product-draft"><span />Draft saved</span></div>
        <div className="hero-preview-body">
          <div className="hero-brief-inline"><span className="scene-label">YOUR BRIEF</span><p>Turn our workshop lessons into a useful post for product leaders.</p><span className="hero-brief-tone">Helpful & direct</span></div>
          <div className="hero-draft-connector"><ArrowDown className="size-3.5" aria-hidden="true" /><span>Brand-guided draft</span></div>
          <div className="hero-social-post">
            <div className="hero-social-author"><BrandMark size={28} /><div><strong>EarnedVoice</strong><span>Example LinkedIn draft</span></div><PlatformIcon name="LinkedIn" color="var(--primary)" size={28} /></div>
            <div className="hero-draft-content"><p className="hero-draft-title">Better handoffs.<br />Stronger teams.</p><p>A good handoff gives the next person a clear decision, an owner and a next step.</p><div className="hero-draft-checklist"><span><Check aria-hidden="true" />Clarify the decision</span><span><Check aria-hidden="true" />Name the owner</span><span><Check aria-hidden="true" />Agree the next step</span></div></div>
            <div className="hero-social-channels"><span className="hero-channel-icons" aria-label="Drafts for Instagram, Facebook and LinkedIn">{["Instagram", "Facebook", "LinkedIn"].map(name => <span key={name} title={name}><PlatformIcon name={name} color="var(--primary)" size={26} /><span className="sr-only">{name}</span></span>)}</span><span className="hero-social-ready"><Check className="size-3.5" aria-hidden="true" />Ready to review</span></div>
          </div>
        </div>
        <div className="hero-preview-footer"><CalendarDays className="size-4" aria-hidden="true" /><span>A good week starts with a plan.</span><span>Draft → Review → Schedule</span></div>
      </div>
    </div>
    <figcaption>Illustrative workflow · Your voice. Your timing. Your final say.</figcaption>
  </figure>;
}

export function Hero() {
  return <section id="top" className="hero-section">
    <div className="container-page hero-layout">
      <div className="hero-copy">
        <p className="eyebrow hero-audience">For founders, consultants and teams</p>
        <h1><span className="hero-title-line">Build the reputation</span><span className="hero-title-line hero-title-accent">your work deserves.</span></h1>
        <p className="hero-description">Turn your expertise, project lessons and ideas into content that sounds like you. Shape a weekly plan, refine AI drafts and publish with purpose. All in one workspace.</p>
        <div className="hero-actions"><a href={SIGNUP_URL} className="btn btn-primary">Get started free <ArrowRight className="size-4" aria-hidden="true" /></a><a href="#weekly-planner" className="btn btn-outline">See how it works <ArrowDown className="size-4" aria-hidden="true" /></a></div>
        <p className="hero-microcopy"><Check className="size-3.5 text-mint-foreground" />Free to start <span aria-hidden="true">·</span>No credit card <span aria-hidden="true">·</span>You choose what goes live</p>
      </div>
      <ProductPreview />
    </div>
  </section>;
}