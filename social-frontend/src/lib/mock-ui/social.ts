import type {
  AnalyticsOverview, ApplyTemplateResult, AudienceGrowth, BrandLogo, BrandVoice,
  BrandVoiceTestResult, CalendarPost, CalendarResponse, ContentPlanDay,
  ContentPlanGenerateResponse, ContentPlanJobStatus, CreateSocialPostPayload,
  CreativeFormat, GeneratedContent, GeneratedSlide, GeneratedTweet,
  GenerateCreativeSetResult, GenerateImageResult, MediaAsset, MediaAssetListResponse,
  PlatformAnalytics, PostPerformanceItem, SocialAccount, SocialActivityItem,
  SocialDashboardStats, SocialPlatform, SocialPost, SocialPostListResponse,
  SocialPostPlatform, SocialPostStatus, SocialSettings, SocialTemplate,
} from "../../types/social-media.types";
import type { AIModelCatalog } from "../../types/ai-models";

const workspace = "mock-workspace";
const actor = "mock-admin";
const sample = "/mock-ui/sample.svg";
const today = new Date().toISOString().slice(0, 10);
const channels: SocialPlatform[] = ["linkedin", "facebook", "instagram", "x"];
const statuses: SocialPostStatus[] = ["draft", "pending_approval", "scheduled", "publishing", "published", "failed", "archived"];
let sequence = 1000;
let textGenerations = 18;
let imageGenerations = 6;

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function now(): string {
  return new Date().toISOString();
}

function dateAt(offset: number, date = today): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + offset * 86400000).toISOString().slice(0, 10);
}

function id(kind: string): string {
  return `mock-demo-${kind}-${++sequence}`;
}

function fail(message: string): never {
  throw new Error(`Mock UI: ${message}`);
}

function required<T>(value: T | undefined): T {
  return value === undefined ? fail("demo record not found.") : value;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function positive(value: unknown, fallback: number, maximum = 200, minimum = 1): number {
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) fail(`enter a whole number between ${minimum} and ${maximum}.`);
  return number;
}

function matches(search: string | undefined, ...values: unknown[]): boolean {
  return !search || values.join(" ").toLowerCase().includes(search.trim().toLowerCase());
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("expected a demo object.");
  return value as Record<string, unknown>;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === "string")) fail("expected a list of strings.");
  return value as string[];
}

function platform(value: unknown): SocialPlatform {
  if (!channels.includes(value as SocialPlatform)) fail("unsupported demo platform.");
  return value as SocialPlatform;
}

function selectedPlatforms(value: unknown, fallback: SocialPlatform[] = ["linkedin"]): SocialPlatform[] {
  if (value === undefined) return [...fallback];
  const result = [...new Set(strings(value).map(platform))];
  if (!result.length) fail("select at least one demo platform.");
  return result;
}

function date(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(`${result}T00:00:00Z`)) || new Date(`${result}T00:00:00Z`).toISOString().slice(0, 10) !== result) fail("enter a valid YYYY-MM-DD demo date.");
  return result;
}

function timestamp(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) fail("enter a valid demo schedule timestamp.");
  return new Date(value).toISOString();
}

function page<T>(items: T[], params: Record<string, string>) {
  const number = positive(params.page, 1, 1000000);
  const size = positive(params.pageSize, 20);
  return { items: items.slice((number - 1) * size, number * size), total: items.length, page: number, pageSize: size, totalPages: Math.ceil(items.length / size) };
}

function mergeKnown<T extends object>(target: T, input: Record<string, unknown>, excluded: string[] = []): T {
  const next = copy(target);
  for (const key of Object.keys(target) as Array<keyof T & string>) {
    if (excluded.includes(key) || input[key] === undefined) continue;
    const value = input[key];
    const original = target[key];
    if (original !== null && (Array.isArray(original) ? !Array.isArray(value) : typeof original !== typeof value || value === null)) fail(`invalid demo ${key}.`);
    if (original === null && value !== null && typeof value !== "string") fail(`invalid demo ${key}.`);
    Object.assign(next, { [key]: copy(value) });
  }
  return next;
}

const accounts: SocialAccount[] = ["linkedin", "facebook", "instagram"].map((name, index) => ({
  id: `mock-demo-account-${name}`, orgId: workspace, platform: name as SocialPlatform,
  accountType: name === "instagram" ? "profile" : "page", platformAccountId: `demo-${name}-page`,
  accountName: `Demo Northstar ${name === "linkedin" ? "Studio" : name === "facebook" ? "Community" : "Stories"}`,
  accountPictureUrl: sample, followerCount: [4820, 2310, 3670][index],
  tokenExpiresAt: `${dateAt(index === 2 ? 4 : 60)}T12:00:00.000Z`,
  tokenStatus: index === 2 ? "expires_soon" : "active", isDefault: true, isActive: true,
  lastSyncedAt: `${today}T08:00:00.000Z`, createdAt: `${dateAt(-90)}T09:00:00.000Z`, updatedAt: `${today}T08:00:00.000Z`,
}));

let brand: BrandVoice = {
  id: "mock-demo-brand", orgId: workspace, brandName: "Demo Northstar Studio", industry: "B2B consulting",
  tagline: "Useful ideas, shared consistently.", targetAudience: "Founders and small marketing teams",
  tones: ["Professional", "Helpful"], wordsToUse: ["clarity", "practical", "progress"],
  wordsToAvoid: ["guaranteed", "revolutionary"], ctaPhrases: ["What would you try first?"],
  sentenceLength: "medium", emojiUsage: "never", primaryLanguage: "English", systemPromptOverride: null,
  logoUrl: sample, primaryColor: "#c2410c", accentColor: "#fb923c", updatedAt: `${today}T08:00:00.000Z`,
};

let logos: BrandLogo[] = [
  { id: "mock-demo-logo-1", url: sample, name: "Demo sample mark", isDefault: true, createdAt: `${dateAt(-20)}T09:00:00Z` },
  { id: "mock-demo-logo-2", url: sample, name: "Demo alternate mark", isDefault: false, createdAt: `${dateAt(-10)}T09:00:00Z` },
];

let settings: SocialSettings = {
  id: "mock-demo-settings", orgId: workspace, timezone: "Asia/Kolkata", defaultLanguage: "English",
  approvalRequired: false, approverUserIds: [actor], approvalSlaHours: 24, approvalSlaAction: "notify",
  defaultPostingTimes: { linkedin: ["09:00"], facebook: ["12:00"], instagram: ["18:00"] },
  queueGapMinutes: 120, blackoutDates: [], defaultTone: "Professional", defaultCta: "Share your perspective.",
  hashtagCount: 3, autoFirstComment: false, imageGenerationStyle: "Editorial", openaiModel: "demo-offline",
  systemPromptOverride: null, enabledPlatforms: { linkedin: true, facebook: true, instagram: true, x: false },
  notificationEvents: { published: true, failed: true, approvalRequested: true, tokenExpiring: true },
  notificationDelivery: "in_app",
};

