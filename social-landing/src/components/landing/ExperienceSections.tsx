import { ArrowRight, Check } from "lucide-react";
import type { ReactNode } from "react";
import { SIGNUP_URL } from "@/content/site";
import { ProductIllustration, type IllustrationKind } from "./ProductIllustration";
import { StudioDemo } from "./StudioDemo";

const journey = [
  { step: "01", label: "Plan", title: "Give the week a direction.", body: "Start with your business, audience and goal. Shape a seven-day plan you can make your own.", kind: "plan" },
  { step: "02", label: "Create", title: "Put your ideas into words.", body: "Bring your brief and brand context together for editable captions, hashtags and visuals.", kind: "studio" },
  { step: "03", label: "Publish", title: "Make the final call.", body: "Check each channel’s preview, review with your team and choose when to publish.", kind: "publishing" },
  { step: "04", label: "Measure", title: "Bring results to the next brief.", body: "Compare available post metrics and use what you find to inform your next campaign.", kind: "analytics" },
] as const;

export function ProductJourney() {
  return <section id="how-it-works" className="section-y journey-section" aria-labelledby="journey-heading"><div className="container-page">
    <div className="section-lead"><p className="eyebrow">A more connected content rhythm</p><h2 id="journey-heading" className="section-heading mt-4">Less starting over.<br />More moving forward.</h2><p className="section-intro mt-4">From the first idea to the next campaign, keep your content, team and decisions in one place.</p></div>
    <ol className="journey-grid">{journey.map(item => <li key={item.step} className="journey-item"><div className="journey-art"><ProductIllustration kind={item.kind} /></div><div className="journey-step"><span>{item.step}</span>{item.label}</div><h3>{item.title}</h3><p>{item.body}</p></li>)}</ol>
    <a href="#weekly-planner" className="journey-link">Try the interactive planner <ArrowRight className="size-4" aria-hidden="true" /></a>
  </div></section>;
}

function Feature({ id, eyebrow, title, description, benefits, kind, reverse = false, tone = "indigo", link, children, note }: { id: string; eyebrow: string; title: string; description: string; benefits: string[]; kind: IllustrationKind; reverse?: boolean; tone?: string; link?: { href: string; label: string }; children?: ReactNode; note?: string }) {
  return <section id={id} className="section-y feature-section" aria-labelledby={`${id}-heading`}><div className={`container-page feature-layout ${reverse ? "feature-reverse" : ""}`}>
    <div className="feature-copy"><p className="eyebrow">{eyebrow}</p><h2 id={`${id}-heading`} className="section-heading mt-4">{title}</h2><p className="section-intro mt-5">{description}</p><ul className="feature-benefits">{benefits.map(benefit => <li key={benefit}><Check className="size-4" aria-hidden="true" /><span>{benefit}</span></li>)}</ul>{link && <a href={link.href} className="feature-link">{link.label}<ArrowRight className="size-4" aria-hidden="true" /></a>}{children}</div>
    <figure className={`feature-art feature-art-${tone}`}><ProductIllustration kind={kind} /><figcaption>{note ?? "Illustrative product view · EarnedVoice example campaign"}</figcaption></figure>
  </div></section>;
}

export function CreationFeature() {
  return <Feature id="ai-content-studio" eyebrow="AI Content Studio" title="A clear brief. A stronger first draft." description="Turn the details you know into content your audience can understand. Bring the product context; let AI help with the starting point." benefits={["Generate hooks, captions and hashtags from one brief.", "Adapt drafts for each channel’s format.", "Create AI images within your plan’s allowance."]} kind="studio" link={{ href: SIGNUP_URL, label: "Create your first draft" }}>
    <details className="studio-disclosure"><summary>Explore an interactive sample <span aria-hidden="true">+</span></summary><div className="studio-disclosure-body"><StudioDemo /></div></details>
  </Feature>;
}

export function PublishingFeature() {
  return <Feature id="publishing-calendar" eyebrow="Publishing & previews" title="One campaign. Every channel considered." description="Keep your publishing in one workspace, without treating every channel the same. Review the copy and preview before you choose what goes live." benefits={["Preview posts for your connected channels.", "Keep drafts and scheduled posts on one calendar.", "Choose your publishing times and review each version."]} kind="publishing" reverse tone="sky" link={{ href: SIGNUP_URL, label: "Bring your channels together" }} note="Illustrative previews · Supported formats vary by platform" />;
}

export function BrandFeature() {
  return <Feature id="brand-voice" eyebrow="Brand voice & visual identity" title="More of your voice. Less explaining it again." description="Give every draft a shared starting point. Save the audience, tone and visual identity that make your brand recognisable." benefits={["Keep your audience and writing preferences together.", "Build a brand kit with colors and reusable logos.", "Use saved brand context to guide AI drafts."]} kind="brand" reverse tone="mint" link={{ href: SIGNUP_URL, label: "Build your brand profile" }} />;
}

export function AnalyticsFeature() {
  return <Feature id="analytics" eyebrow="Analytics & reporting" title="See the response. Find your next direction." description="Bring your connected accounts into one view. Compare post performance, look at the available metrics and take the useful details into your next plan." benefits={["Compare engagement and available post metrics.", "Filter your view by supported channel.", "Export a CSV report to review or share."]} kind="analytics" tone="sky" link={{ href: SIGNUP_URL, label: "Get a clearer view" }} note="Illustrative data, not customer results. Metrics vary by platform." />;
}

export function ReviewFeature() {
  return <Feature id="teams-approvals" eyebrow="Teams & approvals" title="A second pair of eyes. A clearer way forward." description="Give your team a deliberate review step. Keep draft and approval states visible, so you know what still needs attention before publishing." benefits={["Organise brands and teams in separate workspaces.", "Submit drafts for review and track approval status.", "Keep publishing decisions in your team’s hands."]} kind="review" reverse tone="peach" link={{ href: SIGNUP_URL, label: "Create with your team" }} note="Illustrative review states · Approvals on Pro, Growth and Scale" />;
}