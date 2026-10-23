import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AGENCY_ENQUIRY_URL, brand, faqs, featureLinks, formatINR, LOGIN_URL, plans, SIGNUP_URL } from "@/content/site";
import { BrandLockup } from "./Brand";

export function Pricing() {
  const [open, setOpen] = useState(false);
  const rows: [string, keyof (typeof plans)[number]][] = [
    ["Connected accounts", "accounts"], ["Posts per month", "posts"], ["AI text generations / month", "textGen"],
    ["AI images / month", "images"], ["Brand voice", "brandVoice"], ["Approval workflow", "approvals"],
  ];
  return (
    <section id="pricing" className="section-y">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold md:text-[40px] md:leading-[1.12]">Start free. Choose more room when you need it.</h2>
          <p className="mt-4 text-lg text-muted-foreground">Simple monthly pricing in Indian rupees, with clear limits for content and AI generation.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => (
            <div key={p.id} className={`relative flex flex-col rounded-[20px] border bg-card p-6 ${p.recommended ? "border-2 border-primary shadow-lift" : "shadow-card"}`}>
              {p.recommended && <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">Recommended</span>}
              {p.proposed && <span className="absolute -top-3 left-6 rounded-full border bg-amber-soft px-3 py-1 text-xs font-bold text-amber-foreground">Proposed package</span>}
              <h3 className="text-xl font-bold">{p.name}</h3>
              <p className="mt-1 min-h-12 text-sm text-muted-foreground">{p.audience}</p>
              <p className="mt-4"><span className="font-display text-4xl font-extrabold">{formatINR(p.price)}</span><span className="text-muted-foreground"> / month</span></p>
              {p.proposed ? (
                AGENCY_ENQUIRY_URL ? <a href={AGENCY_ENQUIRY_URL} className="btn btn-outline mt-6">{p.cta}</a>
                  : <button disabled className="btn btn-outline mt-6">Agency enquiries opening soon</button>
              ) : (
                <a href={SIGNUP_URL} className={`btn mt-6 ${p.recommended ? "btn-primary" : "btn-outline"}`}>{p.cta}</a>
              )}
              <dl className="mt-6 grid gap-2.5 border-t pt-5 text-sm">
                {rows.slice(0, 4).map(([l, k]) => (
                  <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{l}</dt><dd className="text-right font-semibold">{String(p[k])}</dd></div>
                ))}
              </dl>
              <ul className="mt-5 grid gap-2 border-t pt-5 text-sm">
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-mint-foreground" />Brand voice</li>
                <li className={`flex gap-2 ${p.approvals === "Not included" ? "text-muted-foreground line-through" : ""}`}><Check className="h-4 w-4 shrink-0 text-mint-foreground" />Approval workflow</li>
              </ul>
              {p.proposed && <p className="mt-4 text-xs text-muted-foreground">For agencies that need a package shaped around account volume, brand workflows and collaboration. Confirm your allocation before purchase.</p>}
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <button aria-expanded={open} aria-controls="compare" onClick={() => setOpen(!open)} className="btn btn-outline">
            Compare plan details <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
        {open && (
          <div id="compare" role="region" aria-label="Plan comparison table, scrolls horizontally" tabIndex={0} className="mt-6 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface"><tr><th className="p-4 text-left">Detail</th>{plans.map((p) => <th key={p.id} className="p-4 text-left">{p.name}</th>)}</tr></thead>
              <tbody>
                <tr className="border-t"><th scope="row" className="p-4 text-left font-medium">Monthly price</th>{plans.map((p) => <td key={p.id} className="p-4">{formatINR(p.price)}</td>)}</tr>
                {rows.map(([l, k]) => (
                  <tr key={k} className="border-t"><th scope="row" className="p-4 text-left font-medium">{l}</th>{plans.map((p) => <td key={p.id} className="p-4">{String(p[k])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-6 space-y-1 text-center text-sm text-muted-foreground">
          <p>Text generations and image generations have separate monthly allowances.</p>
          <p>Prices in INR. Review applicable taxes and billing terms at checkout.</p>
        </div>
      </div>
    </section>
  );
}

export function FAQ() {
  return (
    <section id="faq" className="section-y bg-surface">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <h2 className="text-3xl font-bold md:text-[40px] md:leading-[1.12]">A few things you might be wondering.</h2>
        <Accordion type="single" collapsible className="rounded-2xl border bg-background px-5">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`q${i}`}>
              <AccordionTrigger className="py-5 text-left text-base font-semibold">{f.q}</AccordionTrigger>
              <AccordionContent forceMount className="text-base text-muted-foreground data-[state=closed]:hidden">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section className="py-14 md:py-20">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-[28px] bg-ink px-6 py-14 text-center text-ink-foreground md:px-16 md:py-20">
          <div className="mx-auto mb-8 flex w-fit gap-1.5" aria-hidden="true">
            {Array.from({ length: 7 }).map((_, i) => <span key={i} className={`h-8 w-6 rounded-md ${i === 2 ? "bg-primary" : i === 4 ? "bg-mint" : "bg-ink-muted/25"}`} />)}
          </div>
          <h2 className="mx-auto max-w-2xl text-3xl font-bold md:text-[44px] md:leading-[1.1]">Make room for a more consistent social presence.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink-muted">Bring your ideas, brand voice, and next week of content into one place.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={SIGNUP_URL} className="btn btn-primary px-6">Start planning free</a>
            <a href="#pricing" className="btn btn-ink-outline px-6">Compare plans</a>
          </div>
          <p className="mt-4 text-sm text-ink-muted">Free plan available. You review every draft.</p>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t py-12">
      <div className="container-page grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div><BrandLockup /><p className="mt-4 max-w-xs text-sm text-muted-foreground">{brand.tagline}</p></div>
        <div>
          <p className="text-sm font-bold">Product</p>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
            {featureLinks.slice(0, 5).map((f) => <li key={f.href}><a href={f.href} className="hover:text-foreground">{f.label}</a></li>)}
            <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold">Resources</p>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <li><a href="#how-it-works" className="hover:text-foreground">How it works</a></li>
            <li><a href="#platforms" className="hover:text-foreground">Platforms</a></li>
            <li><a href="#faq" className="hover:text-foreground">FAQ</a></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold">Account</p>
          <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <li><a href={LOGIN_URL} className="hover:text-foreground">Sign in</a></li>
            <li><a href={SIGNUP_URL} className="hover:text-foreground">Start free</a></li>
          </ul>
        </div>
      </div>
      <p className="container-page mt-10 text-sm text-muted-foreground">© {new Date().getFullYear()} OpsBrain AI</p>
    </footer>
  );
}
