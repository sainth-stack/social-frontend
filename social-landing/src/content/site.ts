function publicUrl(value: string | undefined, fallback: string) {
  try {
    const url = new URL(value || fallback);
    return ["https:", "http:"].includes(url.protocol) ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

export const SITE_URL = publicUrl(process.env.NEXT_PUBLIC_SITE_URL, "https://opsbrainai.com");
export const APP_URL = publicUrl(process.env.NEXT_PUBLIC_APP_URL, "https://app.opsbrainai.com");
export const SIGNUP_URL = `${APP_URL}/register`;
export const LOGIN_URL = `${APP_URL}/login`;
export const CONTACT_SALES_URL = "#contact";

export const seo = {
  title: "EarnedVoice — Social Content for Product-Focused Teams",
  description: "Plan product campaigns, create on-brand content and schedule posts on Instagram, Facebook and LinkedIn. More integrations coming soon. Start free with EarnedVoice.",
};

export const brand = {
  name: "EarnedVoice",
  tagline: "Social content planning, publishing and analytics for startups, software teams and growing businesses.",
};

export type PlatformStatus = "available" | "coming-soon";
export type Platform = { id: string; name: string; status: PlatformStatus; color: string };

export const platforms: Platform[] = [
  { id: "instagram", name: "Instagram", status: "available", color: "oklch(0.6 0.22 0)" },
  { id: "facebook", name: "Facebook", status: "available", color: "oklch(0.55 0.2 260)" },
  { id: "linkedin", name: "LinkedIn", status: "available", color: "oklch(0.5 0.14 245)" },
  { id: "x", name: "X", status: "coming-soon", color: "oklch(0.2 0 0)" },
  { id: "threads", name: "Threads", status: "coming-soon", color: "oklch(0.2 0 0)" },
  { id: "youtube", name: "YouTube", status: "coming-soon", color: "oklch(0.58 0.24 27)" },
  { id: "tiktok", name: "TikTok", status: "coming-soon", color: "oklch(0.2 0 0)" },
  { id: "pinterest", name: "Pinterest", status: "coming-soon", color: "oklch(0.55 0.22 22)" },
  { id: "bluesky", name: "Bluesky", status: "coming-soon", color: "oklch(0.62 0.17 245)" },
];

export const featureLinks = [
  { label: "Content Studio", href: "#ai-content-studio" },
  { label: "Weekly Planner", href: "#weekly-planner" },
  { label: "Brand Voice", href: "#brand-voice" },
  { label: "Publishing & Calendar", href: "#publishing-calendar" },
  { label: "Analytics", href: "#analytics" },
  { label: "Teams & Approvals", href: "#teams-approvals" },
];

export const navLinks = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Contact", href: CONTACT_SALES_URL },
];

export type Plan = {
  id: string;
  name: string;
  price: number;
  audience: string;
  accounts: string;
  posts: string;
  textGen: string;
  images: string;
  brandVoice: string;
  approvals: string;
  cta: string;
  recommended?: boolean;
  custom?: boolean;
};

export const plans: Plan[] = [
  { id: "free", name: "Free", price: 0, audience: "Get started with the essentials.", accounts: "Unlimited", posts: "10", textGen: "30", images: "5", brandVoice: "Included", approvals: "Not included", cta: "Start free" },
  { id: "pro", name: "Pro", price: 499, audience: "Build a consistent social presence.", accounts: "Unlimited", posts: "100", textGen: "300", images: "50", brandVoice: "Included", approvals: "Included", cta: "Choose Pro" },
  { id: "growth", name: "Growth", price: 999, audience: "More content for a growing brand.", accounts: "Unlimited", posts: "500", textGen: "1,500", images: "200", brandVoice: "Included", approvals: "Included", cta: "Choose Growth", recommended: true },
  { id: "scale", name: "Scale", price: 4999, audience: "Higher capacity for bigger ambitions.", accounts: "Unlimited", posts: "Tailored to your team", textGen: "Tailored to your team", images: "Tailored to your team", brandVoice: "Included", approvals: "Included", cta: "Contact sales", custom: true },
];

export const formatINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const faqs = [
  { q: "What is EarnedVoice?", a: "EarnedVoice helps startups, software teams and businesses turn product updates and campaign briefs into on-brand social content, a weekly plan and a coordinated publishing workflow." },
  { q: "Can it help me decide what to post?", a: "Yes. Start with your business, audience and goal to generate content ideas and a seven-day starting plan. Review and edit the drafts before you schedule them." },
  { q: "Does it generate a full week of content?", a: "Yes. Set your business, audience and goal to create a seven-day content plan with topics, captions and suggested formats. Edit each draft and choose when it goes live. Generation allowances depend on your plan." },
  { q: "Which platforms can I use?", a: "Instagram, Facebook and LinkedIn are available now. X, Threads, YouTube, TikTok, Pinterest and Bluesky are coming soon and cannot be connected yet. Supported post formats and analytics vary by platform and account permissions." },
  { q: "Will the content sound like my brand?", a: "You can add brand context and writing preferences to guide generation. AI gives you a starting draft; you stay in control of the final wording." },
  { q: "Does the planner publish posts automatically?", a: "Generating a plan does not publish it. Review your content and deliberately choose scheduling or publishing on an available integration." },
  { q: "Is there a free plan?", a: "Yes. Start with the Free plan and its monthly content and AI allowances. A credit card is not required to create a free account." },
  { q: "How many social accounts can I connect?", a: "Every plan includes unlimited social accounts, including Free and Scale. You can connect accounts on currently available integrations. Monthly post and AI allowances still depend on your plan." },
  { q: "How do I get the Scale plan?", a: "Scale is ₹4,999 per month and is available through sales, not self-service checkout. Use Contact sales to discuss your team's tailored post, AI text and image allowances. Social accounts are unlimited." },
  { q: "How do AI allowances work?", a: "Plans include separate monthly allowances for AI text generations and AI images. Check your usage in the app before creating more content." },
  { q: "Can my team review posts?", a: "Yes. Pro, Growth and Scale include approval workflows so your team can review content before it is scheduled or published." },
  { q: "Does EarnedVoice guarantee reach or engagement?", a: "No. AI can help with planning and drafting, but audience response depends on your content, platform and business." },
];
