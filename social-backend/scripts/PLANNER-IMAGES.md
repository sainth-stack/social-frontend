# Planner image operation handoff

## Frontend API

Base path: `/api/v1/workspaces/{workspaceId}/social/content-plan`.

- `POST /runs/{runId}/items/{itemId}/image/start` returns HTTP **202** with **RunItem**, not a separate job envelope. This acknowledges persisted operation state; inspect the returned state because a broker failure can already be terminal.
- Body: `expectedRevision: string`, `requestId: string`, optional `mode: "generate" | "retry" | "regenerate"` (default `generate`), `creditsConfirmed: boolean` (default `false`), `imageDirection: string | null` (maximum 1500 characters).
- Poll existing `GET /runs/{runId}`. Its `items` contain the same RunItem fields. There is no provider polling endpoint or percentage/ETA.
- Existing synchronous `POST /runs/{runId}/items/{itemId}/image` remains supported. Use `/image/start`, not the legacy route, to retry an async operation.
- Existing owned-media `POST /runs/{runId}/items/{itemId}/image-asset` is unchanged: body `expectedRevision`, `assetId`. Assets must belong to the workspace. Attaching an image while work is queued prevents that operation from replacing the owned attachment.

Additive RunItem fields:

| Field | Type / meaning |
| --- | --- |
| `imageOperationId` | Existing nullable string; stable operation identity |
| `imageRequestId` | Existing nullable string; original client request ID |
| `imageStage` | Nullable string: `queued`, `concept`, `generate`, `format`, `save`, `ready`, `failed` |
| `imageError` | Null or `{code: string, stage: string, message: string}`; `stage` identifies the actual failing pipeline stage, independently of terminal `imageStage` |
| `imageRetryable` | Boolean; whether an explicit same-request checkpoint retry is currently offered |
| `imageUpdatedAt` | Nullable UTC ISO timestamp; persisted operation update, not an ETA |
| `imageDirection` | Nullable string; saved original visual direction (empty string means editorial default) |
| `imageWarnings` | String array; advisory visibility warnings do not reject legitimate dark artwork |

`visualState` keeps its existing vocabulary. Async queued/active work is `processing`; successful current media is `ready`; failed operations are `failed` unless a current owned attachment has superseded them. Approval and image intent remain independent. An operation's historical failure does not invalidate a subsequently attached current image; prefer `visualState` and current media for rendering that attachment.

Stages are event-based, not a progress bar: concept creation, actual provider request, composition, and storage/attachment callbacks. Saving a reusable raw base occurs before formatting the export, so `save` can be followed by `format` and another `save`. Recovery with a saved recipe/base skips concept/provider stages. Fast stages may complete between polls. Do not invent percentages or assume every stage must be observed.

## Idempotency and recovery

- Persist the request ID before sending. On a lost response, replay the identical request or fetch the run and match `imageRequestId`. Active/completed identical submissions return the existing operation even while the worker holds its edit lock. They never start a second provider call.
- Keep workspace/session/run/item/revision and operation identity bound to polling. Ignore responses predating the locally accepted mutation or saved revision; use `imageUpdatedAt` to reject older operation snapshots. Poll independently of mutation requests with bounded backoff and stop at `ready`/`failed`.
- `mode: "retry"` must reuse the current request ID and original revision. Omit `imageDirection` to retain the saved direction, or send the exact saved value. Original persisted models and creative request are retained even if model headers/settings change. Retry is explicit, never automatically dispatched by GET or recovery.
- `mode: "regenerate"` requires a **new request ID** and `creditsConfirmed: true`. It is blocked while another operation is queued/active. It does not erase existing Media assets.
- Broker dispatch failure: `IMAGE_QUEUE_UNAVAILABLE`, failed, retryable. If delivery was uncertain, the failed state's generation fence prevents the old delivery from running; an explicit retry gets a new fence.
- Queued work expires after five minutes (`IMAGE_QUEUE_EXPIRED`). Active work has a thirty-minute lease refreshed by genuine stage callbacks (`IMAGE_LEASE_EXPIRED`). Polling reconciles expiry; the existing scheduled `recover_planner_runs` maintenance task also reconciles it. Neither path blindly replays paid attempts.
- A same-request retry delegates to shared creative-set checkpoints. Saved bases/recipes are reused without new image calls or accepted-base quota charges. A recorded attempt without a saved base is not replayed; it becomes non-retryable and requires explicit new-artwork consent or an owned image.
- Base-quality rejection preserves safe codes such as `IMAGE_NEAR_BLACK`, `IMAGE_UNIFORM`, `IMAGE_FULLY_TRANSPARENT`, and `IMAGE_DECODE_FAILED`, with the failing stage. It is not presented as a generic recoverable storage failure. Existing provider metering and quota/hold release are retained.
- Worker rechecks creator permission, workspace status, cancellation, approved revision, image intent and item operation identity before work. Claim/generation fencing plus the existing post edit lease prevent stale attachment/status writes. Cancellation cannot guarantee stopping an already running provider request; it never schedules/publishes anything.

## Visual direction and rollout

The planner defaults to clean editorial artwork, one clear subject, balanced contrast, a light/neutral setting, and brand colours as accents. User direction replaces this style default, so deliberately dark artwork remains allowed. The approved caption is the primary subject, with bounded original brief constraints. Art direction is enabled separately from `autoCopy=false` and `textOverlay=false`; no headline/CTA overlays are enabled. Studio's existing auto-copy semantics and saved render recipes are preserved.

The additive task `app.social.tasks.planner_runs.generate_planner_image` is registered in the existing included module and routed by the existing `planner_runs.*` rule to `social_maintenance`, with `max_retries=0`. Deploy matching API and maintenance worker code before enabling the frontend start endpoint. No database migration or publishing-worker startup is needed for these fields. A worker that does not consume this queue will lead to visible queue expiry rather than endless processing.

All verification uses test database, storage, broker and model fixtures. No live database, worker, server or paid provider call was used. The user's exact failing image was not inspected: no authorized raw asset bytes were supplied offline, and no database/network lookup was attempted. The precise asset root cause remains unconfirmed; pixel visibility metrics are advisory, not semantic quality validation.

Verification: 427 scoped tests passed across planner images/runs/scheduling/slots/safeguards/backend regressions, creative sets/variants/rendering, image reliability, metering and publish validation. Final full backend run: **1286 passed**, 86 existing deprecation warnings, 87.88 seconds. Editor diagnostics and whitespace validation passed. The new image module includes 23 dedicated regression cases.