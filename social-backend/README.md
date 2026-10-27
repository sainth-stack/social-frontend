# OpsBrain AI — Social Media Manager (Backend)

Standalone FastAPI SaaS backend for the OpsBrain AI Social Media Manager. Multi-tenant
(workspace-based), plan-gated, AI-usage-metered social publishing platform: connect
Facebook/Instagram/LinkedIn/X accounts, generate on-brand posts/images with OpenAI,
store media on Amazon S3, schedule + publish, and track analytics.

This project is self-contained — it does **not** depend on `OpsBrain-Backend` or
`opsbrain-frontend` at runtime. The `app/social/` module was extracted and adapted from
`OpsBrain-Backend/app/social_media/`, with `Organization` renamed to `Workspace`
throughout.

## Stock media and safe user uploads

Set `PEXELS_API_KEY` only in the backend environment (or backend `.env`). Obtain a key
from https://www.pexels.com/api/ and restart the API after changing it. Never expose
it through frontend environment variables. Pexels is the only stock provider;
Unsplash is intentionally not integrated because its hotlink requirements do not
fit this rehosting workflow. No key is required for user uploads.

Authenticated workspace members can use these routes under
`/api/v1/workspaces/{workspace_id}/social`:

- `GET /stock/providers`: `{items:[{id:"pexels",name:"Pexels",available,mediaTypes:["image","video"],reason?}]}`.
- `GET /stock/search?query=office&mediaType=image&page=1&pageSize=24`:
  `{items:StockMediaItem[],page,pageSize,hasMore}`. `mediaType` is `image` or `video`,
  query is 1–200 nonblank characters, page is 1–1000, and pageSize is 1–80.
- `POST /stock/import`: `{provider:"pexels",id:"12345",mediaType:"image"}` returns
  a `MediaAssetOut` directly, not a wrapper. Requires editor permission or higher.
  Additional body fields (including URLs) are rejected. The provider ID is fetched
  afresh, independent of the search cache, and checked against the requested ID.

`StockMediaItem` contains `id`, `provider`, `mediaType`, `previewUrl`, `thumbnailUrl`,
`width`, `height`, optional `durationSeconds`, `creatorName`, `creatorUrl`,
`providerPageUrl`, `licenseUrl`, and `attributionText`. IDs are decimal strings.
Search preview URLs remain provider URLs; only a successful import creates owned
workspace storage. Imported assets retain `source:"uploaded"` for compatibility.
The optional `provenance` field contains `attributionText`, `providerPageUrl`,
`creatorName`, `creatorUrl`, `licenseUrl`, `provider`, and `providerAssetId`, and is
preserved by list/detail serialization. Show creator/Pexels attribution and links
in the stock picker; retain provenance when displaying an imported asset. Review
https://www.pexels.com/license/ and https://www.pexels.com/api/terms-of-service/
before deployment, including restrictions on identifiable people, trademarks,
standalone redistribution, and attribution requirements of the API integration.

Imports use HTTPS with exact `images.pexels.com` (images/thumbnails) and
`videos.pexels.com` (MP4 renditions) hosts only, no redirects, no cookies or API
authorization on CDN requests, and bounded streamed downloads. Unsupported or
legacy external video hosts are rejected rather than followed. Images are limited
to 8 MiB and 25 million pixels, verified with Pillow, re-encoded as metadata-free
JPEG, and capped again after normalization. SVG, mismatched MIME/bytes, and unsafe
images are rejected. Videos are capped at 50 MiB; Pexels imports accept MP4 only
with an ISO BMFF `ftyp` signature, recognized MP4 brands, and complete top-level
`moov`/`mdat` boxes. This is container validation, not a video decode or malware scan.

