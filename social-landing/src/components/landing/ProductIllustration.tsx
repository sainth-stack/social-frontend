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

function Text({ x, y, children, size = 18, muted = false, weight = 500 }: { x: number; y: number; children: ReactNode; size?: number; muted?: boolean; weight?: number }) {
  return <text x={x} y={y} fill={muted ? "var(--muted-foreground)" : "var(--foreground)"} fontSize={size} fontWeight={weight}>{children}</text>;
}

function Avatar({ x, y, initials, mint = false }: { x: number; y: number; initials: string; mint?: boolean }) {
  return <g transform={`translate(${x} ${y})`}><circle r="18" fill={mint ? "var(--mint-soft)" : "var(--primary-soft)"} stroke="var(--background)" strokeWidth="3" /><text y="4" textAnchor="middle" fontSize="10" fontWeight="600" fill={mint ? "var(--mint-foreground)" : "var(--primary)"}>{initials}</text></g>;
}

function Check({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}><circle r="13" fill="var(--mint-soft)" /><path d="m-5 0 3 3 7-7" fill="none" stroke="var(--mint-foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></g>;
}

function Campaign() {
  return <Plan />;
}

function Studio() {
  return <>
    <Panel x={24} y={46} w={272} h={352}>
      <Text x={24} y={42} size={17} muted>01 / YOUR BRIEF</Text>
      <Text x={24} y={90} size={28} weight={700}>A launch worth</Text><Text x={24} y={124} size={28} weight={700}>talking about.</Text>
      <Text x={24} y={172}>Introduce our new</Text><Text x={24} y={200}>shared workspace.</Text>
      <Text x={24} y={254} muted>VOICE</Text><Badge x={24} y={272} text="Clear & helpful" />
    </Panel>
    <Panel x={320} y={46} w={296} h={388}>
      <Text x={24} y={42} size={17} muted>02 / YOUR DRAFT</Text>
      <Poster x={20} y={64} w={256} h={190} />
      <Text x={24} y={290}>Big ideas. One workspace.</Text><Text x={24} y={318}>Bring your team together.</Text>
      <Badge x={24} y={340} text="Ready to edit" tone="mint" />
    </Panel>
    <Flow x={294} y={205} />
  </>;
}

function Publishing() {
  return <>
    <Text x={42} y={56} size={30} weight={700}>One idea. Three tailored previews.</Text>
    <path d="M320 82V112M118 138V112H522V138" fill="none" stroke="var(--primary)" strokeWidth="2" />
    {["Instagram", "Facebook", "LinkedIn"].map((name, i) => <Panel key={name} x={24 + i * 202} y={138 + (i === 1 ? 24 : 0)} w={188} h={272}>
      <Text x={16} y={35} size={20} weight={650}>{name}</Text>
      <Poster x={12} y={54} w={164} h={120} minimal />
      <Text x={16} y={207} size={16}>{["A little less scattered.", "Meet your team's", "A shared space for"][i]}</Text>
      <Text x={16} y={231} size={16}>{["A lot more connected.", "new starting point.", "your next big idea."][i]}</Text>
      <circle cx="162" cy="33" r="5" fill="var(--mint)" />
    </Panel>)}
  </>;
}

function Brand() {
  return <>
    <Panel x={24} y={34} w={304} h={408}>
      <Text x={24} y={45} size={24} weight={700}>Your brand profile.</Text>
      <Text x={24} y={96} size={16} muted>AUDIENCE</Text><Text x={24} y={126}>Ambitious product teams</Text>
      <Text x={24} y={178} size={16} muted>HOW YOU SOUND</Text><Badge x={24} y={196} text="Helpful" /><Badge x={150} y={196} text="Direct" tone="mint" />
      <Text x={24} y={278} size={16} muted>YOUR PALETTE</Text>
      {["primary", "ink", "mint", "primary-soft"].map((tone, i) => <rect key={tone} x={24 + i * 61} y="299" width="48" height="48" rx="13" fill={`var(--${tone})`} stroke="var(--border)" />)}
      <Text x={24} y={384} size={16} muted>Context for every first draft</Text>
    </Panel>
    <Panel x={352} y={83} w={264} h={310}><Poster x={16} y={16} w={232} h={208} /><Check x={32} y={263} /><Text x={56} y={269} size={17}>Your voice. Your look.</Text></Panel>
    <Flow x={326} y={224} />
  </>;
}

