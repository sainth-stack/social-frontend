import type { RootState } from "@/store";
import type { SocialPostStatus } from "@/types/social-media.types";

export const selectSocialPostsState = (state: RootState) => state.socialPosts;

export const selectSocialPostsLoading = (state: RootState) => state.socialPosts.loading;

export const selectSocialPostsError = (state: RootState) => state.socialPosts.error;

export const selectCurrentSocialPost = (state: RootState) => state.socialPosts.currentPost;

export const selectGeneratedContent = (state: RootState) => state.socialPosts.generatedContent;

export const selectGenerating = (state: RootState) => state.socialPosts.generating;

export const selectGenerateError = (state: RootState) => state.socialPosts.generateError;

export const selectPublishing = (state: RootState) => state.socialPosts.publishing;

export const selectSocialPostsByStatus = (status: SocialPostStatus) => (state: RootState) =>
  state.socialPosts.posts[status] ?? [];

export const selectSocialPostsPagination = (status: SocialPostStatus) => (state: RootState) =>
  state.socialPosts.pagination[status];
