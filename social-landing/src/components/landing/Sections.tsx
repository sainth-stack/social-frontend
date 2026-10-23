import { useState } from "react";
import { Check, CalendarDays, Compass, Lightbulb, PenLine, Palette, Users, Building2, Rocket, User } from "lucide-react";
import { platforms, SIGNUP_URL } from "@/content/site";
import { PlatformIcon } from "./Brand";
import { StatusBadge } from "./Hero";

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 grid gap-3">
      {items.map((i) => (
        <li key={i} className="flex gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-mint-foreground" /><span>{i}</span></li>
      ))}
    </ul>
  );
}

function SectionHead({ eyebrow, title, body, center }: { eyebrow?: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-3 text-3xl font-bold md:text-[40px] md:leading-[1.12]">{title}</h2>
      {body && <p className="mt-4 text-lg text-muted-foreground">{body}</p>}
    </div>
  );
}

export function PlatformGrid() {
  return (
    <section id="platforms" className="border-y bg-surface py-14 md:py-20">
      <div className="container-page">
        <SectionHead center title="Your social channels, coming together." body="Plan around the channels your audience uses, with more integrations on the way." />
        <ul className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {platforms.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border bg-background p-3">
              <PlatformIcon name={p.name} color={p.color} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.name}</p>
                <p className={`text-xs font-semibold ${p.status === "available" ? "text-mint-foreground" : "text-muted-foreground"}`}>
                  {p.status === "available" ? "Integration built" : "Coming soon"}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center text-sm text-muted-foreground">Publishing formats and analytics availability vary by platform.</p>
      </div>
    </section>
  );
}

