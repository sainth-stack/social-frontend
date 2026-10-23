"use client";

import { Snackbar, Alert } from "@mui/material";

import { dequeueToast, selectToasts } from "@/features/ui/uiSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

/** Renders the global toast queue from uiSlice. Mount once in AppProviders. */
export default function AppSnackbar() {
  const dispatch = useAppDispatch();
  const toasts = useAppSelector(selectToasts);
  const current = toasts[0];

  const handleClose = () => {
    if (current) {
      dispatch(dequeueToast(current.id));
    }
  };

  return (
    <Snackbar
      open={Boolean(current)}
      autoHideDuration={4000}
      onClose={handleClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      {current ? (
        <Alert
          onClose={handleClose}
          severity={current.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {current.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}
