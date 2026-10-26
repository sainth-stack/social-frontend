import { ArrowRight, BookOpen, CalendarDays, Check, FileCheck2, PenLine, ShieldCheck, UsersRound } from "lucide-react";

const reasons = [
  { Icon: BookOpen, title: "Start with what you know.", body: "A project lesson. A useful explanation. A point of view earned through experience. Bring that context into your brief, instead of starting from an empty prompt.", outcome: "Your expertise becomes the starting point." },
  { Icon: PenLine, title: "Make it sound like you.", body: "Give AI your audience, tone and brand preferences. Shape the first draft into something you would be comfortable putting your name to.", outcome: "A consistent voice, not interchangeable copy." },
  { Icon: CalendarDays, title: "Build a rhythm you can keep.", body: "Turn scattered ideas into an editable weekly plan. Review each version, choose your publishing time and learn from the available post metrics.", outcome: "A repeatable workflow, not a last-minute scramble." },
];

export function WhyEarnedVoice() {
  return <section id="why" className="section-y positioning-section" aria-labelledby="why-heading"><div className="container-page">
    <div className="positioning-lead"><div><p className="eyebrow">Why EarnedVoice</p><h2 id="why-heading" className="section-heading mt-4">Good work should not<br />be your best-kept secret.</h2></div><p className="section-intro">Your experience deserves more than an occasional update. Give the right people a clearer view of what you do, how you think and why it matters.</p></div>
    <div className="positioning-grid">{reasons.map(({ Icon, title, body, outcome }, i) => <article key={title} className="positioning-card"><div className="positioning-card-top"><Icon aria-hidden="true" /><span>0{i + 1}</span></div><h3>{title}</h3><p>{body}</p><div className="positioning-outcome"><Check aria-hidden="true" /><span>{outcome}</span></div></article>)}</div>
    <a href="#weekly-planner" className="feature-link">See a week take shape <ArrowRight className="size-4" aria-hidden="true" /></a>
  </div></section>;
}

export function PublishingTrust() {
  const safeguards = [
    { Icon: FileCheck2, title: "A draft is a starting point.", body: "Read and edit AI output. You are responsible for checking the facts, permissions and claims in what you publish." },
    { Icon: ShieldCheck, title: "Publishing is a deliberate choice.", body: "Generating a plan does not publish it. Choose the account, content and time before scheduling or publishing." },
    { Icon: UsersRound, title: "Bring another perspective.", body: "Team approval workflows are included on Pro, Growth and Scale. Keep review states visible before taking the next step." },
  ];
  return <section id="trust" className="section-y trust-section" aria-labelledby="trust-heading"><div className="container-page"><div className="section-lead"><p className="eyebrow">Your name is on it</p><h2 id="trust-heading" className="section-heading mt-4">AI helps you draft.<br />You make the final call.</h2><p className="section-intro mt-4">A useful assistant should support your judgment, not replace it.</p></div><div className="trust-grid">{safeguards.map(({ Icon, title, body }) => <article key={title}><Icon aria-hidden="true" /><h3>{title}</h3><p>{body}</p></article>)}</div><p className="trust-note">Keep confidential client work and personal information out of prompts. EarnedVoice does not provide automated fact-checking or confidentiality screening.</p></div></section>;
}