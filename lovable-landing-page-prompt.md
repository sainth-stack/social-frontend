# OpsBrain AI — landing-page strategy and Lovable prompt

## 1. Scope and reference review

Prepared from the public Hyvo homepage, pricing page, FAQ page, the supplied pricing screenshot and OpsBrain logo images, and a read-only review of the existing application on 23 October 2026. This is a marketing-page specification, not an implementation or a verification of live third-party publishing.

Reference pages:
- https://gethyvo.com/
- https://gethyvo.com/pricing
- https://gethyvo.com/faq

### What Hyvo does well, end to end

| Page stage | Observed approach | Recommendation for OpsBrain AI |
| --- | --- | --- |
| Acquisition | Optional offer strip, compact floating navigation, visible sign-in and free signup | Use a quiet sticky header. Do not invent a launch discount. |
| First impression | Short outcome-led heading, brief supporting copy, free CTA, secondary demo CTA | Lead with planning a week of content, not a vague all-in-one AI claim. |
| Hero proof | Human team photograph with floating product and metric cards | Differentiate with original, readable product UI: brief → ideas → weekly plan. |
| Platform reassurance | Recognizable platform logos and names | Show the proposed nine-platform ecosystem with explicit availability labels. |
| Product explanation | Embedded demo followed by a four-step create/publish/learn/improve loop | Use an interactive, deterministic seven-day-plan demo and a four-step workflow. |
| Feature evidence | Alternating copy/illustration sections for publishing, media, analytics, AI and approvals | Give each important feature a believable UI illustration rather than only a generic icon. |
| Outcome reinforcement | Calendar, brand consistency, performance and previews | Explain fewer blank-page moments, consistent brand voice, easier planning and clearer reporting. |
| Conversion | Four pricing cards with a highlighted Growth tier; separate detailed comparison on pricing page | Use four INR tiers and highlight ₹999 Growth. Keep approved pricing distinct from proposed quotas. |
| Objection handling | FAQs on setup, integrations, pricing, AI usage, privacy and teams | Address those topics in original copy; do not borrow unsupported privacy or billing promises. |
| Final conversion | Repeated free CTA and integration reassurance | Repeat the weekly-planning benefit and free-plan CTA. |
| Footer | Product, resources, company and legal links | Only publish real destinations. No invented blog, certification, support channel or legal policy. |

### Visual observations

Hyvo uses a predominantly white canvas, dark text, restrained blue accents, compact rounded navigation, generous section separation, lightly bordered cards, recognizable platform colors, product illustrations and strong black CTAs. Its pricing layout is unusually easy to scan: plan → audience → price → action → short limits list. Retain that clarity, but create an independent OpsBrain layout, violet identity, illustrations and copy.

### Do not transfer these reference claims automatically

Canva and Unsplash integrations, an AI agent answering questions from live account metrics, automatic best-time optimization, competitor research, unlimited posting, specific analytics retention periods, AI training guarantees and priority service commitments all need independent product verification. Video generation or video publishing should not be advertised merely because video templates or upload controls exist.

## 2. Product and launch decisions

### Positioning

**OpsBrain AI helps creators, small businesses and marketing teams turn a business brief into on-brand content and a ready-to-edit weekly social plan.**

Primary message: **Your next week of social content, planned.**

Supporting message: **Get AI content ideas, write in your brand voice, and organize your posts in one workspace.**

### What the existing application establishes

- Brand: OpsBrain AI. Existing mark is available in the frontend brand assets.
- The frontend is already Next.js. Its root currently redirects users into authentication rather than serving a public marketing page.
- Facebook, Instagram, LinkedIn and X have integration/publisher implementations. Code presence is not proof of production approval, healthy OAuth permissions or successful live publishing.
- The content-plan publishing pipeline currently targets Facebook, Instagram and LinkedIn; do not imply identical capabilities on every connected platform.
- Relevant product areas include AI caption generation, rewriting, brand voice/brand kit, image generation, a media library, AI content planning, scheduling, calendar, analytics, teams and approvals.
- Existing pricing has Free, Pro at ₹499 and Growth at ₹999. The ₹4,999 tier is new work, not an existing checkout plan.
- Existing quotas distinguish text generations and image generations; they are not one interchangeable AI-credit balance.

