import { configureStore } from "@reduxjs/toolkit";

import authReducer from "@/features/auth/authSlice";
import uiReducer from "@/features/ui/uiSlice";
import socialAccountsReducer from "@/features/social-media/socialAccountsSlice";
import socialPostsReducer from "@/features/social-media/socialPostsSlice";
import socialSettingsReducer from "@/features/social-media/socialSettingsSlice";
import socialAnalyticsReducer from "@/features/social-media/socialAnalyticsSlice";
import adminReducer from "@/features/admin/adminSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      ui: uiReducer,
      socialAccounts: socialAccountsReducer,
      socialPosts: socialPostsReducer,
      socialSettings: socialSettingsReducer,
      socialAnalytics: socialAnalyticsReducer,
      admin: adminReducer,
    },
    devTools: process.env.NODE_ENV !== "production",
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
