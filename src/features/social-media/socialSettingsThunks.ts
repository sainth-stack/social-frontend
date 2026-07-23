import { createAsyncThunk } from "@reduxjs/toolkit";

import socialMediaApi from "@/api/endpoints/social-media.api";
import { toApiError } from "@/api/errors";
import type {
  BrandVoice,
  BrandVoicePayload,
  BrandVoiceTestResult,
} from "@/types/social-media.types";

export const fetchBrandVoice = createAsyncThunk<
  BrandVoice,
  string,
  { rejectValue: string }
>("socialSettings/fetchBrandVoice", async (orgId, { rejectWithValue }) => {
  try {
    return await socialMediaApi.getBrandVoice(orgId);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const saveBrandVoice = createAsyncThunk<
  BrandVoice,
  { orgId: string; payload: BrandVoicePayload },
  { rejectValue: string }
>("socialSettings/saveBrandVoice", async ({ orgId, payload }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.saveBrandVoice(orgId, payload);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});

export const testBrandVoice = createAsyncThunk<
  BrandVoiceTestResult,
  { orgId: string; payload?: BrandVoicePayload },
  { rejectValue: string }
>("socialSettings/testBrandVoice", async ({ orgId, payload }, { rejectWithValue }) => {
  try {
    return await socialMediaApi.testBrandVoice(orgId, payload);
  } catch (error) {
    return rejectWithValue(toApiError(error).message);
  }
});
