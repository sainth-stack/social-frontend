"use client";

/**
 * CarouselSlideRenderer — renders a single carousel slide in one of 5 Canva-style layouts.
 * Used in both the editor preview AND the PlatformPreview phone frame.
 */
import { Box, Typography } from "@mui/material";
import type { CarouselSlide, CarouselSlideLayout, CarouselSlideStyle } from "@/types/social-media.types";
import { DEFAULT_SLIDE_STYLE } from "@/types/social-media.types";

// ─── Layout preset thumbnails (for the style picker) ─────────────────────────

export const LAYOUT_PRESETS: { id: CarouselSlideLayout; label: string }[] = [
  { id: "bold",    label: "Bold"    },
  { id: "overlay", label: "Overlay" },
  { id: "split",   label: "Split"   },
  { id: "minimal", label: "Minimal" },
  { id: "stat",    label: "Stat"    },
];

// ─── Background preset swatches ───────────────────────────────────────────────

export const BG_PRESETS: { color: string; color2: string; label: string }[] = [
  { color: "#0A66C2", color2: "#004182", label: "LinkedIn Blue"  },
  { color: "#1B2B4B", color2: "#0f1a2e", label: "Navy"          },
  { color: "#2D6A4F", color2: "#1B4332", label: "Forest"        },
  { color: "#E85D04", color2: "#9D0208", label: "Sunset"        },
  { color: "#5A189A", color2: "#3C096C", label: "Violet"        },
  { color: "#2D3436", color2: "#1a1a1a", label: "Charcoal"      },
  { color: "#D63384", color2: "#9a1563", label: "Rose"          },
  { color: "#0D9488", color2: "#065f56", label: "Teal"          },
  { color: "#ffffff", color2: "#f0f0f0", label: "White"         },
  { color: "#F8F3E6", color2: "#EDE0C4", label: "Cream"        },
];

export const TEXT_PRESETS: { color: string; label: string }[] = [
  { color: "#ffffff", label: "White"      },
  { color: "#000000", label: "Black"      },
  { color: "#1a1a1a", label: "Near Black" },
  { color: "#F8F9FA", label: "Off White"  },
  { color: "#FFD166", label: "Gold"       },
  { color: "#06D6A0", label: "Mint"       },
];

export const ACCENT_PRESETS: { color: string }[] = [
  { color: "#FFD166" },
  { color: "#06D6A0" },
  { color: "#EF476F" },
  { color: "#118AB2" },
  { color: "#ffffff" },
  { color: "#000000" },
];

// ─── Individual slide layouts ─────────────────────────────────────────────────

type SlideProps = {
  slide: CarouselSlide;
  slideNum: number;
  totalSlides: number;
  style: CarouselSlideStyle;
  /** compact = smaller fonts for phone-frame preview */
  compact?: boolean;
};

