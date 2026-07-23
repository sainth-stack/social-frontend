"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import MailOutlineOutlinedIcon from "@mui/icons-material/MailOutlineOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
  InputAdornment,
} from "@mui/material";

import AuthCardShell from "@/components/auth/AuthCardShell";
import AuthEmailDivider from "@/components/auth/AuthEmailDivider";
import AuthSocialButtons from "@/components/auth/AuthSocialButtons";
import PasswordInput from "@/components/auth/PasswordInput";
import {
  clearAuthError,
  selectAuthError,
  selectAuthLoading,
  selectIsAuthenticated,
  selectIsAuthHydrated,
  selectUser,
} from "@/features/auth/authSlice";
import { login } from "@/features/auth/authThunks";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import { getHomeRoute } from "@/lib/auth/users";
import {
  authFooterLinkSx,
  authInlineLinkSx,
  authInputSx,
  authLayout,
  authPrimaryButtonSx,
} from "@/lib/authStyles";
import { colors } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const REMEMBER_EMAIL_KEY = "opsbrain_remember_email";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY);
    if (savedEmail) {
      setValue("email", savedEmail);
    }
  }, [setValue]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user) {
      return;
    }

    const redirect = searchParams.get("redirect");
    router.replace(redirect ?? getHomeRoute(user));
  }, [isAuthenticated, isHydrated, router, searchParams, user]);

  const onSubmit = handleSubmit(async (values) => {
    dispatch(clearAuthError());
    try {
      const { rememberMe, ...credentials } = values;
      if (rememberMe) {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, values.email);
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

      const result = await dispatch(login(credentials)).unwrap();
      const redirect = searchParams.get("redirect");
      router.replace(redirect ?? getHomeRoute(result.user));
    } catch {
      // Error stored in auth slice
    }
  });

  const loading = isSubmitting || authLoading;

  return (
    <AuthCardShell
      title="Log in to your account"
      subtitle="Welcome back to your Social Media Manager."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Typography component={Link} href="/register" sx={authFooterLinkSx}>
            Create an account
          </Typography>
        </>
      }
    >
      <Stack sx={{ gap: authLayout.sectionGap }}>
        <AuthSocialButtons mode="login" />
        <AuthEmailDivider />

        {authError ? (
          <Alert severity="error" sx={{ borderRadius: "10px" }}>
            {authError}
          </Alert>
        ) : null}

        <Stack component="form" onSubmit={onSubmit} noValidate sx={{ gap: authLayout.fieldGap }}>
          <AppInput
            hideLabel
            placeholder="Email"
            type="email"
            autoComplete="email"
            autoFocus
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            sx={authInputSx}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <MailOutlineOutlinedIcon sx={{ fontSize: 20, color: colors.textMuted }} />
                  </InputAdornment>
                ),
              },
            }}
            {...register("email")}
          />

          <PasswordInput
            hideLabel
            placeholder="Password"
            autoComplete="current-password"
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
            sx={authInputSx}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon sx={{ fontSize: 20, color: colors.textMuted }} />
                  </InputAdornment>
                ),
              },
            }}
            {...register("password")}
          />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <FormControlLabel
              sx={{ mx: 0, mr: 0 }}
              control={
                <Checkbox
                  size="small"
                  {...register("rememberMe")}
                  sx={{
                    color: colors.borderHover,
                    p: 0.75,
                    "&.Mui-checked": { color: colors.primary },
                  }}
                />
              }
              label={
                <Typography sx={{ fontSize: "0.8125rem", color: colors.textSecondary }}>
                  Remember me
                </Typography>
              }
            />
            <Typography
              component="a"
              href="mailto:support@opsbrain.ai?subject=Password%20reset%20request"
              sx={{
                ...authInlineLinkSx,
                fontSize: "0.8125rem",
                fontWeight: 500,
              }}
            >
              Forgot password?
            </Typography>
          </Box>

          <AppButton
            type="submit"
            size="large"
            loading={loading}
            fullWidth
            sx={authPrimaryButtonSx}
          >
            Log in
          </AppButton>
        </Stack>
      </Stack>
    </AuthCardShell>
  );
}
