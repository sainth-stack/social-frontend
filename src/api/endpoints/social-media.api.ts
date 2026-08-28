import apiClient from "@/api/client";
import type {
  AnalyticsOverview,
  ApplyTemplateResult,
  AudienceGrowth,
  BrandVoice,
  BrandVoicePayload,
  BrandVoiceTestResult,
  CalendarResponse,
  ContentPlanGeneratePayload,
  ContentPlanGenerateResponse,
  ContentPlanJobStartResponse,
  ContentPlanJobStatus,
  CreateSocialPostPayload,
  GeneratedContent,
  GeneratedSlide,
  GeneratedTweet,
  GeneratePostPayload,
  MediaAsset,
  MediaAssetListResponse,
  MediaAssetType,
  OAuthUrlResponse,
  PlatformAnalytics,
  PostPerformanceItem,
  SocialAccount,
  SocialAccountListResponse,
  SocialActivityItem,
  SocialDashboardStats,
  SocialPlatform,
  SocialPost,
  SocialPostListResponse,
  SocialPostStatus,
  SocialSettings,
  SocialTemplate,
  UpdateSocialAccountPayload,
  UpdateSocialPostPayload,
} from "@/types/social-media.types";

const base = (workspaceId: string) => `/api/v1/workspaces/${workspaceId}/social`;

/** Backend serializes workspaceId; frontend types use orgId. */
function normalizePost(post: SocialPost & { workspaceId?: string }): SocialPost {
  return {
    ...post,
    orgId: post.orgId || post.workspaceId || "",
  };
}

function normalizePostList(data: SocialPostListResponse): SocialPostListResponse {
  return {
    ...data,
    items: data.items.map((item) => normalizePost(item as SocialPost & { workspaceId?: string })),
  };
}