function BoldLayout({ slide, slideNum, totalSlides, style, compact }: SlideProps) {
  const { bgColor, bgColor2, textColor, accentColor } = style;
  const f = compact ? 0.72 : 1;
  return (
    <Box sx={{
      width: "100%", height: "100%",
      background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColor2} 100%)`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      p: compact ? 2 : 4, textAlign: "center", position: "relative",
    }}>
      {/* Slide number dot */}
      <Box sx={{
        position: "absolute", top: compact ? 10 : 18, right: compact ? 12 : 20,
        width: compact ? 18 : 26, height: compact ? 18 : 26,
        borderRadius: "50%", bgcolor: "rgba(255,255,255,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Typography sx={{ color: textColor, fontSize: `${f * 0.625}rem`, fontWeight: 700 }}>{slideNum}</Typography>
      </Box>
      {/* Accent line */}
      <Box sx={{ width: compact ? 28 : 40, height: 3, bgcolor: accentColor, borderRadius: "999px", mb: compact ? 1 : 2 }} />
      <Typography sx={{
        color: textColor, fontWeight: 800,
        fontSize: `${f * (compact ? 0.875 : 1.625)}rem`,
        lineHeight: 1.25, mb: compact ? 0.75 : 1.5,
        textShadow: "0 1px 4px rgba(0,0,0,0.15)",
      }}>
        {slide.headline || `Slide ${slideNum}`}
      </Typography>
      {slide.body && (
        <Typography sx={{
          color: textColor, opacity: 0.88,
          fontSize: `${f * (compact ? 0.625 : 0.9375)}rem`,
          lineHeight: 1.55,
          maxWidth: "88%",
        }}>
          {compact ? slide.body.slice(0, 80) + (slide.body.length > 80 ? "…" : "") : slide.body}
        </Typography>
      )}
      {/* Bottom slide count */}
      <Box sx={{ position: "absolute", bottom: compact ? 8 : 16, display: "flex", gap: "4px" }}>
        {Array.from({ length: totalSlides }).map((_, i) => (
          <Box key={i} sx={{ width: i === slideNum - 1 ? compact ? 12 : 18 : compact ? 4 : 6, height: compact ? 3 : 4, borderRadius: "999px", bgcolor: i === slideNum - 1 ? accentColor : "rgba(255,255,255,0.35)", transition: "width 0.2s" }} />
        ))}
      </Box>
    </Box>
  );
}

function OverlayLayout({ slide, slideNum, totalSlides, style, compact }: SlideProps) {
  const { bgColor, bgColor2, textColor, accentColor } = style;
  const f = compact ? 0.72 : 1;
  return (
    <Box sx={{
      width: "100%", height: "100%", position: "relative", overflow: "hidden",
      background: slide.imageUrl
        ? `url(${slide.imageUrl}) center/cover no-repeat`
        : `linear-gradient(135deg, ${bgColor} 0%, ${bgColor2} 100%)`,
    }}>
      {/* Dark gradient overlay from bottom */}
      <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.82) 50%, rgba(0,0,0,0.15) 100%)" }} />
      <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, p: compact ? 1.5 : 3.5 }}>
        <Box sx={{ width: compact ? 20 : 32, height: 3, bgcolor: accentColor, borderRadius: "999px", mb: compact ? 0.75 : 1.5 }} />
        <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: `${f * (compact ? 0.875 : 1.5)}rem`, lineHeight: 1.25, mb: compact ? 0.5 : 1 }}>
          {slide.headline || `Slide ${slideNum}`}
        </Typography>
        {slide.body && (
          <Typography sx={{ color: "rgba(255,255,255,0.82)", fontSize: `${f * (compact ? 0.5625 : 0.875)}rem`, lineHeight: 1.5 }}>
            {compact ? slide.body.slice(0, 60) + (slide.body.length > 60 ? "…" : "") : slide.body}
          </Typography>
        )}
      </Box>
      {/* Slide num */}
      <Box sx={{ position: "absolute", top: compact ? 8 : 16, right: compact ? 10 : 18, bgcolor: "rgba(0,0,0,0.4)", borderRadius: "4px", px: 0.75, py: 0.25 }}>
        <Typography sx={{ color: "#fff", fontSize: `${f * 0.6875}rem`, fontWeight: 600 }}>{slideNum}/{totalSlides}</Typography>
      </Box>
    </Box>
  );
}

function SplitLayout({ slide, slideNum, totalSlides, style, compact }: SlideProps) {
  const { bgColor, textColor, accentColor } = style;
  const f = compact ? 0.72 : 1;
  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", bgcolor: "#fff" }}>
      {/* Left accent strip */}
      <Box sx={{
        width: compact ? "22%" : "26%", bgcolor: bgColor,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        p: compact ? 0.75 : 1.5,
      }}>
        <Typography sx={{ color: textColor, fontWeight: 800, fontSize: `${f * (compact ? 1.125 : 2.25)}rem`, lineHeight: 1 }}>
          {slideNum}
        </Typography>
        <Box sx={{ width: compact ? 16 : 24, height: 2, bgcolor: accentColor, borderRadius: "999px", mt: compact ? 0.5 : 1 }} />
      </Box>
      {/* Right content */}
      <Box sx={{ flex: 1, p: compact ? 1.25 : 3, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <Box sx={{ width: compact ? 16 : 24, height: 3, bgcolor: bgColor, borderRadius: "999px", mb: compact ? 0.75 : 1.5 }} />
        <Typography sx={{ color: "#1a1a1a", fontWeight: 700, fontSize: `${f * (compact ? 0.75 : 1.25)}rem`, lineHeight: 1.3, mb: compact ? 0.5 : 1.25 }}>
          {slide.headline || `Slide ${slideNum}`}
        </Typography>
        {slide.body && (
          <Typography sx={{ color: "#444", fontSize: `${f * (compact ? 0.5625 : 0.875)}rem`, lineHeight: 1.55 }}>
            {compact ? slide.body.slice(0, 70) + (slide.body.length > 70 ? "…" : "") : slide.body}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function MinimalLayout({ slide, slideNum, totalSlides, style, compact }: SlideProps) {
  const { bgColor, textColor, accentColor } = style;
  const isDark = bgColor === "#ffffff" || bgColor === "#F8F3E6" || bgColor.startsWith("#f") || bgColor.startsWith("#e");
  const bodyColor = isDark ? "#444444" : "rgba(255,255,255,0.78)";
  const headlineColor = isDark ? "#111111" : textColor;
  const f = compact ? 0.72 : 1;
  return (
    <Box sx={{
      width: "100%", height: "100%",
      bgcolor: bgColor,
      display: "flex", flexDirection: "column", justifyContent: "center",
      p: compact ? 2 : 4.5,
    }}>
      {/* Dot + slide number */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: compact ? 1 : 2.5 }}>
        <Box sx={{ width: compact ? 6 : 10, height: compact ? 6 : 10, borderRadius: "50%", bgcolor: accentColor }} />
        <Typography sx={{ color: accentColor, fontSize: `${f * 0.75}rem`, fontWeight: 700 }}>0{slideNum}</Typography>
      </Box>
      <Typography sx={{ color: headlineColor, fontWeight: 800, fontSize: `${f * (compact ? 0.9375 : 1.75)}rem`, lineHeight: 1.2, mb: compact ? 0.75 : 1.75 }}>
        {slide.headline || `Slide ${slideNum}`}
      </Typography>
      {/* Divider */}
      <Box sx={{ width: compact ? 24 : 48, height: 2, bgcolor: accentColor, borderRadius: "999px", mb: compact ? 0.75 : 1.75 }} />
      {slide.body && (
        <Typography sx={{ color: bodyColor, fontSize: `${f * (compact ? 0.625 : 0.9375)}rem`, lineHeight: 1.6 }}>
          {compact ? slide.body.slice(0, 80) + (slide.body.length > 80 ? "…" : "") : slide.body}
        </Typography>
      )}
    </Box>
  );
}

function StatLayout({ slide, slideNum, totalSlides, style, compact }: SlideProps) {
  const { bgColor, bgColor2, textColor, accentColor } = style;
  const f = compact ? 0.72 : 1;
  // Extract first word as "stat" if it's a number or short
  const words = (slide.headline || "").split(" ");
  const stat = words[0]?.match(/^[\d%$+×x]+$/) ? words[0] : slideNum.toString();
  const rest = words[0]?.match(/^[\d%$+×x]+$/) ? words.slice(1).join(" ") : slide.headline;
  return (
    <Box sx={{
      width: "100%", height: "100%",
      background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColor2} 100%)`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      p: compact ? 2 : 4, textAlign: "center", position: "relative",
    }}>
      {/* Large stat */}
      <Typography sx={{
        color: accentColor, fontWeight: 900,
        fontSize: `${f * (compact ? 2.5 : 5)}rem`,
        lineHeight: 1, mb: compact ? 0.25 : 0.5,
        textShadow: "0 2px 12px rgba(0,0,0,0.2)",
      }}>
        {stat}
      </Typography>
      <Box sx={{ width: compact ? 24 : 48, height: 3, bgcolor: "rgba(255,255,255,0.3)", borderRadius: "999px", mb: compact ? 0.75 : 1.5 }} />
      <Typography sx={{ color: textColor, fontWeight: 700, fontSize: `${f * (compact ? 0.75 : 1.25)}rem`, lineHeight: 1.3, mb: compact ? 0.5 : 1 }}>
        {rest || slide.headline}
      </Typography>
      {slide.body && (
        <Typography sx={{ color: textColor, opacity: 0.8, fontSize: `${f * (compact ? 0.5625 : 0.875)}rem`, lineHeight: 1.5, maxWidth: "80%" }}>
          {compact ? slide.body.slice(0, 60) + (slide.body.length > 60 ? "…" : "") : slide.body}
        </Typography>
      )}
      <Box sx={{ position: "absolute", bottom: compact ? 8 : 16, display: "flex", gap: "4px" }}>
        {Array.from({ length: totalSlides }).map((_, i) => (
          <Box key={i} sx={{ width: i === slideNum - 1 ? compact ? 12 : 18 : compact ? 4 : 6, height: compact ? 3 : 4, borderRadius: "999px", bgcolor: i === slideNum - 1 ? accentColor : "rgba(255,255,255,0.3)" }} />
        ))}
      </Box>
    </Box>
  );
}

// ─── Main Renderer ────────────────────────────────────────────────────────────

export default function CarouselSlideRenderer({
  slide,
  slideNum,
  totalSlides,
  compact = false,
}: {
  slide: CarouselSlide;
  slideNum: number;
  totalSlides: number;
  compact?: boolean;
}) {
  const style: CarouselSlideStyle = { ...DEFAULT_SLIDE_STYLE, ...(slide.style ?? {}) };

  const props = { slide, slideNum, totalSlides, style, compact };

  switch (style.layout) {
    case "overlay": return <OverlayLayout {...props} />;
    case "split":   return <SplitLayout {...props} />;
    case "minimal": return <MinimalLayout {...props} />;
    case "stat":    return <StatLayout {...props} />;
    default:        return <BoldLayout {...props} />;
  }
}