const team: Array<{ userId: string; name: string; email: string; permission: string }> = [
  { userId: actor, name: "Demo Admin", email: "demo.admin@example.test", permission: "admin" },
  { userId: "mock-demo-editor", name: "Demo Avery Chen", email: "demo.avery@example.test", permission: "editor" },
  { userId: "mock-demo-publisher", name: "Demo Morgan Patel", email: "demo.morgan@example.test", permission: "publisher" },
];

const templates: SocialTemplate[] = ["Practical checklist", "Behind the scenes", "Community question", "Product lesson"].map((name, index) => ({
  id: `mock-demo-template-${index + 1}`, orgId: workspace, name: `Demo ${name}`, category: ["Education", "Brand", "Engagement", "Marketing"][index],
  platforms: ["linkedin", "facebook", "instagram"], captionTemplate: `Demo example: ${name} for {{topic}}. Start with one useful action and share what you learn.`,
  hashtags: ["Demo", "SmallBusiness"], isSystem: index < 2, systemKey: index < 2 ? `demo-${index}` : null,
  description: "Offline sample template. Edit the details before using outside this demo.", goal: "Build trust",
  placeholders: [{ key: "topic", label: "Topic", example: "a focused weekly content routine", required: true }],
  imagePrompt: "Demo editorial sample", generateImage: false, suggestedTone: "Professional",
  suggestedCta: "What would you try first?", firstCommentTemplate: "Demo discussion starter: share your experience.",
  sortOrder: index, createdBy: index < 2 ? null : actor, createdAt: `${dateAt(-30)}T09:00:00Z`,
}));

const media: MediaAsset[] = Array.from({ length: 8 }, (_, index) => ({
  id: `mock-demo-media-${index + 1}`, mediaType: "image", source: index % 2 ? "uploaded" : "ai_generated",
  url: sample, mimeType: "image/svg+xml", fileSizeBytes: 0,
  prompt: `Demo sample visual ${index + 1}: ${["weekly planning", "a focused team", "a useful checklist", "community ideas"][index % 4]}. Not generated by an AI provider.`,
  soraVideoId: null, durationSeconds: null, postId: null, createdAt: `${dateAt(-index)}T09:00:00Z`,
}));

function makePlatform(input: Record<string, unknown>): SocialPostPlatform {
  const channel = platform(input.platform);
  const caption = text(input.caption);
  const accountId = input.socialAccountId === null ? null : text(input.socialAccountId, accounts.find(item => item.platform === channel && item.isActive)?.id || "") || null;
  if (accountId && !accounts.some(item => item.id === accountId && item.platform === channel)) fail("demo account does not match the selected platform.");
  const result: SocialPostPlatform = {
    id: id("platform"), platform: channel, socialAccountId: accountId, caption,
    hashtags: input.hashtags === undefined ? [] : strings(input.hashtags), firstComment: text(input.firstComment) || null,
    characterCount: caption.length, status: "pending", platformPostId: null, publishedAt: null,
    errorCode: null, errorMessage: null, retryCount: 0, nextRetryAt: null,
    reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, engagementRate: 0,
  };
  if (input.media !== undefined) {
    if (!Array.isArray(input.media)) fail("invalid demo media list.");
    result.media = input.media.map(item => {
      const data = record(item);
      if (!text(data.url)) fail("demo media requires a URL.");
      return { url: text(data.url), assetId: text(data.assetId) || null, blobKey: text(data.blobKey) || null,
        slideId: text(data.slideId) || null, mimeType: text(data.mimeType) || null,
        width: typeof data.width === "number" ? data.width : null, height: typeof data.height === "number" ? data.height : null };
    });
  }
  return result;
}

function postPayload(input: Record<string, unknown>): CreateSocialPostPayload {
  if (input.status !== undefined && !statuses.includes(input.status as SocialPostStatus)) fail("invalid demo post status.");
  if (input.format !== undefined && !["single", "carousel", "thread", "poll"].includes(String(input.format))) fail("unsupported demo post format.");
  if (input.imageSource !== undefined && !["none", "uploaded", "ai_generated"].includes(String(input.imageSource))) fail("invalid demo image source.");
  const result: CreateSocialPostPayload = {};
  for (const key of ["title", "aiPrompt", "templateId", "imageUrl"] as const) {
    if (input[key] !== undefined) {
      if (key === "title" && typeof input[key] !== "string") fail("a demo post title must be text.");
      if (input[key] !== null && typeof input[key] !== "string") fail(`invalid demo ${key}.`);
      Object.assign(result, { [key]: input[key] });
    }
  }
  if (input.status !== undefined) result.status = input.status as SocialPostStatus;
  if (input.format !== undefined) result.format = input.format as CreateSocialPostPayload["format"];
  if (input.imageSource !== undefined) result.imageSource = input.imageSource as CreateSocialPostPayload["imageSource"];
  if (input.scheduledAt !== undefined) result.scheduledAt = input.scheduledAt === null ? null : timestamp(input.scheduledAt);
  if (input.platforms !== undefined) {
    if (!Array.isArray(input.platforms)) fail("invalid demo platform rows.");
    result.platforms = input.platforms.map(item => makePlatform(record(item)));
    if (new Set(result.platforms.map(item => item.platform)).size !== result.platforms.length) fail("choose each demo platform only once.");
  }
  if (input.slides !== undefined) {
    if (!Array.isArray(input.slides) || input.slides.length > 8) fail("demo carousels support at most eight slides.");
    result.slides = input.slides.map(item => {
      const slide = record(item);
      return { id: text(slide.id, id("slide")), headline: text(slide.headline), body: text(slide.body), imagePrompt: text(slide.imagePrompt), imageUrl: text(slide.imageUrl) || null };
    });
  }
  if (input.tweets !== undefined) {
    if (!Array.isArray(input.tweets)) fail("invalid demo thread.");
    result.tweets = input.tweets.map(item => ({ text: text(record(item).text) }));
  }
  if (input.generationOptions !== undefined) result.generationOptions = copy(record(input.generationOptions));
  return result;
}

