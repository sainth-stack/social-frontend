"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import AuthCardShell from "@/components/auth/AuthCardShell";
import PasswordInput from "@/components/auth/PasswordInput";
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";
import AppInput from "@/components/ui/AppInput";
import {
  clearAuthError,
  selectAuthError,
  selectAuthLoading,
  selectIsAuthenticated,
  selectIsAuthHydrated,
  selectUser,
} from "@/features/auth/authSlice";
import { register as registerUser } from "@/features/auth/authThunks";
import { platformBrand } from "@/lib/brand";
import {
  authFooterLinkSx,
  authInlineLinkSx,
  authInputSx,
  authLayout,
  authPrimaryButtonSx,
} from "@/lib/authStyles";
import { getHomeRoute } from "@/lib/auth/users";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const registerSchema = z
  .object({
    name: z.string().min(2, "Enter your full name"),
    business: z.string().min(2, "Enter your business or workspace name"),
    email: z.string().min(1, "Email is required").email("Enter a valid email"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Include at least one letter and one number"),
    confirm: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const authError = useAppSelector(selectAuthError);
  const authLoading = useAppSelector(selectAuthLoading);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isHydrated = useAppSelector(selectIsAuthHydrated);
  const user = useAppSelector(selectUser);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      business: "",
      email: "",
      password: "",
      confirm: "",
    },
    mode: "onSubmit",
  });

  const passwordValue = watch("password");

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user) return;
    if (user.isPlatformAdmin) {
      router.replace(getHomeRoute(user));
      return;
    }
    router.replace("/dashboard/onboarding");
  }, [isAuthenticated, isHydrated, router, user]);

  const onSubmit = handleSubmit(async (values) => {
    dispatch(clearAuthError());

    try {
      await dispatch(
        registerUser({
          name: values.name,
          workspaceName: values.business,
          email: values.email,
          password: values.password,
        }),
      ).unwrap();
      toast.success("Workspace created — welcome to OpsBrain");
      router.replace("/dashboard/onboarding");
    } catch {
      // Error stored in auth slice
    }
  });

  const termsUrl = `${platformBrand.marketingUrl}/terms`;
  const privacyUrl = `${platformBrand.marketingUrl}/privacy`;

  return (
    <AuthCardShell
      title="Create your workspace"
      subtitle="Start free. Connect channels, generate content with AI, and schedule posts in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" style={{ textDecoration: "none" }}>
            <Typography component="span" sx={authFooterLinkSx}>
              Sign in
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

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <AppInput
                label="Full name"
                autoComplete="name"
                autoFocus
                placeholder="Ava Chen"
                error={!!errors.name}
                helperText={errors.name?.message}
                sx={authInputSx}
                {...register("name")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <AppInput
                label="Business name"
                autoComplete="organization"
                placeholder="Northstar Media"
                error={!!errors.business}
                helperText={errors.business?.message}
                sx={authInputSx}
                {...register("business")}
              />
            </Grid>
          </Grid>

          <AppInput
            label="Work email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            error={!!errors.email}
            helperText={errors.email?.message}
            sx={authInputSx}
            {...register("email")}
          />

          <Stack sx={{ gap: 0 }}>
            <PasswordInput
              label="Password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              error={!!errors.password}
              helperText={errors.password?.message}
              sx={authInputSx}
              {...register("password")}
            />
            <PasswordStrengthMeter password={passwordValue} />
          </Stack>

          <PasswordInput
            label="Confirm password"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            error={!!errors.confirm}
            helperText={errors.confirm?.message}
            sx={authInputSx}
            {...register("confirm")}
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
                Creating workspace…
              </>
            ) : (
              "Create account"
            )}
          </Button>

          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.55, textAlign: "center" }}>
            By creating an account, you agree to our{" "}
            <Link href={termsUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <Typography component="span" variant="caption" sx={authInlineLinkSx}>
                Terms
              </Typography>
            </Link>{" "}
            and{" "}
            <Link href={privacyUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <Typography component="span" variant="caption" sx={authInlineLinkSx}>
                Privacy Policy
              </Typography>
            </Link>
            .
          </Typography>
        </Stack>
      </Box>
    </AuthCardShell>
  );
}