### Four tiers, not three

The requested amounts are interpreted as **Free + three paid plans**:

| Plan | Monthly price | Audience | Action |
| --- | --- | --- | --- |
| Free | ₹0 | Try the core workflow | Start free |
| Pro | ₹499 | Creators and solo businesses | Choose Pro |
| Growth | ₹999 | Growing brands and small teams | Choose Growth |
| Agency | ₹4,999 | Agencies managing multiple brands | Enquire about Agency until checkout exists |

Do not invent annual discounts, lifetime offers, a free trial duration or unlimited usage. Paid features and allowances must be checked against the live catalog before public launch.

### Proposed nine-platform list

The five expansion channels below are a proposal because the requested nine were not individually named:

| Platform | Specification status |
| --- | --- |
| Instagram | Integration implemented; validate launch capability |
| Facebook | Integration implemented; validate launch capability |
| LinkedIn | Integration implemented; validate launch capability |
| X | Integration implemented; validate launch capability and plan/API restrictions |
| Threads | Proposed expansion — Coming soon |
| YouTube | Proposed expansion — Coming soon |
| TikTok | Proposed expansion — Coming soon |
| Pinterest | Proposed expansion — Coming soon |
| Bluesky | Proposed expansion — Coming soon |

The design can include all nine now. The published site should not call an unimplemented channel supported. Use “Your social channels, coming together” with clear “Coming soon” labels. Change labels only after the relevant capabilities are released and verified.

### Feature parity roadmap, not immediate promises

| Capability | Landing treatment |
| --- | --- |
| On-brand captions, hooks, hashtags and rewriting | Core product story; describe useful outputs without guaranteeing performance |
| Seven-day content plan | Main differentiator; editable ideas and drafts, not an autonomous guaranteed-results agent |
| Brand voice, colors and logos | Show an original brand-kit UI |
| AI image creation and media | Describe image creation subject to plan allowances |
| Calendar and scheduling | Show review-before-schedule workflow; platform capabilities vary |
| Analytics | Show an illustrative overview, not invented customer results or unsupported recommendations |
| Teams and approvals | Explain workflow; avoid unapproved seat and workspace limits |
| Five additional networks | Coming soon |
| Canva/Unsplash, unified inbox, competitor intelligence | Exclude from current feature claims unless separately implemented |
| Analytics-grounded AI agent and automatic best-time optimization | Future candidates; do not show as live |
| Video generation and automatic video publishing | Exclude from launch claims until verified |

---

## 3. Copy-paste prompt for Lovable

Copy everything from “START PROMPT” to “END PROMPT” into Lovable. Attach the supplied OpsBrain logo and the Hyvo pricing screenshot for visual context.

### START PROMPT

Act as a senior SaaS product designer, conversion copywriter and frontend engineer. Create a polished, production-quality public marketing landing page for **OpsBrain AI**, an AI-powered social media planning and management product.

The result must look like a carefully art-directed SaaS website, not a generic generated template. The most important deliverable is a complete, beautiful landing page with readable product storytelling, original product visuals and working interactions.

### A. Product goal and scope

Help a first-time visitor understand in a few seconds:
1. What OpsBrain AI does.
2. How AI helps them choose what to post.
3. How a short business brief becomes a seven-day content plan.
4. How they can edit, organize and schedule content.
5. Which channels are available and which are coming soon.
6. Which INR plan fits them.
7. How to start free.

Build the public landing page, not the authenticated application. Do not build a new dashboard, backend, payment integration, authentication system or database. Keep demos local and clearly illustrative. Do not add Supabase or other backend services merely to power the marketing page.

### B. Technical requirements

