import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ToastSeverity = "success" | "error" | "info";

export type ToastMessage = {
  id: string;
  message: string;
  severity: ToastSeverity;
};

type UIState = {
  sidebarOpen: boolean;
  mobileSidebarOpen: boolean;
  toasts: ToastMessage[];
};

const initialState: UIState = {
  sidebarOpen: true,
  mobileSidebarOpen: false,
  toasts: [],
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    setMobileSidebarOpen(state, action: PayloadAction<boolean>) {
      state.mobileSidebarOpen = action.payload;
    },
    enqueueToast(state, action: PayloadAction<Omit<ToastMessage, "id">>) {
      state.toasts.push({
        id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ...action.payload,
      });
    },
    dequeueToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setMobileSidebarOpen,
  enqueueToast,
  dequeueToast,
} = uiSlice.actions;

export default uiSlice.reducer;

export const selectSidebarOpen = (state: { ui: UIState }) => state.ui.sidebarOpen;
export const selectMobileSidebarOpen = (state: { ui: UIState }) =>
  state.ui.mobileSidebarOpen;
export const selectToasts = (state: { ui: UIState }) => state.ui.toasts;
