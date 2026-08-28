export type SocialPlatform = "facebook" | "instagram" | "linkedin" | "x";

export type PostFormat = "single" | "carousel" | "reel" | "thread" | "story" | "poll";

export type MediaType = "none" | "image" | "video" | "animated";

export type CarouselSlideLayout = "bold" | "overlay" | "split" | "minimal" | "stat";

export type CarouselSlideStyle = {
  layout: CarouselSlideLayout;
  bgColor: string;
  bgColor2: string;       // second gradient stop
  textColor: string;
  accentColor: string;
};

export const DEFAULT_SLIDE_STYLE: CarouselSlideStyle = {
  layout: "bold",
  bgColor: "#0A66C2",
  bgColor2: "#004182",
  textColor: "#ffffff",
  accentColor: "#FFD166",
};

export type CarouselSlide = {
  id: string;
  headline: string;
  body: string;
  imageUrl?: string | null;
  style?: CarouselSlideStyle;
};

export type ThreadTweet = {
  id: string;
  text: string;
  characterCount: number;
};

export type PollOption = {
  id: string;
  text: string;
};

export type SocialAccountType = "page" | "profile" | "group";

export type SocialTokenStatus = "active" | "expires_soon" | "expired" | "disconnected";

export type SocialPostStatus =
  | "draft"
  | "pending_approval"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "archived";

export type SocialApprovalStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested";

export type SocialImageSource = "uploaded" | "ai_generated" | "none";

export type SocialPlatformPostStatus =
  | "pending"
  | "publishing"
  | "published"
  | "failed"
  | "skipped";