export const socialMediaApi = {
  // ── Accounts ───────────────────────────────────────────────────────────────

  async listAccounts(orgId: string, platform?: SocialPlatform): Promise<SocialAccount[]> {
    const { data } = await apiClient.get<SocialAccountListResponse>(`${base(orgId)}/accounts`, {
      params: platform ? { platform } : undefined,
    });
    return data.items;
  },

  async updateAccount(
    orgId: string,
    accountId: string,
    payload: UpdateSocialAccountPayload,
  ): Promise<SocialAccount> {
    const { data } = await apiClient.patch<SocialAccount>(
      `${base(orgId)}/accounts/${accountId}`,
      payload,
    );
    return data;
  },

  async deleteAccount(orgId: string, accountId: string): Promise<void> {
    await apiClient.delete(`${base(orgId)}/accounts/${accountId}`);
  },

  async syncAccount(orgId: string, accountId: string): Promise<SocialAccount> {
    const { data } = await apiClient.post<SocialAccount>(
      `${base(orgId)}/accounts/${accountId}/sync`,
    );
    return data;
  },

  async reconnectAccount(orgId: string, accountId: string): Promise<OAuthUrlResponse> {
    const { data } = await apiClient.post<OAuthUrlResponse>(
      `${base(orgId)}/accounts/${accountId}/reconnect`,
    );
    return data;
  },

  async getOAuthUrl(orgId: string, platform: SocialPlatform): Promise<OAuthUrlResponse> {
    const { data } = await apiClient.get<OAuthUrlResponse>(
      `${base(orgId)}/oauth/${platform}/url`,
    );
    return data;
  },

  // ── Posts ──────────────────────────────────────────────────────────────────

  async listPosts(
    orgId: string,
    params?: {
      status?: SocialPostStatus;
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<SocialPostListResponse> {
    const { data } = await apiClient.get<SocialPostListResponse>(`${base(orgId)}/posts`, {
      params,
    });
    return normalizePostList(data);
  },

  async getPost(orgId: string, postId: string): Promise<SocialPost> {
    const { data } = await apiClient.get<SocialPost & { workspaceId?: string }>(
      `${base(orgId)}/posts/${postId}`,
    );
    return normalizePost(data);
  },

  async createPost(orgId: string, payload: CreateSocialPostPayload): Promise<SocialPost> {
    const { data } = await apiClient.post<SocialPost & { workspaceId?: string }>(
      `${base(orgId)}/posts`,
      payload,
    );
    return normalizePost(data);
  },

  async updatePost(
    orgId: string,
    postId: string,
    payload: UpdateSocialPostPayload,
  ): Promise<SocialPost> {
    const { data } = await apiClient.patch<SocialPost & { workspaceId?: string }>(
      `${base(orgId)}/posts/${postId}`,
      payload,
    );
    return normalizePost(data);
  },

  async regeneratePostContent(
    orgId: string,
    postId: string,
    payload?: { prompt?: string; regenerateImage?: boolean },
  ): Promise<SocialPost> {
    const { data } = await apiClient.post<SocialPost & { workspaceId?: string }>(
      `${base(orgId)}/posts/${postId}/regenerate-content`,
      {
        prompt: payload?.prompt,
        regenerateImage: payload?.regenerateImage ?? true,
      },
    );
    return normalizePost(data);
  },

  async deletePost(orgId: string, postId: string): Promise<void> {
    await apiClient.delete(`${base(orgId)}/posts/${postId}`);
  },

  async duplicatePost(orgId: string, postId: string): Promise<SocialPost> {
    const { data } = await apiClient.post<SocialPost & { workspaceId?: string }>(
      `${base(orgId)}/posts/${postId}/duplicate`,
    );
    return normalizePost(data);
  },

  async schedulePost(
    orgId: string,
    postId: string,
    scheduledAt: string,
  ): Promise<SocialPost> {
    const { data } = await apiClient.post<SocialPost & { workspaceId?: string }>(
      `${base(orgId)}/posts/${postId}/schedule`,
      { scheduledAt },
    );
    return normalizePost(data);
  },

  async publishNow(orgId: string, postId: string): Promise<SocialPost> {
    const { data } = await apiClient.post<SocialPost & { workspaceId?: string }>(
      `${base(orgId)}/posts/${postId}/publish-now`,
    );
    return normalizePost(data);
  },

  async cancelSchedule(orgId: string, postId: string): Promise<SocialPost> {
    const { data } = await apiClient.post<SocialPost>(
      `${base(orgId)}/posts/${postId}/cancel-schedule`,
    );
    return data;
  },

  async archivePost(orgId: string, postId: string): Promise<SocialPost> {
    const { data } = await apiClient.post<SocialPost>(
      `${base(orgId)}/posts/${postId}/archive`,
    );
    return data;
  },

  async retryPost(
    orgId: string,
    postId: string,
  ): Promise<{ post: SocialPost; retriedPlatforms: number; skippedPlatforms: number }> {
    const { data } = await apiClient.post<{
      post: SocialPost;
      retriedPlatforms: number;
      skippedPlatforms: number;
    }>(`${base(orgId)}/posts/${postId}/retry`);
    return data;
  },

  async bulkRetry(
    orgId: string,
    postIds: string[],
  ): Promise<{ items: { post: SocialPost }[]; totalRetried: number }> {
    const { data } = await apiClient.post<{
      items: { post: SocialPost }[];
      totalRetried: number;
    }>(`${base(orgId)}/posts/bulk-retry`, { postIds });
    return data;
  },

  async getCalendar(orgId: string, month: string): Promise<CalendarResponse> {
    const { data } = await apiClient.get<CalendarResponse>(`${base(orgId)}/calendar`, {
      params: { month },
    });
    return data;
  },

  async startContentPlanJob(
    orgId: string,
    payload: ContentPlanGeneratePayload,
  ): Promise<ContentPlanJobStartResponse> {
    const { data } = await apiClient.post<ContentPlanJobStartResponse>(
      `${base(orgId)}/content-plan/generate`,
      payload,
    );
    return data;
  },

  async getContentPlanJob(orgId: string, jobId: string): Promise<ContentPlanJobStatus> {
    const { data } = await apiClient.get<ContentPlanJobStatus>(
      `${base(orgId)}/content-plan/jobs/${jobId}`,
    );
    return data;
  },

  /** @deprecated Use startContentPlanJob + getContentPlanJob polling */
  async generateContentPlan(
    orgId: string,
    payload: ContentPlanGeneratePayload,
  ): Promise<ContentPlanGenerateResponse> {
    const { jobId } = await socialMediaApi.startContentPlanJob(orgId, payload);
    const deadline = Date.now() + 15 * 60 * 1000;
    while (Date.now() < deadline) {
      const status = await socialMediaApi.getContentPlanJob(orgId, jobId);
      if (status.status === "completed" && status.result) return status.result;
      if (status.status === "failed") {
        throw new Error(status.error || "Content plan failed");
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("Content plan timed out — check Posts and Calendar");
  },

  // ── Analytics ──────────────────────────────────────────────────────────────

  async getAnalyticsOverview(
    orgId: string,
    params: { from?: string; to?: string },
  ): Promise<AnalyticsOverview> {
    const { data } = await apiClient.get<AnalyticsOverview>(
      `${base(orgId)}/analytics/overview`,
      { params },
    );
    return data;
  },

  async getPlatformAnalytics(
    orgId: string,
    platform: SocialPlatform,
    params: { from?: string; to?: string },
  ): Promise<PlatformAnalytics> {
    const { data } = await apiClient.get<PlatformAnalytics>(
      `${base(orgId)}/analytics/platform/${platform}`,
      { params },
    );
    return data;
  },

  async getPostPerformance(
    orgId: string,
    params: { from?: string; to?: string; sort?: string; order?: string },
  ): Promise<{ fromDate: string; toDate: string; items: PostPerformanceItem[] }> {
    const { data } = await apiClient.get<{
      fromDate: string;
      toDate: string;
      items: PostPerformanceItem[];
    }>(`${base(orgId)}/analytics/posts`, { params });
    return data;
  },

  async getAudienceGrowth(
    orgId: string,
    params: { from?: string; to?: string },
  ): Promise<AudienceGrowth> {
    const { data } = await apiClient.get<AudienceGrowth>(
      `${base(orgId)}/analytics/audience`,
      { params },
    );
    return data;
  },

  // ── Brand voice & AI ───────────────────────────────────────────────────────

  async getBrandVoice(orgId: string): Promise<BrandVoice> {
    const { data } = await apiClient.get<BrandVoice>(`${base(orgId)}/brand-voice`);
    return data;
  },

  async saveBrandVoice(orgId: string, payload: BrandVoicePayload): Promise<BrandVoice> {
    const { data } = await apiClient.put<BrandVoice>(`${base(orgId)}/brand-voice`, payload);
    return data;
  },

  async testBrandVoice(
    orgId: string,
    payload?: BrandVoicePayload,
  ): Promise<BrandVoiceTestResult> {
    const { data } = await apiClient.post<BrandVoiceTestResult>(
      `${base(orgId)}/brand-voice/test`,
      payload,
    );
    return data;
  },

  async generatePost(orgId: string, payload: GeneratePostPayload): Promise<GeneratedContent> {
    // Multi-platform AI can take >30s with reasoning models; keep UI waiting.
    const { data } = await apiClient.post<GeneratedContent>(`${base(orgId)}/generate`, payload, {
      timeout: 120_000,
    });
    return data;
  },

  async regenerateSlide(
    orgId: string,
    payload: { topic: string; tone: string; slideIndex: number; totalSlides: number; existingHeadlines: string[] },
  ): Promise<GeneratedSlide> {
    const { data } = await apiClient.post<GeneratedSlide>(
      `${base(orgId)}/generate`,
      {
        topic: `Regenerate slide ${payload.slideIndex + 1} of ${payload.totalSlides} for a carousel about: ${payload.topic}. Other slides cover: ${payload.existingHeadlines.filter((_, i) => i !== payload.slideIndex).join(", ")}. Provide only this one slide.`,
        tone: payload.tone,
        platforms: ["linkedin"],
        format: "carousel_slide",
        includeHashtags: false,
      },
      { timeout: 60_000 },
    );
    return data;
  },

  async regenerateTweet(
    orgId: string,
    payload: { topic: string; tone: string; tweetIndex: number; threadContext: string[] },
  ): Promise<GeneratedTweet> {
    const { data } = await apiClient.post<GeneratedTweet>(
      `${base(orgId)}/generate`,
      {
        topic: `Rewrite tweet ${payload.tweetIndex + 1} in this thread about: ${payload.topic}. Thread context: ${payload.threadContext.join(" / ")}`,
        tone: payload.tone,
        platforms: ["x"],
        format: "thread_tweet",
        includeHashtags: false,
      },
      { timeout: 60_000 },
    );
    return data;
  },

  async generateImage(
    orgId: string,
    payload: {
      topic: string;
      style?: string;
      size?: string;
      mode?: "create" | "edit";
      sourceImageUrl?: string | null;
    },
  ): Promise<{ imageUrl: string; source: string; assetId?: string | null }> {
    const { data } = await apiClient.post<{ imageUrl: string; source: string }>(
      `${base(orgId)}/generate-image`,
      { size: "1024x1024", mode: "create", ...payload },
      { timeout: 120_000 },
    );
    return data;
  },

  async uploadImage(
    orgId: string,
    file: File,
  ): Promise<{ imageUrl: string; source: string; assetId?: string | null }> {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<{ imageUrl: string; source: string }>(
      `${base(orgId)}/upload-image`,
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60_000,
      },
    );
    return data;
  },

  async generateVideo(
    orgId: string,
    payload: {
      prompt: string;
      size?: string;
      seconds?: string;
      referenceImageFile?: File | null;
      referenceImageUrl?: string | null;
      mode?: "create" | "remix";
      remixVideoId?: string | null;
    },
  ): Promise<{ videoUrl: string; source: string; soraVideoId?: string | null }> {
    const form = new FormData();
    form.append("prompt", payload.prompt);
    form.append("mode", payload.mode ?? "create");
    if (payload.mode === "remix" && payload.remixVideoId) {
      form.append("remix_video_id", payload.remixVideoId);
    } else {
      form.append("size", payload.size ?? "1280x720");
      form.append("seconds", payload.seconds ?? "4");
    }
    if (payload.referenceImageFile) {
      form.append("reference_image", payload.referenceImageFile);
    } else if (payload.referenceImageUrl?.trim()) {
      form.append("reference_image_url", payload.referenceImageUrl.trim());
    }
    const { data } = await apiClient.post<{ videoUrl: string; source: string; soraVideoId?: string | null; assetId?: string | null }>(
      `${base(orgId)}/generate-video`,
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 600_000,
      },
    );
    return data;
  },

  async uploadVideo(
    orgId: string,
    file: File,
  ): Promise<{ videoUrl: string; source: string; assetId?: string | null }> {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post<{ videoUrl: string; source: string; assetId?: string | null }>(
      `${base(orgId)}/upload-video`,
      form,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120_000,
      },
    );
    return data;
  },

  async listMediaAssets(
    orgId: string,
    params?: {
      mediaType?: MediaAssetType;
      source?: "uploaded" | "ai_generated";
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<MediaAssetListResponse> {
    const { data } = await apiClient.get<MediaAssetListResponse>(`${base(orgId)}/media-assets`, {
      params,
    });
    return data;
  },

  async getMediaAsset(orgId: string, assetId: string): Promise<MediaAsset> {
    const { data } = await apiClient.get<MediaAsset>(`${base(orgId)}/media-assets/${assetId}`);
    return data;
  },

  async deleteMediaAsset(orgId: string, assetId: string): Promise<void> {
    await apiClient.delete(`${base(orgId)}/media-assets/${assetId}`);
  },

  async getSettings(orgId: string): Promise<SocialSettings> {
    const { data } = await apiClient.get<SocialSettings>(`${base(orgId)}/settings`);
    return data;
  },

  async saveSettings(orgId: string, payload: Partial<SocialSettings>): Promise<SocialSettings> {
    const { data } = await apiClient.put<SocialSettings>(`${base(orgId)}/settings`, payload);
    return data;
  },

  async listTeamPermissions(orgId: string) {
    const { data } = await apiClient.get<
      Array<{ userId: string; name: string; email: string; permission: string }>
    >(`${base(orgId)}/team-permissions`);
    return data;
  },

  async updateTeamPermission(orgId: string, userId: string, permission: string) {
    const { data } = await apiClient.put(
      `${base(orgId)}/team-permissions/${userId}`,
      { permission },
    );
    return data;
  },

  async listTemplates(orgId: string): Promise<SocialTemplate[]> {
    const { data } = await apiClient.get<SocialTemplate[]>(`${base(orgId)}/templates`);
    return data;
  },

  async createTemplate(
    orgId: string,
    payload: Partial<SocialTemplate>,
  ): Promise<SocialTemplate> {
    const { data } = await apiClient.post<SocialTemplate>(`${base(orgId)}/templates`, payload);
    return data;
  },

  async updateTemplate(
    orgId: string,
    templateId: string,
    payload: Partial<SocialTemplate>,
  ): Promise<SocialTemplate> {
    const { data } = await apiClient.put<SocialTemplate>(
      `${base(orgId)}/templates/${templateId}`,
      payload,
    );
    return data;
  },

  async deleteTemplate(orgId: string, templateId: string): Promise<void> {
    await apiClient.delete(`${base(orgId)}/templates/${templateId}`);
  },

  async applyTemplate(
    orgId: string,
    templateId: string,
    values: Record<string, string>,
  ): Promise<ApplyTemplateResult> {
    const { data } = await apiClient.post<ApplyTemplateResult>(
      `${base(orgId)}/templates/${templateId}/apply`,
      { values },
    );
    return data;
  },

  async getDashboardStats(orgId: string): Promise<SocialDashboardStats> {
    const { data } = await apiClient.get<SocialDashboardStats>(`${base(orgId)}/dashboard/stats`);
    return data;
  },

  async getActivity(orgId: string, limit = 10): Promise<SocialActivityItem[]> {
    const { data } = await apiClient.get<SocialActivityItem[]>(`${base(orgId)}/activity`, {
      params: { limit },
    });
    return data;
  },

  async getRecommendations(orgId: string): Promise<Array<{ topic: string; reason: string }>> {
    const { data } = await apiClient.get(`${base(orgId)}/recommendations`);
    return data;
  },

  async submitApproval(orgId: string, postId: string): Promise<SocialPost> {
    const { data } = await apiClient.post<SocialPost>(
      `${base(orgId)}/posts/${postId}/submit-approval`,
    );
    return data;
  },

  async approvePost(orgId: string, postId: string): Promise<SocialPost> {
    const { data } = await apiClient.post<SocialPost>(`${base(orgId)}/posts/${postId}/approve`);
    return data;
  },

  async rejectPost(orgId: string, postId: string, reason?: string): Promise<SocialPost> {
    const { data } = await apiClient.post<SocialPost>(`${base(orgId)}/posts/${postId}/reject`, {
      reason,
    });
    return data;
  },

  async requestChanges(orgId: string, postId: string, reason?: string): Promise<SocialPost> {
    const { data } = await apiClient.post<SocialPost>(
      `${base(orgId)}/posts/${postId}/request-changes`,
      { reason },
    );
    return data;
  },
};

export default socialMediaApi;