Existing `POST /upload-image` and `POST /upload-video` retain their response shapes
(`imageUrl`/`videoUrl`, `source`, `assetId`). Both now require editor permission,
read at most the limit plus one byte, and verify MIME/bytes before storage. Image
uploads accept JPEG/PNG/WebP and use the same JPEG normalization. Video uploads
accept MP4/WebM only (WebM checks EBML signature and WebM doctype), at 50 MiB.
The shipped nginx configurations permit 51 MiB request bodies for a 50 MiB file
plus multipart overhead; the application enforces the file limit. Reload nginx
after deploying its configuration. Logo reads are bounded separately at 5 MiB.

Videos can be stored, previewed, and saved as drafts, but **video publishing is not
supported**. The planner image-asset endpoint remains image-only, workspace-scoped,
and revision/copy-approval guarded. Importing/uploading does not approve copy,
attach media, schedule, publish, or consume AI quota.

Missing/rejected keys return 503 with `detail.error="stock_unavailable"`, provider
rate limits return 429 (`stock_rate_limited`), timeouts return 504 (`stock_timeout`),
missing IDs return 404, and other upstream failures/redirects return 502. Secrets
and raw upstream errors are not returned. Oversized files return 413; unsupported
types return 415; invalid bytes return 400. Search caches only successful responses
for 300 seconds in a thread-safe, per-process, 256-entry LRU cache; keys include a
hash of the credential so key changes cannot reuse old results. Errors and imports
are never cached. The explicit local bound avoids unbounded provider-query keys in
the existing Redis cache, and stock still works if Redis is unavailable.

Offline verification: from the backend directory, run
`.venv/Scripts/python.exe -m pytest -q tests/test_stock_media.py tests/test_upload_safety.py`.
These tests use `httpx.MockTransport`, fake storage, and no provider/paid calls.

## Stack

- **API**: FastAPI + Pydantic v2
- **DB**: MongoDB (PyMongo) — Atlas or any MongoDB URI
- **Auth**: JWT (python-jose) + passlib (pbkdf2_sha256) password hashing
- **Workers**: Celery + Redis (publish scheduler, analytics sync, token refresh, approval reminders)
- **AI**: OpenAI — chat (text) and image generation (`dall-e-3` / `gpt-image-2`)
- **Storage**: Amazon S3 (generated/uploaded media)
- **Social OAuth**: Meta (Facebook + Instagram), LinkedIn, X (Twitter) OAuth 2.0

## Project layout

```
backend/
  app/
    main.py           # FastAPI app factory, CORS, router wiring, startup bootstrap
    core/              # settings, Mongo client, JWT/password hashing, encryption, logging
    auth/              # register / login / me
    users/              # User document shape
    workspaces/         # Workspace + WorkspaceMember documents, membership API
    plans/              # Plan catalog + DB overrides + AI usage ledger
    admin/              # Platform-admin-only API (users, workspaces, pricing, analytics)
    social/             # Full social media product (accounts, posts, AI gen, publishing,
                         # analytics, brand voice, templates, approvals) — mounted per workspace
    providers/          # Amazon S3 + OpenAI client factories
  workers/               # Celery app + beat schedule (social publish/analytics/maintenance)
  requirements.txt
  .env.example
```

## Getting started

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Fill in MONGODB_URL, JWT_SECRET_KEY, CREDENTIAL_ENCRYPTION_KEY, OPENAI_API_KEY,
# AWS S3 / Meta / LinkedIn / X credentials as needed.

./scripts/migrate.sh

# Local
./scripts/start.sh
./scripts/stop.sh

