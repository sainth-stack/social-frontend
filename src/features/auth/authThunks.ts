import { createAsyncThunk } from "@reduxjs/toolkit";

import { authApi } from "@/api/endpoints/auth.api";
import { toApiError } from "@/api/errors";
import { mapApiUserToUser } from "@/lib/auth/mapUser";
import type { LoginRequest, RegisterRequest, User } from "@/types/auth";

export type AuthSuccessPayload = {
  user: User;
  accessToken: string;
};

export const login = createAsyncThunk<AuthSuccessPayload, LoginRequest, { rejectValue: string }>(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const data = await authApi.login(credentials);
      return {
        user: mapApiUserToUser(data.user),
        accessToken: data.access_token,
      };
    } catch (error) {
      return rejectWithValue(toApiError(error).message);
    }
  },
);

export const register = createAsyncThunk<AuthSuccessPayload, RegisterRequest, { rejectValue: string }>(
  "auth/register",
  async (payload, { rejectWithValue }) => {
    try {
      const data = await authApi.register(payload);
      return {
        user: mapApiUserToUser(data.user),
        accessToken: data.access_token,
      };
    } catch (error) {
      return rejectWithValue(toApiError(error).message);
    }
  },
);

export const validateSession = createAsyncThunk<User, void, { rejectValue: string }>(
  "auth/validateSession",
  async (_, { rejectWithValue }) => {
    try {
      const apiUser = await authApi.me();
      return mapApiUserToUser(apiUser);
    } catch (error) {
      return rejectWithValue(toApiError(error).message);
    }
  },
);
