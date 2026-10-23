import { ArrowDown, ArrowRight, Check, CheckCheck, Circle, ImageIcon } from "lucide-react";
import { SIGNUP_URL } from "@/content/site";
import { ProductIllustration } from "./ProductIllustration";

export function StatusBadge({ s }: { s: string }) {
  const scheduled = s === "Scheduled";
  const review = s === "Review" || s === "Needs review";
  const Icon = scheduled ? CheckCheck : review ? Circle : ImageIcon;
  return <span className={`status-badge inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${scheduled ? "bg-mint-soft text-mint-foreground" : review ? "bg-amber-soft text-amber-foreground" : "bg-muted text-muted-foreground"}`}><Icon className="size-3" />{s}</span>;
}

function ProductPreview() {
  return <figure className="hero-campaign" aria-label="Illustrative EarnedVoice campaign workspace"><ProductIllustration kind="campaign" /><figcaption>EarnedVoice example workspace · Illustrative content</figcaption></figure>;
}

export function Hero() {
  return <section id="top" className="hero-section">
    <div className="container-page hero-layout">
      <div className="hero-copy">
        <h1>Your ideas deserve<br /><span className="hero-title-accent">to be heard.</span></h1>
        <p className="hero-description">Turn product updates and useful ideas into content worth sharing. Plan your week, create with AI and publish with confidence—all in one workspace.</p>
        <div className="hero-actions"><a href={SIGNUP_URL} className="btn btn-primary">Get started free <ArrowRight className="size-4" aria-hidden="true" /></a><a href="#weekly-planner" className="btn btn-outline">See how it works <ArrowDown className="size-4" aria-hidden="true" /></a></div>
        <p className="hero-microcopy"><Check className="size-3.5 text-mint-foreground" />Free to start <span aria-hidden="true">·</span>No credit card <span aria-hidden="true">·</span>You approve what goes live</p>
      </div>
      <ProductPreview />
    </div>
  </section>;
}