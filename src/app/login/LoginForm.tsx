"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  Typography,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import AuthCardShell from "@/components/auth/AuthCardShell";
import PasswordInput from "@/components/auth/PasswordInput";
import AppInput from "@/components/ui/AppInput";
import {
  clearAuthError,
  selectAuthError,
  selectAuthLoading,
  selectIsAuthenticated,
  selectIsAuthHydrated,
  selectUser,
} from "@/features/auth/authSlice";
import { login } from "@/features/auth/authThunks";
import { authFooterLinkSx, authInlineLinkSx, authInputSx, authLayout, authPrimaryButtonSx } from "@/lib/authStyles";
import { getHomeRoute } from "@/lib/auth/users";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const REMEMBER_EMAIL_KEY = "opsbrain_remember_email";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean(),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const authError = useAppSelector(selectAuthError);
  const authLoading = useAppSelector(selectAuthLoading);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isHydrated = useAppSelector(selectIsAuthHydrated);
  const user = useAppSelector(selectUser);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      remember: true,
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (savedEmail) setValue("email", savedEmail);
  }, [setValue]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user) return;
    const redirect = searchParams.get("redirect");
    router.replace(redirect ?? getHomeRoute(user));
  }, [isAuthenticated, isHydrated, router, searchParams, user]);

  const onSubmit = handleSubmit(async (values) => {
    dispatch(clearAuthError());

    if (values.remember) {
      window.localStorage.setItem(REMEMBER_EMAIL_KEY, values.email);
    } else {
      window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    try {
      await dispatch(login({ email: values.email, password: values.password })).unwrap();
    } catch {
      // Error stored in auth slice; redirect runs in useEffect when auth state updates
    }
  });

  return (
    <AuthCardShell
      title="Welcome back"
      subtitle="Sign in to plan, publish, and measure social content across your channels."
      footer={
        <>
          New to OpsBrain?{" "}
          <Link href="/register" style={{ textDecoration: "none" }}>
            <Typography component="span" sx={authFooterLinkSx}>
              Create an account
            </Typography>
          </Link>
        </>
      }
    >
      <Box component="form" onSubmit={onSubmit} noValidate>
        <Stack sx={{ gap: authLayout.fieldGap }}>
          {authError ? (
            <Alert severity="error" variant="outlined" sx={{ borderRadius: "10px" }}>
              {authError}
            </Alert>
          ) : null}

          <AppInput
            label="Work email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            error={!!errors.email}
            helperText={errors.email?.message}
            sx={authInputSx}
            {...register("email")}
          />

          <Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", mb: 0.5 }}>
              <Link href="/forgot-password" style={{ textDecoration: "none" }}>
                <Typography variant="body2" sx={{ ...authInlineLinkSx, fontSize: "0.8125rem" }}>
                  Forgot password?
                </Typography>
              </Link>
            </Box>
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              placeholder="Enter your password"
              error={!!errors.password}
              helperText={errors.password?.message}
              sx={authInputSx}
              {...register("password")}
            />
          </Box>

          <Controller
            name="remember"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Checkbox
                    {...field}
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    size="small"
                    sx={{ py: 0 }}
                  />
                }
                label={
                  <Typography variant="body2" color="text.secondary">
                    Remember me on this device
                  </Typography>
                }
              />
            )}
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={authLoading}
            sx={authPrimaryButtonSx}
          >
            {authLoading ? (
              <>
                <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>

          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5, textAlign: "center" }}>
            Protected with encrypted credentials. We never post without your approval.
          </Typography>
        </Stack>
      </Box>
    </AuthCardShell>
  );
}
