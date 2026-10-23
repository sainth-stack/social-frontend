import { ArrowRight, Check, CheckCheck, CircleDashed, MessageSquare, PenLine } from "lucide-react";
import { platforms, SIGNUP_URL } from "@/content/site";
import { PlatformIcon } from "./Brand";
import { StatusBadge } from "./Hero";
import { StudioDemo } from "./StudioDemo";

function SectionHead({ eyebrow, title, body, center = false }: { eyebrow: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="section-heading mt-4 text-balance">{title}</h2>
      {body && <p className="section-intro mt-5 text-pretty">{body}</p>}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-7 grid gap-3 text-sm leading-relaxed md:text-base">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <Check className="mt-1 h-4 w-4 shrink-0 text-mint-foreground" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PlatformGrid() {
  return (
    <section id="platforms" aria-labelledby="platforms-heading" className="border-y bg-background py-10 md:py-12">
      <div className="container-page">
        <h2 id="platforms-heading" className="text-center text-sm font-medium text-muted-foreground">Your social world. One bigger picture.</h2>
        <ul className="platform-ribbon mt-8">
          {platforms.map((platform) => (
            <li key={platform.id} className="platform-ribbon-item">
              <PlatformIcon name={platform.name} color="var(--foreground)" size={46} />
              <span>{platform.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Bridge() {
  const outcomes = [
    { number: "01", title: "Start with product context.", body: "Bring your launch brief, audience and brand voice into the same content workflow." },
    { number: "02", title: "Make the campaign ready.", body: "Shape channel-specific drafts, review the details and choose a publishing schedule." },
    { number: "03", title: "Inform the next brief.", body: "Review available post metrics to decide what to explore in your next campaign." },
  ];
  return (
    <section className="section-y">
      <div className="container-page">
        <div className="overflow-hidden rounded-3xl border border-ink bg-ink text-ink-foreground">
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:gap-16 lg:p-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-ink-muted">One connected workflow</p>
              <h2 className="section-heading mt-5 max-w-xl text-balance">Your product moves forward. Keep your story moving with it.</h2>
              <p className="mt-5 max-w-lg leading-relaxed text-ink-muted">Turn release notes, useful ideas and campaign goals into a weekly publishing rhythm. Less scattered context. A clearer next step for the team.</p>
              <a href="#weekly-planner" className="btn btn-primary mt-7">Explore the planner <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
            </div>
            <div className="rounded-2xl border border-ink-foreground/15 bg-primary/15 p-5 sm:p-6">
              <p className="text-xs font-medium text-ink-muted">Fictional campaign · Northstar</p>
              <h3 className="mt-3 text-xl font-semibold">Product workspaces launch</h3>
              <ol className="mt-6 space-y-5">
                {outcomes.map((outcome) => (
                  <li key={outcome.number} className="flex gap-4 border-t border-ink-foreground/15 pt-5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">{outcome.number}</span>
                    <div><h4 className="text-sm font-semibold">{outcome.title}</h4><p className="mt-2 text-sm leading-relaxed text-ink-muted">{outcome.body}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <p className="border-t border-ink-foreground/15 px-6 py-4 text-xs leading-relaxed text-ink-muted sm:px-10 lg:px-12">AI helps with the draft. Your team decides what is ready to publish.</p>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    { title: "Connect your accounts", body: "Link the social accounts you manage to your workspace." },
    { title: "Create your content", body: "Write a brief, generate a draft and refine the copy and visuals." },
    { title: "Review with your team", body: "Collect feedback and approve posts before they go live." },
    { title: "Schedule and track", body: "Set publish times and review performance across your connected channels." },
  ];
  return (
    <section id="how-it-works" className="section-y border-y bg-surface">
      <div className="container-page">
        <SectionHead center eyebrow="How it works" title="From connected accounts to published posts." body="Manage content creation, review and scheduling in four steps." />
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="relative border-t pt-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border bg-background font-display text-sm font-semibold text-primary">0{index + 1}</span>
              <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <a href={SIGNUP_URL} className="btn btn-primary">Create your workspace <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}

export function ContentStudio() {
  return (
    <section id="ai-content-studio" className="section-y overflow-hidden">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHead eyebrow="AI Content Studio" title="Give your next launch a clear starting point." body="Turn a product brief into captions, hashtags and visuals. Refine the technical details, adapt the message and review each post before publishing." />
          <Bullets items={["Generate hooks, captions and hashtags from one brief.", "Adapt drafts for each channel’s format.", "Create AI images within your plan’s allowance."]} />
          <a href={SIGNUP_URL} className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Create your first draft <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
        </div>
        <div className="rounded-3xl bg-lilac p-3 sm:p-6 lg:p-7">
          <StudioDemo />
        </div>
      </div>
    </section>
  );
}

export function BrandVoice() {
  return (
    <section id="brand-voice" className="section-y bg-surface">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="lg:order-2">
          <SectionHead eyebrow="Brand voice & visual identity" title="Your brand standards, built into every draft." body="Save your audience, tone and visual identity in one brand profile. Use those standards to guide content generation." />
          <Bullets items={["Set your tone, audience and writing preferences.", "Store brand colors and logos in one place.", "Review generated copy against your brand guidelines."]} />
        </div>
        <figure className="rounded-3xl border bg-primary-soft p-4 sm:p-7 lg:order-1">
          <div className="preview-window bg-background">
            <div className="window-heading flex items-center justify-between gap-3 border-b px-5 py-4">
              <span className="text-sm font-semibold">Brand profile</span>
              <span className="flex items-center gap-1 text-xs text-mint-foreground"><Check className="h-3.5 w-3.5" aria-hidden="true" /> Saved</span>
            </div>
            <div className="p-5 sm:p-6">
              <div className="border-b pb-5">
                <p className="text-xl font-semibold tracking-tight">Northstar</p>
                <p className="mt-1 text-xs text-muted-foreground">Product workspaces for software teams</p>
              </div>
              <dl className="divide-y text-sm">
                <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4"><dt className="text-muted-foreground">Audience</dt><dd className="sm:col-span-2">Product leads, engineers and startup teams</dd></div>
                <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4"><dt className="text-muted-foreground">Tone</dt><dd className="sm:col-span-2">Clear, knowledgeable, approachable</dd></div>
                <div className="grid gap-1 py-4 sm:grid-cols-3 sm:gap-4"><dt className="text-muted-foreground">Writing style</dt><dd className="sm:col-span-2">Lead with the use case. Explain the detail. Avoid hype.</dd></div>
              </dl>
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground">Brand colors</p>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {[
                  { name: "Indigo", color: "bg-primary" },
                  { name: "Cloud", color: "bg-primary-soft" },
                  { name: "Slate", color: "bg-muted-foreground" },
                  { name: "Ink", color: "bg-ink" },
                ].map((swatch) => (
                  <li key={swatch.name} className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full border border-foreground/10 ${swatch.color}`} aria-hidden="true" />
                    <span className="text-xs text-muted-foreground">{swatch.name}</span>
                  </li>
                ))}
                </ul>
              </div>
              <div className="mt-5 rounded-xl border bg-surface p-4">
                <p className="text-xs font-semibold text-muted-foreground">Example draft</p>
                <p className="mt-2 text-sm leading-relaxed">“Your next release has a lot of moving parts. Keep the notes, decisions and launch tasks together in a Northstar product workspace.”</p>
              </div>
            </div>
          </div>
          <figcaption className="mt-4 text-center text-xs text-muted-foreground">Fictional brand profile · Northstar software launch</figcaption>
        </figure>
      </div>
    </section>
  );
}

export function Calendar() {
  const posts = [
    { day: "Mon", date: "12", time: "9:00 AM", title: "Introducing product workspaces", platform: platforms[2], status: "Scheduled", color: "bg-primary-soft" },
    { day: "Tue", date: "13", time: "12:30 PM", title: "Inside the release planning workflow", platform: platforms[0], status: "Needs review", color: "bg-amber-soft" },
    { day: "Wed", date: "14", time: "Not set", title: "Product workspace walkthrough", platform: platforms[1], status: "Draft", color: "bg-lilac" },
  ];
  return (
    <section id="publishing-calendar" className="section-y">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHead eyebrow="Publishing & calendar" title="A clear view of every scheduled post." body="See drafts, reviews and scheduled posts in one calendar. Check what is ready to publish and what needs attention." />
          <Bullets items={["Track draft, review and scheduled statuses.", "Check channel-specific previews before publishing.", "Set publish times for your connected accounts."]} />
        </div>
        <figure className="rounded-3xl bg-sky-soft p-3 sm:p-6">
          <div className="preview-window overflow-hidden bg-background">
            <div className="window-heading flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div><p className="text-sm font-semibold">Northstar launch week</p><p className="mt-1 text-xs text-muted-foreground">October 12–18 · Product workspaces</p></div>
              <span className="rounded-lg border bg-surface px-3 py-1.5 text-xs font-medium">Agenda view</span>
            </div>
            <ul className="divide-y">
              {posts.map((post) => (
                <li key={post.day} className="flex gap-3 px-4 py-5 sm:gap-4 sm:px-5">
                  <div className="w-10 shrink-0 text-center"><p className="text-xs text-muted-foreground">{post.day}</p><p className="mt-1 font-display text-2xl font-semibold">{post.date}</p></div>
                  <div className={`min-w-0 flex-1 rounded-xl border border-foreground/5 p-3 ${post.color}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{post.time}</span><StatusBadge s={post.status} /></div>
                    <p className="mt-3 text-sm font-semibold">{post.title}</p>
                    <div className="mt-3 flex items-center gap-2">{post.platform && <><PlatformIcon name={post.platform.name} color={post.platform.color} size={20} /><span className="text-xs text-muted-foreground">{post.platform.name}</span></>}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 border-t bg-surface px-5 py-3 text-xs text-muted-foreground"><CircleDashed className="h-3.5 w-3.5" aria-hidden="true" /> Drafts stay unpublished until you schedule or publish them.</div>
          </div>
          <figcaption className="mt-4 text-center text-xs text-muted-foreground">Fictional Northstar campaign · Example publishing calendar</figcaption>
        </figure>
      </div>
    </section>
  );
}

export function AnalyticsTeam() {
  return (
    <section className="section-y bg-surface">
      <div className="container-page grid gap-6 lg:grid-cols-2">
        <article id="analytics" className="flex min-w-0 flex-col rounded-3xl border bg-background p-6 md:p-8">
          <p className="eyebrow">Analytics</p>
          <h2 className="mt-4 max-w-sm text-balance text-3xl font-semibold leading-tight">Understand what earns attention.</h2>
          <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">Compare post performance and engagement across connected accounts. Use the results to guide your next campaign.</p>
          <figure className="mt-8 rounded-2xl border bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Northstar launch week · Example</p><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />Daily engagements</span></div>
            <svg viewBox="0 0 400 180" role="img" aria-label="Example daily engagements: Monday 42, Tuesday 58, Wednesday 74, Thursday 51, Friday 66, Saturday 80, Sunday 47. Illustrative data, not customer results." className="mt-5 h-auto w-full overflow-visible">
              <g stroke="currentColor" className="text-border" strokeDasharray="3 5"><path d="M24 28H378 M24 76H378 M24 124H378" /></g>
              <path d="M24 103L83 77L142 52L201 89L260 65L319 42L378 95V144H24Z" fill="currentColor" className="text-primary-soft" />
              <path d="M24 103L83 77L142 52L201 89L260 65L319 42L378 95" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="text-primary" />
              <g fill="currentColor" className="text-primary"><circle cx="24" cy="103" r="4" /><circle cx="83" cy="77" r="4" /><circle cx="142" cy="52" r="4" /><circle cx="201" cy="89" r="4" /><circle cx="260" cy="65" r="4" /><circle cx="319" cy="42" r="4" /><circle cx="378" cy="95" r="4" /></g>
              <g fill="currentColor" className="text-muted-foreground" fontSize="11" textAnchor="middle"><text x="24" y="168">Mon</text><text x="83" y="168">Tue</text><text x="142" y="168">Wed</text><text x="201" y="168">Thu</text><text x="260" y="168">Fri</text><text x="319" y="168">Sat</text><text x="378" y="168">Sun</text></g>
            </svg>
            <figcaption className="mt-2 text-xs leading-relaxed text-muted-foreground">Illustrative data, not customer results. Available metrics depend on the connected platform.</figcaption>
          </figure>
        </article>
        <article id="teams-approvals" className="flex min-w-0 flex-col rounded-3xl border bg-background p-6 md:p-8">
          <p className="eyebrow">Teams & approvals</p>
          <h2 className="mt-4 max-w-sm text-balance text-3xl font-semibold leading-tight">Keep feedback and approvals in one place.</h2>
          <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">Share drafts with reviewers, collect feedback and track approval status before scheduling.</p>
          <div className="mt-8 flex-1 rounded-2xl bg-primary-soft p-4 sm:p-5">
            <div className="rounded-xl border bg-background p-4">
              <p className="text-xs text-muted-foreground">Northstar / Product workspaces launch</p>
              <p className="mt-2 text-sm font-semibold">Introducing product workspaces.</p>
              <div className="mt-4 flex items-start gap-2.5 border-t pt-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lilac text-xs font-semibold" aria-hidden="true">J</span>
                <div><p className="text-xs font-semibold">Jules · Product reviewer</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Lead with the release planning use case. Please check the feature names against the launch brief.</p></div>
                <MessageSquare className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
            </div>
            <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Example approval workflow">
              {[
                { label: "Draft", icon: PenLine },
                { label: "Review", icon: MessageSquare },
                { label: "Ready", icon: CheckCheck },
              ].map(({ label, icon: Icon }, index) => (
                <li key={label} className={`rounded-xl border p-2.5 text-center ${index === 1 ? "border-amber-foreground/30 bg-amber-soft" : "bg-background"}`}>
                  <Icon className={`mx-auto h-4 w-4 ${index === 2 ? "text-mint-foreground" : "text-amber-foreground"}`} aria-hidden="true" />
                  <p className="mt-2 text-xs font-semibold">{label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{index === 0 ? "Written" : index === 1 ? "In progress" : "Up next"}</p>
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Fictional review workflow · Approvals included on Pro, Growth and Scale.</p>
        </article>
      </div>
    </section>
  );
}

export function Audience() {
  const audiences = [
    { label: "Startups", title: "Make room for a publishing rhythm.", body: "Turn founder insights, product updates and launch ideas into drafts you can review and schedule.", color: "bg-lilac", detail: "Founders & lean marketing teams" },
    { label: "Software teams", title: "Translate product detail into a clear story.", body: "Build a campaign around a release, explain practical use cases and keep technical reviews organized.", color: "bg-primary-soft", detail: "SaaS & product-led businesses" },
    { label: "Growing businesses", title: "Keep campaigns and teams aligned.", body: "Use shared brand context, campaign drafts and approval workflows to coordinate your social presence.", color: "bg-sky-soft", detail: "In-house marketing & multi-brand teams" },
  ];
  return (
    <section className="section-y">
      <div className="container-page">
        <SectionHead center eyebrow="Who it’s for" title="For teams building something worth explaining." body="A focused social content workflow for startups, software teams and growing businesses." />
        <ul className="mt-12 grid gap-5 md:grid-cols-3">
          {audiences.map((audience) => (
            <li key={audience.label} className={`flex flex-col rounded-3xl p-6 md:p-7 ${audience.color}`}>
              <p className="text-xs font-semibold text-muted-foreground">{audience.label}</p>
              <h3 className="mt-7 text-2xl font-semibold leading-tight">{audience.title}</h3>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{audience.body}</p>
              <div className="mt-8 border-t border-foreground/10 pt-4"><p className="text-xs font-medium">{audience.detail}</p></div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