function makePost(input: Record<string, unknown>): SocialPost {
  const data = postPayload(input);
  return {
    id: id("post"), orgId: workspace, createdBy: actor, title: text(data.title, "Demo untitled draft"),
    status: data.status || "draft", scheduledAt: data.scheduledAt || null, publishedAt: null,
    approvalStatus: "not_required", approvedBy: null, templateId: data.templateId || null,
    aiPrompt: data.aiPrompt || null, imageUrl: data.imageUrl || null, imageSource: data.imageSource || "none",
    platforms: (data.platforms || []).map(item => makePlatform(item as unknown as Record<string, unknown>)),
    format: data.format || "single", generationOptions: data.generationOptions || {}, slides: data.slides || [], tweets: data.tweets || [],
    createdAt: now(), updatedAt: now(),
  };
}

const topics = ["A calmer weekly content routine", "Three questions before your next launch", "What a customer interview taught us", "Behind our Friday planning session", "A practical onboarding checklist", "Small experiments, useful lessons", "Making space for better ideas", "Your team's most useful habit"];
const posts: SocialPost[] = Array.from({ length: 36 }, (_, index) => {
  const state: SocialPostStatus = index < 16 ? "published" : ["draft", "scheduled", "failed", "pending_approval"][index % 4] as SocialPostStatus;
  const selected: SocialPlatform[] = index % 3 === 0 ? ["linkedin", "facebook", "instagram"] : [channels[index % 3]];
  const post = makePost({ title: `Demo: ${topics[index % topics.length]}`, status: state,
    imageUrl: index % 3 ? sample : null, imageSource: index % 3 ? "ai_generated" : "none",
    scheduledAt: state === "scheduled" ? `${dateAt(1 + index % 10)}T09:00:00.000Z` : null,
    platforms: selected.map(channel => ({ platform: channel, caption: `Demo example: ${topics[index % topics.length]}. Start with a clear goal, share one practical lesson, and invite your community to add their experience. What would you try first?`, hashtags: ["Demo", "ContentStrategy"] })),
  });
  post.id = `mock-demo-post-${index + 1}`;
  post.createdAt = `${dateAt(-Math.floor(index / 2))}T08:00:00.000Z`;
  post.updatedAt = post.createdAt;
  if (state === "pending_approval") post.approvalStatus = "pending";
  if (state === "published") post.publishedAt = `${dateAt(-1 - index)}T09:00:00.000Z`;
  post.platforms.forEach((row, rowIndex) => {
    row.status = state === "published" ? "published" : state === "failed" ? "failed" : "pending";
    if (state === "failed") {
      row.errorCode = "DEMO_SIMULATED_FAILURE";
      row.errorMessage = "Demo simulated publishing failure. Retry only updates local fixtures.";
    }
    if (state === "published") {
      row.platformPostId = `mock-demo-published-${index}-${rowIndex}`;
      row.publishedAt = post.publishedAt;
      row.reach = 320 + index * 47 + rowIndex * 73;
      row.impressions = Math.round(row.reach * 1.4);
      row.likes = 18 + index * 2;
      row.comments = 3 + index % 7;
      row.shares = 2 + index % 5;
      row.clicks = 8 + index;
      row.engagementRate = Number(((row.likes + row.comments + row.shares + row.clicks) / row.impressions * 100).toFixed(2));
    }
  });
  return post;
});

const activity: SocialActivityItem[] = posts.slice(0, 10).map(post => ({
  id: id("activity"), action: `post.${post.status}`, type: "published", text: `Demo: ${post.title} (simulated locally)`,
  title: post.title, entityType: "post", entityId: post.id, metadata: { demo: true },
  platforms: post.platforms.map(row => row.platform), groupCount: 1, createdAt: post.publishedAt || post.createdAt,
}));
const jobs = new Map<string, ContentPlanJobStatus>();
const creativeSets = new Map<string, { signature: string; result: GenerateCreativeSetResult }>();
const recommendations = topics.slice(0, 3).map(topic => ({ topic: `Demo: ${topic}`, reason: "Sample recommendation based on the demo brand. No AI or account data was requested." }));

function log(action: string, post: SocialPost): void {
  activity.unshift({ id: id("activity"), action: `post.${action}`, text: `Demo ${action}: ${post.title} (local simulation only)`,
    title: post.title, entityType: "post", entityId: post.id, metadata: { demo: true, simulated: true },
    platforms: post.platforms.map(row => row.platform), createdAt: now() });
  activity.splice(100);
}

function usage() {
  return {
    plan: "enterprise", accounts: { used: accounts.filter(item => item.isActive).length, limit: null },
    postsThisMonth: { used: posts.filter(item => item.createdAt.slice(0, 7) === today.slice(0, 7)).length, limit: null },
    templates: { used: templates.filter(item => !item.isSystem).length, limit: null },
    aiTextThisMonth: { used: textGenerations, limit: null }, aiImagesThisMonth: { used: imageGenerations, limit: null },
    aiVideosThisMonth: { used: 0, limit: null }, approvalWorkflow: true, brandVoice: true,
  } satisfies SocialDashboardStats["usage"] & Record<string, unknown>;
}

function stats(): SocialDashboardStats {
  const rows = posts.flatMap(post => post.platforms).filter(row => row.status === "published");
  return {
    connectedAccounts: accounts.filter(item => item.isActive).length,
    expiredAccounts: accounts.filter(item => item.tokenStatus === "expired" || item.tokenStatus === "disconnected").length,
    postsThisWeek: posts.filter(item => item.createdAt.slice(0, 10) >= dateAt(-6)).length,
    totalReach: rows.reduce((sum, row) => sum + row.reach, 0),
    avgEngagementRate: rows.length ? rows.reduce((sum, row) => sum + row.engagementRate, 0) / rows.length : 0,
    usage: usage(), accounts: accounts.filter(item => item.isActive).map(({ id, platform, accountName, followerCount, tokenStatus, isDefault }) => ({ id, platform, accountName, followerCount, tokenStatus, isDefault })),
  };
}

function calendarPost(post: SocialPost): CalendarPost {
  return { id: post.id, title: post.title, status: post.status, scheduledAt: post.scheduledAt, publishedAt: post.publishedAt,
    platforms: post.platforms.map(row => row.platform), captionPreview: (post.platforms[0]?.caption || "").slice(0, 160), imageUrl: post.imageUrl };
}

function publish(post: SocialPost): void {
  if (post.format === "thread") fail("threads are copy-only in this demo and cannot be published or scheduled.");
  if (!post.platforms.length || post.platforms.some(row => !row.caption.trim())) fail("add demo platform copy before publishing or scheduling.");
  if (post.platforms.some(row => !accounts.some(account => account.id === row.socialAccountId && account.isActive && account.tokenStatus !== "expired" && account.tokenStatus !== "disconnected"))) fail("a selected demo account is disconnected; OAuth/reconnect is disabled.");
  if (settings.approvalRequired && post.approvalStatus !== "approved") fail("approve this demo post before publishing or scheduling.");
}

