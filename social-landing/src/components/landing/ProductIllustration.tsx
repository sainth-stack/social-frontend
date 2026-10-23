import type { ReactNode } from "react";

export type IllustrationKind = "campaign" | "studio" | "publishing" | "brand" | "analytics" | "review" | "plan";

const labels: Record<IllustrationKind, string> = {
  campaign: "Illustrative EarnedVoice campaign workspace with a weekly plan and EarnedVoice launch creative",
  studio: "Illustrative content creation from an EarnedVoice brief to a branded social draft",
  publishing: "Illustrative post previews for Instagram, Facebook and LinkedIn",
  brand: "Illustrative EarnedVoice brand profile guiding a matching social creative",
  analytics: "Illustrative analytics report with example engagements, channel breakdown and CSV export; not customer results",
  review: "Illustrative team review showing a draft, review request and approval states",
  plan: "Illustrative seven-day content plan for an example EarnedVoice launch",
};

function Text({ x, y, children, size = 12, muted = false, weight = 500 }: { x: number; y: number; children: ReactNode; size?: number; muted?: boolean; weight?: number }) {
  return <text x={x} y={y} fill={muted ? "var(--muted-foreground)" : "var(--ink)"} fontSize={size} fontWeight={weight}>{children}</text>;
}

function Frame({ x, y, w, h, title, children }: { x: number; y: number; w: number; h: number; title: string; children?: ReactNode }) {
  return <g transform={`translate(${x} ${y})`}>
    <rect x="0" y="10" width={w} height={h} rx="16" fill="var(--ink)" opacity=".05" />
    <rect width={w} height={h} rx="16" fill="var(--background)" stroke="var(--border)" />
    <path d={`M0 44H${w}`} stroke="var(--border)" />
    <circle cx="18" cy="22" r="3" fill="var(--primary)" /><circle cx="29" cy="22" r="3" fill="var(--border)" /><circle cx="40" cy="22" r="3" fill="var(--border)" />
    <Text x={55} y={26} size={11} weight={600}>{title}</Text>
    {children}
  </g>;
}

function Pill({ x, y, text, tone = "primary" }: { x: number; y: number; text: string; tone?: "primary" | "mint" | "amber" }) {
  const width = text.length * 6 + 24;
  return <g transform={`translate(${x} ${y})`}><rect width={width} height="25" rx="12.5" fill={`var(--${tone}-soft)`} /><text x="12" y="16" fill={tone === "primary" ? "var(--primary)" : `var(--${tone}-foreground)`} fontSize="10" fontWeight="600">{text}</text></g>;
}

function Lines({ x, y, widths = [160, 190, 130] }: { x: number; y: number; widths?: number[] }) {
  return <g fill="var(--border)">{widths.map((w, i) => <rect key={i} x={x} y={y + i * 13} width={w} height="5" rx="2.5" />)}</g>;
}

function Creative({ x, y, w = 210, h = 240, light = false }: { x: number; y: number; w?: number; h?: number; light?: boolean }) {
  return <g transform={`translate(${x} ${y})`}>
    <rect y="8" width={w} height={h} rx="15" fill="var(--ink)" opacity=".08" />
    <rect width={w} height={h} rx="15" fill={light ? "var(--primary-soft)" : "var(--primary)"} />
    <g fill="none" stroke={light ? "var(--primary)" : "var(--primary-foreground)"} opacity=".13" strokeWidth="1.5"><circle cx={w - 20} cy={h - 28} r="85" /><circle cx={w - 20} cy={h - 28} r="64" /><circle cx={w - 20} cy={h - 28} r="43" /></g>
    <text x="20" y="33" fontSize="12" fill={light ? "var(--primary)" : "var(--primary-foreground)"} fontWeight="650" letterSpacing="-.2">EarnedVoice</text>
    <text x="20" y="77" fontSize={w > 200 ? 25 : 22} fontWeight="650" fill={light ? "var(--ink)" : "var(--primary-foreground)"} letterSpacing="-.8"><tspan x="20">Less scattered.</tspan><tspan x="20" dy="30">More aligned.</tspan></text>
    <rect x="20" y={h - 82} width={w - 40} height="62" rx="8" fill="var(--background)" />
    <rect x="30" y={h - 69} width="34" height="5" rx="2.5" fill="var(--primary)" />
    <Lines x={30} y={h - 54} widths={[w - 76, w - 92, w - 110]} />
  </g>;
}

