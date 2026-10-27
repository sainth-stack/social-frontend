import type { ConflictAcknowledgment, PlannerRun, PlannerSelection, PlannerSlot, PlannerWarning, RunCreate, RunItem, ScheduleOutcome, SchedulePreview, ScheduleResult, SlotPreview } from "@/types/planner";
import type { MediaAsset } from "@/types/social-media.types";
import { handleSocialMock } from "./social";

const runs = new Map<string, PlannerRun>();
const previews = new Map<string, { selection: string; preview: SlotPreview }>();
const schedules = new Map<string, { runId: string; preview: SchedulePreview }>();
const confirmations = new Map<string, ScheduleResult>();
const imageRequests = new Map<string, { revision: string | null; direction: string; mode: string }>();
let revision = 0;
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const fail = (message: string): never => { throw new Error(`Mock UI planner: ${message}`); };
const fingerprint = (value: unknown) => {
  let hash = 0;
  for (const char of JSON.stringify(value)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return `demo-warning-${hash}`;
};

function annotate(slot: PlannerSlot, ownPost?: string): PlannerSlot {
  const warnings: PlannerWarning[] = [...runs.values()].flatMap(run => run.items).filter(item => item.postId !== ownPost && item.isScheduled && item.slot.accountId === slot.accountId && item.proposedAt === slot.proposedAt).map(item => ({ code: "scheduled_post_conflict", postId: item.postId, accountId: item.slot.accountId!, accountName: `Demo ${item.slot.platform} account`, status: "scheduled", scheduledAt: item.proposedAt!, localDate: item.slot.date, localTime: item.slot.time!, timezone: item.slot.timezone, utcOffsetMinutes: item.slot.utcOffsetMinutes ?? 0, excerpt: item.post?.platforms[0].caption.replace(/\s+/g, " ").slice(0, 160) ?? "Scheduled demo post", fingerprint: fingerprint([item.postId, item.proposedAt]) }));
  return { ...slot, warnings, warningFingerprint: warnings.length ? fingerprint([slot.slotId, slot.accountId, slot.proposedAt, slot.timezone, warnings]) : null, acknowledgmentRequired: !!warnings.length };
}

const acknowledged = (row: { slotId?: string; warningFingerprint?: string | null }, acknowledgments: ConflictAcknowledgment[] = []) => !row.warningFingerprint || acknowledgments.some(ack => ack.slotId === row.slotId && ack.warningFingerprint === row.warningFingerprint);
const requireConsent = (slot: PlannerSlot, acknowledgments?: ConflictAcknowledgment[]) => {
  if (!acknowledged(slot, acknowledgments)) throw Object.assign(new Error("Review other posts at this time"), { response: { status: 409, data: { detail: { code: "conflict_acknowledgment_required", slot } } } });
};

function instant(date: string, time: string, timezone: string): string {
  const target = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(target)) return fail("invalid date or time");
  let value = target;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (let index = 0; index < 3; index++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map(part => [part.type, part.value]));
    const rendered = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
    value += target - rendered;
  }
  return new Date(value).toISOString();
}

function selectionKey(selection: PlannerSelection): string {
  return JSON.stringify({ timezone: selection.timezone, dates: selection.dates, startDate: selection.startDate, endDate: selection.endDate, platforms: selection.platforms, accountIds: selection.accountIds, postingTime: selection.postingTime, overrides: selection.overrides });
}

