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
        <div className="hero-product-heading"><span>From a real lesson to a useful post.</span><span className="hero-product-preview-label">ILLUSTRATIVE WORKFLOW</span></div>
        <div className="hero-source-note"><span className="scene-label">YOUR BRIEF</span><p>Share three lessons from our onboarding workshop. Helpful, specific and written for product leaders.</p></div>
        <div className="hero-social-post">
          <div className="hero-social-author"><BrandMark size={32} /><div><strong>EarnedVoice</strong><span>Example LinkedIn draft</span></div><PlatformIcon name="LinkedIn" color="var(--primary)" size={30} /></div>
          <div className="hero-editorial-art"><span>FIELD NOTES / 01</span><strong>Better handoffs.<br />Stronger teams.</strong><div className="hero-editorial-steps" aria-hidden="true"><span>Clarify</span><ArrowRight /><span>Own</span><ArrowRight /><span>Review</span></div><p>Three lessons from an onboarding workshop.</p></div>
          <p className="hero-social-caption">A good handoff is more than a document. Give the next person a clear decision, an owner and a next step. Here is what our latest workshop reminded us.</p>
          <div className="hero-social-channels"><span>Tailored for</span>{["Instagram", "Facebook", "LinkedIn"].map(name => <span key={name} title={name}><PlatformIcon name={name} color="var(--primary)" size={28} /><span className="sr-only">{name}</span></span>)}<span className="hero-social-ready"><Check className="size-3.5" />Ready to review</span></div>
        </div>
        <div className="hero-week-summary"><span className="hero-week-icon"><CalendarDays className="size-5" /></span><div><strong>A good week starts with a plan.</strong><span>Ideas, drafts and scheduled posts. Together.</span></div><div className="hero-mini-week" aria-hidden="true">{["M", "T", "W", "T", "F"].map((day, i) => <span key={i} className={i === 2 ? "is-selected" : ""}>{day}</span>)}</div></div>
      </div>
      <div className="hero-product-footnote"><CheckCheck className="size-4" /><span>Your voice. Your timing. Your final say.</span></div>
    </div>
    <figcaption>EarnedVoice example workspace · Illustrative content</figcaption>
  </figure>;
}

export function Hero() {
  return <section id="top" className="hero-section">
    <div className="container-page hero-layout">
      <div className="hero-copy">
        <p className="eyebrow hero-audience">For founders, consultants and teams</p>
        <h1>Build the reputation<br /><span className="hero-title-accent">your work deserves.</span></h1>
        <p className="hero-description">Turn your expertise, project lessons and ideas into content that sounds like you. Shape a weekly plan, refine AI drafts and publish with purpose. All in one workspace.</p>
        <div className="hero-actions"><a href={SIGNUP_URL} className="btn btn-primary">Get started free <ArrowRight className="size-4" aria-hidden="true" /></a><a href="#weekly-planner" className="btn btn-outline">See how it works <ArrowDown className="size-4" aria-hidden="true" /></a></div>
        <p className="hero-microcopy"><Check className="size-3.5 text-mint-foreground" />Free to start <span aria-hidden="true">·</span>No credit card <span aria-hidden="true">·</span>You choose what goes live</p>
      </div>
      <ProductPreview />
    </div>
  </section>;
}