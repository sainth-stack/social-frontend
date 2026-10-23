import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { login, register, validateSession } from "@/features/auth/authThunks";
import { clearSession, persistSession, readSession } from "@/lib/auth/session";
import type { User } from "@/types/auth";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    hydrateAuth(state) {
      if (typeof window === "undefined") {
        return;
      }

      const session = readSession();
      if (session) {
        state.user = session.user;
        state.accessToken = session.accessToken;
        state.isAuthenticated = true;
      }

      state.isHydrated = true;
    },
    loginSuccess(state, action: PayloadAction<{ user: User; accessToken: string }>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
      state.error = null;
      persistSession(action.payload);
    },
    loginFailure(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
    clearAuthError(state) {
      state.error = null;
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.error = null;
      clearSession();
    },
  },
  extraReducers: (builder) => {
    const pending = (state: AuthState) => {
      state.isLoading = true;
      state.error = null;
    };
    const rejected = (state: AuthState, action: { payload?: string }) => {
      state.isLoading = false;
      state.error = action.payload ?? "Something went wrong";
    };
    const fulfilled = (state: AuthState, action: PayloadAction<{ user: User; accessToken: string }>) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
      state.error = null;
      persistSession(action.payload);
    };

    builder
      .addCase(login.pending, pending)
      .addCase(login.fulfilled, fulfilled)
      .addCase(login.rejected, rejected)
      .addCase(register.pending, pending)
      .addCase(register.fulfilled, fulfilled)
      .addCase(register.rejected, rejected)
      .addCase(validateSession.fulfilled, (state, action) => {
        state.user = action.payload;
        if (state.accessToken) {
          persistSession({ user: action.payload, accessToken: state.accessToken });
        }
      })
      .addCase(validateSession.rejected, (state) => {
        state.user = null;
        state.accessToken = null;
        state.isAuthenticated = false;
        clearSession();
      });
  },
});

export const { hydrateAuth, loginSuccess, loginFailure, clearAuthError, logout } =
  authSlice.actions;

export default authSlice.reducer;

export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectAccessToken = (state: { auth: AuthState }) => state.auth.accessToken;
export const selectIsAuthenticated = (state: { auth: AuthState }) =>
  state.auth.isAuthenticated;
export const selectIsAuthHydrated = (state: { auth: AuthState }) =>
  state.auth.isHydrated;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.isLoading;
