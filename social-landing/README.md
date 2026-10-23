# OpsBrain AI marketing site

Standalone Next.js 16 App Router landing page with React 19, TypeScript, Tailwind CSS 4 and Radix primitives. The former Lovable TanStack Start runtime has been removed. The authenticated dashboard and backend are separate applications and were not modified.

## Local development

Use Node.js 20.9 or newer (Node.js 22 recommended). Run `npm ci --legacy-peer-deps`, then `npm run dev` from this directory. The landing runs at http://localhost:3002, separately from the dashboard at port 3001.

Use `npm run build` for production, followed by `npm run start`. Deploy as a Next.js application, not a Vite application or a static dist folder. The main page, sitemap, robots file and generated social image are prerendered; Next.js handles optimized brand images.

The connected Lovable project may not preview a Next.js application. Use a Next.js-capable host or local development; do not regenerate the old TanStack runtime to repair a Lovable preview. Git history has not been rewritten.

## Public configuration

Copy the example environment values into your deployment configuration before building:

| Variable | Purpose | Default |
| --- | --- | --- |
| NEXT_PUBLIC_SITE_URL | Canonical marketing origin, sitemap and structured data | https://opsbrainai.com |
| NEXT_PUBLIC_APP_URL | Existing authenticated app origin; links use /register and /login | https://app.opsbrainai.com |

These values are public and baked in at build time. Confirm actual DNS and app URLs before deployment. There is no payment checkout, lead storage or live AI generation in this marketing application.

## Design and content

- The supplied OpsBrain logo and editorial photographs are stored locally. Product previews are original HTML/CSS/SVG, not Hyvo assets or fabricated customer results. Photography sources are recorded in the image credits.
- Colors, typography and reusable layout rules are centralized in the stylesheet.
- Platform status, pricing and FAQs are maintained in the site content module.
- All nine integrations are presented as available based on product-owner confirmation. Account limits are not network counts. Publishing formats and metrics depend on platform permissions.
- Pricing shows Free, Pro ₹499, Growth ₹999 and Scale ₹4,999. Scale uses tailored allowances rather than invented numerical quotas; confirm allocations with the billing owner.
- Inter is used for body text, headings and controls, with system-font fallbacks. The original Lovable prompt is historical; the site content module is the current source of truth.
- Weekly planner and Content Studio interactions use prepared, labeled sample data. Caption/time edits are local; applying a new plan or resetting asks before discarding them.
- FAQ and pricing comparison use native HTML disclosures: answers and comparison content remain in the server-rendered document and work without JavaScript.

## SEO and accessibility

Native Next.js metadata supplies the title, description, canonical, Open Graph/Twitter metadata and icons. Metadata routes provide robots.txt, sitemap.xml and a generated 1200×630 social card. Structured data describes the organization, site and web application without fake ratings, unsupported offers or guaranteed search results.

The landing uses one H1, semantic sections, real anchor links, a skip link, reduced-motion support, visible focus styles and a Radix mobile menu. Sample charts are labeled illustrative and have accessible summaries. Optimize real content and monitor Core Web Vitals after deployment; implementation alone cannot guarantee search rankings.

## Quality checks

- `npm run typecheck`
- `npm run lint`
- `npm test -- --maxWorkers=2`
- `npm run build`

Tests cover the main page, anchor destinations, structured data, platform statuses, plan prices, crawler routes, planner input changes, validation and edit protection. Browser validation should cover 360, 390, 768, 1024 and 1440px widths, menu keyboard behavior, planner controls, FAQ and pricing disclosures.

## Release checklist

- Confirm production origins and deploy on a Next.js-compatible host.
- Supply approved privacy, terms and support destinations before public launch; no legal policy or contact information is invented here.
- Verify platform permissions, integration launch status and plan allowances with the live product.
- Confirm Scale allocations against the live billing catalog before deployment.
- Submit the deployed sitemap to Google Search Console and Bing Webmaster Tools.
- Run a production Lighthouse/Core Web Vitals audit and monitor real-user performance. No audit score or ranking is guaranteed by this repository.