- Required target stack: Next.js App Router, React, TypeScript, Tailwind CSS and accessible Radix/shadcn-style primitives.
- Confirm the generation environment supports Next.js. If it only supports React/Vite, explain that limitation before implementation. Do not silently call a Vite application Next.js. A portable React prototype is acceptable only after explicit approval.
- Keep the page mostly server-rendered; isolate client components for the menu, tabs, demo and FAQ.
- Use a central typed content/config module for brand information, plan prices, platform availability, feature flags and app URLs.
- Marketing and authenticated application are separate concerns. Configure the existing app URL; signup goes to its /register route and sign-in to /login. Do not hardcode localhost in production links.
- Preserve the current application if integrating into an existing Next.js repository. Do not replace authentication, Redux, billing flows or dashboard routes.
- Use semantic HTML and real text in product mockups, not giant screenshots with unreadable labels.
- Use optimized images, SVG/CSS for lightweight interface artwork, and lazy-load noncritical media. Avoid heavy WebGL, autoplay background video and unnecessary animation libraries.
- No code comments. Keep components focused and maintainable.

### C. Reference interpretation

Study https://gethyvo.com/ for its calm white canvas, strong hierarchy, concrete feature explanations, visible product illustrations, simple pricing and repeated free CTA.

Do not copy Hyvo's name, wording, imagery, screenshots, logo, exact layouts or proprietary artwork. Build an original OpsBrain identity. Do not copy its blue palette wholesale. Our signature is violet with a small mint accent, drawn from the supplied brain logo.

Avoid the usual AI-site clichés: dark neon backgrounds, giant purple gradient text, decorative floating spheres, excessive glass cards, meaningless analytics numbers, six identical feature cards, huge empty gaps and wall-to-wall sparkles.

### D. Theme and design tokens

Design direction: **calm intelligence, practical creativity, premium simplicity**.

Palette:
- Canvas: #FFFFFF.
- Alternating section surface: #F8FAFC.
- Primary text: #111827.
- Secondary text: #475569.
- Brand violet: #4F46E5.
- Brand violet hover: #4338CA.
- Soft violet surface: #EEF2FF.
- Borders: #E2E8F0.
- Small mint accent: #10B981, used decoratively or for status with sufficiently dark accompanying text.
- Dark final-CTA surface: #111827.

Turn these into reusable CSS variables. Do not scatter arbitrary colors throughout the page. Use official platform colors only inside their logos or subtle platform-specific UI accents. Check WCAG AA contrast, especially muted text, badges and text on colored surfaces.

Typography:
- Headings: Plus Jakarta Sans, weight 600–800.
- Body/UI: Inter, weight 400–600.
- Desktop hero heading: approximately 60–68px, tight but readable line height.
- Mobile hero heading: approximately 38–44px, no awkward single-word overflow.
- Section headings: approximately 36–44px desktop and 28–32px mobile.
- Body text: 16–18px. Do not shrink important copy to make it fit.
- Feature labels can be 12–14px; uppercase only for short eyebrows.

Layout:
- Main maximum width approximately 1180–1200px.
- Desktop horizontal gutters 32px; mobile 20px.
- Section padding approximately 88–104px desktop and 56–64px mobile, with tighter spacing where sections are closely related.
- Cards: 16–24px radii, fine borders, restrained shadows.
- Buttons: 44–48px minimum height, 10–12px radius, clear hover/focus/disabled states.
- Use violet for the primary CTA, white/bordered secondary CTAs and consistent button styling across the page.
- Motion: short opacity/translate transitions, approximately 150–250ms. No continuous logo or card movement. Respect prefers-reduced-motion.

### E. Brand and assets

- Product name: OpsBrain AI.
- Use the supplied violet rounded-square brain mark with the white circuit-brain illustration and small mint node.
- Preserve its aspect ratio. Do not redraw it approximately or substitute a generic brain icon.
- Header lockup: mark at approximately 34–40px plus readable “OpsBrain AI” wordmark. Preserve small-size legibility.
- Use the highest-resolution supplied asset for large uses and an appropriate small asset for favicon/app icon.
- Never upscale the smallest supplied icon for a hero illustration.
- Use original HTML/CSS/SVG product artwork for the landing illustrations.

### F. Page structure and exact copy direction

Build the following sections in this order. Keep the page purposeful: each section must answer a different visitor question.

#### 1. Header

An elegant sticky header with a white or very lightly translucent surface, subtle border and modest shadow after scrolling.

Desktop:
- Left: OpsBrain AI brand lockup linking to the top.
- Center: Features, How it works, Platforms, Pricing, FAQ.
- Right: Sign in; primary button “Start free”.