function Avatar({ x, y, initials, mint = false }: { x: number; y: number; initials: string; mint?: boolean }) {
  return <g transform={`translate(${x} ${y})`}><circle r="18" fill={mint ? "var(--mint-soft)" : "var(--primary-soft)"} stroke="var(--background)" strokeWidth="3" /><text y="4" textAnchor="middle" fontSize="10" fontWeight="600" fill={mint ? "var(--mint-foreground)" : "var(--primary)"}>{initials}</text></g>;
}

function Check({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}><circle r="13" fill="var(--mint-soft)" /><path d="m-5 0 3 3 7-7" fill="none" stroke="var(--mint-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g>;
}

function Campaign() {
  return <>
    <Frame x={35} y={42} w={482} h={342} title="EarnedVoice / Launch campaign">
      <Text x={24} y={82} size={22} weight={650}>A good week starts with a plan.</Text>
      <Text x={24} y={105} muted>Launch campaign · October 12–18</Text>
      <Pill x={24} y={124} text="3 channels connected" />
      {["MON", "TUE", "WED"].map((day, i) => <g key={day} transform={`translate(${24 + i * 142} 174)`}>
        <rect width="128" height="141" rx="10" fill={i === 2 ? "var(--primary-soft)" : "var(--surface)"} stroke={i === 2 ? "var(--primary)" : "var(--border)"} />
        <Text x={12} y={23} size={10} muted>{day}</Text><Text x={12} y={53} size={13} weight={600}>{["Brand story", "Practical tip", "Product launch"][i]}</Text>
        <Lines x={12} y={67} widths={[100, 84]} /><Pill x={8} y={104} text={i === 2 ? "In review" : "Scheduled"} tone={i === 2 ? "amber" : "mint"} />
      </g>)}
    </Frame>
    <g transform="rotate(5 508 307)"><Creative x={399} y={192} w={202} h={239} /></g>
    <g transform="translate(66 395)"><rect width="255" height="51" rx="12" fill="var(--background)" stroke="var(--border)" /><Check x={26} y={26} /><Text x={48} y={23} size={12} weight={600}>Your voice. A clearer week.</Text><Text x={48} y={39} size={10} muted>Plan it. Review it. Make it yours.</Text></g>
  </>;
}

function Studio() {
  return <>
    <Frame x={32} y={65} w={316} h={312} title="Content Studio">
      <Text x={22} y={77} size={10} muted>YOUR BRIEF</Text><Text x={22} y={103} size={17} weight={600}>Meet the next launch.</Text>
      <Lines x={22} y={124} widths={[253, 239, 180]} /><Pill x={22} y={177} text="Clear & direct" /><Pill x={22} y={211} text="Brand voice included" tone="mint" />
      <path d="M22 252H294" stroke="var(--border)" /><Text x={22} y={278} size={11} muted>Captions · Hashtags · AI images</Text>
    </Frame>
    <path d="M305 197C355 197 345 140 389 140" fill="none" stroke="var(--primary)" strokeWidth="2" strokeDasharray="5 5" /><path d="m381 134 8 6-8 6" fill="none" stroke="var(--primary)" strokeWidth="2" />
    <g transform="rotate(4 487 215)"><Creative x={375} y={62} w={222} h={267} /></g>
    <Frame x={303} y={324} w={297} h={105} title="Editable draft"><Text x={18} y={69} size={12}>One launch. A shared starting point.</Text><Text x={18} y={88} size={10} muted>#EarnedVoice #ProductLaunch</Text></Frame>
  </>;
}