export function Bridge() {
  const cols = [
    { icon: Lightbulb, t: "Find your next idea", b: "Start with suggestions shaped around your business, audience and goals." },
    { icon: PenLine, t: "Keep your voice consistent", b: "Turn your brand preferences into a clearer starting point for every draft." },
    { icon: CalendarDays, t: "See your week clearly", b: "Organize content before you open another social app." },
  ];
  return (
    <section className="section-y">
      <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <h2 className="text-3xl font-bold md:text-[40px] md:leading-[1.12]">Less time figuring out what to post. More time running your business.</h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {cols.map(({ icon: I, t, b }) => (
            <div key={t} className="border-t-2 border-primary pt-5">
              <I className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-bold">{t}</h3>
              <p className="mt-2 text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    ["Add your brand", "Set your audience, tone, colors and goals."],
    ["Build your plan", "Explore AI suggestions and draft your week."],
    ["Make it yours", "Edit the words, choose visuals and review each post."],
    ["Schedule and review", "Organize publishing and check available performance data."],
  ];
  return (
    <section id="how-it-works" className="section-y">
      <div className="container-page">
        <SectionHead center title="From your first idea to a planned week." />
        <ol className="relative mt-12 grid gap-8 md:grid-cols-4">
          <div className="absolute left-[12%] right-[12%] top-6 hidden h-px bg-border md:block" aria-hidden="true" />
          {steps.map(([t, b], i) => (
            <li key={t} className="relative text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary bg-background font-display font-bold text-primary">{i + 1}</span>
              <h3 className="mt-4 text-lg font-bold">{t}</h3>
              <p className="mx-auto mt-2 max-w-[240px] text-muted-foreground">{b}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center"><a href={SIGNUP_URL} className="btn btn-primary px-6">Build my first plan</a></div>
      </div>
    </section>
  );
}

const samples = {
  "Product launch": { brief: "Launching a new cold brew this Wednesday", caption: "Your afternoon reset, poured over ice. Meet our new cold brew: slow-steeped, smooth, and ready when you are.", tags: "#ColdBrew #NewOnTheMenu" },
  "Weekly tip": { brief: "Share a home-brewing tip with regulars", caption: "Better iced coffee at home: brew it strong, chill it fast, and always pour over fresh ice.", tags: "#CoffeeTips #HomeBrew" },
  "Event": { brief: "Invite locals to Saturday's tasting", caption: "Three single origins, one slow morning. Join our free tasting this Saturday from 10 AM.", tags: "#LocalCafe #CoffeeTasting" },
};

export function ContentStudio() {
  const [tab, setTab] = useState<keyof typeof samples>("Product launch");
  const s = samples[tab];
  return (
    <section id="ai-content-studio" className="section-y bg-surface">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHead eyebrow="AI Content Studio" title="A useful first draft. Not another blank page." body="Turn a topic, product update, or campaign idea into hooks, captions and hashtags. Refine the tone and adapt the draft for the channels you choose." />
          <Bullets items={["Content ideas for your business and goals.", "Editable captions, hooks and hashtags.", "Platform-aware writing and previews.", "Rewriting and variations where included in your plan.", "AI-created images subject to plan allowance."]} />
        </div>
        <div className="card-panel p-5">
          <div role="tablist" aria-label="Sample drafts" className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
            {(Object.keys(samples) as (keyof typeof samples)[]).map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-medium ${tab === k ? "bg-background shadow-card" : "text-muted-foreground"}`}>{k}</button>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Brief</p>
              <p className="mt-2 font-medium">{s.brief}</p>
              <div className="mt-4 flex gap-1.5">{["Instagram", "LinkedIn"].map((c) => <span key={c} className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-accent-foreground">{c}</span>)}</div>
            </div>
            <div className="rounded-xl border border-primary p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Draft caption</p>
              <p className="mt-2 leading-relaxed">{s.caption}</p>
              <p className="mt-2 text-sm font-medium text-primary">{s.tags}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Sample output shown for illustration.</p>
        </div>
      </div>
    </section>
  );
}

export function BrandVoice() {
  return (
    <section id="brand-voice" className="section-y">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <div className="lg:order-2">
          <SectionHead title="Content that starts with your brand." body="Keep your tone, audience, preferred language, colors and logos in one place. Give AI clearer context so every draft is easier to make your own." />
          <Bullets items={["Save writing preferences and brand context.", "Keep colors and logos close to your content workflow.", "Review and refine every draft before publishing."]} />
        </div>
        <div className="card-panel grid gap-5 p-6 lg:order-1">
          <div className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /><p className="font-display font-bold">Brand kit · Corner Café</p></div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Tone</p>
            <div className="mt-2 flex flex-wrap gap-2">{["Warm", "Helpful", "Straightforward"].map((t) => <span key={t} className="rounded-full border border-primary bg-primary-soft px-3 py-1 text-sm font-medium text-accent-foreground">{t}</span>)}</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm font-semibold text-muted-foreground">Audience</p><p className="mt-1">Local professionals, students</p></div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Colors &amp; logo</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="h-7 w-7 rounded-full bg-amber-foreground" /><span className="h-7 w-7 rounded-full bg-amber-soft border" /><span className="h-7 w-7 rounded-full bg-ink" />
                <span className="ml-2 rounded-md border px-2 py-1 text-xs font-semibold">logo.svg ✓</span>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-muted p-3"><p className="text-xs font-semibold text-muted-foreground">Before</p><p className="mt-1 text-sm">New cold brew available now. Buy today.</p></div>
            <div className="rounded-xl bg-mint-soft p-3"><p className="text-xs font-semibold text-mint-foreground">With brand voice</p><p className="mt-1 text-sm">Meet our new cold brew — smooth, slow-steeped and ready when you are.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Calendar() {
  const items = [
    { d: "Mon 12", t: "Meet the team", c: "Instagram", s: "Scheduled" },
    { d: "Tue 13", t: "Iced coffee tips", c: "Facebook", s: "Scheduled" },
    { d: "Wed 14", t: "New cold brew", c: "Instagram", s: "Needs review" },
    { d: "Thu 15", t: "Behind the counter", c: "LinkedIn", s: "Draft" },
    { d: "Fri 16", t: "Friday coffee poll", c: "X", s: "Draft" },
  ];
  return (
    <section id="publishing-calendar" className="section-y bg-surface">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHead title="Your content calendar, without the chaos." body="Bring drafts and scheduled posts into one view. Check the details, choose your channels, and keep your next steps visible." />
          <Bullets items={["Organize drafts and scheduled content.", "Preview platform-specific versions.", "Publish or schedule on available integrations.", "Track publishing status and items needing attention."]} />
        </div>
        <div className="card-panel overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-3"><p className="font-display font-bold">This week</p><span className="text-xs text-muted-foreground">Illustrative preview</span></div>
          <ul>
            {items.map((i) => (
              <li key={i.d} className="flex items-center gap-4 border-b px-5 py-3.5 last:border-b-0">
                <span className="w-14 shrink-0 text-sm font-bold">{i.d}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{i.t}</p><p className="text-xs text-muted-foreground">{i.c}</p></div>
                <StatusBadge s={i.s} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function AnalyticsTeam() {
  const data = [["Mon", 42], ["Tue", 58], ["Wed", 74], ["Thu", 51], ["Fri", 66], ["Sat", 80], ["Sun", 47]] as const;
  return (
    <section className="section-y">
      <div className="container-page grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div id="analytics" className="card-panel p-6 md:p-8">
          <h2 className="text-2xl font-bold md:text-3xl">See what your content is doing.</h2>
          <p className="mt-3 text-muted-foreground">Review available account and post performance in a clearer overview, so your next planning session starts with context.</p>
          <figure className="mt-6">
            <div className="flex h-44 items-end gap-3 border-b border-l pl-2" role="img" aria-label="Illustrative bar chart of post engagements by weekday, highest on Saturday and lowest on Monday.">
              {data.map(([d, v]) => (
                <div key={d} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">{v}</span>
                  <div className="w-full rounded-t-md bg-primary" style={{ height: `${v * 1.6}px` }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-3 pl-2">{data.map(([d]) => <span key={d} className="flex-1 text-center text-xs text-muted-foreground">{d}</span>)}</div>
            <figcaption className="mt-3 text-xs text-muted-foreground">Engagements per day · Illustrative data</figcaption>
          </figure>
        </div>
        <div id="teams-approvals" className="card-panel p-6 md:p-8">
          <h2 className="text-2xl font-bold md:text-3xl">Keep review out of scattered messages.</h2>
          <p className="mt-3 text-muted-foreground">Give your team a shared place to prepare content and review posts before publishing, where included in your plan.</p>
          <ol className="mt-6 grid gap-2">
            {["Draft", "Review", "Scheduled"].map((s, i) => (
              <li key={s} className="flex items-center gap-3 rounded-xl border p-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-accent-foreground">{i + 1}</span>
                <span className="font-medium">{s}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">{["Owner", "Editor", "Reviewer"].map((r) => <span key={r} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{r}</span>)}</div>
        </div>
      </div>
    </section>
  );
}

export function Audience() {
  const items = [
    { i: User, t: "Creators & solo businesses", b: "Turn expertise and everyday ideas into a more consistent content routine." },
    { i: Rocket, t: "Growing brands", b: "Connect brand voice, weekly planning and publishing in one workflow." },
    { i: Building2, t: "Agencies & marketing teams", b: "Bring a more organized approach to content review and multiple brand workflows." },
  ];
  return (
    <section className="section-y bg-surface">
      <div className="container-page">
        <SectionHead center title="Built for the way small teams create." />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {items.map(({ i: I, t, b }) => (
            <div key={t} className="rounded-2xl border bg-background p-6">
              <I className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-bold">{t}</h3>
              <p className="mt-2 text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { Compass, Users };
