import { createSlice } from "@reduxjs/toolkit";

import {
  fetchBrandVoice,
  saveBrandVoice,
  testBrandVoice,
} from "@/features/social-media/socialSettingsThunks";
import type { BrandVoice, BrandVoiceTestResult } from "@/types/social-media.types";

export type SocialSettingsState = {
  settings: null;
  brandVoice: BrandVoice | null;
  testSample: BrandVoiceTestResult | null;
  loading: boolean;
  saving: boolean;
  testing: boolean;
  error: string | null;
};

const initialState: SocialSettingsState = {
  settings: null,
  brandVoice: null,
  testSample: null,
  loading: false,
  saving: false,
  testing: false,
  error: null,
};

const socialSettingsSlice = createSlice({
  name: "socialSettings",
  initialState,
  reducers: {
    clearBrandVoiceTest(state) {
      state.testSample = null;
    },
    clearSocialSettingsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBrandVoice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBrandVoice.fulfilled, (state, action) => {
        state.loading = false;
        state.brandVoice = action.payload;
      })
      .addCase(fetchBrandVoice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? "Failed to load brand voice";
      })
      .addCase(saveBrandVoice.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(saveBrandVoice.fulfilled, (state, action) => {
        state.saving = false;
        state.brandVoice = action.payload;
      })
      .addCase(saveBrandVoice.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload ?? "Failed to save brand voice";
      })
      .addCase(testBrandVoice.pending, (state) => {
        state.testing = true;
        state.error = null;
      })
      .addCase(testBrandVoice.fulfilled, (state, action) => {
        state.testing = false;
        state.testSample = action.payload;
      })
      .addCase(testBrandVoice.rejected, (state, action) => {
        state.testing = false;
        state.error = action.payload ?? "Failed to test brand voice";
      });
  },
});

export const { clearBrandVoiceTest, clearSocialSettingsError } = socialSettingsSlice.actions;
export default socialSettingsSlice.reducer;

export const selectBrandVoice = (state: { socialSettings: SocialSettingsState }) =>
  state.socialSettings.brandVoice;
export const selectBrandVoiceLoading = (state: { socialSettings: SocialSettingsState }) =>
  state.socialSettings.loading;
export const selectBrandVoiceSaving = (state: { socialSettings: SocialSettingsState }) =>
  state.socialSettings.saving;
export const selectBrandVoiceTesting = (state: { socialSettings: SocialSettingsState }) =>
  state.socialSettings.testing;
export const selectBrandVoiceTestSample = (state: { socialSettings: SocialSettingsState }) =>
  state.socialSettings.testSample;
export const selectSocialSettingsError = (state: { socialSettings: SocialSettingsState }) =>
  state.socialSettings.error;