function Publishing() {
  return <>
    <Frame x={136} y={32} w={369} h={135} title="One campaign, channel-specific drafts"><Text x={22} y={77} size={18} weight={600}>Give your launch a clear voice.</Text><Pill x={22} y={94} text="Ready for your review" tone="mint" /></Frame>
    <g fill="none" stroke="var(--primary)" strokeWidth="2" opacity=".5"><path d="M320 167V200M110 222V200H530V222M320 200V222" /></g>
    {["Instagram", "Facebook", "LinkedIn"].map((name, i) => <Frame key={name} x={30 + i * 202} y={222 + (i === 1 ? 18 : 0)} w={179} h={205} title={name}>
      <rect x="14" y="58" width="151" height="84" rx="8" fill={i === 1 ? "var(--mint-soft)" : "var(--primary-soft)"} /><Text x={26} y={88} size={11} muted>EarnedVoice</Text><Text x={26} y={113} size={15} weight={650}>Built for the team.</Text>
      <Lines x={16} y={158} widths={[141, 113]} /><Text x={16} y={193} size={10} muted>Preview before publishing</Text>
    </Frame>)}
  </>;
}

function Brand() {
  return <>
    <Frame x={36} y={48} w={351} h={364} title="Brand profile / EarnedVoice">
      <Text x={24} y={83} size={25} weight={650}>Make it sound like you.</Text><Text x={24} y={111} size={11} muted>Product teams. Clear ideas. No hype.</Text>
      <Text x={24} y={150} size={10} muted>VOICE & TONE</Text><Pill x={24} y={166} text="Knowledgeable" /><Pill x={24} y={201} text="Approachable" tone="mint" />
      <Text x={24} y={259} size={10} muted>YOUR VISUAL IDENTITY</Text>
      {["primary", "ink", "mint", "primary-soft"].map((color, i) => <rect key={color} x={24 + i * 48} y={275} width="34" height="34" rx="10" fill={`var(--${color})`} stroke="var(--border)" />)}
      <Text x={24} y={341} size={11} muted>One profile. Context for every draft.</Text>
    </Frame>
    <g transform="rotate(5 487 248)"><Creative x={373} y={111} w={222} h={272} /></g>
    <g transform="translate(363 379)"><rect width="231" height="48" rx="12" fill="var(--background)" stroke="var(--border)" /><Check x={25} y={24} /><Text x={46} y={28} size={12} weight={600}>Guided by your brand profile</Text></g>
  </>;
}

function Analytics() {
  return <>
    <Frame x={35} y={38} w={564} h={373} title="Analytics / Illustrative report">
      <Text x={24} y={80} size={20} weight={650}>A clearer view of your content.</Text><Text x={24} y={101} size={11} muted>Example data · Not customer results</Text>
      {[["Engagements", "418"], ["Published posts", "12"], ["Channels", "3"]].map(([label, value], i) => <g key={label} transform={`translate(${24 + i * 176} 121)`}><rect width="164" height="75" rx="10" fill="var(--surface)" /><Text x={14} y={24} size={10} muted>{label}</Text><Text x={14} y={54} size={26} weight={650}>{value}</Text></g>)}
      <g transform="translate(24 218)"><Text x={0} y={0} size={11} weight={600}>Engagement over the week</Text><g stroke="var(--border)" strokeDasharray="3 5"><path d="M0 32H306M0 66H306M0 100H306" /></g><path d="M0 94 51 69 102 82 153 40 204 57 255 22 306 43V111H0Z" fill="var(--primary-soft)" /><path d="M0 94 51 69 102 82 153 40 204 57 255 22 306 43" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" /><Text x={0} y={132} size={10} muted>Mon</Text><Text x={277} y={132} size={10} muted>Sun</Text></g>
      <g transform="translate(362 218)"><Text x={0} y={0} size={11} weight={600}>By channel</Text>{["LinkedIn", "Instagram", "Facebook"].map((name, i) => <g key={name} transform={`translate(0 ${26 + i * 39})`}><Text x={0} y={0} size={10} muted>{name}</Text><rect y="9" width="157" height="6" rx="3" fill="var(--surface)" /><rect y="9" width={133 - i * 31} height="6" rx="3" fill={i === 1 ? "var(--mint)" : "var(--primary)"} /></g>)}</g>
    </Frame>
    <g transform="translate(359 390)"><rect width="225" height="48" rx="12" fill="var(--ink)" /><path d="M23 14v15m-5-5 5 5 5-5m-12 7h14" stroke="var(--ink-foreground)" strokeWidth="1.5" fill="none" /><text x="44" y="29" fill="var(--ink-foreground)" fontSize="12" fontWeight="500">Your report. Ready for CSV.</text></g>
  </>;
}

