import { ArrowDown, ArrowRight, CalendarDays, Check, Download, FileText, MessageSquare, PenLine, UsersRound } from "lucide-react";
import { BrandMark, PlatformIcon } from "./Brand";
import type { IllustrationKind } from "./ProductIllustration";

const sceneNames: Record<IllustrationKind, string> = {
  campaign: "Illustrative weekly campaign plan", plan: "Illustrative editable weekly content plan",
  studio: "Illustrative brief becoming an editable social draft", publishing: "Illustrative tailored Instagram, Facebook and LinkedIn previews",
  brand: "Illustrative saved brand context guiding a draft", analytics: "Illustrative analytics with example data, not customer results",
  review: "Illustrative author and reviewer approval workflow",
};

function SceneHeader({ title, meta }: { title: string; meta: string }) {
  return <div className="scene-topbar"><span><BrandMark size={25} /><strong>{title}</strong></span><span>{meta}</span></div>;
}

function Draft({ compact = false }: { compact?: boolean }) {
  return <div className={`scene-draft ${compact ? "scene-draft-compact" : ""}`}><div className="scene-draft-author"><span className="scene-avatar">AL</span><div><strong>Alex Lee</strong><span>Product consultant · Example</span></div><PlatformIcon name="LinkedIn" color="var(--primary)" size={30} /></div><p className="scene-draft-hook">The best handoff is a clear next step.</p><p>Our onboarding workshop came back to three questions: what needs deciding, who owns it, and what happens next?</p>{!compact && <div className="scene-takeaways"><span><Check />One decision</span><span><Check />One owner</span><span><Check />One next step</span></div>}<div className="scene-status"><PenLine />Editable draft</div></div>;
}

function StudioScene() {
  return <><SceneHeader title="Content Studio" meta="Brief to draft" /><div className="scene-body"><div className="scene-brief"><span className="scene-label">01 / YOUR EXPERIENCE</span><p>We ran an onboarding workshop. Turn the three handoff lessons into a practical LinkedIn post.</p><div className="scene-chips"><span>Product leaders</span><span>Helpful & direct</span></div></div><div className="scene-transition"><span /><ArrowDown /><span /></div><span className="scene-label">02 / A STARTING POINT, IN YOUR VOICE</span><Draft /></div></>;
}

function PublishingScene() {
  const previews = [
    { name: "LinkedIn", copy: "Three questions that make a handoff work.", detail: "A practical perspective for your professional network.", tag: "Expertise & insight" },
    { name: "Instagram", copy: "Less confusion. A clearer next step.", detail: "A visual checklist with a concise caption.", tag: "Visual & concise" },
    { name: "Facebook", copy: "What makes a great project handoff?", detail: "An accessible introduction that starts a conversation.", tag: "Community & conversation" },
  ];
  return <><SceneHeader title="Channel previews" meta="One idea, adapted" /><div className="scene-body"><div className="scene-source"><FileText /><span>Workshop lesson: make every next step clear.</span></div><div className="scene-publishing-list">{previews.map(({ name, copy, detail, tag }) => <div key={name} className="scene-channel-preview"><PlatformIcon name={name} color="var(--primary)" size={38} /><div><span className="scene-channel-name">{name}<small>{tag}</small></span><strong>{copy}</strong><p>{detail}</p></div></div>)}</div><div className="scene-bottom-note"><CalendarDays /><span>Preview each version. Choose when to publish.</span></div></div></>;
}

function BrandScene() {
  return <><SceneHeader title="Your brand profile" meta="A shared starting point" /><div className="scene-body"><div className="scene-brand-fields"><div><span className="scene-label">YOUR AUDIENCE</span><strong>Product leaders building better teams</strong></div><div><span className="scene-label">YOUR VOICE</span><div className="scene-chips"><span>Helpful</span><span>Specific</span><span>Plain-spoken</span></div></div><div className="scene-palette"><span className="scene-label">YOUR COLORS</span><div><i /><i /><i /><span>A consistent visual identity</span></div></div></div><div className="scene-brand-output"><span className="scene-label">HOW THAT GUIDES THE DRAFT</span><p>“A clear handoff tells the next person what matters, who owns it and where to start.”</p><span className="scene-status"><Check />Brand-guided. Still yours to edit.</span></div></div></>;
}