function publishLocally(post: SocialPost, failedOnly = false): void {
  publish(post);
  post.status = "published";
  post.publishedAt = now();
  post.scheduledAt = null;
  post.platforms.forEach(row => {
    if (failedOnly && row.status !== "failed") return;
    if (failedOnly) row.retryCount++;
    row.status = "published";
    row.publishedAt = post.publishedAt;
    row.platformPostId = id("simulated-publish");
    row.errorCode = null;
    row.errorMessage = null;
    row.nextRetryAt = null;
  });
  post.updatedAt = now();
  log("published", post);
}

function generated(body: Record<string, unknown>): GeneratedContent | GeneratedSlide | GeneratedTweet {
  const topic = text(body.topic, "a practical weekly content routine").slice(0, 500);
  const format = text(body.format, "single");
  if (["video", "reel", "story"].includes(format)) fail("video and story generation are unsupported in the offline demo.");
  if (!["single", "carousel", "thread", "poll", "carousel_slide", "thread_tweet"].includes(format)) fail("unsupported demo text format.");
  const selected = selectedPlatforms(body.platforms);
  const caption = `Demo example: ${topic.slice(0, 150)}. Start with one clear goal, share a useful lesson, and ask your audience what they would try next.`;
  const hashtags = body.includeHashtags === false ? [] : ["Demo", "PracticalIdeas"];
  const slide = (index: number): GeneratedSlide => ({ id: id("slide"), headline: `Demo ${index + 1}: ${["Start with a clear goal", "Make it practical", "Invite a conversation"][index % 3]}`,
    body: `Demo example about ${topic.slice(0, 120)}: ${["Choose one problem your audience cares about.", "Share a small step they can try this week.", "Ask a specific question and listen to the answers."][index % 3]}`,
    imagePrompt: "Demo sample editorial visual; no provider invoked.", imageUrl: null });
  textGenerations++;
  if (format === "carousel_slide") return slide(0);
  if (format === "thread_tweet") return { text: caption.slice(0, 270), characterCount: Math.min(caption.length, 270) };
  const result: GeneratedContent = { format, prompt: topic, platforms: {} };
  for (const channel of selected) {
    const value = channel === "x" ? caption.slice(0, 240) : caption;
    result.platforms[channel] = { caption: value, hashtags, firstComment: body.includeComment ? "Demo discussion: what has worked for your team?" : "", characterCount: value.length };
  }
  if (format !== "single") Object.assign(result, { caption, hashtags });
  if (format === "carousel") result.slides = Array.from({ length: positive(body.slideCount, 3, 8, 2) }, (_, index) => slide(index));
  if (format === "thread") result.tweets = [caption.slice(0, 240), "Demo example: use one useful idea per post. Keep the language clear and the next step small.", "Demo example: review what people ask, then turn those questions into next week's content."].map(value => ({ text: value, characterCount: value.length }));
  if (format === "poll") Object.assign(result, { pollQuestion: "Demo: what would help your content routine most?", pollOptions: ["Clearer goals", "Useful examples", "Time to plan", "Better feedback"] });
  return result;
}

function dimensions(format: CreativeFormat, channel?: SocialPlatform): [number, number] {
  if (format === "story") return [1080, 1920];
  if (format === "banner") return channel === "linkedin" ? [1200, 627] : channel === "facebook" ? [1200, 630] : channel === "x" ? [1600, 900] : [1200, 628];
  if (format === "carousel") return channel === "linkedin" ? [1080, 1080] : [1080, 1350];
  if (format === "product" || format === "post") return channel === "linkedin" ? [1200, 1200] : channel === "x" ? [1600, 900] : channel === "instagram" || channel === "facebook" ? [1080, 1350] : [1080, 1080];
  return [1080, 1080];
}

function creativeFormat(value: unknown): CreativeFormat {
  const result = text(value, "post");
  if (!["post", "banner", "story", "carousel", "quote", "product"].includes(result)) fail("unsupported demo visual format.");
  return result as CreativeFormat;
}

function placeholder(width: number, height: number): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1080 1080"><rect width="1080" height="1080" fill="#fff7ed"/><circle cx="820" cy="240" r="210" fill="#fed7aa"/><path d="M140 690 360 370 570 690Z" fill="#c2410c"/><path d="m450 690 180-260 180 260Z" fill="#fb923c"/><text x="100" y="830" font-family="sans-serif" font-size="64" font-weight="700" fill="#431407">DEMO SAMPLE VISUAL</text><text x="100" y="910" font-family="sans-serif" font-size="32" fill="#7c2d12">Offline placeholder - no AI provider used</text></svg>`)}`;
}

function newVisual(body: Record<string, unknown>, channel?: SocialPlatform): GenerateImageResult {
  if (body.mode === "edit" || body.sourceImageUrl) fail("image editing is unsupported; demo visuals are labelled placeholders only.");
  const format = creativeFormat(body.format);
  let [width, height] = dimensions(format, channel);
  if (!body.format && typeof body.size === "string" && /^\d+x\d+$/.test(body.size)) {
    const size = body.size.split("x").map(Number);
    width = positive(size[0], 1080, 4096);
    height = positive(size[1], 1080, 4096);
  }
  const url = placeholder(width, height);
  const asset: MediaAsset = { id: id("media"), mediaType: "image", source: "ai_generated", url, mimeType: "image/svg+xml",
    fileSizeBytes: decodeURIComponent(url.split(",")[1]).length, prompt: `Demo placeholder: ${text(body.topic, "sample editorial visual")}. No provider used.`, createdAt: now() };
  media.unshift(asset);
  imageGenerations++;
  return { imageUrl: url, source: "ai_generated", assetId: asset.id, width, height, format,
    headline: "DEMO SAMPLE VISUAL", subtext: "Offline placeholder; not AI generated", cta: null, logoApplied: false };
}