function Review() {
  return <>
    <Frame x={40} y={42} w={362} h={356} title="EarnedVoice / Post review">
      <Text x={22} y={82} size={11} muted>PRODUCT WORKSPACES LAUNCH</Text><Text x={22} y={110} size={22} weight={650}>Ready for a second look.</Text>
      <rect x="22" y="132" width="318" height="118" rx="10" fill="var(--primary-soft)" /><Text x={40} y={164} size={15} weight={600}>Keep the launch moving.</Text><Lines x={40} y={182} widths={[239, 265, 182]} />
      <Avatar x={42} y={288} initials="AS" /><Text x={70} y={284} size={12} weight={600}>Alex · Content author</Text><Text x={70} y={303} size={10} muted>Submitted for review</Text><Pill x={22} y={318} text="Review requested" tone="amber" />
    </Frame>
    <Frame x={345} y={170} w={253} h={232} title="A clear review path">
      <Avatar x={35} y={80} initials="JM" mint /><Text x={62} y={77} size={12} weight={600}>Jules · Reviewer</Text><Text x={62} y={94} size={10} muted>Product team workspace</Text>
      <path d="M29 128V195" stroke="var(--border)" strokeWidth="2" />
      <Check x={29} y={132} /><Text x={53} y={136} size={12}>Draft prepared</Text><Check x={29} y={166} /><Text x={53} y={170} size={12}>Review requested</Text><Check x={29} y={200} /><Text x={53} y={204} size={12}>Approved</Text>
    </Frame>
    <Pill x={73} y={422} text="Your team decides what is ready" tone="mint" />
  </>;
}

function Plan() {
  return <>
    <Frame x={40} y={47} w={558} h={357} title="Weekly planner / EarnedVoice">
      <Text x={24} y={83} size={23} weight={650}>From a blank week to a plan.</Text><Pill x={24} y={104} text="Build awareness" /><Text x={24} y={163} size={11} muted>SEVEN DAYS. A MIX OF IDEAS.</Text>
      {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day, i) => <g key={day} transform={`translate(${24 + i * 74} 183)`}><Text x={8} y={0} size={10} muted>{day}</Text><rect y="17" width="64" height={i % 2 ? 91 : 122} rx="8" fill={i === 2 ? "var(--primary)" : i % 2 ? "var(--mint-soft)" : "var(--primary-soft)"} /><rect x="10" y="32" width="27" height="5" rx="2" fill={i === 2 ? "var(--primary-foreground)" : "var(--primary)"} /><rect x="10" y="46" width="43" height="4" rx="2" fill={i === 2 ? "var(--primary-foreground)" : "var(--primary)"} opacity=".3" /><rect x="10" y="57" width="32" height="4" rx="2" fill={i === 2 ? "var(--primary-foreground)" : "var(--primary)"} opacity=".3" /></g>)}
    </Frame>
    <g transform="translate(174 368)"><rect width="291" height="68" rx="13" fill="var(--background)" stroke="var(--border)" /><Check x={26} y={33} /><Text x={49} y={29} size={13} weight={600}>Ideas, captions and a next step.</Text><Text x={49} y={48} size={11} muted>Editable before anything goes live.</Text></g>
  </>;
}

const scenes = { campaign: Campaign, studio: Studio, publishing: Publishing, brand: Brand, analytics: Analytics, review: Review, plan: Plan };

export function ProductIllustration({ kind, className = "" }: { kind: IllustrationKind; className?: string }) {
  const Scene = scenes[kind];
  return <svg viewBox="0 0 640 480" width="640" height="480" role="img" aria-label={labels[kind]} className={`product-illustration ${className}`} fontFamily="var(--font-sans)">
    <circle cx="321" cy="243" r="207" fill="var(--primary)" opacity=".035" /><circle cx="321" cy="243" r="170" fill="none" stroke="var(--primary)" opacity=".07" strokeDasharray="3 9" />
    <Scene />
  </svg>;
}