function Analytics() {
  return <Panel x={24} y={30} w={592} h={418}>
    <Text x={26} y={45} size={26} weight={700}>See the story behind your posts.</Text>
    <Text x={26} y={77} size={16} muted>Example data. Not customer results.</Text>
    {[["Engagements", "418"], ["Published posts", "12"], ["Channels", "3"]].map(([label, value], i) => <g key={label} transform={`translate(${26 + i * 183} 102)`}><rect width="170" height="92" rx="14" fill="var(--surface)" /><Text x={16} y={29} size={16} muted>{label}</Text><Text x={16} y={71} size={36} weight={700}>{value}</Text></g>)}
    <g transform="translate(26 229)"><Text x={0} y={0} size={17} weight={600}>Engagement this week</Text><path d="M0 38H305M0 80H305M0 122H305" stroke="var(--border)" /><path d="M0 111 50 84 101 98 152 47 203 69 254 29 305 50V126H0Z" fill="var(--primary-soft)" /><path d="M0 111 50 84 101 98 152 47 203 69 254 29 305 50" stroke="var(--primary)" strokeWidth="4" fill="none" strokeLinejoin="round" /><Text x={0} y={151} size={15} muted>Mon</Text><Text x={274} y={151} size={15} muted>Sun</Text></g>
    <g transform="translate(364 229)"><Text x={0} y={0} size={17} weight={600}>By channel</Text>{["LinkedIn", "Instagram", "Facebook"].map((name, i) => <g key={name} transform={`translate(0 ${34 + i * 48})`}><Text x={0} y={0} size={16} muted>{name}</Text><rect y="12" width="194" height="8" rx="4" fill="var(--surface)" /><rect y="12" width={168 - i * 39} height="8" rx="4" fill={i === 1 ? "var(--mint)" : "var(--primary)"} /></g>)}</g>
  </Panel>;
}

function Review() {
  return <>
    <Panel x={24} y={42} w={278} h={388}><Text x={22} y={41} size={20} weight={650}>A second pair of eyes.</Text><Poster x={18} y={62} w={242} h={208} /><Avatar x={37} y={315} initials="AS" /><Text x={65} y={310} size={17}>Alex, author</Text><Text x={65} y={336} size={16} muted>Submitted for review</Text></Panel>
    <Panel x={326} y={90} w={290} h={302}><Text x={24} y={45} size={24} weight={700}>A clear review path</Text><path d="M36 93V227" stroke="var(--border)" strokeWidth="2" />{["Draft prepared", "Review requested", "Approved by Jules"].map((label, i) => <g key={label}><Check x={36} y={98 + i * 63} /><Text x={64} y={104 + i * 63} size={18} weight={i === 2 ? 650 : 500}>{label}</Text></g>)}</Panel><Flow x={300} y={222} />
  </>;
}

function Plan() {
  return <Panel x={24} y={36} w={592} h={408}>
    <Text x={26} y={49} size={28} weight={700}>A good week starts with a plan.</Text><Text x={26} y={81} muted>Seven days. One clear direction.</Text>
    {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => <g key={i} transform={`translate(${26 + i * 78} 110)`}><Text x={22} y={23} size={20} weight={600}>{day}</Text><rect y="40" width="68" height="94" rx="13" fill={i === 2 ? "var(--primary)" : "var(--primary-soft)"} /><text x="34" y="94" textAnchor="middle" fontSize="27" fill={i === 2 ? "var(--primary-foreground)" : "var(--primary)"}>{12 + i}</text></g>)}
    <rect x="26" y="270" width="540" height="110" rx="16" fill="var(--surface)" /><Text x={46} y={305} size={17} muted>WEDNESDAY / PRODUCT SPOTLIGHT</Text><Text x={46} y={338} size={23} weight={650}>Introduce your next big idea.</Text><Text x={46} y={365} size={16} muted>Caption, creative and publishing time. All editable.</Text>
  </Panel>;
}

function Panel({ x, y, w, h, children }: { x: number; y: number; w: number; h: number; children: ReactNode }) {
  return <g transform={`translate(${x} ${y})`} className="illustration-panel"><rect width={w} height={h} rx="22" fill="var(--card)" stroke="var(--border)" />{children}</g>;
}

function Badge({ x, y, text, tone = "primary" }: { x: number; y: number; text: string; tone?: "primary" | "mint" }) {
  return <g transform={`translate(${x} ${y})`}><rect width={text.length * 8.8 + 30} height="36" rx="18" fill={`var(--${tone}-soft)`} /><text x="15" y="24" fontSize="17" fontWeight="600" fill={tone === "mint" ? "var(--mint-foreground)" : "var(--primary)"}>{text}</text></g>;
}

