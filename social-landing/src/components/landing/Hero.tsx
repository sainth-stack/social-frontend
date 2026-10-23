import { ArrowRight, Coffee, Sparkles } from "lucide-react";
import { SIGNUP_URL } from "@/content/site";

const week = [
  { d: "Mon", t: "Brand story", s: "Scheduled" },
  { d: "Tue", t: "Quick tip", s: "Scheduled" },
  { d: "Wed", t: "Cold brew", s: "Review", active: true },
  { d: "Thu", t: "Behind scenes", s: "Draft" },
  { d: "Fri", t: "Question", s: "Draft" },
  { d: "Sat", t: "Community", s: "Draft" },
  { d: "Sun", t: "Promo", s: "Draft" },
];

export function StatusBadge({ s }: { s: string }) {
  const cls =
    s === "Scheduled" ? "bg-mint-soft text-mint-foreground" : s === "Review" || s === "Needs review" ? "bg-amber-soft text-amber-foreground" : "bg-muted text-muted-foreground";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{s}</span>;
}

function ProductPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[32px] bg-grid" aria-hidden="true" />
      <div className="card-panel shadow-lift overflow-hidden">
        <div className="flex items-center justify-between border-b bg-surface px-5 py-3">
          <p className="font-display text-sm font-bold">Your weekly content plan</p>
          <span className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">Illustrative preview</span>
        </div>
        <div className="grid gap-4 p-5">
          <div className="rounded-xl border bg-primary-soft p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-foreground">Brand brief</p>
            <p className="mt-1 text-sm font-medium">A neighbourhood coffee brand launching a new cold brew</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Behind the scenes", "A quick tip", "Product spotlight"].map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
                  <Sparkles className="h-3 w-3 text-primary" />{c}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {week.map((w) => (
              <div key={w.d} className={`rounded-lg border p-1.5 text-center ${w.active ? "border-primary bg-primary-soft" : "bg-background"}`}>
                <p className="text-[11px] font-bold">{w.d}</p>
                <p className="mt-0.5 hidden truncate text-[10px] text-muted-foreground sm:block">{w.t}</p>
                <span className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${w.s === "Scheduled" ? "bg-mint" : w.s === "Review" ? "bg-amber-foreground" : "bg-border"}`} />
              </div>
            ))}
          </div>
          <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-[120px_1fr]">
            <div className="flex aspect-square items-center justify-center rounded-lg bg-amber-soft text-amber-foreground">
              <Coffee className="h-12 w-12" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Wednesday · Instagram</p>
                <StatusBadge s="Review" />
              </div>
              <p className="mt-2 text-sm leading-relaxed">Your afternoon reset, poured over ice. Meet our new cold brew: slow-steeped, smooth, and ready when you are.</p>
              <p className="mt-2 text-xs font-medium text-primary">#ColdBrew #CoffeeBreak #LocalCafe</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pb-16 pt-12 md:pb-24 md:pt-20">
      <div className="container-page grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border bg-primary-soft px-3 py-1 text-sm font-semibold text-accent-foreground">
            <span className="h-2 w-2 rounded-full bg-mint" /> AI-powered social media planning
          </p>
          <h1 className="mt-6 text-[40px] font-extrabold leading-[1.05] md:text-[64px]">
            Your next week of social content, <span className="text-primary">planned.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Turn a simple business brief into fresh content ideas, on-brand captions, and a ready-to-edit weekly plan. Create, organize, and schedule your social content in one workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={SIGNUP_URL} className="btn btn-primary px-6">Start planning free <ArrowRight className="h-4 w-4" /></a>
            <a href="#weekly-planner" className="btn btn-outline px-6">Explore the weekly planner</a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Free plan available. No credit card needed to start.</p>
        </div>
        <ProductPreview />
      </div>
    </section>
  );
}
