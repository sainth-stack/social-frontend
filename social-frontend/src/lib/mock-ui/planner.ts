import type { PlannerRun, PlannerSelection, PlannerSlot, RunCreate, RunItem, ScheduleOutcome, SchedulePreview, ScheduleResult, SlotPreview } from "@/types/planner";

const runs = new Map<string, PlannerRun>();
const previews = new Map<string, { selection: string; preview: SlotPreview }>();
const schedules = new Map<string, { runId: string; preview: SchedulePreview }>();
const confirmations = new Map<string, ScheduleResult>();
let revision = 0;
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const fail = (message: string): never => { throw new Error(`Mock UI planner: ${message}`); };

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
    return { slotId: `${date}:${platform}`, date, time, timezone: selection.timezone, platform, accountId: selection.accountIds[platform] || null, proposedAt, utcOffsetMinutes: null, reasons: [...(!selection.accountIds[platform] ? ["account_missing"] : []), ...(Date.parse(proposedAt) <= Date.now() ? ["time_in_past"] : [])] };
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
  const run: PlannerRun = { id: id(), requestId: payload.requestId, status: "completed", dispatchState: "accepted", prompt: payload.prompt, timezone: payload.timezone, createdAt: now(), createdBy: "mock-admin", cancelled: false, items: [] };
  run.items = validated.preview.slots.map(slot => {
    const skip = excluded.includes(slot.slotId);
    const caption = `Demo text draft for ${slot.platform}: ${payload.prompt}\n\nReview this illustrative copy before scheduling.`;
    return refresh({ id: id(), slot, generationState: skip ? "excluded" : "created", error: null, postId: id(), revision: `demo-${++revision}`, copyApproved: false, approvedRevision: null, approvedBy: null, approvedAt: null, visualState: "not_requested", visualRevision: null, imageOperationId: null, imageRequestId: null, textState: "idle", textRequestId: null, imageIntent: slot.platform === "instagram" ? "required" : "optional", proposedAt: slot.proposedAt, isScheduled: false, canSchedule: false, reasons: [], scheduleState: null,
      post: skip ? null : { id: id(), workspaceId: "mock-workspace", createdBy: "mock-admin", title: "Demo planner draft", status: "draft", scheduledAt: slot.proposedAt, publishedAt: null, approvalStatus: "not_required", approvedBy: null, templateId: null, aiPrompt: payload.prompt, imageUrl: null, imageSource: "none", createdAt: now(), updatedAt: now(), platforms: [{ id: id(), platform: slot.platform, socialAccountId: slot.accountId, caption, hashtags: ["#Demo"], firstComment: "", characterCount: caption.length, status: "pending", platformPostId: null, publishedAt: null, errorCode: null, errorMessage: null, retryCount: 0, nextRetryAt: null, reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, engagementRate: 0 }] } });
  });
  run.items.forEach(item => { if (item.post) item.post.id = item.postId; });
  runs.set(run.id, run);
  return run;
}

function outcome(item: RunItem): ScheduleOutcome {
  refresh(item);
  return { itemId: item.id, postId: item.postId, revision: item.revision, proposedAt: item.proposedAt, timezone: item.slot.timezone, platform: item.slot.platform, accountId: item.slot.accountId, outcome: item.isScheduled ? "already_scheduled" : item.canSchedule ? "ready" : "blocked", reasons: item.reasons };
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
  if (!action && method === "GET") { run.items.forEach(refresh); return run; }
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
    if (!body.confirm || !value || value.runId !== runId) return fail("explicit final confirmation and preview are required");
    const items = value.preview.items.map(expected => {
      const item = run.items.find(row => row.id === expected.itemId)!;
      const row = outcome(item);
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
  } else if (operation === "image" && method === "POST") {
    if (!item.copyApproved) return fail("approve saved text before generating an image");
    if (body.mode === "retry" && body.requestId !== item.imageRequestId) return fail("retry must reuse the saved image request ID");
    if (body.mode === "regenerate" && (!body.creditsConfirmed || body.requestId === item.imageRequestId)) return fail("new artwork requires a new request ID and credit confirmation");
    item.imageOperationId = id(); item.imageRequestId = String(body.requestId); item.visualState = "ready"; item.visualRevision = item.revision; item.imageIntent = "required"; item.post.imageUrl = "/mock-ui/sample.svg"; item.post.imageSource = "ai_generated";
  } else if (operation === "image-intent" && method === "PATCH") {
    if (item.slot.platform === "instagram" && body.intent === "text_only") return fail("Instagram requires an image");
    item.imageIntent = String(body.intent);
    if (body.intent === "text_only") { item.post.imageUrl = null; item.visualState = "not_requested"; }
  } else if (operation === "slot" && method === "PATCH") {
    item.slot.date = String(body.date); item.slot.time = String(body.time); item.slot.timezone = String(body.timezone); item.proposedAt = instant(item.slot.date, item.slot.time, item.slot.timezone); item.slot.proposedAt = item.proposedAt;
  } else return undefined;
  return refresh(item);
}