function creativeSet(body: Record<string, unknown>): GenerateCreativeSetResult {
  const requestId = text(body.requestId);
  if (!requestId) fail("a requestId is required for a demo creative set.");
  const selected = selectedPlatforms(body.platforms);
  if (body.slides !== undefined && !Array.isArray(body.slides)) fail("invalid demo slides.");
  const slides = Array.isArray(body.slides) && body.slides.length ? body.slides.map(item => record(item)) : [{ id: "single" }];
  if (slides.length > 8) fail("demo creative sets support at most eight slides.");
  const slideIds = slides.map(slide => text(slide.id));
  if (slideIds.some(value => !value) || new Set(slideIds).size !== slideIds.length) fail("demo slide IDs must be present and unique.");
  const signature = JSON.stringify(body);
  const cached = creativeSets.get(requestId);
  if (cached) {
    if (cached.signature !== signature) fail("this demo requestId already belongs to different content; use a new requestId.");
    return cached.result;
  }
  creativeFormat(body.format);
  const result: GenerateCreativeSetResult = { creativeSetId: id("creative-set"), status: "completed", items: [], errors: [],
    warnings: ["Demo only: SVG placeholder exports, no AI generation, logo compositing, upload, or provider calls."] };
  for (const slide of slides) {
    for (const channel of selected) {
      const visual = newVisual(body, channel);
      result.items.push({ slideId: String(slide.id), platform: channel, imageUrl: visual.imageUrl,
        assetId: required(visual.assetId || undefined), blobKey: `mock-ui/${visual.assetId}.svg`,
        width: required(visual.width || undefined), height: required(visual.height || undefined), mimeType: "image/svg+xml" });
    }
  }
  creativeSets.set(requestId, { signature, result });
  return result;
}

function plan(body: Record<string, unknown>): { jobId: string } {
  const days = positive(body.days, 7, 30);
  if (![1, 7, 15, 30].includes(days)) fail("demo content plans support 1, 7, 15, or 30 days.");
  if (!text(body.prompt, text(body.theme))) fail("enter a brief for the demo content plan.");
  const selected = selectedPlatforms(body.platforms, accounts.filter(item => item.isActive).map(item => item.platform));
  if (selected.some(channel => channel === "x" || !accounts.some(item => item.platform === channel && item.isActive))) fail("content plans require a connected demo LinkedIn, Facebook, or Instagram account.");
  const start = body.targetDate ? date(body.targetDate) : dateAt(positive(body.startDayOffset, 0, 365, 0));
  const result: ContentPlanGenerateResponse = { days, timezone: settings.timezone, autoScheduled: false,
    scheduledCount: 0, draftCount: 0, skippedCount: 0, items: [], calendarItems: [], errors: [],
    message: "Demo plan completed locally. Text-only drafts; no AI, images, automatic publishing, or scheduling." };
  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    const day = dateAt(dayIndex, start);
    for (const channel of selected) {
      if (body.skipFilledDays !== false && posts.some(post => post.scheduledAt?.slice(0, 10) === day && post.platforms.some(row => row.platform === channel))) {
        result.skippedCount = (result.skippedCount || 0) + 1;
        continue;
      }
      const topic = `${text(body.prompt, text(body.theme)).slice(0, 120)} — ${topics[dayIndex % topics.length]}`;
      const caption = `Demo example: ${topic}. Share one practical step your audience can try, and invite their perspective.`;
      const post = makePost({ title: `Demo day ${dayIndex + 1}: ${topics[dayIndex % topics.length]}`, scheduledAt: `${day}T09:00:00.000Z`,
        aiPrompt: topic, platforms: [{ platform: channel, caption, hashtags: ["Demo", "PracticalIdeas"] }] });
      posts.unshift(post);
      textGenerations++;
      const item: ContentPlanDay = { dayIndex: dayIndex + 1, date: day, weekday: new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
        scheduledAt: post.scheduledAt, platform: channel, topic, title: post.title, caption, hashtags: ["Demo", "PracticalIdeas"], imageUrl: null, postId: post.id, status: "draft" };
      result.items.push(item);
      result.calendarItems.push(calendarPost(post));
      result.draftCount++;
      log("generated", post);
    }
  }
  const jobId = id("content-plan-job");
  jobs.set(jobId, { jobId, status: "completed", progress: { current: result.items.length, total: result.items.length, message: result.message }, result, error: null });
  return { jobId };
}

function analytics(params: Record<string, string>) {
  const fromDate = date(params.from || dateAt(-29));
  const toDate = date(params.to || today);
  const count = Math.round((Date.parse(toDate) - Date.parse(fromDate)) / 86400000) + 1;
  if (count < 1 || count > 366) fail("demo analytics ranges must be ordered and at most 366 days.");
  const dates = Array.from({ length: count }, (_, index) => dateAt(index, fromDate));
  const items: PostPerformanceItem[] = posts.flatMap(post => post.platforms.filter(row => row.status === "published" && row.publishedAt && row.publishedAt.slice(0, 10) >= fromDate && row.publishedAt.slice(0, 10) <= toDate).map(row => ({
    postId: post.id, platformRowId: row.id, caption: row.caption, platform: row.platform, publishedAt: row.publishedAt,
    reach: row.reach, impressions: row.impressions, likes: row.likes, comments: row.comments, shares: row.shares,
    clicks: row.clicks, engagementRate: row.engagementRate, engagements: row.likes + row.comments + row.shares + row.clicks, imageUrl: post.imageUrl,
  })));
  const sum = (rows: PostPerformanceItem[], key: "reach" | "impressions" | "engagements" | "clicks") => rows.reduce((total, item) => total + item[key], 0);
  const followers = (channel: SocialPlatform) => accounts.filter(item => item.platform === channel && item.isActive).reduce((total, item) => total + item.followerCount, 0);
  const newFollowers = (day: string, channel: SocialPlatform) => day >= dateAt(-29) && day <= today && followers(channel) ? 2 + channels.indexOf(channel) : 0;
  const comparison = channels.map(channel => {
    const rows = items.filter(item => item.platform === channel);
    const impressions = sum(rows, "impressions");
    return { platform: channel, posts: rows.length, reach: sum(rows, "reach"), impressions,
      engagementRate: impressions ? sum(rows, "engagements") / impressions * 100 : 0,
      topPost: [...rows].sort((a, b) => b.engagements - a.engagements)[0]?.postId || null };
  });
  const overview: AnalyticsOverview = { fromDate, toDate, metrics: {
    totalPosts: new Set(items.map(item => item.postId)).size, totalReach: sum(items, "reach"), totalImpressions: sum(items, "impressions"),
    totalEngagements: sum(items, "engagements"), avgEngagementRate: sum(items, "impressions") ? sum(items, "engagements") / sum(items, "impressions") * 100 : 0,
    followerGrowth: dates.reduce((total, day) => total + channels.reduce((n, channel) => n + newFollowers(day, channel), 0), 0), totalClicks: sum(items, "clicks"),
  }, engagementSeries: dates.map(day => Object.assign({ date: day }, Object.fromEntries(channels.map(channel => [channel, sum(items.filter(item => item.platform === channel && item.publishedAt?.slice(0, 10) === day), "engagements")])))),
  reachByPlatform: comparison.map(item => ({ platform: item.platform, reach: item.reach })), platformComparison: comparison };
  const audience: AudienceGrowth = { fromDate, toDate,
    series: dates.map(day => Object.assign({ date: day }, Object.fromEntries(channels.map(channel => [channel, Math.max(0, followers(channel) - Math.max(0, Math.min(30, Math.round((Date.parse(today) - Date.parse(day)) / 86400000))) * (2 + channels.indexOf(channel)))])))),
    netNewFollowers: dates.map(day => ({ date: day, newFollowers: channels.reduce((total, channel) => total + newFollowers(day, channel), 0) })),
    platformCards: channels.map(channel => ({ platform: channel, followers: followers(channel), growth: dates.reduce((total, day) => total + newFollowers(day, channel), 0) })) };
  const platformReport = (channel: SocialPlatform): PlatformAnalytics => {
    const rows = items.filter(item => item.platform === channel);
    return { platform: channel, fromDate, toDate, metrics: { posts: rows.length, reach: sum(rows, "reach"), impressions: sum(rows, "impressions"), engagements: sum(rows, "engagements"), clicks: sum(rows, "clicks"),
      followerGrowth: dates.reduce((total, day) => total + newFollowers(day, channel), 0), latestFollowers: followers(channel) },
      series: dates.map(day => {
        const daily = rows.filter(item => item.publishedAt?.slice(0, 10) === day);
        return { date: day, impressions: sum(daily, "impressions"), reach: sum(daily, "reach"), engagement: sum(daily, "engagements"), clicks: sum(daily, "clicks"),
          followers: Number(audience.series.find(item => item.date === day)?.[channel] || 0), newFollowers: newFollowers(day, channel) };
      }), postTypes: ["single", "carousel", "thread", "poll"].map(type => ({ type, count: rows.filter(row => posts.find(post => post.id === row.postId)?.format === type).length })).filter(item => item.count > 0) };
  };
  const sortKey = ["reach", "impressions", "engagementRate", "engagements", "clicks", "likes", "comments", "shares", "publishedAt"].includes(params.sort) ? params.sort as keyof PostPerformanceItem : "engagements";
  items.sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    const order = typeof left === "number" && typeof right === "number" ? left - right : String(left || "").localeCompare(String(right || ""));
    return order * (params.order === "asc" ? 1 : -1);
  });
  return { overview, audience, platformReport, performance: { fromDate, toDate, items } };
}

