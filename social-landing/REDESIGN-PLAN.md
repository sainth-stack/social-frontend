# EarnedVoice landing redesign

## Objective

Create a premium, illustration-led SaaS landing page for businesses, startups and professional software teams. Use Hyvo as a benchmark for clarity and visual richness, not as a source of copied layouts, text or artwork.

Implemented: original seven-scene SVG illustration system, illustrated hero, four-step journey, dedicated Studio/publishing/brand/analytics/review sections, preserved interactive demos, and refreshed final CTA. Repetitive Bridge and audience panels are no longer rendered. Pricing and product allowances are unchanged.

Validation: 101 tests, typecheck, lint and production build pass. Browser layouts at 360, 390, 768, 1024 and 1440 have no page overflow or broken section anchors. Studio switching and planner apply/edit/discard protection were checked. Live marketing submission remains environment-dependent; the local marketing proxy returns 503 without its backend configuration.

## Audit findings

| Area | Current issue | Planned change |
| --- | --- | --- |
| Page story | Bridge, how-it-works, feature panels and audience cards repeat similar ideas | One introductory product journey, followed by specific feature proof |
| Visuals | Existing HTML mockups are informative but feel like nested forms rather than polished marketing artwork | An original coordinated illustration system with composed product scenes |
| Feature balance | Analytics and approvals share a compact row while other features have large illustrations | Give each major capability a dedicated, balanced feature section |
| Interactive demos | Planner and Studio can dominate page height | Keep one substantial planner demo; use compact progressive disclosure in Studio |
| Rhythm | Repeated panels, borders and colored containers flatten the hierarchy | Alternate open white sections with restrained tinted artwork stages |
| Conversion | Signup messages repeat without a clear progression | Use hero signup, contextual feature links, pricing, and final signup as primary conversion moments |

## Product boundaries

- Available integrations: Instagram, Facebook and LinkedIn. Keep the simple three-logo strip. Do not present future integrations as available or add Mastodon without product support.
- Advertise AI captions, hashtags, images within allowance, brand profiles, seven-day plans, account previews, scheduling, available analytics, CSV export and paid-plan approvals.
- Do not claim Canva, Unsplash, a live analytics AI chat assistant, automatic learning from every post, or account-specific optimal posting times without implementation and verification.
- Analytics examples must be labelled illustrative. Metrics depend on platform availability and permissions.
- Review actions and approval states may be illustrated; do not imply threaded comments or automatic scheduling after approval unless verified in the product.
- Preserve Free / Pro / Growth / Scale and INR 0 / 499 / 999 / 4,999 monthly pricing. Accounts remain unlimited on every plan. Scale remains contact-sales only.
- Do not reintroduce workflow or approval rows into pricing cards.
- Keep existing configured production origins until a new owned domain is confirmed.

## Proposed page narrative

| Order | Section | Purpose and visual treatment |
| --- | --- | --- |
| 1 | Navigation and hero | Keep EarnedVoice identity and refined feature menu. Clear business outcome, two CTAs and a composed campaign workspace illustration. No removed AI-powered eyebrow. |
| 2 | Supported platforms | Quiet monochrome Instagram, Facebook and LinkedIn strip; one future-integrations note. |
| 3 | The product journey | Four compact illustrated steps: Plan, Create, Review & publish, Measure. Explain a connected process without claiming autonomous optimization. Replace overlapping Bridge / HowItWorks narratives while preserving anchors. |
| 4 | Content Studio | Brief-to-draft visual with caption, hashtags and an original branded creative. Three concise benefits and a signup link. Preserve sample switching. |
| 5 | Publishing and previews | One draft adapted to supported channels; show channel preview and intentional scheduling controls. Do not promise identical support for every post format. |
| 6 | Weekly planner | Retain the redesigned setup, seven-day schedule and focused caption editor. Add a restrained visual lead-in; do not add another tall mock calendar above the demo. |
| 7 | Brand voice | Brand context, tone chips, logo/colors and an example draft as one layered visual. Demonstrate consistent guidance, not guaranteed human imitation. |
| 8 | Analytics and reports | Dedicated full-width feature row with available metric cards, engagement trend, channel split and CSV report cue. Clearly fictional sample data. |
| 9 | Teams and approvals | Dedicated feature row: draft, review requested, approved state. Show workspace separation and reviewer roles, not unverified chat or automation. |
| 10 | Pricing | Preserve current product data. Consistent Inter typography, aligned card structure, readable allowances and one recommended plan. |
| 11 | FAQ and contact | Concise product, platform and allowance answers. Preserve accessible contact submission, status and error handling. |
| 12 | Final CTA and footer | One clear signup statement, free-plan reassurance, useful product links. No invented customer logos, testimonials, legal pages or social destinations. |

