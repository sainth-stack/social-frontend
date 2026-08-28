"use client";

import { useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";

import AuthHeroIllustration from "@/components/auth/AuthHeroIllustration";
import { authSlides } from "@/components/auth/authSlides";
import { authLayout } from "@/lib/authStyles";
import { colors, displayFont } from "@/lib/theme";

const SLIDE_INTERVAL_MS = 5500;

export default function AuthShowcasePanel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const slide = authSlides[activeIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % authSlides.length);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <Box
      sx={{
        ...authLayout.showcaseColumn,
        display: { xs: "none", md: "flex" },
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        px: 5,
        py: 5,
        color: "#fff",
        background: `linear-gradient(165deg, ${colors.primary} 0%, #4338ca 52%, #3730a3 100%)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 28% 18%, rgb(255 255 255 / 0.14) 0%, transparent 42%), radial-gradient(circle at 82% 78%, rgb(16 185 129 / 0.16) 0%, transparent 38%)",
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          position: "absolute",
          top: "12%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 320,
          height: 320,
          borderRadius: "50%",
          border: "1px solid rgb(255 255 255 / 0.08)",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: "18%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 240,
          height: 240,
          borderRadius: "50%",
          border: "1px solid rgb(255 255 255 / 0.06)",
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          maxWidth: 360,
          py: 2,
        }}
      >
        <Box
          key={slide.id}
          sx={{
            width: "100%",
            transition: "opacity 0.4s ease, transform 0.4s ease",
            animation: "authSlideIn 0.45s ease",
            "@keyframes authSlideIn": {
              from: { opacity: 0, transform: "translateY(8px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          <AuthHeroIllustration variant={slide.illustration} />
        </Box>
      </Box>

      <Stack
        sx={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          gap: 1.25,
          maxWidth: 340,
          minHeight: 96,
          px: 1,
        }}
      >
        <Typography
          sx={{
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: "1.375rem",
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
          }}
        >
          {slide.title}
        </Typography>
        <Typography sx={{ fontSize: "0.875rem", lineHeight: 1.65, color: "rgb(255 255 255 / 0.78)" }}>
          {slide.subtitle}
        </Typography>
      </Stack>

      <Stack
        direction="row"
        role="tablist"
        aria-label="Feature highlights"
        sx={{
          position: "relative",
          zIndex: 1,
          gap: 0.75,
          pt: 2,
        }}
      >
        {authSlides.map((item, index) => (
          <Box
            key={item.id}
            component="button"
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-label={`Show slide ${index + 1}: ${item.title}`}
            onClick={() => setActiveIndex(index)}
            sx={{
              width: index === activeIndex ? 24 : 8,
              height: 8,
              border: 0,
              borderRadius: 999,
              p: 0,
              cursor: "pointer",
              bgcolor: index === activeIndex ? "#fff" : "rgb(255 255 255 / 0.32)",
              transition: "width 0.25s ease, background-color 0.25s ease",
              "&:hover": {
                bgcolor: index === activeIndex ? "#fff" : "rgb(255 255 255 / 0.5)",
              },
            }}
          />
        ))}
      </Stack>
    </Box>
  );
}
