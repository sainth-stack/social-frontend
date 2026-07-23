"use client";

import { Box, Button, Tooltip, Typography } from "@mui/material";

import { colors } from "@/lib/theme";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#F25022" d="M1 1h7.5v7.5H1z" />
      <path fill="#7FBA00" d="M9.5 1H17v7.5H9.5z" />
      <path fill="#00A4EF" d="M1 9.5h7.5V17H1z" />
      <path fill="#FFB900" d="M9.5 9.5H17V17H9.5z" />
    </svg>
  );
}

type AuthSocialButtonsProps = {
  mode: "login" | "register";
};

export default function AuthSocialButtons({ mode }: AuthSocialButtonsProps) {
  const providers = [
    { name: "Google", Icon: GoogleIcon },
    { name: "Microsoft", Icon: MicrosoftIcon },
  ] as const;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
      {providers.map(({ name, Icon }) => (
        <Tooltip key={name} title="SSO coming soon" arrow placement="top">
          <span style={{ display: "block" }}>
            <Button
              type="button"
              disabled
              fullWidth
              aria-label={`${mode === "login" ? "Sign in" : "Sign up"} with ${name} (coming soon)`}
              sx={{
                justifyContent: "center",
                gap: 1.25,
                minHeight: 44,
                py: 1.15,
                borderRadius: "10px",
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.875rem",
                color: colors.textPrimary,
                bgcolor: colors.paper,
                border: `1px solid ${colors.border}`,
                transition: "border-color 0.15s ease, background-color 0.15s ease",
                "&.Mui-disabled": {
                  color: colors.textPrimary,
                  bgcolor: colors.paper,
                  borderColor: colors.border,
                  opacity: 1,
                },
              }}
            >
              <Icon />
              <Typography component="span" sx={{ fontSize: "0.875rem", fontWeight: 500 }}>
                {name}
              </Typography>
            </Button>
          </span>
        </Tooltip>
      ))}
    </Box>
  );
}