export type SocialAccount = {
  id: string;
  orgId: string;
  platform: SocialPlatform;
  accountType: SocialAccountType;
  platformAccountId: string;
  accountName: string;
  accountPictureUrl: string | null;
  followerCount: number;
  tokenExpiresAt: string | null;
  tokenStatus: SocialTokenStatus;
  isDefault: boolean;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialAccountListResponse = {
  items: SocialAccount[];
};

export type SocialPostPlatform = {
  id: string;
  platform: SocialPlatform;
  socialAccountId: string | null;
  caption: string;
  hashtags: string[];
  firstComment: string | null;
  characterCount: number;
  status: SocialPlatformPostStatus;
  platformPostId: string | null;
  publishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagementRate: number;
};

export type SocialPost = {
  id: string;
  orgId: string;
  createdBy: string;
  title: string;
  status: SocialPostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  approvalStatus: SocialApprovalStatus;
  approvedBy: string | null;
  templateId: string | null;
  aiPrompt: string | null;
  imageUrl: string | null;
  imageSource: SocialImageSource;
  platforms: SocialPostPlatform[];
  createdAt: string;
  updatedAt: string;
};

export type SocialPostListResponse = {
  items: SocialPost[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreateSocialPostPayload = {
  title?: string;
  status?: SocialPostStatus;
  scheduledAt?: string | null;
  imageUrl?: string | null;
  imageSource?: SocialImageSource;
  aiPrompt?: string | null;
  templateId?: string | null;
  platforms?: Array<{
    platform: SocialPlatform;
    socialAccountId?: string | null;
    caption?: string;
    hashtags?: string[];
    firstComment?: string | null;
  }>;
};

export type SentenceLength = "short" | "medium" | "long";
export type EmojiUsage = "never" | "sometimes" | "often";

export type BrandVoice = {
  id: string | null;
  orgId: string;
  brandName: string;
  industry: string;
  tagline: string;
  targetAudience: string;
  tones: string[];
  wordsToUse: string[];
  wordsToAvoid: string[];
  ctaPhrases: string[];
  sentenceLength: SentenceLength;
  emojiUsage: EmojiUsage;
  primaryLanguage: string;
  systemPromptOverride: string | null;
  logoUrl: string | null;
  updatedAt: string | null;
};

export type BrandVoicePayload = Omit<BrandVoice, "id" | "orgId" | "updatedAt">;

export type GeneratedPlatformContent = {
  caption: string;
  hashtags: string[];
  firstComment: string;
  characterCount: number;
};

export type GeneratedSlide = {
  headline: string;
  body: string;
  imagePrompt: string;
  imageUrl?: string | null;
};

export type GeneratedTweet = {
  text: string;
  characterCount: number;
};

export type GeneratedContent = {
  format: string;
  platforms: Partial<Record<SocialPlatform, GeneratedPlatformContent>>;
  prompt: string;
  // Carousel
  slides?: GeneratedSlide[];
  // Thread
  tweets?: GeneratedTweet[];
  // Poll
  pollQuestion?: string;
  pollOptions?: string[];
  // Shared non-single
  caption?: string;
  hashtags?: string[];
};

export type GeneratePostPayload = {
  topic: string;
  tone: string;
  platforms: SocialPlatform[];
  audience?: string;
  cta?: string;
  includeHashtags?: boolean;
  includeComment?: boolean;
  format?: string;
};

export type BrandVoiceTestResult = {
  platform: string;
  caption: string;
  hashtags: string[];
  firstComment: string;
};

export const PLATFORM_CHAR_LIMITS: Record<SocialPlatform, number> = {
  facebook: 2200,
  instagram: 2200,
  linkedin: 3000,
  x: 280,
};

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
};

export const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  facebook: "#1877F2",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  x: "#111111",
};

export type CalendarPost = {
  id: string;
  title: string;
  status: SocialPostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  platforms: SocialPlatform[];
  captionPreview: string;
  imageUrl: string | null;
};

export type CalendarResponse = {
  month: string;
  items: CalendarPost[];
};

export type ContentPlanGeneratePayload = {
  days: 7 | 15 | 30;
  /** User brief — what the content plan should be about */
  prompt: string;
  /** @deprecated use prompt */
  theme?: string;
  tone?: string;
  cta?: string;
  autoSchedule?: boolean;
  generateImages?: boolean;
  skipFilledDays?: boolean;
};

export type ContentPlanJobStartResponse = {
  jobId: string;
};

export type ContentPlanJobProgress = {
  current: number;
  total: number;
  message: string;
};

export type ContentPlanJobStatus = {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed" | string;
  progress?: ContentPlanJobProgress | null;
  result?: ContentPlanGenerateResponse | null;
  error?: string | null;
};

export type ContentPlanDay = {
  dayIndex: number;
  date: string;
  weekday: string;
  scheduledAt: string | null;
  platform: SocialPlatform;
  topic: string;
  title: string;
  caption: string;
  hashtags: string[];
  imageUrl: string | null;
  postId: string | null;
  status: SocialPostStatus;
};

export type ContentPlanGenerateResponse = {
  days: number;
  timezone: string;
  autoScheduled: boolean;
  scheduledCount: number;
  draftCount: number;
  skippedCount?: number;
  items: ContentPlanDay[];
  calendarItems: CalendarPost[];
  errors: string[];
  message: string;
};

export type UpdateSocialPostPayload = Partial<CreateSocialPostPayload>;

export type UpdateSocialAccountPayload = {
  accountName?: string;
  isDefault?: boolean;
  isActive?: boolean;
};

export type OAuthUrlResponse = {
  url: string;
};

export type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AnalyticsDateRange = {
  from: string;
  to: string;
};

export type AnalyticsMetrics = {
  totalPosts: number;
  totalReach: number;
  totalImpressions: number;
  totalEngagements: number;
  avgEngagementRate: number;
  followerGrowth: number;
  totalClicks: number;
};

export type PlatformComparisonRow = {
  platform: SocialPlatform;
  posts: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  topPost: string | null;
};

export type AnalyticsOverview = {
  fromDate: string;
  toDate: string;
  metrics: AnalyticsMetrics;
  engagementSeries: Array<Record<string, string | number>>;
  reachByPlatform: Array<{ platform: string; reach: number }>;
  platformComparison: PlatformComparisonRow[];
};

export type PlatformAnalytics = {
  platform: SocialPlatform;
  fromDate: string;
  toDate: string;
  metrics: {
    posts: number;
    reach: number;
    impressions: number;
    engagements: number;
    clicks: number;
    followerGrowth: number;
    latestFollowers: number;
  };
  series: Array<{
    date: string;
    impressions: number;
    reach: number;
    engagement: number;
    clicks: number;
    followers: number;
    newFollowers: number;
  }>;
  postTypes: Array<{ type: string; count: number }>;
};

export type PostPerformanceItem = {
  postId: string;
  platformRowId: string;
  caption: string;
  platform: SocialPlatform;
  publishedAt: string | null;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagementRate: number;
  engagements: number;
  imageUrl: string | null;
};

export type AudienceGrowth = {
  fromDate: string;
  toDate: string;
  series: Array<Record<string, string | number>>;
  netNewFollowers: Array<{ date: string; newFollowers: number }>;
  platformCards: Array<{ platform: SocialPlatform; followers: number; growth: number }>;
};

export type SocialTemplatePlaceholder = {
  key: string;
  label: string;
  example?: string;
  required?: boolean;
};

export type SocialTemplate = {
  id: string;
  orgId: string;
  name: string;
  category: string;
  platforms: SocialPlatform[];
  captionTemplate: string;
  hashtags: string[];
  isSystem?: boolean;
  systemKey?: string | null;
  description?: string;
  goal?: string;
  placeholders?: SocialTemplatePlaceholder[];
  imagePrompt?: string;
  generateImage?: boolean;
  suggestedTone?: string;
  suggestedCta?: string;
  firstCommentTemplate?: string;
  sortOrder?: number;
  createdBy: string | null;
  createdAt: string | null;
};

export type ApplyTemplateResult = {
  templateId: string;
  name: string;
  category: string;
  goal: string;
  platforms: SocialPlatform[];
  topic: string;
  captionTemplate: string;
  hashtags: string[];
  firstComment: string;
  suggestedTone: string;
  suggestedCta: string;
  generateImage: boolean;
  imagePrompt: string;
  placeholderValues: Record<string, string>;
};

export type SocialDashboardStats = {
  connectedAccounts: number;
  expiredAccounts: number;
  postsThisWeek: number;
  totalReach: number;
  avgEngagementRate: number;
  usage: {
    plan: string;
    accounts: { used: number; limit: number | null };
    postsThisMonth: { used: number; limit: number | null };
    templates: { used: number; limit: number | null };
    approvalWorkflow: boolean;
    brandVoice: boolean;
  };
  accounts: Array<{
    id: string;
    platform: SocialPlatform;
    accountName: string;
    followerCount: number;
    tokenStatus: SocialTokenStatus;
    isDefault: boolean;
  }>;
};

export type SocialActivityItem = {
  id: string;
  action: string;
  type?: "generated" | "published" | "connected" | "scheduled";
  text?: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
};

export type SocialSettings = {
  id: string | null;
  orgId: string;
  timezone: string;
  defaultLanguage: string;
  approvalRequired: boolean;
  approverUserIds: string[];
  approvalSlaHours: number;
  approvalSlaAction: string;
  defaultPostingTimes: Record<string, string[]>;
  queueGapMinutes: number;
  blackoutDates: string[];
  defaultTone: string;
  defaultCta: string;
  hashtagCount: number;
  autoFirstComment: boolean;
  imageGenerationStyle: string;
  openaiModel: string;
  systemPromptOverride: string | null;
  enabledPlatforms: Record<string, boolean>;
  notificationEvents: Record<string, boolean>;
  notificationDelivery: string;
  usage?: SocialDashboardStats["usage"];
};

export type VideoSize = "1280x720" | "720x1280";
export type VideoSeconds = "4" | "8" | "12";
export type StudioGenerationMode = "create" | "refine";

export type GenerateVideoRequest = {
  prompt: string;
  size?: VideoSize;
  seconds?: VideoSeconds;
  mode?: "create" | "remix";
  remixVideoId?: string | null;
};

export type GenerateVideoResponse = {
  videoUrl: string;
  source: string;
  soraVideoId?: string | null;
  assetId?: string | null;
};

export type MediaAssetType = "image" | "video";

export type MediaAsset = {
  id: string;
  mediaType: MediaAssetType;
  source: "uploaded" | "ai_generated";
  url: string;
  mimeType: string;
  fileSizeBytes: number;
  prompt?: string | null;
  soraVideoId?: string | null;
  durationSeconds?: number | null;
  postId?: string | null;
  createdAt: string;
};

export type MediaAssetListResponse = {
  items: MediaAsset[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type VideoGenerationUnavailableError = {
  error: "sora_unavailable";
  message: string;
};

export type StudioMode = "text" | "image" | "video";

export type ImageAspectRatio = "1024x1024" | "1024x1536" | "1536x1024";

export type ImageTemplateCategory =
  | "Sales"
  | "Marketing"
  | "Brand"
  | "Engagement"
  | "Education"
  | "Social Proof";

export type VideoTemplateCategory =
  | "Sales"
  | "Marketing"
  | "Brand"
  | "Engagement"
  | "Education"
  | "Social Proof";

export type ImageGenerationTemplate = {
  id: string;
  name: string;
  category: ImageTemplateCategory;
  description: string;
  thumbnailGradient: [string, string];
  icon: string;
  promptTemplate: string;
  style: string;
  aspectRatio: ImageAspectRatio;
  platforms: SocialPlatform[];
};

export type VideoGenerationTemplate = {
  id: string;
  name: string;
  category: VideoTemplateCategory;
  description: string;
  thumbnailGradient: [string, string];
  icon: string;
  promptTemplate: string;
  size: VideoSize;
  seconds: VideoSeconds;
  cameraStyle?: string;
  platforms: SocialPlatform[];
};
