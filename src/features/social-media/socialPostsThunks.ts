import { createAsyncThunk } from "@reduxjs/toolkit";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { toApiError } from "@/api/errors";
import type {
  CreateSocialPostPayload,
  GeneratedContent,
  GeneratePostPayload,
  SocialPost,
  SocialPostListResponse,
  SocialPostStatus,
  UpdateSocialPostPayload,
} from "@/types/social-media.types";

export const fetchSocialPosts = createAsyncThunk<
  SocialPostListResponse,
  {
    orgId: string;
    status?: SocialPostStatus;
    search?: string;
    page?: number;
    pageSize?: number;
  },
  { rejectValue: string }
>("socialPosts/fetch", async ({ orgId, status, search, page, pageSize }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.listPosts(orgId, { status, search, page, pageSize });
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const fetchSocialPost = createAsyncThunk<
  SocialPost,
  { orgId: string; postId: string },
  { rejectValue: string }
>("socialPosts/fetchOne", async ({ orgId, postId }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.getPost(orgId, postId);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const createSocialPost = createAsyncThunk<
  SocialPost,
  { orgId: string; payload: CreateSocialPostPayload },
  { rejectValue: string }
>("socialPosts/create", async ({ orgId, payload }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.createPost(orgId, payload);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const updateSocialPost = createAsyncThunk<
  SocialPost,
  { orgId: string; postId: string; payload: UpdateSocialPostPayload },
  { rejectValue: string }
>("socialPosts/update", async ({ orgId, postId, payload }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.updatePost(orgId, postId, payload);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const deleteSocialPost = createAsyncThunk<
  string,
  { orgId: string; postId: string },
  { rejectValue: string }
>("socialPosts/delete", async ({ orgId, postId }, { rejectWithValue }) => {
  try {
    await socialMediaApi.deletePost(orgId, postId);
    return postId;
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const duplicateSocialPost = createAsyncThunk<
  SocialPost,
  { orgId: string; postId: string },
  { rejectValue: string }
>("socialPosts/duplicate", async ({ orgId, postId }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.duplicatePost(orgId, postId);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const generateSocialContent = createAsyncThunk<
  GeneratedContent,
  { orgId: string; payload: GeneratePostPayload },
  { rejectValue: string }
>("socialPosts/generate", async ({ orgId, payload }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.generatePost(orgId, payload);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const scheduleSocialPost = createAsyncThunk<
  SocialPost,
  { orgId: string; postId: string; scheduledAt: string },
  { rejectValue: string }
>("socialPosts/schedule", async ({ orgId, postId, scheduledAt }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.schedulePost(orgId, postId, scheduledAt);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const publishSocialPostNow = createAsyncThunk<
  SocialPost,
  { orgId: string; postId: string },
  { rejectValue: string }
>("socialPosts/publishNow", async ({ orgId, postId }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.publishNow(orgId, postId);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const cancelSocialSchedule = createAsyncThunk<
  SocialPost,
  { orgId: string; postId: string },
  { rejectValue: string }
>("socialPosts/cancelSchedule", async ({ orgId, postId }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.cancelSchedule(orgId, postId);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const archiveSocialPost = createAsyncThunk<
  SocialPost,
  { orgId: string; postId: string },
  { rejectValue: string }
>("socialPosts/archive", async ({ orgId, postId }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.archivePost(orgId, postId);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const retrySocialPost = createAsyncThunk<
  SocialPost,
  { orgId: string; postId: string },
  { rejectValue: string }
>("socialPosts/retry", async ({ orgId, postId }, { rejectWithValue }) => {
  try {
    const result = await socialMediaApi.retryPost(orgId, postId);
    return result.post;
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const bulkRetrySocialPosts = createAsyncThunk<
  SocialPost[],
  { orgId: string; postIds: string[] },
  { rejectValue: string }
>("socialPosts/bulkRetry", async ({ orgId, postIds }, { rejectWithValue }) => {
  try {
    const result = await socialMediaApi.bulkRetry(orgId, postIds);
    return result.items.map((i) => i.post);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});
