# OpsBrain AI — Social Media Manager (Backend)

Standalone FastAPI SaaS backend for the OpsBrain AI Social Media Manager. Multi-tenant
(workspace-based), plan-gated, AI-usage-metered social publishing platform: connect
Facebook/Instagram/LinkedIn/X accounts, generate on-brand posts/images with OpenAI,
store media on Amazon S3, schedule + publish, and track analytics.

This project is self-contained — it does **not** depend on `OpsBrain-Backend` or
`opsbrain-frontend` at runtime. The `app/social/` module was extracted and adapted from
`OpsBrain-Backend/app/social_media/`, with `Organization` renamed to `Workspace`
throughout.

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

### Production (EC2 + PM2)

API on **5000**, frontend on **5001**. Frontend folder is auto-detected as
`social-frontend` or `frontend` next to the backend repo.

```bash
cd ../social-frontend && npm ci && npm run build && cd ../social-backend
./scripts/pm2-start.sh
./scripts/pm2-stop.sh
```

Use the same `.env` file everywhere — edit values per machine (laptop vs EC2). There is no separate “production mode” in code.

Point nginx at `127.0.0.1:5000` (API) and `127.0.0.1:5001` (frontend).

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