function templateInput(body: Record<string, unknown>, current?: SocialTemplate): SocialTemplate {
  const base: SocialTemplate = current || { id: id("template"), orgId: workspace, name: "Demo custom template", category: "Education", platforms: ["linkedin"],
    captionTemplate: "Demo example: {{topic}}", hashtags: ["Demo"], isSystem: false, systemKey: null, createdBy: actor, createdAt: now(),
    description: "Demo custom template", goal: "Build trust", placeholders: [], imagePrompt: "", generateImage: false,
    suggestedTone: "Professional", suggestedCta: "", firstCommentTemplate: "", sortOrder: 0 };
  const next = mergeKnown(base, body, ["id", "orgId", "isSystem", "systemKey", "createdBy", "createdAt"]);
  if (body.platforms !== undefined) next.platforms = selectedPlatforms(body.platforms);
  if (body.hashtags !== undefined) next.hashtags = strings(body.hashtags);
  if (!next.name.trim() || !next.captionTemplate.trim()) fail("a demo template needs a name and caption.");
  return next;
}

function handle(path: string, method: string, params: Record<string, string>, body: Record<string, unknown>): unknown | undefined {
  const prefix = `/api/v1/workspaces/${workspace}/social/`;
  if (!path.startsWith(prefix)) return undefined;
  const route = path.slice(prefix.length).replace(/\/$/, "");
  const verb = method.toUpperCase();
  if (["upload-image", "upload-logo", "upload-video", "generate-video"].includes(route) && verb === "POST") fail("uploads and video generation are disabled in the offline demo. No file was stored and no provider was called; use the sample media library.");
  if (/^oauth\/(facebook|instagram|linkedin|x)\/url$/.test(route) && verb === "GET") fail("OAuth connections are disabled in the offline demo. No external account will be connected.");
  if (route === "usage" && verb === "GET") return usage();
  if (route === "dashboard/stats" && verb === "GET") return stats();
  if (route === "dashboard/home" && verb === "GET") return { stats: stats(), activity: activity.slice(0, 10), recommendations,
    scheduledPosts: posts.filter(item => item.status === "scheduled").sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt))).slice(0, 4) };
  if (route === "activity" && verb === "GET") return activity.slice(0, positive(params.limit, 10, 100));
  if (route === "recommendations" && verb === "GET") return recommendations;
  if (route === "accounts" && verb === "GET") return { items: accounts.filter(item => !params.platform || item.platform === params.platform) };
  const accountMatch = /^accounts\/([^/]+)(?:\/(sync|reconnect))?$/.exec(route);
  if (accountMatch && ((!accountMatch[2] && ["GET", "PATCH", "DELETE"].includes(verb)) || (accountMatch[2] && verb === "POST"))) {
    const account = required(accounts.find(item => item.id === accountMatch[1]));
    if (accountMatch[2] === "reconnect") fail("reconnect/OAuth is disabled in the offline demo. No external account will be accessed.");
    if (verb === "DELETE") {
      accounts.splice(accounts.indexOf(account), 1);
      return { ok: true };
    }
    if (verb === "PATCH") {
      const next = mergeKnown(account, body, Object.keys(account).filter(key => !["accountName", "isDefault", "isActive"].includes(key)));
      if (next.isDefault) accounts.filter(item => item.platform === next.platform && item.id !== next.id).forEach(item => { item.isDefault = false; });
      if (!next.isActive) next.tokenStatus = "disconnected";
      if (next.isActive && !account.isActive) fail("reconnecting a demo account is disabled; refresh to reset fixtures.");
      Object.assign(account, next, { updatedAt: now() });
    }
    if (accountMatch[2] === "sync") {
      if (!account.isActive) fail("the demo account is disconnected; refresh to reset fixtures.");
      account.lastSyncedAt = now();
      account.updatedAt = now();
    }
    return account;
  }
  if (route === "posts" && verb === "GET") {
    const result: SocialPostListResponse = page(posts.filter(item => (!params.status || item.status === params.status) && (!params.platform || item.platforms.some(row => row.platform === params.platform)) && matches(params.search, item.title, ...item.platforms.map(row => row.caption)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), params);
    return result;
  }
  if (route === "posts" && verb === "POST") {
    const post = makePost(body);
    if (post.status !== "draft") fail("create a demo draft first, then use the local scheduling or publishing actions.");
    posts.unshift(post);
    log("created", post);
    return post;
  }
  if (route === "posts/bulk-retry" && verb === "POST") {
    const targets = [...new Set(strings(body.postIds))].map(value => required(posts.find(item => item.id === value)));
    const failed = targets.filter(item => ["failed", "published"].includes(item.status) && item.platforms.some(row => row.status === "failed"));
    failed.forEach(publish);
    const items = failed.map(post => ({ post, retriedPlatforms: post.platforms.filter(row => row.status === "failed").length, skippedPlatforms: 0 }));
    failed.forEach(post => publishLocally(post, true));
    return { items, totalRetried: items.reduce((total, item) => total + item.retriedPlatforms, 0) };
  }
  const postMatch = /^posts\/([^/]+)(?:\/([^/]+))?$/.exec(route);
  const actions = ["duplicate", "schedule", "publish-now", "cancel-schedule", "archive", "retry", "submit-approval", "approve", "reject", "request-changes", "regenerate-content"];
  if (postMatch && ((!postMatch[2] && ["GET", "PATCH", "DELETE"].includes(verb)) || (actions.includes(postMatch[2]) && verb === "POST"))) {
    const post = required(posts.find(item => item.id === postMatch[1]));
    const action = postMatch[2];
    if (verb === "GET") return post;
    if (verb === "DELETE") {
      posts.splice(posts.indexOf(post), 1);
      log("deleted", post);
      return { ok: true };
    }
    if (verb === "PATCH") {
      const data = postPayload(body);
      if (data.status && data.status !== post.status && data.status !== "draft") fail("use the demo post action to change publishing status.");
      Object.assign(post, data, { platforms: data.platforms ? data.platforms.map(item => makePlatform(item as unknown as Record<string, unknown>)) : post.platforms });
      if (post.approvalStatus === "approved") { post.approvalStatus = "not_required"; post.approvedBy = null; }
    } else if (action === "duplicate") {
      const duplicate = makePost({ ...copy(post), title: `${post.title} (demo copy)`, status: "draft", scheduledAt: null });
      posts.unshift(duplicate);
      log("duplicated", duplicate);
      return duplicate;
    } else if (action === "publish-now") publishLocally(post);
    else if (action === "schedule") {
      publish(post);
      const scheduledAt = timestamp(body.scheduledAt);
      if (Date.parse(scheduledAt) <= Date.now()) fail("choose a future demo schedule time.");
      post.status = "scheduled";
      post.scheduledAt = scheduledAt;
      post.publishedAt = null;
      post.platforms.forEach(row => { row.status = "pending"; row.errorCode = null; row.errorMessage = null; row.publishedAt = null; row.platformPostId = null; });
    } else if (action === "cancel-schedule") {
      post.status = "draft";
      post.scheduledAt = null;
    } else if (action === "archive") post.status = "archived";
    else if (action === "submit-approval") { post.status = "pending_approval"; post.approvalStatus = "pending"; post.approvedBy = null; }
    else if (action === "approve") { post.status = "draft"; post.approvalStatus = "approved"; post.approvedBy = actor; }
    else if (action === "reject" || action === "request-changes") { post.status = "draft"; post.approvalStatus = action === "reject" ? "rejected" : "changes_requested"; post.approvedBy = null; }
    else if (action === "retry") {
      const retriedPlatforms = post.platforms.filter(row => row.status === "failed").length;
      if (!["failed", "published"].includes(post.status) || !retriedPlatforms) fail("there are no failed demo platforms to retry.");
      publishLocally(post, true);
      return { post, retriedPlatforms, skippedPlatforms: 0 };
    } else if (action === "regenerate-content") {
      if (body.regenerateCaption !== false) {
        const generatedContent = generated({ topic: text(body.prompt, post.title), platforms: post.platforms.map(row => row.platform), format: "single" }) as GeneratedContent;
        post.platforms.forEach(row => { const content = generatedContent.platforms[row.platform]; if (content) Object.assign(row, content); });
      }
      if (body.regenerateImage !== false) { const visual = newVisual({ topic: post.title }); post.imageUrl = visual.imageUrl; post.imageSource = "ai_generated"; }
      post.approvalStatus = "not_required";
      post.approvedBy = null;
    }
    post.updatedAt = now();
    if (action !== "publish-now") log(action || "updated", post);
    return post;
  }
  if (route === "calendar" && verb === "GET") {
    const month = params.month || today.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) fail("enter a valid YYYY-MM demo calendar month.");
    date(`${month}-01`);
    const result: CalendarResponse = { month, items: posts.filter(item => item.scheduledAt?.slice(0, 7) === month).sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt))).map(calendarPost) };
    return result;
  }
  if (route === "content-plan/generate" && verb === "POST") return plan(body);
  const jobMatch = /^content-plan\/jobs\/([^/]+)(\/cancel)?$/.exec(route);
  if (jobMatch && ((!jobMatch[2] && verb === "GET") || (jobMatch[2] && verb === "POST"))) {
    const job = required(jobs.get(jobMatch[1]));
    return jobMatch[2] ? { jobId: job.jobId, cancelled: false } : job;
  }
  const visualMatch = /^content-plan\/posts\/([^/]+)\/approve-visual$/.exec(route);
  if (visualMatch && verb === "POST") {
    const post = required(posts.find(item => item.id === visualMatch[1]));
    if (post.status !== "draft") fail("only a demo draft can approve a sample visual.");
    if (text(body.caption) !== post.platforms[0]?.caption) fail("demo copy changed; approve the latest caption before requesting a visual.");
    if (!post.imageUrl) {
      const visual = newVisual({ topic: post.title }, post.platforms[0]?.platform);
      post.imageUrl = visual.imageUrl;
      post.imageSource = "ai_generated";
      post.platforms.forEach(row => { row.media = [{ url: visual.imageUrl, assetId: visual.assetId, width: visual.width, height: visual.height, mimeType: "image/svg+xml", slideId: "single" }]; });
    }
    post.updatedAt = now();
    return post;
  }
  if (verb === "GET" && ["analytics/overview", "analytics/posts", "analytics/audience", ...channels.map(channel => `analytics/platform/${channel}`)].includes(route)) {
    const reports = analytics(params);
    if (route === "analytics/overview") return reports.overview;
    if (route === "analytics/posts") return reports.performance;
    if (route === "analytics/audience") return reports.audience;
    return reports.platformReport(platform(route.split("/")[2]));
  }
  if (route === "brand-voice" && verb === "GET") return brand;
  if (route === "brand-voice" && verb === "PUT") {
    const next = mergeKnown(brand, body, ["id", "orgId", "updatedAt"]);
    for (const key of ["tones", "wordsToUse", "wordsToAvoid", "ctaPhrases"] as const) next[key] = strings(next[key]);
    if (!["short", "medium", "long"].includes(next.sentenceLength) || !["never", "sometimes", "often"].includes(next.emojiUsage)) fail("invalid demo brand writing preferences.");
    brand = { ...next, updatedAt: now() };
    return brand;
  }
  if (route === "brand-voice/test" && verb === "POST") {
    textGenerations++;
    const result: BrandVoiceTestResult = { platform: "linkedin", caption: `Demo example from ${text(body.brandName, brand.brandName)}: one clear idea, one practical step, and a conversation worth having. No AI provider was used.`, hashtags: ["Demo", "PracticalIdeas"], firstComment: "Demo question: what would you try first?" };
    return result;
  }
  if (route === "brand-logos" && verb === "GET") return { items: logos };
  const logoMatch = /^brand-logos\/([^/]+)(\/default)?$/.exec(route);
  if (logoMatch && ((!logoMatch[2] && verb === "DELETE") || (logoMatch[2] && verb === "POST"))) {
    const logoId = decodeURIComponent(logoMatch[1]);
    const logo = required(logos.find(item => item.id === logoId));
    if (verb === "DELETE") {
      logos = logos.filter(item => item.id !== logo.id);
      if (logo.isDefault && logos[0]) logos[0].isDefault = true;
    } else logos.forEach(item => { item.isDefault = item.id === logo.id; });
    brand.logoUrl = logos.find(item => item.isDefault)?.url || null;
    brand.updatedAt = now();
    return { items: logos };
  }
  if (route === "ai-models" && verb === "GET") {
    const result: AIModelCatalog = { textModels: [], imageModels: [], defaultTextModelId: null, defaultImageModelId: "demo-offline",
      discovery: [], cacheTtlSeconds: 0, invokeAccessVerified: false, message: "Demo mode: no AI models or providers are contacted. Text is canned sample copy; visuals are SVG placeholders." };
    return result;
  }
  if (route === "generate" && verb === "POST") return generated(body);
  if (route === "generate-image" && verb === "POST") return newVisual(body, body.platform ? platform(body.platform) : undefined);
  if (route === "generate-creative-set" && verb === "POST") return creativeSet(body);
  if (route === "media-assets" && verb === "GET") {
    const filtered = media.filter(item => (!params.mediaType || item.mediaType === params.mediaType) && (!params.source || item.source === params.source) && matches(params.search, item.prompt, item.id));
    const result: MediaAssetListResponse = { ...page(filtered, params), stats: { images: media.filter(item => item.mediaType === "image").length,
      videos: media.filter(item => item.mediaType === "video").length, totalBytes: media.reduce((total, item) => total + item.fileSizeBytes, 0) } };
    return result;
  }
  const mediaMatch = /^media-assets\/([^/]+)$/.exec(route);
  if (mediaMatch && ["GET", "DELETE"].includes(verb)) {
    const asset = required(media.find(item => item.id === mediaMatch[1]));
    if (verb === "GET") return asset;
    media.splice(media.indexOf(asset), 1);
    return { ok: true };
  }
  if (route === "settings" && verb === "GET") return { ...settings, usage: usage() };
  if (route === "settings" && verb === "PUT") {
    const next = mergeKnown(settings, body, ["id", "orgId", "usage"]);
    try { new Intl.DateTimeFormat("en-US", { timeZone: next.timezone }).format(); } catch { fail("invalid demo timezone."); }
    for (const key of ["hashtagCount", "queueGapMinutes", "approvalSlaHours"] as const) positive(next[key], settings[key], 10080, 0);
    next.approverUserIds = strings(next.approverUserIds);
    next.blackoutDates = strings(next.blackoutDates).map(date);
    for (const key of ["enabledPlatforms", "notificationEvents"] as const) if (!Object.values(record(next[key])).every(value => typeof value === "boolean")) fail(`invalid demo ${key}.`);
    if (!Object.values(record(next.defaultPostingTimes)).every(value => strings(value).every(time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)))) fail("invalid demo posting times.");
    settings = next;
    return { ...settings, usage: usage() };
  }
  if (route === "team-permissions" && verb === "GET") return team;
  const teamMatch = /^team-permissions\/([^/]+)$/.exec(route);
  if (teamMatch && verb === "PUT") {
    const member = required(team.find(item => item.userId === teamMatch[1]));
    const permission = text(body.permission);
    if (!["viewer", "editor", "publisher", "admin"].includes(permission)) fail("invalid demo permission.");
    if (member.userId === actor && permission !== "admin") fail("the demo workspace owner must remain an admin.");
    member.permission = permission;
    return member;
  }
  if (route === "templates" && verb === "GET") return templates.filter(item => (!params.category || item.category === params.category) && (!params.platform || item.platforms.includes(params.platform as SocialPlatform)) && matches(params.search, item.name, item.captionTemplate));
  if (route === "templates" && verb === "POST") {
    const template = templateInput(body);
    templates.unshift(template);
    return template;
  }
  const templateMatch = /^templates\/([^/]+)(\/apply)?$/.exec(route);
  if (templateMatch && ((!templateMatch[2] && ["GET", "PUT", "DELETE"].includes(verb)) || (templateMatch[2] && verb === "POST"))) {
    const template = required(templates.find(item => item.id === templateMatch[1]));
    if (templateMatch[2]) {
      const values = body.values === undefined ? {} : record(body.values);
      if (!Object.values(values).every(value => typeof value === "string")) fail("demo placeholder values must be strings.");
      const placeholderValues = values as Record<string, string>;
      const fill = (value: string) => value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key: string) => placeholderValues[key] || template.placeholders?.find(item => item.key === key)?.example || key);
      const result: ApplyTemplateResult = { templateId: template.id, name: template.name, category: template.category,
        goal: template.goal || "", platforms: template.platforms, topic: fill(template.captionTemplate), captionTemplate: fill(template.captionTemplate),
        hashtags: template.hashtags, firstComment: fill(template.firstCommentTemplate || ""), suggestedTone: template.suggestedTone || "Professional",
        suggestedCta: template.suggestedCta || "", generateImage: template.generateImage || false, imagePrompt: fill(template.imagePrompt || ""), placeholderValues };
      return result;
    }
    if (verb === "GET") return template;
    if (template.isSystem) fail("demo system templates are read-only; create a custom template instead.");
    if (verb === "DELETE") { templates.splice(templates.indexOf(template), 1); return { ok: true }; }
    Object.assign(template, templateInput(body, template));
    return template;
  }
  return undefined;
}

export function handleSocialMock(path: string, method: string, params: Record<string, string>, body: Record<string, unknown>): unknown | undefined {
  const result = handle(path, method, params, copy(body));
  return result === undefined ? undefined : copy(result);
}