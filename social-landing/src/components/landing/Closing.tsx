import { ArrowRight, Check, ChevronDown, Minus } from "lucide-react";
import { brand, CONTACT_SALES_URL, faqs, featureLinks, formatINR, LOGIN_URL, plans, SIGNUP_URL } from "@/content/site";
import { BrandLockup } from "./Brand";

const comparisonRows = [
  ["Connected social accounts", "accounts"], ["Posts per month", "posts"],
  ["AI text generations per month", "textGen"], ["AI images per month", "images"],
  ["Brand voice", "brandVoice"], ["Approval workflow", "approvals"],
] as const;

export function Pricing() {
  return <section id="pricing" className="section-y pricing-section">
    <div className="container-page">
      <div className="mx-auto max-w-2xl text-center"><p className="eyebrow">Pricing</p><h2 className="section-heading mt-4">The right plan for your next stage.</h2><p className="section-intro mt-4">Unlimited social accounts on every plan. Add more content and collaboration as your team grows.</p></div>
      <div className="pricing-grid">{plans.map(plan => <article key={plan.id} className={`pricing-card ${plan.recommended ? "pricing-card-featured" : ""}`}>
        {plan.recommended && <span className="pricing-recommendation">Recommended</span>}
        <h3 className="text-xl font-bold">{plan.name}</h3><p className="pricing-audience">{plan.audience}</p>
        <p className="pricing-price"><span>{formatINR(plan.price)}</span><span className="pricing-period">/month</span></p><p className="mt-2 text-xs text-muted-foreground">{plan.custom ? "Sales-assisted · no self-service checkout" : plan.price === 0 ? "Free plan · no card required" : "Billed monthly"}</p>
        <a href={plan.custom ? CONTACT_SALES_URL : SIGNUP_URL} className={`btn mt-6 ${plan.recommended ? "btn-primary" : "btn-outline"}`}>{plan.cta}</a>
        <ul className="pricing-benefits">{[
          `${plan.accounts} social accounts`,
          `${plan.posts} posts per month`,
          `${plan.textGen} AI text generations`,
          `${plan.images} AI images per month`,
        ].map((label, i) => <li key={i}><Check className="size-4 text-primary" /><span>{plan.custom && i > 0 ? ["", "Content allowance for your workflow", "Tailored text generation allowance", "Tailored image generation allowance"][i] : label}</span></li>)}<li><Check className="size-4 text-primary" />Brand voice</li><li className={plan.approvals === "Not included" ? "text-muted-foreground" : ""}>{plan.approvals === "Not included" ? <Minus className="size-4" /> : <Check className="size-4 text-primary" />}<span>{plan.approvals === "Not included" ? "Approvals on paid plans" : "Approval workflow"}</span></li></ul>
      </article>)}</div>
      <div className="mt-8 text-center"><p className="text-sm font-medium">Every plan includes content planning, brand voice and publishing tools.</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Separate monthly allowances apply to text and images. Prices in INR. Applicable taxes and terms are shown at checkout.</p></div>
      <details className="comparison-disclosure"><summary className="btn btn-outline mx-auto w-fit">Compare the details <ChevronDown className="size-4" /></summary><div role="region" aria-label="Plan comparison" tabIndex={0} className="comparison-scroll"><table><caption className="sr-only">OpsBrain AI monthly plan comparison</caption><thead><tr><th scope="col">What’s included</th>{plans.map(plan => <th scope="col" key={plan.id}>{plan.name}<span className="mt-1 block font-normal text-muted-foreground">{formatINR(plan.price)} / month</span></th>)}</tr></thead><tbody>{comparisonRows.map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{plans.map(plan => <td key={plan.id}>{plan[key]}</td>)}</tr>)}</tbody></table></div></details>
    </div>
  </section>;
}

export function FAQ() {
  return <section id="faq" className="section-y"><div className="container-page faq-layout"><div><p className="eyebrow">Frequently asked questions</p><h2 className="section-heading mt-4">Before you get started.</h2><p className="section-intro mt-5">What to know about planning, publishing and choosing a plan.</p><a href={SIGNUP_URL} className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Create a free account <ArrowRight className="size-4" /></a></div><div>{faqs.map(faq => <details key={faq.q} name="landing-faq" className="faq-item"><summary>{faq.q}<ChevronDown className="size-4 shrink-0 text-muted-foreground" /></summary><p>{faq.a}</p></details>)}</div></div></section>;
}

export function FinalCTA() {
  return <section className="closing-section"><div className="container-page"><div className="closing-panel"><p className="eyebrow">Your next week starts here</p><h2>Get your content in order.<br />Get back to your business.</h2><p>Plan, create and schedule your next week of social content in one workspace.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><a href={SIGNUP_URL} className="btn btn-primary">Start for free <ArrowRight className="size-4" /></a><a href="#pricing" className="btn btn-ink-outline">View plans</a></div><span className="mt-5 block text-sm text-ink-muted">Free plan available. No credit card required.</span></div></div></section>;
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="container-page"><div className="footer-grid"><div><a href="#top" aria-label="OpsBrain AI home"><BrandLockup /></a><p className="mt-5 max-w-xs text-sm leading-relaxed text-muted-foreground">{brand.tagline}</p></div><div><h2 className="text-sm font-semibold">Product</h2><ul>{featureLinks.map(link => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul></div><div><h2 className="text-sm font-semibold">Explore</h2><ul><li><a href="#how-it-works">How it works</a></li><li><a href="#platforms">Social platforms</a></li><li><a href="#pricing">Pricing</a></li><li><a href="#faq">Questions & answers</a></li></ul></div><div><h2 className="text-sm font-semibold">Your workspace</h2><ul><li><a href={LOGIN_URL}>Sign in</a></li><li><a href={SIGNUP_URL}>Create a free account</a></li></ul></div></div><div className="footer-bottom"><p>© {new Date().getFullYear()} OpsBrain AI. All rights reserved.</p><p>Planning. Publishing. Performance.</p></div></div></footer>;
}