Features opens an accessible dropdown with AI Content Studio, Weekly Planner, Brand Voice, Publishing & Calendar, Analytics, Teams & Approvals. Items scroll to real section anchors.

Mobile: logo, a compact Start free button if space allows, and an accessible menu. Support keyboard navigation, Escape, focus management and closing after selection. Do not let a sticky header cover anchor headings.

Do not add a promotional banner without a real approved offer.

#### 2. Hero — outcome plus product proof

Desktop: original split layout, copy on the left and a substantial product-interface composition on the right. On mobile, copy first and a simplified preview below it.

Eyebrow: “AI-powered social media planning”

H1: “Your next week of social content, planned.”

Supporting copy: “Turn a simple business brief into fresh content ideas, on-brand captions, and a ready-to-edit weekly plan. Create, organize, and schedule your social content in one workspace.”

Primary CTA: “Start planning free”
Secondary CTA: “Explore the weekly planner” — scroll to the interactive demo.
Microcopy: “Free plan available. No credit card needed to start.”

Hero visual:
- Show a realistic miniature OpsBrain workspace, not a random laptop render.
- Label the active area “Your weekly content plan”.
- Include a compact brand brief: “A neighbourhood coffee brand launching a new cold brew”.
- Show three connected layers: AI suggestions, seven-day plan and selected-post preview.
- Suggestion chips: “Behind the scenes”, “A quick tip”, “Product spotlight”.
- Show a short, readable caption and tasteful coffee-themed visual.
- Show draft/review/scheduled states, but not a fake success notification or live customer data.
- Include an unobtrusive “Illustrative preview” label.
- The artwork should remain legible and not rely on tiny dashboard text.

Do not display fabricated “10,000+ teams”, testimonials, star ratings, awards, revenue lifts or growth percentages.

#### 3. Platform ecosystem

Heading: “Your social channels, coming together.”
Supporting copy: “Plan around the channels your audience uses, with more integrations on the way.”

Show nine recognizable platform icons with names in a balanced static grid:
Instagram, Facebook, LinkedIn, X, Threads, YouTube, TikTok, Pinterest, Bluesky.

Availability configuration:
- Instagram, Facebook, LinkedIn and X: integration implemented; show as available only after the owner confirms launch readiness.
- Threads, YouTube, TikTok, Pinterest and Bluesky: show a visible “Coming soon” badge.
- This nine-platform selection is provisional and must be easy to change in one config.

Use clear status text, not opacity alone. Explain in small readable copy: “Publishing formats and analytics availability vary by platform.”

Do not use “Supports 9 platforms” or “Publish everywhere” while five channels remain unimplemented. After all nine are verified, this headline can become “One workspace. Nine social platforms.”

#### 4. Short problem/benefit bridge

Heading: “Less time figuring out what to post. More time running your business.”

Three compact editorial columns, not oversized generic cards:
- “Find your next idea” — “Start with suggestions shaped around your business, audience and goals.”
- “Keep your voice consistent” — “Turn your brand preferences into a clearer starting point for every draft.”
- “See your week clearly” — “Organize content before you open another social app.”

Do not quantify time saved without evidence.

#### 5. Signature feature: interactive seven-day planner

Anchor: weekly-planner.
Eyebrow: “THE WEEKLY PLANNER”
Heading: “One brief. A clearer plan for the week.”
Body: “Tell OpsBrain AI what you do, who you want to reach, and what you want to achieve. Get a seven-day starting point with content angles and editable drafts.”

This is the most important section after the hero. Make it visually distinctive and give it more space than secondary features.

Create a local interactive demo with these inputs:
- Business type: Café, Fitness coach, Online store.
- Goal: Build awareness, Start conversations, Promote an offer.
- Channels: choose from available channels, not future integrations.
- Primary button: “Preview my week”.

Use prepared sample data, not a real AI call. All inputs must affect the visible demo: business changes the topic/copy, goal changes the angle/CTA, channel selection changes the platform previews. If nothing is selected, show a helpful validation message.

Clearly label the experience: “Interactive sample — sign up to generate a plan for your business.” Never pretend a timed animation is a live AI request.

