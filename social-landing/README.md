# EarnedVoice marketing site

Standalone Next.js 16 App Router landing page with React 19, TypeScript, Tailwind CSS 4 and Radix primitives. The former Lovable TanStack Start runtime has been removed. The authenticated dashboard and backend are separate applications and were not modified.

## Local development

Use Node.js 20.9 or newer (Node.js 22 recommended). Run `npm ci --legacy-peer-deps`, then `npm run dev` from this directory. The landing runs at http://localhost:3002, separately from the dashboard at port 3001.

Use `npm run build` for production, followed by `npm run start`. Production defaults to port 5002, with LANDING_PORT taking precedence over PORT. An explicit `npm run start -- --port 3007` overrides both. The Node launcher works on Windows and Unix without shell-specific environment interpolation. Deploy as a Next.js application, not a Vite application or a static dist folder. The main page, sitemap, robots file and generated social image are prerendered; Next.js handles optimized brand images.

The connected Lovable project may not preview a Next.js application. Use a Next.js-capable host or local development; do not regenerate the old TanStack runtime to repair a Lovable preview. Git history has not been rewritten.

## Public configuration

Copy the example environment values into your deployment configuration before building:

| Variable | Purpose | Default |
| --- | --- | --- |
| NEXT_PUBLIC_SITE_URL | Canonical marketing origin, sitemap and structured data | https://opsbrainai.com |
| NEXT_PUBLIC_APP_URL | Existing authenticated app origin; links use /register and /login | https://app.opsbrainai.com |

These values are public and baked in at build time. The existing opsbrainai.com and app.opsbrainai.com defaults are intentional: no EarnedVoice production domain has been confirmed. Before a domain migration, set NEXT_PUBLIC_SITE_URL to the confirmed marketing origin and NEXT_PUBLIC_APP_URL to the confirmed dashboard origin in the marketing deployment, and align the dashboard’s marketing/app URL environment configuration with those confirmed origins. Rebuild affected applications after changing public values. Confirm DNS, redirects and integration callback configuration with the deployment owner; this rebrand does not provision DNS, invent mailbox addresses or change existing email destinations.

There is no payment checkout or live AI generation in this marketing application. Contact enquiries remain at #contact, are submitted through the existing same-origin Next.js proxy and are stored by the backend, not by this application. Contact and privacy-aware marketing analytics flows are unchanged by the rebrand.

## Server-side marketing configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| MARKETING_API_URL | Backend origin only, such as https://api.example.com; no API path, query, credentials or secrets | http://127.0.0.1:8000 in development only; required in production |
| MARKETING_TRUSTED_IP_HEADER | Optional header overwritten by your trusted edge proxy with exactly one visitor IPv4 or IPv6 address | Unset: no client IP forwarding |

Set these server-only variables in the Next.js runtime environment, not with a NEXT_PUBLIC prefix. The local example backend URL is for development; replace it with the actual backend origin for deployment. Missing or invalid production backend configuration returns 503 rather than silently contacting localhost. The proxy accepts same-origin JSON POSTs and forwards only validated contact fields or one of three event names to /api/v1/public/contact or /api/v1/public/events. Backend failures are sanitized; unavailable or malformed backend responses return 503.

The backend contact limiter allows **5 requests per minute per IP**, and the event limiter allows 120. By default, the proxy does not trust or forward incoming x-forwarded-for, x-real-ip or provider-specific visitor headers. All visitors reaching the backend from the same Next.js egress IP therefore share those aggregate limits (often 127.0.0.1 when colocated). This fallback can throttle unrelated visitors after five contact attempts; it is not a per-visitor rate limit. Backend limiting also depends on Redis being available; its existing limiter fails open if Redis is unavailable.

Enable per-visitor limits only after the deployment operator verifies a trusted ingress, for example by setting MARKETING_TRUSTED_IP_HEADER=x-real-ip when that ingress **removes and overwrites** x-real-ip with one verified client address. Block direct access that bypasses that ingress, and ensure the backend is reachable only through trusted paths. Never select an arbitrary client-controlled header or a header that appends an untrusted forwarded chain. The proxy validates a single IP and emits only that address as backend X-Forwarded-For; missing, malformed or comma-separated values with this option enabled return 503. The backend already trusts X-Forwarded-For, so backend ingress must preserve this verified value rather than replace it with the Next.js address. Do not enable the option without those deployment guarantees; IP syntax validation alone does not establish trust.

