"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import MailOutlineOutlinedIcon from "@mui/icons-material/MailOutlineOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
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
import PasswordStrengthMeter from "@/components/auth/PasswordStrengthMeter";
import {
  clearAuthError,
  selectAuthError,
  selectAuthLoading,
  selectIsAuthenticated,
  selectIsAuthHydrated,
  selectUser,
} from "@/features/auth/authSlice";
import { register as registerUser } from "@/features/auth/authThunks";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import { getHomeRoute } from "@/lib/auth/users";
import { platformBrand } from "@/lib/brand";
import {
  authFooterLinkSx,
  authInlineLinkSx,
  authInputSx,
  authLayout,
  authPrimaryButtonSx,
} from "@/lib/authStyles";
import { colors } from "@/lib/theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(120),
  workspaceName: z.string().min(2, "Workspace name must be at least 2 characters").max(120),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, "Password must include at least 1 letter and 1 number"),
  acceptTerms: z.boolean().refine((value) => value, {
    message: "You must accept the terms to continue",
  }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const authError = useAppSelector(selectAuthError);
  const authLoading = useAppSelector(selectAuthLoading);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isHydrated = useAppSelector(selectIsAuthHydrated);
  const user = useAppSelector(selectUser);
  const [passwordValue, setPasswordValue] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      workspaceName: "",
      email: "",
      password: "",
      acceptTerms: false,
    },
  });

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !user) {
      return;
    }
    router.replace(getHomeRoute(user));
  }, [isAuthenticated, isHydrated, router, user]);

  const onSubmit = handleSubmit(async (values) => {
    dispatch(clearAuthError());
    try {
      const result = await dispatch(
        registerUser({
          name: values.name,
          workspaceName: values.workspaceName,
          email: values.email,
          password: values.password,
        }),
      ).unwrap();
      router.replace(getHomeRoute(result.user));
    } catch {
      // Error stored in auth slice
    }
  });

  const loading = isSubmitting || authLoading;
  const passwordField = register("password");
  const marketingUrl = platformBrand.marketingUrl;

  return (
    <AuthCardShell
      title="Create your account"
      subtitle="Set up your workspace and start posting in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Typography component={Link} href="/login" sx={authFooterLinkSx}>
            Log in
          </Typography>
        </>
      }
    >
      <Stack sx={{ gap: authLayout.sectionGap }}>
        <AuthSocialButtons mode="register" />
        <AuthEmailDivider label="or sign up with email" />

        {authError ? (
          <Alert severity="error" sx={{ borderRadius: "10px" }}>
            {authError}
          </Alert>
        ) : null}

        <Stack component="form" onSubmit={onSubmit} noValidate sx={{ gap: authLayout.fieldGap }}>
          <AppInput
            hideLabel
            placeholder="Full name"
            autoComplete="name"
            autoFocus
            error={Boolean(errors.name)}
            helperText={errors.name?.message}
            sx={authInputSx}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlineOutlinedIcon sx={{ fontSize: 20, color: colors.textMuted }} />
                  </InputAdornment>
                ),
              },
            }}
            {...register("name")}
          />

          <AppInput
            hideLabel
            placeholder="Workspace name (e.g. Acme Inc.)"
            autoComplete="organization"
            error={Boolean(errors.workspaceName)}
            helperText={errors.workspaceName?.message}
            sx={authInputSx}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <ApartmentOutlinedIcon sx={{ fontSize: 20, color: colors.textMuted }} />
                  </InputAdornment>
                ),
              },
            }}
            {...register("workspaceName")}
          />

          <AppInput
            hideLabel
            placeholder="Email"
            type="email"
            autoComplete="email"
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

          <Box>
            <PasswordInput
              hideLabel
              placeholder="Password"
              autoComplete="new-password"
              error={Boolean(errors.password)}
              helperText={errors.password?.message ?? "At least 8 characters with a letter and number"}
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
              {...passwordField}
              onChange={(event) => {
                setPasswordValue(event.target.value);
                void passwordField.onChange(event);
              }}
            />
            <PasswordStrengthMeter password={passwordValue} />
          </Box>

          <FormControlLabel
            sx={{
              alignItems: "flex-start",
              mx: 0,
              mt: 0.25,
              "& .MuiCheckbox-root": { pt: 0.25, pl: 0.75 },
            }}
            control={
              <Checkbox
                size="small"
                {...register("acceptTerms")}
                sx={{ color: colors.borderHover, "&.Mui-checked": { color: colors.primary } }}
              />
            }
            label={
              <Typography sx={{ fontSize: "0.8125rem", lineHeight: 1.6, color: colors.textSecondary }}>
                I agree to the{" "}
                <Typography
                  component="a"
                  href={`${marketingUrl}/terms`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={authInlineLinkSx}
                >
                  Terms of Service
                </Typography>{" "}
                and{" "}
                <Typography
                  component="a"
                  href={`${marketingUrl}/privacy`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={authInlineLinkSx}
                >
                  Privacy Policy
                </Typography>
              </Typography>
            }
          />
          {errors.acceptTerms ? (
            <Typography sx={{ fontSize: "0.75rem", color: colors.error, mt: -1 }}>
              {errors.acceptTerms.message}
            </Typography>
          ) : null}

          <AppButton
            type="submit"
            size="large"
            loading={loading}
            fullWidth
            sx={authPrimaryButtonSx}
          >
            Create account
          </AppButton>
        </Stack>
      </Stack>
    </AuthCardShell>
  );
}