Default café example:
| Day | Content angle | Sample idea |
| --- | --- | --- |
| Monday | Brand story | Meet the people behind your morning coffee |
| Tuesday | Helpful tip | Three ways to make better iced coffee at home |
| Wednesday | Product spotlight | A closer look at our new cold brew |
| Thursday | Behind the scenes | From freshly ground beans to the first pour |
| Friday | Conversation starter | How do you take your Friday coffee? |
| Saturday | Community | A weekend invitation to your neighbourhood café |
| Sunday | Gentle promotion | Make your Monday easier with a cold brew stop |

Select a day to show a content detail panel with angle, hook, caption, hashtags, platform and editable suggested time. Label any times “Example time”, not AI-optimized recommendations.

Example selected caption: “Your afternoon reset, poured over ice. Meet our new cold brew: slow-steeped, smooth, and ready when you are. Drop by this week and tell us how you take yours.”
Example hashtags: #ColdBrew #CoffeeBreak #LocalCafe.

Include local editable caption text and a “Reset sample” action. Do not lose edits silently when switching a preset; show a lightweight discard confirmation if needed. “Create my own plan” opens existing signup.

Desktop uses a seven-column overview plus a detail panel. On mobile use day tabs or a stacked agenda with full-width details, not a seven-column calendar squeezed into a phone.

#### 6. How it works

Anchor: how-it-works.
Heading: “From your first idea to a planned week.”

Four steps with a subtle connecting line on desktop:
1. “Add your brand” — “Set your audience, tone, colors and goals.”
2. “Build your plan” — “Explore AI suggestions and draft your week.”
3. “Make it yours” — “Edit the words, choose visuals and review each post.”
4. “Schedule and review” — “Organize publishing and check available performance data.”

CTA: “Build my first plan”.
Do not describe scheduling as automatically enabled the moment a plan is generated.

#### 7. AI Content Studio

Anchor: ai-content-studio.
Eyebrow: “AI CONTENT STUDIO”
Heading: “A useful first draft. Not another blank page.”
Body: “Turn a topic, product update, or campaign idea into hooks, captions and hashtags. Refine the tone and adapt the draft for the channels you choose.”

Bullets:
- Content ideas for your business and goals.
- Editable captions, hooks and hashtags.
- Platform-aware writing and previews.
- Rewriting and variations where included in your plan.
- AI-created images subject to plan allowance.

Show an original composer illustration: business brief on the left, editable caption on the right, platform chips and a small selected image. Optional tabs can switch prepared caption examples. Label these as samples.

Do not claim automatic trending-topic research, guaranteed virality, unlimited image generation or video generation.

#### 8. Brand Voice and visual identity

Anchor: brand-voice.
Heading: “Content that starts with your brand.”
Body: “Keep your tone, audience, preferred language, colors and logos in one place. Give AI clearer context so every draft is easier to make your own.”

Visual: a brand-kit panel with tone chips “Warm”, “Helpful”, “Straightforward”; audience; color swatches; logo selection; and a short before/after draft example.

Bullets:
- Save writing preferences and brand context.
- Keep colors and logos close to your content workflow.
- Review and refine every draft before publishing.

Do not call this autonomous permanent learning or claim each post retrains the AI.

#### 9. Publishing and calendar

Anchor: publishing-calendar.
Heading: “Your content calendar, without the chaos.”
Body: “Bring drafts and scheduled posts into one view. Check the details, choose your channels, and keep your next steps visible.”

Show a readable calendar/agenda mockup with draft, scheduled and needs-review badges. If a mockup control is interactive, it must work locally. Do not show a draggable calendar affordance unless it actually changes demo dates.

Bullets:
- Organize drafts and scheduled content.
- Preview platform-specific versions.
- Publish or schedule on available integrations.
- Track publishing status and items needing attention.

Avoid promising every post format on every network or automatic best-time scheduling.

#### 10. Analytics and team workflow

Use a compact asymmetric two-panel section rather than two full repetitive feature rows.