Audience-specific messaging will be integrated into the hero and feature copy rather than repeated in a separate large card section.

## Original illustration system

Use a consistent fictional Northstar software launch campaign throughout. No lifestyle photos, coffee-shop imagery, Hyvo assets, copied screenshots or fake customer endorsements.

| Artwork | Composition |
| --- | --- |
| Campaign overview | Main calendar/composer window, two smaller post creatives, one review-state detail |
| Four journey scenes | Small matching Plan, Create, Publish and Measure scenes; fewer details than feature artwork |
| AI Studio | Compact brief panel flowing into a polished social creative and editable caption |
| Multi-channel publishing | A central draft connected to Instagram, Facebook and LinkedIn preview cards |
| Brand profile | Tone, audience, branded color swatches and a matching finished post |
| Analytics report | Metric tiles, engagement chart, channel split and export action |
| Team review | Two role avatars, draft excerpt and explicit review/approval states |

### Production approach

- Build original vector artwork and reusable React/SVG illustration elements locally. No dependency on an unavailable image-generation service or external hotlinks.
- Use real HTML for important copy and functional controls. SVG is for composed visual storytelling, not tiny unreadable marketing paragraphs.
- Shared illustration rules: indigo focal points, white/cloud surfaces, limited mint/amber status accents, consistent strokes, corners and soft elevation.
- Use wider landscape compositions rather than long stacked fake screens. Target approximately 4:3 for feature artwork, with a deliberate mobile composition where necessary.
- Richness should come from depth, framing, meaningful product details and contrast, not excessive cards or decorations.
- Export static artwork where useful; use optimized SVG or WebP/AVIF with explicit dimensions. Lazy-load below-the-fold artwork and prioritize only the hero when appropriate.
- Keep essential text and controls outside artwork crops. No fixed-height clipping of interactive forms or captions.
- Avoid unnecessary animation; any transitions must respect reduced motion.

## Design rules

- Keep the approved indigo palette and Inter throughout.
- One typography scale for headings, descriptions, plan prices, labels and metadata.
- Consistent content width, section spacing, buttons, focus rings and illustration-stage styling.
- Desktop feature rows use balanced copy/art columns and alternate placement. Mobile stacks copy before artwork.
- Limit each feature to one headline, a short explanation, three benefits and at most one contextual CTA.
- Preserve existing navigation anchors or update every dependent link and test together.

## Implementation phases

1. Foundation and one complete slice: consolidate illustration primitives and section rhythm; implement hero, platform strip and four-step journey. Review desktop and mobile before extending the system.
2. Feature illustrations: Studio, publishing previews and brand profile. Preserve Studio sample controls and original-copy disclosures.
3. Planner and evidence: finish browser validation of the current planner redesign; add dedicated analytics and approvals artwork. Keep day-specific edits, channel validation and discard confirmations.
4. Conversion and consistency: pricing alignment, FAQs, contact and footer; remove redundant narrative sections and verify all anchors.
5. Quality gate: automated checks, responsive browser review, interaction tests, content/claim review and asset-performance audit.

Expected scope: approximately 12–18 source/test files plus the original illustration assets. This is a landing-page redesign, not a backend feature expansion or dashboard redesign.

## Verification and acceptance

- Run landing typecheck, lint, all Vitest tests and production build. Current baseline: 92 passing tests after planner changes.
- Browser-check CSS widths 360, 390, 768, 1024 and 1440; no page overflow, clipped artwork or unreadable labels.
- Check feature-menu hover and keyboard behavior, mobile navigation, section anchors and CTA destinations.
- Check planner business/goal/channel application, zero-channel validation, keyboard day navigation, caption/time persistence, reset and discard confirmations.
- Check Studio sample switching and disclosure panels, pricing comparison, FAQ and contact success/error states.
- Verify one H1, meaningful heading order, visible keyboard focus, labelled controls, sufficient contrast and appropriate image alternatives.
- Preserve metadata, structured data, sitemap, marketing event tracking and privacy behavior.
- Confirm no copied Hyvo artwork/text, fabricated results, unsupported integration claims or new production-domain assumptions.
- Restart the production preview after builds so browser validation uses current assets rather than a stale Next.js manifest.

## Approval checkpoint

Direction approved and implemented. Preview the completed page on the running production preview at port 3007. Further artwork or copy refinements can be reviewed against the product boundaries above.