function Flow({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}><circle cx="14" cy="14" r="20" fill="var(--primary)" /><path d="M5 14H23M16 7L23 14L16 21" stroke="var(--primary-foreground)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>;
}

function Poster({ x, y, w, h, minimal = false, compact = false }: { x: number; y: number; w: number; h: number; minimal?: boolean; compact?: boolean }) {
  return <g transform={`translate(${x} ${y})`}>
    <rect width={w} height={h} rx="14" fill="var(--primary)" />
    <path d={`M${w * .5} ${h}Q${w * .6} ${h * .4} ${w} ${h * .35}V${h}Z`} fill="var(--primary-hover)" />
    <circle cx={w * .83} cy={h * .78} r={h * .15} fill="var(--mint)" />
    <circle cx={w * .83} cy={h * .78} r={h * .27} fill="none" stroke="var(--primary-foreground)" opacity=".25" />
    <text x="18" y="31" fontSize={compact ? 24 : minimal ? 13 : 15} fontWeight="650" fill="var(--primary-foreground)">EarnedVoice</text>
    <text x="18" y={h * .47} fontSize={minimal ? 21 : 29} fontWeight="700" letterSpacing="-.8" fill="var(--primary-foreground)"><tspan x="18">Ideas into</tspan><tspan x="18" dy={minimal ? 25 : 34}>impact.</tspan></text>
  </g>;
}

function CompactScene({ kind }: { kind: IllustrationKind }) {
  const copy = { campaign: ["Your week", "All in one place"], plan: ["A clear week", "Seven editable ideas"], studio: ["Your next draft", "In your brand voice"], publishing: ["Ready to share", "Preview. Review. Publish."], brand: ["Sound like you", "One brand profile"], analytics: ["See the response", "Learn from each post"], review: ["A second look", "Your team makes the call"] }[kind];
  return <Panel x={54} y={48} w={532} h={384}>
    <Text x={36} y={62} size={32} weight={700}>{copy[0]}</Text>
    {kind === "analytics" ? <g transform="translate(38 112)"><path d="M0 150H456M0 75H456" stroke="var(--border)" strokeWidth="2" /><path d="M0 143 76 110 152 128 228 51 304 82 380 22 456 43V170H0Z" fill="var(--primary-soft)" /><path d="M0 143 76 110 152 128 228 51 304 82 380 22 456 43" fill="none" stroke="var(--primary)" strokeWidth="7" strokeLinejoin="round" /></g>
      : kind === "publishing" ? <g>{["Instagram", "Facebook", "LinkedIn"].map((name, i) => <g key={name} transform={`translate(${36 + i * 156} 124)`}><rect width="144" height="150" rx="18" fill={i === 1 ? "var(--mint-soft)" : "var(--primary-soft)"} /><Check x={72} y={59} /><Text x={12} y={113} size={22} weight={600}>{name}</Text></g>)}</g>
      : kind === "plan" || kind === "campaign" ? <g>{["M", "T", "W", "T", "F"].map((day, i) => <g key={i} transform={`translate(${36 + i * 94} 125)`}><rect width="82" height="148" rx="16" fill={i === 2 ? "var(--primary)" : "var(--primary-soft)"} /><text x="41" y="52" textAnchor="middle" fill={i === 2 ? "var(--primary-foreground)" : "var(--primary)"} fontSize="26" fontWeight="600">{day}</text><path d="m25 99 11 11 23-26" stroke={i === 2 ? "var(--primary-foreground)" : "var(--primary)"} strokeWidth="4" fill="none" /></g>)}</g>
        : <Poster x={36} y={99} w={460} h={191} compact />}
    <Text x={36} y={341} size={26} muted>{copy[1]}</Text>
  </Panel>;
}

const scenes = { campaign: Campaign, studio: Studio, publishing: Publishing, brand: Brand, analytics: Analytics, review: Review, plan: Plan };

export function ProductIllustration({ kind, className = "", detail = "full" }: { kind: IllustrationKind; className?: string; detail?: "full" | "compact" }) {
  const Scene = scenes[kind];
  return <svg viewBox="0 0 640 480" width="640" height="480" role="img" aria-label={labels[kind]} data-detail={detail} className={`product-illustration illustration-${kind} ${className}`} fontFamily="var(--font-sans)">
    {detail === "compact" ? <CompactScene kind={kind} /> : <Scene />}
  </svg>;
}