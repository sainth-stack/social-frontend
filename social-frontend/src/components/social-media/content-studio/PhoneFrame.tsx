"use client";

import { Box, type SxProps } from "@mui/material";

type PhoneFrameProps = {
  children: React.ReactNode;
  /** Logical screen width (content area). Frame adds ~24px to each side. Default 390px */
  width?: number;
  sx?: SxProps;
};

/**
 * iPhone 17 Pro — Black Titanium
 * Matches the reference mockup: very thin bezel, large corner radius,
 * Dynamic Island tight to the top edge, slim side buttons.
 *
 * All dimensions in px. Proportions are derived from:
 *   Screen logical size: 393 × 852 pt
 *   Aspect ratio: 2.168
 *   Corner radius (outer): ~55 pt → 14% of width
 *   Bezel thickness: ~9 pt → 2.3% of width
 *   Dynamic Island: 126 × 37 pt → (32% × 9.4%) of screen
 */
export default function PhoneFrame({ children, width = 390, sx }: PhoneFrameProps) {
  const bezel = Math.round(width * 0.023);         // ~9 px  — thin titanium band
  const outerR = Math.round(width * 0.148);        // ~58 px — outer corner radius
  const innerR = outerR - bezel - 1;               // screen glass radius
  const screenH = Math.round(width * 2.168);       // logical screen height (no bezel)
  const outerH = screenH + bezel * 2;              // total frame height

  // Dynamic Island — sits 10 px below the top of the glass
  const diW = Math.round(width * 0.322);           // 126 pt → ~32% of 393 pt screen
  const diH = Math.round(width * 0.094);           // 37 pt → ~9.4%
  const diTop = Math.round(width * 0.026);         // ~10 px from glass top
  const statusBarH = diTop + diH + Math.round(width * 0.026); // space below DI pill

  // Side button dimensions (proportional)
  const btnW = Math.round(width * 0.018);          // button protrusion from frame
  const actionH = Math.round(outerH * 0.038);
  const volH    = Math.round(outerH * 0.075);
  const sideH   = Math.round(outerH * 0.118);
  const ccH     = Math.round(outerH * 0.060);

  return (
    <Box
      component="div"
      sx={{
        position: "relative",
        width: width + bezel * 2,
        height: outerH,
        flexShrink: 0,
        ...sx,
      }}
    >
      {/* ─── Drop shadow layers ─────────────────────────────────────── */}
      <Box sx={{
        position: "absolute", inset: 0,
        borderRadius: `${outerR}px`,
        boxShadow: [
          "0 0 0 0.5px rgba(255,255,255,0.07)",
          "0 1px 3px rgba(0,0,0,0.8)",
          "0 8px 24px rgba(0,0,0,0.6)",
          "0 24px 64px rgba(0,0,0,0.45)",
          "0 0 80px 8px rgba(0,0,0,0.15)",
        ].join(", "),
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* ─── Titanium outer frame ───────────────────────────────────── */}
      <Box sx={{
        position: "absolute", inset: 0,
        borderRadius: `${outerR}px`,
        // Brushed black titanium — subtle directional gradient
        background: [
          "linear-gradient(160deg,",
          "  #565656 0%,",
          "  #242424 8%,",
          "  #1a1a1a 20%,",
          "  #2d2d2d 35%,",
          "  #181818 50%,",
          "  #2a2a2a 65%,",
          "  #1c1c1c 80%,",
          "  #3a3a3a 92%,",
          "  #222222 100%",
          ")",
        ].join(""),
        zIndex: 1,
      }} />

      {/* Specular top edge highlight */}
      <Box sx={{
        position: "absolute",
        top: 0, left: `${outerR * 0.6}px`, right: `${outerR * 0.6}px`,
        height: "1px",
        bgcolor: "rgba(255,255,255,0.14)",
        borderRadius: "999px",
        zIndex: 2,
      }} />
      {/* Specular bottom edge */}
      <Box sx={{
        position: "absolute",
        bottom: 0, left: `${outerR * 0.6}px`, right: `${outerR * 0.6}px`,
        height: "1px",
        bgcolor: "rgba(255,255,255,0.05)",
        borderRadius: "999px",
        zIndex: 2,
      }} />

      {/* ─── Left buttons ──────────────────────────────────────────────
           Action button, Volume ↑, Volume ↓
      ──────────────────────────────────────────────────────────────── */}
      {/* Action button */}
      <Box sx={{
        position: "absolute",
        left: -btnW,
        top: `${Math.round(outerH * 0.128)}px`,
        width: btnW,
        height: actionH,
        background: "linear-gradient(90deg,#1a1a1a 0%,#323232 50%,#262626 100%)",
        borderRadius: `${btnW}px 0 0 ${btnW}px`,
        boxShadow: "-1px 0 4px rgba(0,0,0,0.8)",
        zIndex: 2,
      }} />
      {/* Volume ↑ */}
      <Box sx={{
        position: "absolute",
        left: -btnW,
        top: `${Math.round(outerH * 0.215)}px`,
        width: btnW,
        height: volH,
        background: "linear-gradient(90deg,#1a1a1a 0%,#323232 50%,#262626 100%)",
        borderRadius: `${btnW}px 0 0 ${btnW}px`,
        boxShadow: "-1px 0 4px rgba(0,0,0,0.8)",
        zIndex: 2,
      }} />
      {/* Volume ↓ */}
      <Box sx={{
        position: "absolute",
        left: -btnW,
        top: `${Math.round(outerH * 0.315)}px`,
        width: btnW,
        height: volH,
        background: "linear-gradient(90deg,#1a1a1a 0%,#323232 50%,#262626 100%)",
        borderRadius: `${btnW}px 0 0 ${btnW}px`,
        boxShadow: "-1px 0 4px rgba(0,0,0,0.8)",
        zIndex: 2,
      }} />

      {/* ─── Right buttons ─────────────────────────────────────────────
           Power / Side button, Camera Control
      ──────────────────────────────────────────────────────────────── */}
      {/* Power / Side button */}
      <Box sx={{
        position: "absolute",
        right: -btnW,
        top: `${Math.round(outerH * 0.215)}px`,
        width: btnW,
        height: sideH,
        background: "linear-gradient(270deg,#1a1a1a 0%,#323232 50%,#262626 100%)",
        borderRadius: `0 ${btnW}px ${btnW}px 0`,
        boxShadow: "1px 0 4px rgba(0,0,0,0.8)",
        zIndex: 2,
      }} />
      {/* Camera Control — flat elongated button */}
      <Box sx={{
        position: "absolute",
        right: -btnW,
        top: `${Math.round(outerH * 0.365)}px`,
        width: btnW,
        height: ccH,
        background: "linear-gradient(270deg,#1a1a1a 0%,#323232 50%,#262626 100%)",
        borderRadius: `0 ${btnW}px ${btnW}px 0`,
        boxShadow: "1px 0 4px rgba(0,0,0,0.8)",
        zIndex: 2,
        // Engraved ring detail
        "&::before": {
          content: '""',
          position: "absolute",
          inset: "18% 15%",
          border: "0.5px solid rgba(255,255,255,0.12)",
          borderRadius: "2px",
        },
      }} />

      {/* ─── Screen glass ────────────────────────────────────────────── */}
      <Box sx={{
        position: "absolute",
        top: bezel, left: bezel, right: bezel, bottom: bezel,
        borderRadius: `${innerR}px`,
        bgcolor: "#fff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        zIndex: 1,
        // Subtle top-left screen glare
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0, left: 0,
          width: "40%", height: "15%",
          background: "linear-gradient(135deg,rgba(255,255,255,0.05) 0%,transparent 70%)",
          borderRadius: `${innerR}px 0 0 0`,
          pointerEvents: "none",
          zIndex: 20,
        },
      }}>

        {/* ── Status bar ── */}
        <Box sx={{
          height: statusBarH,
          bgcolor: "transparent",
          position: "relative",
          flexShrink: 0,
        }}>
          {/* Dynamic Island pill */}
          <Box sx={{
            position: "absolute",
            top: diTop,
            left: "50%",
            transform: "translateX(-50%)",
            width: diW,
            height: diH,
            bgcolor: "#000",
            borderRadius: "999px",
            boxShadow: [
              "0 0 0 1px rgba(255,255,255,0.04)",
              "0 2px 10px rgba(0,0,0,0.95)",
            ].join(", "),
            zIndex: 10,
            // Front-facing camera dot (right side)
            "&::after": {
              content: '""',
              position: "absolute",
              top: "50%",
              right: "12%",
              transform: "translateY(-50%)",
              width: Math.round(diH * 0.38),
              height: Math.round(diH * 0.38),
              borderRadius: "50%",
              bgcolor: "#0d1117",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.04)",
            },
          }} />

          {/* Time — left */}
          <Box component="span" sx={{
            position: "absolute",
            left: 20, top: "50%", transform: "translateY(-50%)",
            fontSize: Math.round(width * 0.041),
            fontWeight: 700,
            color: "#000",
            letterSpacing: "-0.02em",
            fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif",
            zIndex: 5,
          }}>
            9:41
          </Box>

          {/* Status icons — right */}
          <Box sx={{
            position: "absolute",
            right: 18, top: "50%", transform: "translateY(-50%)",
            display: "flex", alignItems: "center", gap: "4px",
            zIndex: 5,
          }}>
            {/* Signal bars */}
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: "1.5px", height: Math.round(width * 0.033) }}>
              {[0.38, 0.55, 0.72, 1.0].map((frac, i) => (
                <Box key={i} sx={{
                  width: Math.round(width * 0.008),
                  height: `${frac * 100}%`,
                  bgcolor: i < 3 ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.2)",
                  borderRadius: "1px",
                }} />
              ))}
            </Box>

            {/* Wi-Fi */}
            <Box sx={{ position: "relative", width: Math.round(width * 0.042), height: Math.round(width * 0.033), display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              {[
                { w: 13, h: 13, opacity: 0.85 },
                { w: 9,  h: 9,  opacity: 0.85 },
                { w: 5,  h: 5,  opacity: 0.85 },
              ].map((arc, i) => (
                <Box key={i} sx={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  bottom: `${i * 4}px`,
                  width: arc.w,
                  height: arc.h / 2,
                  border: `1.5px solid rgba(0,0,0,${arc.opacity})`,
                  borderBottom: "none",
                  borderRadius: `${arc.w}px ${arc.w}px 0 0`,
                }} />
              ))}
              <Box sx={{ position: "absolute", bottom: 0, width: 2, height: 2, bgcolor: "rgba(0,0,0,0.85)", borderRadius: "50%" }} />
            </Box>

            {/* Battery */}
            <Box sx={{
              position: "relative",
              width: Math.round(width * 0.062),
              height: Math.round(width * 0.031),
              border: "1.5px solid rgba(0,0,0,0.35)",
              borderRadius: "3px",
              display: "flex",
              alignItems: "center",
              px: "1.5px",
              "&::after": {
                content: '""',
                position: "absolute",
                right: `-${Math.round(width * 0.009)}px`,
                top: "50%",
                transform: "translateY(-50%)",
                width: Math.round(width * 0.008),
                height: Math.round(width * 0.017),
                bgcolor: "rgba(0,0,0,0.28)",
                borderRadius: "0 2px 2px 0",
              },
            }}>
              <Box sx={{
                width: "75%", height: "62%",
                bgcolor: "#34c759",
                borderRadius: "1.5px",
              }} />
            </Box>
          </Box>
        </Box>

        {/* ── App content ── */}
        <Box sx={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
        }}>
          {children}
        </Box>

        {/* ── Home Indicator ── */}
        <Box sx={{
          height: Math.round(width * 0.065),
          bgcolor: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <Box sx={{
            width: Math.round(width * 0.36),
            height: Math.round(width * 0.013),
            bgcolor: "rgba(0,0,0,0.2)",
            borderRadius: "999px",
          }} />
        </Box>

      </Box>{/* end screen glass */}
    </Box>
  );
}