function AnalyticsScene() {
  const metrics = [{ name: "LinkedIn", count: "196" }, { name: "Instagram", count: "142" }, { name: "Facebook", count: "80" }];
  return <><SceneHeader title="Content performance" meta="Example report" /><div className="scene-body">
    <div className="scene-report-heading"><div><span className="scene-label">ENGAGEMENT THIS WEEK</span><strong>418</strong></div><span className="scene-report-period">Mon to Sun</span></div>
    <svg viewBox="0 0 480 170" className="scene-chart" role="img" aria-label="Illustrative engagement trend with daily values, not customer results"><path d="M18 30H462M18 85H462M18 140H462" stroke="var(--border)" fill="none" /><path d="M18 122 92 84 166 104 240 51 314 70 388 27 462 49V144H18Z" fill="var(--primary-soft)" /><path d="M18 122 92 84 166 104 240 51 314 70 388 27 462 49" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" /><circle cx="388" cy="27" r="6" fill="var(--primary)" /></svg>
    <div className="scene-chart-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
    <div className="scene-channel-metrics">{metrics.map(({ name, count }) => <div key={name}><PlatformIcon name={name} color="var(--primary)" size={30} /><span>{name}</span><strong>{count}</strong></div>)}</div>
    <div className="scene-report-footer"><span>Example data, not customer results.</span><span><Download />CSV export</span></div>
  </div></>;
}

function ReviewScene() {
  return <><SceneHeader title="Team review" meta="A deliberate next step" /><div className="scene-body"><div className="scene-review-post"><MessageSquare /><div><span className="scene-label">WORKSHOP LESSON / LINKEDIN</span><strong>The best handoff is a clear next step.</strong><span>Prepared by Alex · Example draft</span></div></div><ol className="scene-review-timeline">{[{ who: "Alex", action: "Prepared the first draft", state: "Draft", initials: "AL" }, { who: "Alex", action: "Submitted for a second look", state: "In review", initials: "AL" }, { who: "Jules", action: "Approved the revised version", state: "Approved", initials: "JM" }].map(({ who, action, state, initials }) => <li key={state}><span className="scene-avatar">{initials}</span><div><strong>{who}</strong><span>{action}</span></div><span className={`scene-review-state ${state === "Approved" ? "is-approved" : ""}`}>{state}</span></li>)}</ol><div className="scene-bottom-note"><UsersRound /><span>Approval workflows on Pro, Growth and Scale.</span></div></div></>;
}

function PlanScene() {
  return <><SceneHeader title="Your content week" meta="Ideas before publishing" /><div className="scene-body"><div className="scene-plan-days">{["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, i) => <div key={day} className={i === 2 ? "is-selected" : ""}><span>{day}</span><strong>{12 + i}</strong></div>)}</div><div className="scene-brief"><span className="scene-label">WEDNESDAY / SHARE WHAT YOU LEARNED</span><p>Three lessons from your latest workshop.</p><span>Turn a useful experience into a practical post.</span></div><div className="scene-bottom-note"><PenLine /><span>Edit the caption and choose your publishing time.</span></div></div></>;
}

const scenes = { studio: StudioScene, publishing: PublishingScene, brand: BrandScene, analytics: AnalyticsScene, review: ReviewScene, plan: PlanScene, campaign: PlanScene };

export function WorkflowVisual({ kind }: { kind: IllustrationKind }) {
  const Scene = scenes[kind];
  return <div className={`workflow-visual workflow-${kind}`} role="group" aria-label={sceneNames[kind]} data-scene={kind}><Scene /></div>;
}

export function JourneyVisual({ kind }: { kind: IllustrationKind }) {
  const items = {
    plan: { Icon: CalendarDays, label: "A week with direction", detail: "Your goal → seven editable ideas", mark: "01" },
    studio: { Icon: PenLine, label: "A draft with context", detail: "Your brief → your brand voice", mark: "02" },
    publishing: { Icon: FileText, label: "A considered next step", detail: "Preview → choose when to publish", mark: "03" },
    analytics: { Icon: MessageSquare, label: "A clearer response", detail: "Post metrics → your next brief", mark: "04" },
  };
  const { Icon, label, detail, mark } = items[kind as keyof typeof items] ?? items.plan;
  return <div className="journey-visual" aria-hidden="true"><div><Icon /><span>{mark}</span></div><strong>{label}</strong><span>{detail}</span><ArrowRight className="journey-visual-arrow" /></div>;
}