Marketing events contain only page_view, signup_click or contact_click and a fixed backend path of /. No query strings, referrers, form contents, visitor IDs, cookies or storage identifiers are included. The tracker skips requests when Do Not Track or Global Privacy Control is enabled and sends one page view per mounted page, including React Strict Mode effect replay. Contact submissions remain available when tracking is disabled. Supply approved privacy and retention policies before launch.

## Design and content

- The shared EarnedVoice mark is stored locally at public/brand/earnedvoice-mark.svg and used by metadata and organization structured data. Product previews are original HTML/CSS/SVG, not copied assets or fabricated customer results.
- Positioning connects professional expertise to consistent social content for founders, consultants and teams. EarnedVoice remains a self-service product, not a managed PR service or a promise of reputation outcomes. Workshop examples and the interactive Northstar sample are fictional, not customers or claims of results.
- Page order is Hero, platforms, Why EarnedVoice, how it works, Content Studio, publishing, weekly planner, brand voice, analytics, team review, responsible publishing, pricing, FAQ, contact and final call to action. Existing section anchor IDs remain stable.
- Feature illustrations use responsive HTML text and decorative graphics rather than text scaled inside SVG dashboards. Example analytics are clearly distinguished from customer results.
- Company follow links are separate from product integrations. Only the verified OpsBrain AI LinkedIn company page is published; ambiguous handles and generic platform homepages are not used. Keep this list in the site content module and confirm ownership before adding another profile.
- Colors, typography and reusable layout rules are centralized in the stylesheet.
- Platform status, pricing and FAQs are maintained in the site content module.
- Instagram, Facebook and LinkedIn are available; the platform strip shows all nine logos, while the FAQ and metadata explain the six upcoming integrations. Account limits are not network counts. Publishing formats and metrics depend on platform permissions.
- Pricing shows Free ₹0, Pro ₹499, Growth ₹999 and Scale ₹4,999 per month in INR. Every plan includes unlimited social accounts and brand voice. Monthly post/text/image allowances remain Free 10/30/5, Pro 100/300/50 and Growth 500/1,500/200. Approvals are included on Pro, Growth and Scale, not Free. Scale is sales-assisted with tailored allowances, not self-service checkout or invented numerical quotas; confirm allocations with the billing owner.
- Inter is used for body text, headings and controls, with system-font fallbacks. The original Lovable prompt is historical; the site content module is the current source of truth.
- The weekly planner uses prepared, labeled sample data. Caption/time edits are local; applying a new plan or resetting asks before discarding them. The Content Studio section illustrates a fictional software-launch brief and draft, not live generation.
- FAQ and pricing comparison use native HTML disclosures: answers and comparison content remain in the server-rendered document and work without JavaScript.

## SEO and accessibility

Native Next.js metadata supplies the title, description, canonical, Open Graph/Twitter metadata and icons. Metadata routes provide robots.txt, sitemap.xml and a generated 1200×630 social card. Structured data describes the organization, site and web application without fake ratings, unsupported offers or guaranteed search results.

The landing uses one H1, semantic sections, real anchor links, a skip link, reduced-motion support, visible focus styles and a Radix mobile menu. Sample charts are labeled illustrative and have accessible summaries. Optimize real content and monitor Core Web Vitals after deployment; implementation alone cannot guarantee search rankings.

## Quality checks

- `npm run typecheck`
- `npm run lint`
- `npm test -- --maxWorkers=2`
- `npm run build`

Tests cover the main page, anchor destinations, structured data, platform statuses, plan prices, crawler routes, planner input changes, validation and edit protection, contact success/error/retry, tracker payloads and privacy signals, and proxy origin/input/configuration/IP trust/backend handling. Browser validation should cover 360, 390, 768, 1024 and 1440px widths, menu keyboard behavior, planner controls, FAQ, contact states and pricing disclosures.

## Release checklist

- Confirm production origins and deploy on a Next.js-compatible host.
- Supply approved privacy, terms and support destinations before public launch; no legal policy or contact information is invented here.
- Verify platform permissions, integration launch status and plan allowances with the live product.
- Confirm Scale allocations against the live billing catalog before deployment.
- Submit the deployed sitemap to Google Search Console and Bing Webmaster Tools.
- Run a production Lighthouse/Core Web Vitals audit and monitor real-user performance. No audit score or ranking is guaranteed by this repository.