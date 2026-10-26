"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { useForm } from "react-hook-form";
import { z } from "zod";

import authApi from "@/api/endpoints/auth.api";
import { toApiError } from "@/api/errors";
import AuthCardShell from "@/components/auth/AuthCardShell";
import AppInput from "@/components/ui/AppInput";
import {
  authFooterLinkSx,
  authInputSx,
  authLayout,
  authPrimaryButtonSx,
} from "@/lib/authStyles";
import { colors } from "@/lib/theme";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});

type ForgotValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [apiError, setApiError] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const email = watch("email");

  const onSubmit = handleSubmit(async (values) => {
    setApiError(undefined);
    try {
      await authApi.forgotPassword(values.email);
      setSent(true);
    } catch (error) {
      setApiError(toApiError(error).message);
    }
  });

  if (sent) {
    return (
      <AuthCardShell
        title="Check your email"
        subtitle={`If an account exists for ${email}, we sent a password reset link.`}
        footer={
          <Link href="/login" style={{ textDecoration: "none" }}>
            <Typography component="span" sx={authFooterLinkSx}>
              Back to sign in
            </Typography>
          </Link>
        }
      >
        <Stack sx={{ alignItems: "center", gap: 2, py: 1, textAlign: "center" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: "50%",
              bgcolor: colors.successLight,
              color: colors.success,
            }}
          >
            <CheckCircleOutlinedIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, lineHeight: 1.55 }}>
            The link expires in 60 minutes. Didn&apos;t get it? Check spam or{" "}
            <Button
              type="button"
              variant="text"
              size="small"
              onClick={() => setSent(false)}
              sx={{ minWidth: 0, p: 0, verticalAlign: "baseline", textTransform: "none", fontWeight: 600 }}
            >
              try again
            </Button>
            .
          </Typography>
        </Stack>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell
      title="Forgot your password?"
      subtitle="Enter your work email and we'll send you a secure reset link."
      footer={
        <Link href="/login" style={{ textDecoration: "none" }}>
          <Typography component="span" sx={authFooterLinkSx}>
            Back to sign in
          </Typography>
        </Link>
      }
    >
      <Box component="form" onSubmit={onSubmit} noValidate>
        <Stack sx={{ gap: authLayout.fieldGap }}>
          {apiError ? (
            <Alert severity="error" variant="outlined" sx={{ borderRadius: "10px" }}>
              {apiError}
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

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={isSubmitting}
            sx={authPrimaryButtonSx}
          >
            {isSubmitting ? (
              <>
                <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
                Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </Stack>
      </Box>
    </AuthCardShell>
  );
}