# Frontend (separate terminal):
cd ../social-frontend && npm run dev
```

Generate a Fernet key for `CREDENTIAL_ENCRYPTION_KEY` (used to encrypt stored OAuth
tokens at rest):

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

On startup, if `ADMIN_EMAIL` + `ADMIN_PASSWORD` are set, a platform admin user (with an
Enterprise-plan workspace) is created idempotently.

### One-off platform admin setup or password reset

From this backend directory, with its virtual environment activated, run
`python -m app.core.seed_admin`. Configure `MONGODB_URL` and `MONGODB_DB_NAME` for
the intended database first. The command reads `ADMIN_EMAIL` and `ADMIN_PASSWORD`
from environment variables or the backend `.env`; missing values are requested
using an email prompt and a hidden password prompt. No default password is supplied.
Do not commit credentials or put passwords in command-line arguments.

Email validation and password length (8–128 characters) match registration. This
explicit command creates or promotes only the normalized target email, activates
that user, and sets/resets only that user's password using the existing password
hashing helpers. Repeating it with the same credentials creates no duplicate user,
workspace, or membership. It repairs an owned workspace's active state and the
owner/admin membership, creating an Enterprise workspace when none is owned;
existing workspace names and plans are preserved. Other users and shared-workspace
memberships are not changed. Interrupted database writes may leave partial setup;
rerun after fixing connectivity. Startup bootstrap is unchanged: it never resets
an existing user's password.

Local setup is currently blocked: MongoDB at `localhost:27017` refused the connection,
and no backend `.env` or local MongoDB service executable was available. The requested
`superadmin@gmail.com` account has **not** been seeded. Start/install MongoDB or
configure a reachable MongoDB deployment, then run the command and enter the password
securely when prompted.

### Running the background workers

`./scripts/start.sh` starts api + worker + beat together.

### Planner and creative-status deployment

- Deploy the matching backend API, Celery workers and beat revision together before
  enabling the new planner client. Apply MongoDB indexes via `./scripts/migrate.sh`
  against the shared database. Restart workers so they register
  `app.social.tasks.planner_runs`; consume `social_maintenance` for generation and
  recovery and `social_publish` for scheduling/publishing. Keep one beat instance
  active with the updated schedule: planner recovery and the due-post safety net
  run every 60 seconds. API and workers must share database, broker, storage and
  model configuration. Old workers cannot safely implement the new handoff.
- The new `/api/v1/workspaces/{workspace_id}/social/content-plan` API previews exact
  dates, accounts, local times and IANA timezone before creating durable runs.
  Ranges and individually selected dates retain their exact slots; blocked dates
  require explicit exclusion/correction, not silent replacement. DST gaps are
  rejected and ambiguous times require an explicit UTC offset. Generation creates
  text-only drafts. Approve copy separately, then explicitly request/retry an
  image; Instagram requires a current image, while Facebook/LinkedIn can use
  text-only intent. Changed copy invalidates approval and visual readiness.
  Team approval remains separate. Scheduling requires publisher permission,
  fresh schedule preview and explicit confirmation; generation, approval and
  image creation never schedule automatically. Results are per item; pending
  dispatch is not a confirmed scheduling success.
- `GET /api/v1/workspaces/{workspace_id}/social/generate-creative-set/status?requestId=...`
  requires authentication and workspace access (viewer allowed), with a required
  1–128 character `requestId`. It returns `creativeSetId`, `status`, `items`,
  `errors`, `warnings`, refreshes media URLs and never generates, uploads or
  consumes AI credits. Requests are workspace-scoped; missing/foreign requests
  return 404. Keep the synchronous creative POST available; polling GET is not
  a replacement generation job or an automatic POST retry.
- Recovery is bounded by persisted checkpoints, not an exactly-once guarantee.
  Planner workers use a 30-minute run lease; beat reconciles expired runs, queued
  dispatches and confirmed schedules awaiting broker acceptance. Saved text can
  be reused through explicit failed/missing/checkpointed-item retry, but uncertain
  paid attempts are not automatically replayed. Dispatch retry applies only to
  already confirmed schedules; blocked drafts need correction and a new preview.
  Creative processing has a 15-minute lease with a 30-second heartbeat. Expired
  status returns failed/partial with `CREATIVE_LEASE_EXPIRED` without mutating it;
  explicit POST of the original payload/request ID recovers saved bases/exports
  and stale quota holds. Missing artwork after an attempted/unknown call requires
  explicit new-artwork consent and a new request ID, not blind retry. Image calls
  remain synchronous: leases cannot cancel in-flight providers. Crashes before
  checkpoints can lose paid output; interrupted uploads can leave unattached
  assets. There is no background creative-hold sweep, cross-collection transaction
  or exactly-once external publication guarantee. Monitor uncertain operations
  and broker/worker health; reconcile before authorizing another paid attempt.

### Production (EC2 + PM2)

API on **5000**, app on **5001**, marketing landing on **5002**. Folders are
auto-detected as `social-frontend` / `social-landing` next to the backend repo.

```bash
cd ../social-frontend && npm ci && npm run build
cd ../social-landing && npm ci && npm run build
cd ../social-backend
./scripts/pm2-start.sh
./scripts/pm2-stop.sh
```

Override ports with `PORT`, `FRONTEND_PORT`, and `LANDING_PORT` when starting PM2.

Use the same `.env` file everywhere — edit values per machine (laptop vs EC2). There is no separate “production mode” in code.

Point nginx at `127.0.0.1:5000` (API), `127.0.0.1:5001` (app), and `127.0.0.1:5002` (landing).

## API surface

### Provider usage and estimated costs

Bedrock text and image invocations append immutable application events to
`ai_provider_usage`, separately from the unchanged `plans_ai_usage` quota ledger.
Generation, brand-voice tests, creative sets, image generation, regeneration, and
synchronous/background content plans establish workspace/user attribution.
Each actual text call (including repair/art direction/retries) is a separate event;
resized exports and creative-set replays without provider calls create none.
Events are recorded before response parsing, image decoding, and media persistence
can fail. Image response bodies must first be read to count returned images.
No prompts, completions, token contents, credentials, or provider error bodies are stored.

`AI_PROVIDER_PRICING_JSON` defaults to `{}`: no rates are supplied or invented.
Use a JSON object keyed by the exact invoked model ID, with optional
`inputPerMillionUsd`, `outputPerMillionUsd`, `cacheReadPerMillionUsd`,
`cacheWritePerMillionUsd`, `imagePerUnitUsd`, `version`, `source`, `region`, and
`currency` (USD only). Rates must be finite and nonnegative. An explicit profile
entry may use `aliasOf` referencing a directly priced model entry; no automatic
prefix stripping or profile/region inference is performed. If supplied, both
entries' regions must match the actual runtime region. An omitted region explicitly
means the configured rate applies in every region; specify one for regional rates.

Estimates use Decimal arithmetic, then a finite numeric USD value for reporting.
Snapshots preserve the exact configured entry and resolved alias rates, currency,
version/source metadata so later configuration changes do not rewrite history.
`pricing_configuration()` in `app/providers/llm/metering.py` returns a list of
configured entries with `model_id` and `currency` for reporting.
Missing rates/usage remain null with `missing_rate`/`missing_usage`; cache usage
without its rate, failed/filtered calls, and ambiguous image results have unknown
cost, never assumed free. Only successful returned images are priced.
Bedrock Converse `inputTokens` already excludes cache-read/write tokens: no cache
subtraction is applied; each cache field is priced separately. See
[AWS cache usage semantics](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html#prompt-caching-converse).

SDK-hidden retries are disabled (`total_max_attempts=1`) so every application
invocation has an event. Application retries remain separately recorded.
Provider request IDs are indexed non-uniquely: deduplicating on them can silently
drop actual invocations. The ledger only inserts; it never updates prior events.
This is application immutability, not a MongoDB authorization/retention guarantee.
Existing historical quota records have no recoverable provider cost and are not
backfilled. Missing scope and database write failures emit explicit error logs
without breaking successful generation; outages can leave ledger gaps and need
operational alerting. There is no durable outbox or automatic cost reconciliation.

All authenticated routes are under `API_V1_PREFIX` (default `/api/v1`).

- `POST /api/v1/auth/register` — create user + personal Starter workspace, returns JWT
- `POST /api/v1/auth/login` — returns JWT
- `GET  /api/v1/auth/me` — current user + workspace memberships
- `GET  /api/v1/workspaces` / `POST /api/v1/workspaces` — list / create workspaces
- `GET  /api/v1/workspaces/{id}` — workspace detail
- `GET/POST/PATCH/DELETE /api/v1/workspaces/{id}/members` — membership management
- `GET  /api/v1/plans` — effective pricing + limits (catalog merged with DB overrides)
- `GET  /api/v1/workspaces/{workspace_id}/social/...` — the full social product: accounts,
  posts, AI generation (text/image/video), scheduling, publishing, analytics, brand voice,
  templates, approvals, settings, team permissions (mirrors the original
  `OpsBrain-Backend` social API 1:1, just re-rooted under a workspace)
- `GET  /api/v1/social/oauth/{platform}/callback` (Meta/X) and
  `GET  /api/v1/social/oauth/linkedin/callback` — public OAuth provider callbacks (no
  workspace prefix, since providers redirect to a fixed URL)
- `/api/v1/admin/...` — platform-admin-only (requires `is_platform_admin`). All
  responses below are camelCase (Pydantic `alias_generator=to_camel`) to match
  the admin dashboard 1:1 — see `app/admin/schemas.py`:
  - `GET /admin/overview` — totals, MRR estimate, 30d posts/AI usage/failed
    publishes, user growth %, plan distribution
  - `GET /admin/analytics` — 30-day daily posts-published series, plan
    distribution, platform mix (published posts by platform)
  - `GET /admin/users` — paginated user directory (`?search&plan&status&page&pageSize`),
    joined with each user's primary owned workspace + social permission level
  - `POST /admin/users/{id}/suspend` (body `{suspended?: bool}` — omit to toggle),
    `POST /admin/users/{id}/plan` (body `{plan}`) — both return the updated user row
  - `GET /admin/pricing`, `PUT /admin/pricing/{plan}` — FE-shaped pricing plans
    (camelCase, `null` limit == unlimited), backed by the same `PlanOverride` table
  - Legacy/unused-by-FE: `GET/PATCH /admin/users/{id}` (snake_case), `GET
    /admin/workspaces`, `PATCH /admin/workspaces/{id}/plan|status`, `GET/PUT
    /admin/plans` (snake_case plan catalog), `GET /admin/analytics/overview`
    (snake_case totals) — all still work, kept for backwards compatibility

Interactive docs at `/docs` once the server is running.

### Marketing contacts and analytics

Paths below use the default `/api/v1` prefix. Exact schemas and behavior are in
[app/marketing/schemas.py](app/marketing/schemas.py),
[app/marketing/service.py](app/marketing/service.py),
[app/marketing/router.py](app/marketing/router.py), and
[app/admin/router.py](app/admin/router.py).

- `POST /api/v1/public/contact` — unauthenticated; rate limit 5 requests/60 seconds.
  JSON: required `name` (2–100 characters), valid `email`, `message` (10–5000);
  optional nullable `company` (max 160), `website` (max 2048). Strings are trimmed
  and unknown fields rejected. `website` is a honeypot, not a company URL: leave
  empty/omit it. A nonempty value returns success without storing a contact.
  Returns HTTP 200 `{id: UUID, status: "received"}`. Stored contacts start as `new`.
- `POST /api/v1/public/events` — unauthenticated; rate limit 120 requests/60 seconds.
  JSON: `{event: "page_view" | "signup_click" | "contact_click", path: "/"}`;
  both fields required, unknown fields rejected. Returns HTTP 200
  `{status: "received"}`. Increments aggregate UTC daily counters, not unique
  visitor, completed-signup, or conversion counts.
- `GET /api/v1/admin/contacts` — active platform-admin bearer authentication required.
  Query: optional `search` (max 200; case-insensitive literal substring across name,
  email, company, message), optional `status` (`new`, `in_progress`, `resolved`),
  `page` (default 1; 1–1,000,000), `pageSize` (default 20; 1–200).
  Returns `{items, total, page, pageSize, totalPages}`; `totalPages` is at least 1.
  Items are newest-first (`created_at` descending, ID ascending for ties), each
  `{id, name, email, company, message, status, createdAt, updatedAt}`; timestamps
  are UTC and `company` may be null. Passwords and honeypot values are not returned.
- `PATCH /api/v1/admin/contacts/{contact_id}` — same admin authentication; UUID path
  parameter, JSON `{status: "new" | "in_progress" | "resolved"}` only. Returns the
  updated contact with the item shape above; unknown contact returns HTTP 404.
- `GET /api/v1/admin/marketing-analytics` — same admin authentication; no parameters.
  Returns `{pageViews30d, signupClicks30d, contactClicks30d, contacts30d,
  newContacts, inProgressContacts, resolvedContacts, daily}`. The four `30d` totals
  cover today and the preceding 29 UTC dates. `daily` contains exactly 30 ascending,
  zero-filled entries `{date: "YYYY-MM-DD", pageViews, signupClicks, contactClicks,
  contacts}`. Contact status counts are **all-time**, not limited to 30 days.

Invalid request bodies/query values return HTTP 422; rate limits return HTTP 429.
Contacts are stored in `marketing_contacts`; event counters in `marketing_daily`.

## Plans & AI usage enforcement

`app/plans/catalog.py` defines the three tiers (Starter / Growth / Enterprise) with
concrete limits (connected accounts, posts/month, AI text/image/video generations/month,
templates, brand voice, approval workflow). Admins can override any field per-plan via
`PUT /api/v1/admin/plans/{key}` — overrides are stored in `plan_overrides` and merged
over the catalog at read time (`app/plans/service.get_effective_plan`).

Every AI generation records an `AiUsageEvent` document (`app/plans/models.py`) and is **enforced
before** the underlying OpenAI call runs, in `app/social/limits.py`:

- `enforce_ai_text_limit` — gates `generate_post` + `test_brand_voice`
- `enforce_ai_image_limit` — gates `generate_image`
- `enforce_ai_video_limit` — gates `generate_video` (blocked entirely on Starter)
- `enforce_brand_voice_available` / `enforce_approval_available` — feature gates for
  Growth+ only features

All of these raise `402 Payment Required` with a structured `{code, message, limit, used}`
body when a workspace is over quota or the feature isn't included in its plan.

## Billing (Razorpay)

Self-serve upgrades for **Pro (₹499/mo)** and **Growth (₹999/mo)** live under
`app/billing/`:

- `POST /api/v1/workspaces/{id}/billing/checkout` — Razorpay order (workspace admin)
- `POST /api/v1/workspaces/{id}/billing/confirm` — signature verify + plan activation
- `POST /api/v1/billing/webhooks/razorpay` — `payment.captured` / `order.paid` backup
- Admin coupons: `GET/POST /api/v1/admin/coupons`, redemptions at
  `GET /api/v1/admin/coupons/redemptions`

Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in `.env`
(same keys as OpsBrain-Backend work if you reuse one Razorpay account).

## Known gaps / follow-ups

- Video generation is disabled (`VIDEO_GENERATION_ENABLED=false`). Users can still upload
  videos to S3. Re-enable only after a video provider is configured.
- Image generation requires `OPENAI_API_KEY` and `OPENAI_IMAGE_DEPLOYMENT` (`dall-e-3` or
  `gpt-image-2`). Quota enforcement in `limits.py` still runs regardless.
- OAuth apps (Meta, LinkedIn, X) need to be created/re-approved for the OpsBrain AI brand
  — the OpsBrain-Backend production app IDs are not reused here.
- No automated test suite was carried over from `OpsBrain-Backend`; verify locally against
  MongoDB Atlas (`testing-social`).