Panel one, anchor analytics:
Heading: “See what your content is doing.”
Body: “Review available account and post performance in a clearer overview, so your next planning session starts with context.”
Show a small accessible chart with an “Illustrative data” label and real axis labels. Never present sample numbers as customer outcomes. Do not invent demographics, forecasts, previous-period lifts or analytics-grounded AI recommendations.

Panel two, anchor teams-approvals:
Heading: “Keep review out of scattered messages.”
Body: “Give your team a shared place to prepare content and review posts before publishing, where included in your plan.”
Show a simple Draft → Review → Scheduled workflow and role chips. Do not promise specific seat limits, white-labeling or client portals unless explicitly configured.

#### 11. Who it is for

Heading: “Built for the way small teams create.”

Three concise use cases:
- “Creators & solo businesses” — “Turn expertise and everyday ideas into a more consistent content routine.”
- “Growing brands” — “Connect brand voice, weekly planning and publishing in one workflow.”
- “Agencies & marketing teams” — “Bring a more organized approach to content review and multiple brand workflows.”

Use real use cases instead of fabricated testimonials or customer logos.

#### 12. Pricing

Anchor: pricing.
Heading: “Start free. Choose more room when you need it.”
Body: “Simple monthly pricing in Indian rupees, with clear limits for content and AI generation.”

There are FOUR tiers, not three:

| Detail | Free | Pro | Growth | Agency |
| --- | --- | --- | --- | --- |
| Monthly price | ₹0 | ₹499 | ₹999 | ₹4,999 |
| Audience | Try the essentials | Creators and solo businesses | Growing brands and small teams | Agencies managing multiple brands |
| Connected accounts | 2 | 10 | 50 | Custom allocation |
| Posts per month | 10 | 100 | 500 | Custom allocation |
| AI text generations per month | 30 | 300 | 1,500 | Custom allocation |
| AI images per month | 5 | 50 | 200 | Custom allocation |
| Brand voice | Included | Included | Included | Included in proposed package |
| Approval workflow | Not included | Included | Included | Proposed package |
| CTA | Start free | Choose Pro | Choose Growth | Enquire about Agency |

The first three tiers mirror the current baseline product catalog; production values must be checked against live pricing. Agency at ₹4,999 is a proposed package, not an active checkout tier. In the review build label it “Proposed package” and use a real configured enquiry destination; if none exists, show “Agency enquiries opening soon” rather than a fake contact form. Do not make Agency purchasable before it exists in billing.

Agency detail copy: “For agencies that need a package shaped around account volume, brand workflows and collaboration. Confirm your allocation before purchase.” Do not promise dedicated support, white-labeling, unlimited use or workspace/seat counts.

Pricing design:
- Four equal-height cards on desktop, two-by-two on tablet, stacked on mobile.
- Highlight Growth with a violet outline and a “Recommended” badge, not an unsupported “Most popular” claim.
- Keep plan name, audience, large price, billing unit and CTA in the same vertical positions.
- Separate key quotas from feature inclusions.
- Use INR formatting, especially ₹4,999 and 1,500.
- Below cards, provide a working “Compare plan details” disclosure with a semantic comparison table.
- Explain: “Text generations and image generations have separate monthly allowances.” Do not rename them combined AI credits.
- Add “Prices in INR. Review applicable taxes and billing terms at checkout.”
- No annual toggle until actual annual prices and terms are provided.
- No “Cancel anytime” or auto-renewal wording until it matches the real payment model.
- Do not imply a plan's connected-account allowance means that many distinct social networks are supported.

Keep plan data centralized. The preview may display provided baseline prices, but public release requires pricing-owner approval, especially the proposed Agency offering.

#### 13. FAQ

Anchor: faq.
Heading: “A few things you might be wondering.”
Use an accessible accordion. Answers must be in the initial HTML, not fetched only when expanded.

Q: What is OpsBrain AI?
A: “OpsBrain AI helps you create on-brand social content, organize ideas into a weekly plan, and manage publishing from one workspace.”

Q: Can it help me decide what to post?
A: “Yes. Start with your business, audience and goal to generate content ideas and a seven-day starting plan. Review and edit the drafts before you schedule them.”

Q: Does it generate a full week of content?
A: “The weekly planner creates a structured starting point for seven days, with content angles and drafts you can refine. Availability and usage allowances depend on your plan.”

