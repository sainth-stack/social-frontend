import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import {
  archiveSocialPost,
  bulkRetrySocialPosts,
  cancelSocialSchedule,
  createSocialPost,
  deleteSocialPost,
  duplicateSocialPost,
  fetchSocialPost,
  fetchSocialPosts,
  generateSocialContent,
  publishSocialPostNow,
  retrySocialPost,
  scheduleSocialPost,
  updateSocialPost,
} from "@/features/social-media/socialPostsThunks";
import type {
  GeneratedContent,
  PaginationMeta,
  SocialPost,
  SocialPostStatus,
} from "@/types/social-media.types";

const POST_STATUSES: SocialPostStatus[] = [
  "draft",
  "pending_approval",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "archived",
];

const emptyPagination = (): PaginationMeta => ({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
});

function emptyPostsRecord(): Record<SocialPostStatus, SocialPost[]> {
  return Object.fromEntries(POST_STATUSES.map((s) => [s, [] as SocialPost[]])) as unknown as Record<
    SocialPostStatus,
    SocialPost[]
  >;
}

function emptyPaginationRecord(): Record<SocialPostStatus, PaginationMeta> {
  return Object.fromEntries(
    POST_STATUSES.map((s) => [s, emptyPagination()]),
  ) as unknown as Record<SocialPostStatus, PaginationMeta>;
}

export type SocialPostsState = {
  posts: Record<SocialPostStatus, SocialPost[]>;
  currentPost: SocialPost | null;
  generatedContent: GeneratedContent | null;
  generating: boolean;
  loading: boolean;
  publishing: boolean;
  pagination: Record<SocialPostStatus, PaginationMeta>;
  error: string | null;
  generateError: string | null;
};

function upsertPostByStatus(state: SocialPostsState, post: SocialPost) {
  for (const status of POST_STATUSES) {
    state.posts[status] = state.posts[status].filter((p) => p.id !== post.id);
  }
  state.posts[post.status] = [post, ...state.posts[post.status]];
  if (state.currentPost?.id === post.id) {
    state.currentPost = post;
  }
}

const initialState: SocialPostsState = {
  posts: emptyPostsRecord(),
  currentPost: null,
  generatedContent: null,
  generating: false,
  loading: false,
  publishing: false,
  pagination: emptyPaginationRecord(),
  error: null,
  generateError: null,
};

