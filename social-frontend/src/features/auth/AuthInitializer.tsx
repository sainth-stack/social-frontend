"use client";

import { useEffect } from "react";

import {
  hydrateAuth,
  selectAccessToken,
  selectIsAuthHydrated,
  selectUser,
} from "@/features/auth/authSlice";
import { validateSession } from "@/features/auth/authThunks";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

let validatedAccessToken: string | null = null;

export default function AuthInitializer() {
  const dispatch = useAppDispatch();
  const isHydrated = useAppSelector(selectIsAuthHydrated);
  const accessToken = useAppSelector(selectAccessToken);
  const user = useAppSelector(selectUser);

  useEffect(() => {
    dispatch(hydrateAuth());
  }, [dispatch]);

  useEffect(() => {
    if (!isHydrated || !accessToken) {
      return;
    }

    if (validatedAccessToken === accessToken) {
      return;
    }

    validatedAccessToken = accessToken;
    if (!user) {
      dispatch(validateSession());
    }
  }, [accessToken, dispatch, isHydrated, user]);

  return null;
}