Q: Which platforms can I use?
A: “Facebook, Instagram, LinkedIn and X have integrations in the product. Availability depends on launch readiness, account type, platform permissions and format. Threads, YouTube, TikTok, Pinterest and Bluesky are planned additions and are marked Coming soon.”
Before production, replace the integration wording with the owner's verified availability statement. Keep the distinction between live and planned channels.

Q: Will the content sound like my brand?
A: “You can add brand context and writing preferences to guide generation. AI gives you a starting draft; you stay in control of the final wording.”

Q: Does the planner publish posts automatically?
A: “Generating a plan does not publish it. Review your content and deliberately choose scheduling or publishing on an available integration.”

Q: Is there a free plan?
A: “Yes. Start with the Free plan and its monthly content and AI allowances. A credit card is not required to create a free account.”

Q: How do AI allowances work?
A: “Plans include separate monthly allowances for AI text generations and AI images. Check your usage in the app before creating more content.”

Q: Can my team review posts?
A: “Approval workflows are available on eligible paid plans. Confirm the package's collaboration details before purchase.”

Q: Does OpsBrain AI guarantee reach or engagement?
A: “No. AI can help with planning and drafting, but audience response depends on your content, platform and business.”

Do not invent refunds, security certifications, data residency commitments, AI-training policies or subscription cancellation rules. Add those FAQs only after approved policy copy exists.

#### 14. Final CTA

An elegant dark panel with a restrained violet accent and a small original seven-day-plan motif.

Heading: “Make room for a more consistent social presence.”
Body: “Bring your ideas, brand voice, and next week of content into one place.”
Primary button: “Start planning free”.
Secondary link: “Compare plans”.
Microcopy: “Free plan available. You review every draft.”

Keep contrast high and avoid a giant glowing gradient background.

#### 15. Footer

Brand description: “AI-assisted content planning for creators, businesses and marketing teams.”

Product links: AI Content Studio, Weekly Planner, Brand Voice, Publishing & Calendar, Analytics, Pricing.
Resources: How it works, Platforms, FAQ.
Account: Sign in, Start free.

Company, support, contact and legal links must use owner-provided destinations. Omit unconfigured links instead of using #, fake emails or invented policy text. If legal links are not provided, flag this as a launch blocker in the handoff.

Use the current year dynamically. Do not invent a legal entity suffix, address, registration number, social profile or certification.

### G. Interaction requirements

Every element that looks actionable must work:
- Navigation and feature dropdown reach the correct sections.
- Mobile menu is keyboard and screen-reader accessible.
- Primary CTAs reach configured existing signup.
- Sign in reaches configured existing login.
- The planner demo changes sample data based on business, goal and selected channels.
- Day selection updates the preview; editing and reset work locally.
- Feature example tabs update visible content.
- FAQ items expand and collapse.
- Pricing comparison opens and closes.
- Agency CTA follows real availability/configuration.
- No empty links, fake form submissions, fake AI calls or payment success states.

Do not add a chatbot, newsletter capture or lead form without a real operational destination. A marketing page should not pretend to store submissions.

### H. Responsive behavior

Validate at 360px, 390px, 768px, 1024px and 1440px:
- No page-wide horizontal scroll or clipped buttons.
- Hero stacks naturally on small screens.
- Platform grid wraps with visible names and availability badges.
- Weekly plan becomes a usable agenda/day selector.
- Pricing stacks without shrinking fonts.
- Comparison tables may scroll only inside a clearly labeled scroll region.
- Feature sections place copy before the visual on mobile.
- Simplify decorative overlays on phones rather than hiding useful content.
- Maintain touch targets of at least 44px and readable body text.

### I. Accessibility, SEO and performance

