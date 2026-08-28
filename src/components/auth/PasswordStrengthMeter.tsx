"use client";

import { Box, Stack, Typography } from "@mui/material";

import { colors } from "@/lib/theme";

type Strength = {
  score: number;
  label: string;
  color: string;
};

function getPasswordStrength(password: string): Strength {
  if (!password) {
    return { score: 0, label: "", color: colors.border };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score: 1, label: "Weak", color: colors.error };
  if (score <= 3) return { score: 2, label: "Fair", color: colors.warning };
  if (score <= 4) return { score: 3, label: "Good", color: colors.primary };
  return { score: 4, label: "Strong", color: colors.success };
}

type PasswordStrengthMeterProps = {
  password: string;
};

export default function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const strength = getPasswordStrength(password);

  if (!password) {
    return null;
  }

  return (
    <Stack sx={{ gap: 0.75, mt: 1 }}>
      <Stack direction="row" sx={{ gap: 0.75 }}>
        {[1, 2, 3, 4].map((segment) => (
          <Box
            key={segment}
            sx={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              bgcolor: segment <= strength.score ? strength.color : colors.muted,
              transition: "background-color 0.2s ease",
            }}
          />
        ))}
      </Stack>
      <Typography sx={{ fontSize: "0.75rem", color: colors.textMuted }}>
        Password strength:{" "}
        <Box component="span" sx={{ color: strength.color, fontWeight: 600 }}>
          {strength.label}
        </Box>
      </Typography>
    </Stack>
  );
}