function preview(selection: PlannerSelection): SlotPreview {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: selection.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find(row => row.type === type)!.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const dates = [...new Set(selection.dates ?? [])].sort();
  if (!selection.dates) {
    const start = Date.parse(`${selection.startDate}T00:00:00Z`);
    const end = Date.parse(`${selection.endDate}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end - start > 30 * 86400000) fail("select a valid range of up to 30 dates");
    for (let value = start; value <= end; value += 86400000) dates.push(new Date(value).toISOString().slice(0, 10));
  }
  if (!dates.length || dates.length > 30 || !selection.platforms?.length || !selection.timezone) fail("select dates, timezone and channels");
  const slots: PlannerSlot[] = dates.flatMap(date => selection.platforms.map(platform => {
    const override = selection.overrides?.find(row => row.date === date && row.platform === platform);
    const time = override?.time || selection.postingTime || "10:00";
    const proposedAt = instant(date, time, selection.timezone);
    const accountId = override?.accountId || selection.accountIds[platform] || null;
    return annotate({ slotId: `${date}:${platform}`, date, time, timezone: selection.timezone, platform, accountId, proposedAt, utcOffsetMinutes: null, reasons: [...(!accountId ? ["account_missing"] : []), ...(date < today ? ["past_date"] : Date.parse(proposedAt) <= Date.now() ? ["past_slot"] : [])] });
  }));
  const result = { timezone: selection.timezone, selectedDateCount: dates.length, dateCap: 30, expectedTextUnits: slots.length, previewToken: id(), slots };
  previews.set(result.previewToken, { selection: selectionKey(selection), preview: result });
  return result;
}

function refresh(item: RunItem) {
  item.reasons = [];
  if (!item.copyApproved) item.reasons.push("copy_not_approved");
  const currentImage = item.visualState === "ready" && item.visualRevision === item.revision && !!item.post?.imageUrl;
  if ((item.imageIntent === "required" || item.slot.platform === "instagram") && !currentImage) item.reasons.push("image_required");
  if (["facebook", "linkedin"].includes(item.slot.platform) && item.imageIntent !== "text_only" && !currentImage) item.reasons.push("Choose text only or generate a current planner image before publishing");
  if (item.proposedAt && Date.parse(item.proposedAt) <= Date.now()) item.reasons.push("time_in_past");
  item.canSchedule = !item.reasons.length;
  return item;
}

function create(payload: RunCreate): PlannerRun {
  const old = [...runs.values()].find(run => run.requestId === payload.requestId);
  if (old) return old;
  const validated = previews.get(payload.previewToken);
  if (!validated || validated.selection !== selectionKey(payload)) return fail("refresh the exact slot preview before creating");
  const excluded = payload.excludedSlotIds ?? [];
  if (validated.preview.slots.some(slot => slot.reasons.length && !excluded.includes(slot.slotId))) fail("correct or explicitly exclude blocked slots");
  validated.preview.slots.filter(slot => !excluded.includes(slot.slotId)).forEach(slot => requireConsent(annotate(slot), payload.conflictAcknowledgments));
  const settings = handleSocialMock("/api/v1/workspaces/mock-workspace/social/settings", "GET", {}, {}) as { autoFirstComment?: boolean } | undefined;
  const includeComment = payload.includeComment ?? !!settings?.autoFirstComment;
  const run: PlannerRun = { id: id(), requestId: payload.requestId, status: "completed", dispatchState: "accepted", prompt: payload.prompt, includeComment, timezone: payload.timezone, createdAt: now(), createdBy: "mock-admin", cancelled: false, items: [] };
  run.items = validated.preview.slots.map(slot => {
    const skip = excluded.includes(slot.slotId);
    const caption = `Demo text draft for ${slot.platform}: ${payload.prompt}\n\nReview this illustrative copy before scheduling.`;
    return refresh({ id: id(), slot, generationState: skip ? "excluded" : "created", error: null, postId: id(), revision: `demo-${++revision}`, copyApproved: false, approvedRevision: null, approvedBy: null, approvedAt: null, visualState: "not_requested", visualRevision: null, imageOperationId: null, imageRequestId: null, imageStage: null, imageError: null, imageRetryable: false, imageUpdatedAt: null, imageDirection: null, imageWarnings: [], textState: "idle", textRequestId: null, imageIntent: slot.platform === "instagram" ? "required" : "optional", proposedAt: slot.proposedAt, isScheduled: false, canSchedule: false, reasons: [], scheduleState: null,
      post: skip ? null : { id: id(), workspaceId: "mock-workspace", createdBy: "mock-admin", title: "Demo planner draft", status: "draft", scheduledAt: slot.proposedAt, publishedAt: null, approvalStatus: "not_required", approvedBy: null, templateId: null, aiPrompt: payload.prompt, imageUrl: null, imageSource: "none", createdAt: now(), updatedAt: now(), platforms: [{ id: id(), platform: slot.platform, socialAccountId: slot.accountId, caption, hashtags: ["#Demo"], firstComment: "", characterCount: caption.length, status: "pending", platformPostId: null, publishedAt: null, errorCode: null, errorMessage: null, retryCount: 0, nextRetryAt: null, reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, engagementRate: 0 }] } });
  });
  run.items.forEach(item => { if (item.post) { item.post.id = item.postId; item.post.generationOptions = { includeComment }; item.post.platforms[0].firstComment = includeComment ? "Demo discussion: what has worked for your team?" : ""; } });
  runs.set(run.id, run);
  return run;
}

function outcome(item: RunItem): ScheduleOutcome {
  refresh(item);
  const slot = annotate(item.slot, item.postId);
  return { itemId: item.id, slotId: slot.slotId, warnings: slot.warnings, warningFingerprint: slot.warningFingerprint, acknowledgmentRequired: slot.acknowledgmentRequired, postId: item.postId, revision: item.revision, proposedAt: item.proposedAt, timezone: item.slot.timezone, platform: item.slot.platform, accountId: item.slot.accountId, outcome: item.isScheduled ? "already_scheduled" : item.canSchedule ? "ready" : "blocked", reasons: [...item.reasons] };
}

export function handlePlannerMock(path: string, method: string, params: Record<string, string>, body: Record<string, unknown>): unknown | undefined {
  const match = /^\/api\/v1\/workspaces\/mock-workspace\/social\/content-plan\/(slots\/preview|runs(?:\/.*)?)$/.exec(path);
  if (!match) return undefined;
  const route = match[1];
  if (route === "slots/preview" && method === "POST") return preview(body as unknown as PlannerSelection);
  if (route === "runs") {
    if (method === "POST") return create(body as unknown as RunCreate);
    if (method === "GET") { const rows = [...runs.values()].reverse(); const offset = Number(params.offset ?? 0); return { total: rows.length, items: rows.slice(offset, offset + Number(params.limit ?? 20)) }; }
  }
  const [, runId, ...rest] = route.split("/");
  const run = runs.get(runId);
  if (!run) return fail("saved demo run not found; mock data resets when the page reloads");
  const action = rest.join("/");
  if (!action && method === "GET") {
    run.items.forEach(item => {
      if (item.visualState === "processing") {
        const stages = ["queued", "concept", "generate", "format", "save", "ready"] as const;
        item.imageStage = stages[Math.min(stages.indexOf(item.imageStage as typeof stages[number]) + 1, stages.length - 1)];
        item.imageUpdatedAt = now();
        if (item.imageStage === "ready" && item.post) { item.visualState = "ready"; item.visualRevision = item.revision; item.post.imageUrl = "/mock-ui/sample.svg"; item.post.imageSource = "ai_generated"; }
      }
      item.slot = annotate(item.slot, item.postId);
      refresh(item);
    });
    return run;
  }
  if (action === "cancel" && method === "POST") { run.cancelled = true; run.status = "cancelled"; return run; }
  if (action === "retry" && method === "POST") return run;
  if (action === "schedule/preview" && method === "POST") {
    const rows = (body.itemIds as string[]).map(itemId => outcome(run.items.find(item => item.id === itemId) ?? fail("selected item not found")));
    const value = { previewId: id(), expiresAt: new Date(Date.now() + 600000).toISOString(), items: rows };
    schedules.set(value.previewId, { runId, preview: value });
    return value;
  }
  if (action === "schedule/confirm" && method === "POST") {
    const key = String(body.requestId);
    if (confirmations.has(key)) return confirmations.get(key);
    const value = schedules.get(String(body.previewId));
    if (!body.confirm || !value || value.runId !== runId || Date.parse(value.preview.expiresAt) <= Date.now()) return fail("explicit final confirmation and a current preview are required");
    const items = value.preview.items.map(expected => {
      const item = run.items.find(row => row.id === expected.itemId)!;
      const row = outcome(item);
      if (row.warningFingerprint !== expected.warningFingerprint) return { ...row, outcome: "blocked" as const, reasons: ["conflict_snapshot_changed_preview_again"] };
      if (!acknowledged(row, body.conflictAcknowledgments as ConflictAcknowledgment[])) return { ...row, outcome: "blocked" as const, reasons: ["conflict_acknowledgment_required"] };
      if (row.revision !== expected.revision || row.proposedAt !== expected.proposedAt) return { ...row, outcome: "blocked" as const, reasons: ["preview_changed"] };
      if (row.outcome === "ready" && row.revision === expected.revision && row.proposedAt === expected.proposedAt) { item.isScheduled = true; item.scheduleState = "accepted"; if (item.post) item.post.status = "scheduled"; row.outcome = "scheduled"; }
      return row;
    });
    const result = { requestId: key, items };
    confirmations.set(key, result);
    return result;
  }
  if (action === "schedule/retry" && method === "POST") return { requestId: body.requestId, items: (body.itemIds as string[]).map(itemId => outcome(run.items.find(item => item.id === itemId) ?? fail("item not found"))) };
  const itemMatch = /^items\/([^/]+)\/(.+)$/.exec(action);
  if (!itemMatch) return undefined;
  const item = run.items.find(row => row.id === itemMatch[1]) ?? fail("item not found");
  const operation = itemMatch[2];
  if (!item.post || item.isScheduled) return fail("only saved demo drafts can change");
  if (operation !== "slot" && body.expectedRevision !== item.revision) return fail("saved copy changed; reload its revision");
  if (operation === "approve-copy" && method === "POST") { item.copyApproved = true; item.approvedRevision = item.revision; item.approvedAt = now(); item.approvedBy = "mock-admin"; }
  else if ((operation === "copy" && method === "PATCH") || (operation === "regenerate-text" && method === "POST")) {
    const copy = item.post.platforms[0];
    copy.caption = operation === "copy" ? String(body.caption) : `${copy.caption}\n\nDemo revised text ${++revision}.`;
    if (operation === "copy") { copy.hashtags = body.hashtags as string[]; copy.firstComment = String(body.firstComment ?? ""); }
    item.revision = `demo-${++revision}`; item.copyApproved = false; item.approvedRevision = null; item.visualState = item.post.imageUrl ? "stale" : "not_requested";
  } else if (["image", "image/start"].includes(operation) && method === "POST") {
    if (!item.copyApproved) return fail("approve saved text before generating an image");
    const key = `${run.id}/${item.id}/${body.requestId}`;
    const original = imageRequests.get(key);
    if (original && (original.revision !== body.expectedRevision || body.imageDirection !== undefined && body.imageDirection !== original.direction || body.mode !== "retry" && String(body.mode ?? "generate") !== original.mode)) return fail("request revision, action or direction changed");
    if (item.imageRequestId === body.requestId && (body.mode !== "retry" || ["processing", "ready"].includes(item.visualState))) {
      return item;
    }
    if (item.visualState === "processing") return fail("an image operation is already active");
    if (body.mode === "retry" && body.requestId !== item.imageRequestId) return fail("retry must reuse the saved image request ID");
    if (body.mode === "regenerate" && (!body.creditsConfirmed || body.requestId === item.imageRequestId)) return fail("new artwork requires a new request ID and credit confirmation");
    imageRequests.set(key, original ?? { revision: item.revision, direction: String(body.imageDirection ?? ""), mode: String(body.mode ?? "generate") });
    item.imageOperationId = body.mode === "retry" ? item.imageOperationId : id(); item.imageRequestId = String(body.requestId); item.imageDirection = body.mode === "retry" ? item.imageDirection : String(body.imageDirection ?? ""); item.imageError = null; item.imageRetryable = false; item.imageUpdatedAt = now(); item.imageIntent = "required";
    if (operation === "image/start") { item.visualState = "processing"; item.imageStage = "queued"; }
    else { item.visualState = "ready"; item.imageStage = "ready"; item.visualRevision = item.revision; item.post.imageUrl = "/mock-ui/sample.svg"; item.post.imageSource = "ai_generated"; }
  } else if (operation === "image-asset" && method === "POST") {
    if (!item.copyApproved) return fail("approve text before choosing an image");
    if (!body.assetId) return fail("choose a workspace image");
    const asset = handleSocialMock(`/api/v1/workspaces/mock-workspace/social/media-assets/${encodeURIComponent(String(body.assetId))}`, "GET", {}, {}) as MediaAsset;
    if (!asset || asset.mediaType !== "image") return fail("choose an owned workspace image");
    item.visualState = "ready"; item.visualRevision = item.revision; item.imageIntent = "required"; item.post.imageUrl = asset.url; item.post.imageSource = asset.source; item.imageUpdatedAt = now();
  } else if (operation === "image-intent" && method === "PATCH") {
    if (item.slot.platform === "instagram" && body.intent === "text_only") return fail("Instagram requires an image");
    item.imageIntent = String(body.intent);
    if (body.intent === "text_only") { item.post.imageUrl = null; item.visualState = "not_requested"; }
  } else if (operation === "slot" && method === "PATCH") {
    const proposedAt = instant(String(body.date), String(body.time), String(body.timezone));
    if (Date.parse(proposedAt) <= Date.now()) return fail("choose a future posting time");
    const slot = annotate({ ...item.slot, date: String(body.date), time: String(body.time), timezone: String(body.timezone), proposedAt }, item.postId);
    requireConsent(slot, body.conflictAcknowledgments as ConflictAcknowledgment[]);
    item.slot = slot; item.proposedAt = proposedAt;
  } else return undefined;
  return refresh(item);
}