- One H1, meaningful H2/H3 hierarchy, main landmark, navigation labels and skip link.
- WCAG AA color contrast and obvious focus rings.
- Meaningful alternative text for informative imagery; decorative imagery has empty alt text.
- Charts have text summaries. Status is never communicated only by color.
- Respect reduced motion. No autoplay audio or flashing content.
- Suggested title: “OpsBrain AI — AI Social Media Planner & Content Studio”.
- Suggested description: “Create on-brand captions, explore AI content ideas, and organize your next week of social posts with OpsBrain AI. Start with a free plan.”
- Configurable canonical URL, original branded Open Graph image, favicon, sitemap and robots configuration appropriate to deployment. No localhost canonical.
- Use accurate Organization or SoftwareApplication structured data only for verified facts. Do not add fake reviews, ratings or offers. An FAQ accordion does not imply guaranteed FAQ rich results.
- Keep important copy server-rendered and indexable. Reserve image dimensions to avoid layout shifts.
- Prioritize the hero asset; lazy-load below-the-fold images. Do not embed a heavy external demo video by default.
- Treat Lighthouse accessibility/SEO/best-practices scores of 95+ and performance of 90+ as targets to measure, not claims to report without running an audit.

### J. Suggested component organization

Use reusable components for SiteHeader, HeroSection, ProductPreview, PlatformGrid, WeeklyPlannerDemo, WorkflowSteps, FeatureSection, BrandVoicePreview, CalendarPreview, AnalyticsTeamPanels, PricingSection, PlanComparison, FAQSection, FinalCTA and SiteFooter.

Keep brand config, platform availability, sample plans, FAQ copy and pricing separate from presentation. Plan and platform status must be changeable without rewriting layouts. Use a shared feature-section primitive but allow visual variety instead of making every section identical.

### K. Delivery and acceptance criteria

Deliver the complete landing page, not a starter skeleton. Include original polished product previews, final copy, responsive states and functional demo interactions. Do not finish after the hero and a few placeholder cards.

Before handoff verify:
1. The first screen clearly communicates AI suggestions and weekly planning.
2. All nine proposed platform names appear, and all future channels have Coming soon labels.
3. No unsupported promise says all nine integrations are live.
4. Four pricing amounts appear exactly: ₹0, ₹499, ₹999 and ₹4,999.
5. Growth is Recommended; Agency is explicitly proposed/enquiry-only until configured.
6. No annual-discount, unlimited-use, false customer-proof or fabricated performance claims appear.
7. Text and image quotas are separate and consistent across cards, comparison and FAQ.
8. Navigation, mobile menu, planner controls, FAQ and comparison disclosure work.
9. Signup/login links use the existing app rather than a new mock auth flow.
10. No overflow or unreadable product mockups at the specified widths.
11. The result looks premium and original, not like a clone of Hyvo or a generic AI template.
12. Report what was built, what was actually tested and any remaining release blockers. Do not claim Next.js compatibility, Lighthouse scores, a live integration or payment readiness without verification.

Build the full first version using these defaults. Only ask a question if the environment cannot support the required framework or if an essential live destination is unavailable. Otherwise use explicit review-build placeholders/configuration and identify them in the handoff, not fabricated public claims.

### END PROMPT

---

## 4. Owner checklist before public launch

- Confirm the five expansion networks; the proposed list is not a codebase commitment.
- Verify each launch integration and supported format with a real connected account.
- Confirm weekly-plan allowances per tier; do not accidentally offer more generation than quotas permit.
- Approve live plan prices and quotas, GST/tax treatment and payment/renewal wording.
- Define the ₹4,999 Agency package, its account/seat/workspace allowances, operational support and checkout or enquiry destination.
- Reassess AI image unit costs before promising large allocations at low monthly prices.
- Supply production application/signup URLs and approved legal/privacy/support links.
- Use original product visuals or anonymized app captures; remove sample-data ambiguity.
- Confirm whether Lovable can generate Next.js in the selected environment before accepting a framework substitution.

## 5. Optional visual refinement prompt

Use this after the initial complete build if the result feels generic:

“Refine the existing landing page without removing sections, changing claims or changing pricing. Make it feel more like an intentionally designed premium SaaS brand: stronger type hierarchy, calmer whitespace, fewer decorative cards, more readable original product UI and better visual rhythm between feature sections. Make the seven-day planner the signature visual. Keep violet accents restrained, preserve the supplied OpsBrain logo, improve mobile spacing and retain all functionality, accessibility and availability labels. Do not introduce fabricated social proof or new feature promises. Validate the full page again after the refinement.”