const socialPostsSlice = createSlice({
  name: "socialPosts",
  initialState,
  reducers: {
    clearCurrentSocialPost(state) {
      state.currentPost = null;
    },
    clearSocialPostsError(state) {
      state.error = null;
      state.generateError = null;
    },
    clearGeneratedContent(state) {
      state.generatedContent = null;
      state.generateError = null;
    },
    setGeneratedContent(state, action: PayloadAction<GeneratedContent | null>) {
      state.generatedContent = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSocialPosts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSocialPosts.fulfilled, (state, action) => {
        state.loading = false;
        const status = (action.meta.arg.status ?? "draft") as SocialPostStatus;
        // When no status filter, store under draft bucket as "all" isn't a status key.
        // Callers that list all posts should pass no status and read from currentPost list via items.
        if (action.meta.arg.status) {
          state.posts[status] = action.payload.items;
          state.pagination[status] = {
            total: action.payload.total,
            page: action.payload.page,
            pageSize: action.payload.pageSize,
            totalPages: action.payload.totalPages,
          };
        } else {
          // Distribute by status when listing all
          const buckets = emptyPostsRecord();
          for (const post of action.payload.items) {
            buckets[post.status].push(post);
          }
          state.posts = buckets;
        }
      })
      .addCase(fetchSocialPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load posts";
      })
      .addCase(fetchSocialPost.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSocialPost.fulfilled, (state, action) => {
        state.loading = false;
        state.currentPost = action.payload;
      })
      .addCase(fetchSocialPost.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load post";
      })
      .addCase(createSocialPost.fulfilled, (state, action) => {
        const post = action.payload;
        state.posts[post.status] = [post, ...state.posts[post.status]];
        state.currentPost = post;
      })
      .addCase(createSocialPost.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to create post";
      })
      .addCase(updateSocialPost.fulfilled, (state, action) => {
        upsertPostByStatus(state, action.payload);
      })
      .addCase(updateSocialPost.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to update post";
      })
      .addCase(deleteSocialPost.fulfilled, (state, action) => {
        for (const status of POST_STATUSES) {
          state.posts[status] = state.posts[status].filter((p) => p.id !== action.payload);
        }
        if (state.currentPost?.id === action.payload) {
          state.currentPost = null;
        }
      })
      .addCase(deleteSocialPost.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to delete post";
      })
      .addCase(duplicateSocialPost.fulfilled, (state, action) => {
        const post = action.payload;
        state.posts.draft = [post, ...state.posts.draft];
      })
      .addCase(duplicateSocialPost.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to duplicate post";
      })
      .addCase(generateSocialContent.pending, (state) => {
        state.generating = true;
        state.generateError = null;
      })
      .addCase(generateSocialContent.fulfilled, (state, action) => {
        state.generating = false;
        state.generatedContent = action.payload;
      })
      .addCase(generateSocialContent.rejected, (state, action) => {
        state.generating = false;
        state.generateError = action.payload ?? "Generation failed";
      })
      .addCase(scheduleSocialPost.pending, (state) => {
        state.publishing = true;
        state.error = null;
      })
      .addCase(scheduleSocialPost.fulfilled, (state, action) => {
        state.publishing = false;
        upsertPostByStatus(state, action.payload);
      })
      .addCase(scheduleSocialPost.rejected, (state, action) => {
        state.publishing = false;
        state.error = action.payload ?? "Failed to schedule post";
      })
      .addCase(publishSocialPostNow.pending, (state) => {
        state.publishing = true;
        state.error = null;
      })
      .addCase(publishSocialPostNow.fulfilled, (state, action) => {
        state.publishing = false;
        upsertPostByStatus(state, action.payload);
      })
      .addCase(publishSocialPostNow.rejected, (state, action) => {
        state.publishing = false;
        state.error = action.payload ?? "Failed to publish post";
      })
      .addCase(cancelSocialSchedule.fulfilled, (state, action) => {
        upsertPostByStatus(state, action.payload);
      })
      .addCase(cancelSocialSchedule.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to cancel schedule";
      })
      .addCase(archiveSocialPost.fulfilled, (state, action) => {
        upsertPostByStatus(state, action.payload);
      })
      .addCase(archiveSocialPost.rejected, (state, action) => {
        state.error = action.payload ?? "Failed to archive post";
      })
      .addCase(retrySocialPost.pending, (state) => {
        state.publishing = true;
        state.error = null;
      })
      .addCase(retrySocialPost.fulfilled, (state, action) => {
        state.publishing = false;
        upsertPostByStatus(state, action.payload);
      })
      .addCase(retrySocialPost.rejected, (state, action) => {
        state.publishing = false;
        state.error = action.payload ?? "Failed to retry post";
      })
      .addCase(bulkRetrySocialPosts.pending, (state) => {
        state.publishing = true;
        state.error = null;
      })
      .addCase(bulkRetrySocialPosts.fulfilled, (state, action) => {
        state.publishing = false;
        for (const post of action.payload) {
          upsertPostByStatus(state, post);
        }
      })
      .addCase(bulkRetrySocialPosts.rejected, (state, action) => {
        state.publishing = false;
        state.error = action.payload ?? "Bulk retry failed";
      });
  },
});

export const {
  clearCurrentSocialPost,
  clearSocialPostsError,
  clearGeneratedContent,
  setGeneratedContent,
} = socialPostsSlice.actions;
export default socialPostsSlice.reducer;
