import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { brand, companySocialLinks, CONTACT_SALES_URL, faqs, featureLinks, formatINR, LOGIN_URL, plans, platforms, SIGNUP_URL } from "@/content/site";
import { BrandLockup, PlatformIcon } from "./Brand";

const comparisonRows = [
  ["Connected social accounts", "accounts"], ["Posts per month", "posts"],
  ["AI text generations per month", "textGen"], ["AI images per month", "images"],
  ["Brand voice", "brandVoice"],
] as const;

export function Pricing() {
  return <section id="pricing" className="section-y pricing-section">
    <div className="container-page">
      <div className="mx-auto max-w-2xl text-center"><p className="eyebrow">Pricing</p><h2 className="section-heading mt-4">Start free. Make room to grow.</h2><p className="section-intro mt-4">Choose the posts and AI generations you need. Unlimited social accounts on every plan.</p></div>
      <div className="pricing-grid">{plans.map(plan => <article key={plan.id} aria-labelledby={`plan-${plan.id}`} className={`pricing-card ${plan.recommended ? "pricing-card-featured" : ""}`}>
        {plan.recommended && <span className="pricing-recommendation">Recommended</span>}
        <h3 id={`plan-${plan.id}`} className="pricing-plan-name">{plan.name}</h3><p className="pricing-audience">{plan.audience}</p>
        <p className="pricing-price"><span>{formatINR(plan.price)}</span><span className="pricing-period">{plan.price === 0 ? "/forever" : "/month"}</span></p><p className="mt-2 text-xs text-muted-foreground">{plan.custom ? "Talk to us about your plan" : plan.price === 0 ? "No credit card required" : "Billed monthly"}</p>
        <a href={plan.custom ? CONTACT_SALES_URL : SIGNUP_URL} className={`btn mt-6 w-full ${plan.recommended ? "btn-primary" : "btn-outline"}`}>{plan.cta}</a>
        <ul className="pricing-benefits">{[
          `${plan.accounts} social accounts`,
          `${plan.posts} posts per month`,
          `${plan.textGen} AI text generations`,
          `${plan.images} AI images per month`,
        ].map((label, i) => <li key={i}><Check className="size-4 text-primary" aria-hidden="true" /><span>{plan.custom && i > 0 ? ["", "Custom monthly post allowance", "Custom AI text allowance", "Custom AI image allowance"][i] : label}</span></li>)}<li><Check className="size-4 text-primary" aria-hidden="true" />Brand voice</li></ul>
      </article>)}</div>
      <div className="mt-8 text-center"><p className="text-sm font-medium">Every plan includes content planning, brand voice and publishing tools.</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Separate monthly allowances apply to text and images. Prices in INR. Applicable taxes and terms are shown at checkout.</p></div>
      <details className="comparison-disclosure"><summary className="btn btn-outline mx-auto w-fit">Compare the details <ChevronDown className="size-4" aria-hidden="true" /></summary><div role="region" aria-label="Plan comparison" tabIndex={0} className="comparison-scroll"><table><caption className="sr-only">EarnedVoice monthly plan comparison</caption><thead><tr><th scope="col">What’s included</th>{plans.map(plan => <th scope="col" key={plan.id}>{plan.name}<span className="mt-1 block font-normal text-muted-foreground">{formatINR(plan.price)} / {plan.price === 0 ? "forever" : "month"}</span></th>)}</tr></thead><tbody>{comparisonRows.map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{plans.map(plan => <td key={plan.id}>{plan[key]}</td>)}</tr>)}</tbody></table></div></details>
    </div>
  </section>;
}

export function FAQ() {
  return <section id="faq" className="section-y"><div className="container-page faq-layout"><div><p className="eyebrow">Frequently asked questions</p><h2 className="section-heading mt-4">Before you get started.</h2><p className="section-intro mt-5">What to know about planning, publishing and choosing a plan.</p><a href={SIGNUP_URL} className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Create a free account <ArrowRight className="size-4" /></a></div><div>{faqs.map(faq => <details key={faq.q} name="landing-faq" className="faq-item"><summary>{faq.q}<ChevronDown className="size-4 shrink-0 text-muted-foreground" /></summary><p>{faq.a}</p></details>)}</div></div></section>;
}

export function FinalCTA() {
  return <section className="closing-section"><div className="container-page"><div className="closing-panel"><p className="eyebrow">Make your experience count</p><h2>Your work has a story.<br />Give it a voice.</h2><p>Start with one useful idea. Make it sound like you.<br />Build a content rhythm you can keep.</p><div className="closing-platforms" aria-label="Supported platforms">{platforms.filter(platform => platform.status === "available").map(platform => <span key={platform.id}><PlatformIcon name={platform.name} color="var(--ink-foreground)" size={34} /><span className="sr-only">{platform.name}</span></span>)}</div><div className="mt-7 flex flex-wrap justify-center gap-3"><a href={SIGNUP_URL} className="btn btn-primary">Start for free <ArrowRight className="size-4" aria-hidden="true" /></a><a href="#pricing" className="btn btn-ink-outline">View plans</a></div><span className="mt-5 block text-sm text-ink-muted">Free plan available. No credit card required.</span></div></div></section>;
}

export function SiteFooter() {
  return <footer className="site-footer"><div className="container-page"><div className="footer-grid"><div><a href="#top" aria-label={`${brand.name} home`}><BrandLockup /></a><p className="mt-5 max-w-xs text-sm leading-relaxed text-muted-foreground">{brand.tagline}</p><p className="footer-publisher">From OpsBrain AI</p><nav className="footer-social-links" aria-label="OpsBrain AI social profiles">{companySocialLinks.map(link => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}><PlatformIcon name={link.name} color="var(--primary)" size={32} />OpsBrain AI on {link.name}<span aria-hidden="true">↗</span></a>)}</nav></div><div><h2 className="text-sm font-semibold">Product</h2><ul>{featureLinks.map(link => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul></div><div><h2 className="text-sm font-semibold">Explore</h2><ul><li><a href="#why">Why EarnedVoice</a></li><li><a href="#how-it-works">How it works</a></li><li><a href="#platforms">Social platforms</a></li><li><a href="#trust">Publishing responsibly</a></li><li><a href="#pricing">Pricing</a></li><li><a href="#faq">Questions & answers</a></li><li><a href={CONTACT_SALES_URL}>Contact</a></li></ul></div><div><h2 className="text-sm font-semibold">Your workspace</h2><ul><li><a href={LOGIN_URL}>Sign in</a></li><li><a href={SIGNUP_URL}>Create a free account</a></li></ul></div></div><div className="footer-bottom"><p>© {new Date().getFullYear()} {brand.name}. All rights reserved.</p><p>Your expertise. Your voice. Your next step.</p></div></div></footer>;
}