"use client";

import { useEffect, useState } from "react";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import ChatBubbleOutlinedIcon from "@mui/icons-material/ChatBubbleOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HomeIcon from "@mui/icons-material/Home";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import PublicIcon from "@mui/icons-material/Public";
import RepeatOutlinedIcon from "@mui/icons-material/RepeatOutlined";
import SearchIcon from "@mui/icons-material/Search";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import SmartDisplayOutlinedIcon from "@mui/icons-material/SmartDisplayOutlined";
import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import { Avatar, Box, Divider, Stack, Typography } from "@mui/material";

import CarouselSlideRenderer from "@/components/social-media/content-studio/CarouselSlideRenderer";
import type { CarouselSlide, SocialPlatform } from "@/types/social-media.types";
export type PreviewAccount = {
  accountName?: string | null;
  accountPictureUrl?: string | null;
  handle?: string | null;
};

type PlatformPreviewProps = {
  platform: SocialPlatform;
  caption: string;
  hashtags: string[];
  imageUrl?: string | null;
  videoUrl?: string | null;
  brandName?: string;
  account?: PreviewAccount | null;
  slides?: CarouselSlide[];
  pollOptions?: string[];
};

function resolveIdentity(platform: SocialPlatform, brandName: string, account?: PreviewAccount | null) {
  const rawName = (account?.accountName || brandName || "Your Brand").trim();
  const displayName = rawName.replace(/^@/, "") || "Your Brand";
  const explicitHandle = (account?.handle || "").trim().replace(/^@/, "");
  const fromName = rawName.startsWith("@")
    ? rawName.slice(1)
    : displayName.toLowerCase().replace(/[^a-z0-9_]+/g, "") || "yourbrand";
  const handle = explicitHandle || fromName;
  const pictureUrl = account?.accountPictureUrl || null;
  const initial = (displayName[0] || "Y").toUpperCase();
  return { displayName, handle, pictureUrl, initial };
}

// ─── Shared: Paper plane (send/share) SVG ────────────────────────────────────

function PaperPlane({ size = 22, color = "#262626" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function HeartOutline({ size = 22, color = "#262626", filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentBubble({ size = 22, color = "#262626" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function BookmarkOutline({ size = 22, color = "#262626" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// ─── Film frame icon (Instagram Reels) ───────────────────────────────────────
function FilmFrame({ size = 22, color = "#262626" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="17" x2="22" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
    </svg>
  );
}

// ─── LinkedIn "in" badge ─────────────────────────────────────────────────────
function LinkedInBadge() {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 14, height: 14, bgcolor: "#0A66C2", borderRadius: "2px",
        fontSize: "0.5rem", fontWeight: 800, color: "#fff",
        fontFamily: "Georgia, serif", letterSpacing: "-0.02em",
        flexShrink: 0, ml: 0.25,
      }}
    >
      in
    </Box>
  );
}

// ─── LinkedIn Preview ─────────────────────────────────────────────────────────

function LinkedInPreview({ caption, hashtags, imageUrl, videoUrl, displayName, handle, pictureUrl, initial, slides, pollOptions }: {
  caption: string; hashtags: string[];
  imageUrl?: string | null; videoUrl?: string | null;
  displayName: string; handle: string; pictureUrl: string | null; initial: string;
  slides?: CarouselSlide[]; pollOptions?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const tags = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  const body = [caption, tags].filter(Boolean).join("\n\n");
  const SHORT = 180;
  const isLong = body.length > SHORT;
  const displayed = !expanded && isLong ? body.slice(0, SHORT) + "…" : body;
  const headline = `${displayName.split(" ")[0]}'s Page · Brand`;

  return (
    <Box sx={{ bgcolor: "#f3f2ef", minHeight: "100%", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>

      {/* ── App header ── */}
      <Box sx={{ bgcolor: "#fff", px: 1.5, pt: 1.25, pb: 0.5, borderBottom: "1px solid #e0e0e0", position: "sticky", top: 0, zIndex: 10 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.875 }}>
          {/* Profile avatar */}
          <Avatar src={pictureUrl || undefined} sx={{ width: 30, height: 30, bgcolor: "#0A66C2", fontSize: "0.7rem", flexShrink: 0 }}>{initial}</Avatar>
          {/* Search pill */}
          <Box sx={{ flex: 1, height: 32, bgcolor: "#eef3f8", borderRadius: "4px", display: "flex", alignItems: "center", px: 1.25, gap: 0.75 }}>
            <SearchIcon sx={{ fontSize: 16, color: "#56687a" }} />
            <Typography sx={{ fontSize: "0.8125rem", color: "#56687a" }}>Search</Typography>
          </Box>
          {/* Messaging */}
          <Box sx={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#56687a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="8.5" cy="11" r="0.8" fill="#56687a" />
              <circle cx="12" cy="11" r="0.8" fill="#56687a" />
              <circle cx="15.5" cy="11" r="0.8" fill="#56687a" />
            </svg>
          </Box>
        </Box>

        {/* Nav tabs */}
        <Box sx={{ display: "flex" }}>
          {[
            { label: "Home", active: true, icon: <HomeIcon sx={{ fontSize: 22, color: "#000" }} />, inactiveIcon: <HomeOutlinedIcon sx={{ fontSize: 22, color: "#56687a" }} /> },
            { label: "My Network", icon: <PeopleAltOutlinedIcon sx={{ fontSize: 22, color: "#56687a" }} /> },
            { label: "Post", icon: <AddCircleOutlineIcon sx={{ fontSize: 22, color: "#56687a" }} /> },
            { label: "Notifications", icon: <NotificationsNoneOutlinedIcon sx={{ fontSize: 22, color: "#56687a" }} /> },
            { label: "Jobs", icon: <BusinessCenterOutlinedIcon sx={{ fontSize: 22, color: "#56687a" }} /> },
          ].map(({ label, active, icon, inactiveIcon }) => (
            <Box key={label} sx={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", pb: 0.5,
              borderBottom: active ? "2px solid #000" : "2px solid transparent",
            }}>
              {active ? (icon) : (inactiveIcon ?? icon)}
              <Typography sx={{ fontSize: "0.5rem", color: active ? "#000" : "#56687a", mt: 0.125, fontWeight: active ? 600 : 400, lineHeight: 1.2, textAlign: "center" }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Post card ── */}
      <Box sx={{ bgcolor: "#fff", borderTop: "1px solid #e0e0e0", borderBottom: "1px solid #e0e0e0", mt: 1 }}>

        {/* Author */}
        <Stack direction="row" sx={{ px: 1.5, pt: 1.5, pb: 0.75, alignItems: "flex-start" }} spacing={1.25}>
          <Avatar src={pictureUrl || undefined} sx={{ width: 44, height: 44, bgcolor: "#0A66C2", fontSize: "1rem", flexShrink: 0 }}>{initial}</Avatar>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.375 }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#000", lineHeight: 1.3 }}>{displayName}</Typography>
              <LinkedInBadge />
              <Typography sx={{ fontSize: "0.875rem", color: "#56687a" }}>· 1st</Typography>
            </Box>
            <Typography sx={{ fontSize: "0.75rem", color: "#56687a", lineHeight: 1.4, mt: 0.125 }}>{headline}</Typography>
            <Typography sx={{ fontSize: "0.6875rem", color: "#0A66C2", fontWeight: 500, mt: 0.125 }}>View my services</Typography>
            <Stack direction="row" spacing={0.375} sx={{ alignItems: "center", mt: 0.25 }}>
              <Typography sx={{ fontSize: "0.6875rem", color: "#56687a" }}>1h · Edited ·</Typography>
              <PublicIcon sx={{ fontSize: 11, color: "#56687a" }} />
            </Stack>
          </Box>
          <MoreHorizIcon sx={{ fontSize: 20, color: "#56687a", flexShrink: 0, mt: 0.25 }} />
        </Stack>

        {/* Caption */}
        <Box sx={{ px: 1.5, pb: 1 }}>
          <Typography sx={{ fontSize: "0.9375rem", color: "#000", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {displayed || <span style={{ color: "#aaa" }}>Your LinkedIn post will appear here…</span>}
            {isLong && !expanded && (
              <Box component="span" onClick={() => setExpanded(true)} sx={{ color: "#56687a", cursor: "pointer", fontWeight: 500 }}> …more</Box>
            )}
          </Typography>
        </Box>

        {/* Carousel — uses CarouselSlideRenderer for styled slides */}
        {slides && slides.length > 0 ? (
          <Box sx={{ bgcolor: "#f3f2ef" }}>
            <Box sx={{ aspectRatio: "4/3", overflow: "hidden" }}>
              <CarouselSlideRenderer
                slide={slides[activeSlide] ?? slides[0]}
                slideNum={activeSlide + 1}
                totalSlides={slides.length}
                compact
              />
            </Box>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 2, py: 0.75 }}>
              <Typography sx={{ fontSize: "0.6875rem", color: "#56687a" }}>{activeSlide + 1} / {slides.length}</Typography>
              <Stack direction="row" spacing={0.5}>
                {slides.map((_, i) => (
                  <Box key={i} onClick={() => setActiveSlide(i)} sx={{ width: i === activeSlide ? 14 : 5, height: 5, borderRadius: "999px", bgcolor: i === activeSlide ? "#0A66C2" : "#aaa", cursor: "pointer", transition: "all 0.15s" }} />
                ))}
              </Stack>
              <Box />
            </Stack>
          </Box>
        ) : videoUrl ? (
          <video src={videoUrl} controls style={{ width: "100%", display: "block", maxHeight: 200 }} />
        ) : imageUrl ? (
          <Box component="img" src={imageUrl} alt="" sx={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
        ) : null}

        {/* Poll */}
        {pollOptions && pollOptions.length > 0 && (
          <Box sx={{ px: 1.5, pb: 1, pt: 0.5 }}>
            <Stack spacing={0.625}>
              {pollOptions.filter(Boolean).map((opt, i) => (
                <Box key={i} sx={{ position: "relative", height: 36, borderRadius: "4px", overflow: "hidden", border: "1px solid #0A66C2" }}>
                  <Box sx={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${[42, 28, 18, 12][i] ?? 10}%`, bgcolor: "rgba(10,102,194,0.1)" }} />
                  <Box sx={{ position: "relative", px: 1.5, height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography sx={{ fontSize: "0.8125rem", color: "#0A66C2", fontWeight: 500 }}>{opt}</Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "#0A66C2", fontWeight: 600 }}>{[42, 28, 18, 12][i] ?? 10}%</Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
            <Typography sx={{ fontSize: "0.6875rem", color: "#56687a", mt: 0.75 }}>247 votes · 2 days left</Typography>
          </Box>
        )}

        {/* Reactions */}
        <Box sx={{ px: 1.5, pt: 1, pb: 0.25 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Stack direction="row" spacing={0} sx={{ alignItems: "center" }}>
              {["❤️", "💡", "👏"].map((e, i) => (
                <Box key={i} component="span" sx={{ fontSize: "0.875rem", ml: i > 0 ? "-3px" : 0 }}>{e}</Box>
              ))}
              <Typography sx={{ fontSize: "0.8125rem", color: "#56687a", ml: 0.75 }}>34</Typography>
            </Stack>
            <Typography sx={{ fontSize: "0.8125rem", color: "#56687a" }}>4 comments · 2 reposts</Typography>
          </Stack>
        </Box>

        <Divider sx={{ mx: 1.5, my: 0.375 }} />

        {/* Action bar — avatar+dropdown THEN actions */}
        <Stack direction="row" sx={{ px: 1, pb: 0.625, alignItems: "center" }}>
          {/* Small avatar + dropdown (reaction picker) */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.125, pr: 1, mr: 0.5, borderRight: "1px solid #e0e0e0" }}>
            <Avatar src={pictureUrl || undefined} sx={{ width: 22, height: 22, bgcolor: "#0A66C2", fontSize: "0.55rem" }}>{initial}</Avatar>
            <Box sx={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid #56687a", ml: 0.25 }} />
          </Box>
          {[
            { icon: <ThumbUpOutlinedIcon sx={{ fontSize: 18 }} />, label: "Like" },
            { icon: <ChatBubbleOutlinedIcon sx={{ fontSize: 18 }} />, label: "Comment" },
            { icon: <RepeatOutlinedIcon sx={{ fontSize: 18 }} />, label: "Repost" },
            { icon: <SendOutlinedIcon sx={{ fontSize: 18 }} />, label: "Send" },
          ].map(({ icon, label }) => (
            <Box key={label} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.125, py: 0.625, borderRadius: "4px", cursor: "pointer", color: "#56687a", "&:hover": { bgcolor: "#f3f2ef" } }}>
              {icon}
              <Typography sx={{ fontSize: "0.5625rem", fontWeight: 600 }}>{label}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

// ─── Instagram Preview ────────────────────────────────────────────────────────

// Exact Instagram gradient: yellow→orange→pink→purple→blue
const IG_STORY_GRADIENT = "linear-gradient(45deg,#F58529 0%,#DD2A7B 50%,#8134AF 75%,#515BD4 100%)";

function InstagramPreview({ caption, hashtags, imageUrl, videoUrl, displayName, handle, pictureUrl, initial, slides, pollOptions }: {
  caption: string; hashtags: string[];
  imageUrl?: string | null; videoUrl?: string | null;
  displayName: string; handle: string; pictureUrl: string | null; initial: string;
  slides?: CarouselSlide[]; pollOptions?: string[];
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // Inject Google Fonts "Dancing Script" for the Instagram wordmark
  useEffect(() => {
    const id = "ig-wordmark-font";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap";
      document.head.appendChild(link);
    }
  }, []);
  const tags = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  const SHORT = 90;
  const isLong = caption.length > SHORT;
  const displayedCaption = !expanded && isLong ? caption.slice(0, SHORT) + "…" : caption;

  return (
    <Box sx={{ bgcolor: "#fff", minHeight: "100%", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* ── App header ── */}
      <Box sx={{ bgcolor: "#fff", px: 1.5, py: 1, borderBottom: "1px solid #dbdbdb", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center" }}>
        {/* Instagram wordmark — Dancing Script from Google Fonts */}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{
            fontFamily: "'Dancing Script', 'Billabong', cursive",
            fontSize: "1.625rem",
            fontWeight: 600,
            color: "#000",
            lineHeight: 1,
            letterSpacing: "-0.01em",
          }}>
            Instagram
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.75} sx={{ alignItems: "center" }}>
          {/* Heart outline */}
          <HeartOutline size={24} color="#000" />
          {/* Messenger icon with badge */}
          <Box sx={{ position: "relative" }}>
            <PaperPlane size={24} color="#000" />
            <Box sx={{ position: "absolute", top: -3, right: -4, width: 8, height: 8, bgcolor: "#e1306c", borderRadius: "50%", border: "1.5px solid #fff" }} />
          </Box>
        </Stack>
      </Box>

      {/* ── Stories ── */}
      <Box sx={{ px: 1, py: 1, borderBottom: "1px solid #dbdbdb", display: "flex", gap: 1.5, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" } }}>
        {/* Your story */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.375, flexShrink: 0 }}>
          <Box sx={{ position: "relative", width: 60, height: 60 }}>
            <Avatar src={pictureUrl || undefined} sx={{ width: 60, height: 60, bgcolor: "#dbdbdb", border: "1px solid #dbdbdb", fontSize: "1.2rem" }}>
              {pictureUrl ? initial : null}
            </Avatar>
            {/* Blue + badge */}
            <Box sx={{ position: "absolute", bottom: 0, right: 0, width: 18, height: 18, bgcolor: "#0095f6", borderRadius: "50%", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography sx={{ fontSize: "0.625rem", color: "#fff", fontWeight: 700, lineHeight: 1 }}>+</Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: "0.5625rem", color: "#262626", textAlign: "center", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>your story</Typography>
        </Box>

        {/* Other stories */}
        {[handle.slice(0, 8), "alex_k", "sarah.m"].map((name, i) => (
          <Box key={i} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.375, flexShrink: 0 }}>
            <Box sx={{ width: 62, height: 62, borderRadius: "50%", background: IG_STORY_GRADIENT, p: "2px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Avatar sx={{ width: 56, height: 56, bgcolor: ["#C7B8EA", "#B8D8EA", "#EAD4B8"][i], border: "3px solid #fff", fontSize: "1rem" }}>
                {name[0].toUpperCase()}
              </Avatar>
            </Box>
            <Typography sx={{ fontSize: "0.5625rem", color: "#262626", maxWidth: 62, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</Typography>
          </Box>
        ))}
      </Box>

      {/* ── Post ── */}
      {/* Post header */}
      <Stack direction="row" sx={{ px: 1.25, py: 0.875, alignItems: "center" }} spacing={1.25}>
        <Box sx={{ width: 36, height: 36, borderRadius: "50%", background: IG_STORY_GRADIENT, p: "2px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Avatar src={pictureUrl || undefined} sx={{ width: 30, height: 30, fontSize: "0.7rem", border: "2px solid #fff" }}>{initial}</Avatar>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.8125rem", color: "#262626" }}>{handle}</Typography>
        </Box>
        <MoreHorizIcon sx={{ fontSize: 20, color: "#262626" }} />
      </Stack>

      {/* Media */}
      {slides && slides.length > 0 ? (
        <Box sx={{ position: "relative", aspectRatio: "1/1", bgcolor: "#f0f0f0", overflow: "hidden" }}>
          <CarouselSlideRenderer
            slide={slides[activeSlide] ?? slides[0]}
            slideNum={activeSlide + 1}
            totalSlides={slides.length}
            compact
          />
          {slides.length > 1 && (
            <>
              <Box sx={{ position: "absolute", top: 10, right: 10, bgcolor: "rgba(0,0,0,0.5)", borderRadius: "10px", px: 1, py: 0.25 }}>
                <Typography sx={{ color: "#fff", fontSize: "0.6875rem", fontWeight: 600 }}>{activeSlide + 1}/{slides.length}</Typography>
              </Box>
              <Stack direction="row" sx={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)" }} spacing={0.5}>
                {slides.map((_, i) => (
                  <Box key={i} onClick={() => setActiveSlide(i)} sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: i === activeSlide ? "#3897f0" : "rgba(255,255,255,0.7)", cursor: "pointer" }} />
                ))}
              </Stack>
            </>
          )}
        </Box>
      ) : videoUrl ? (
        <Box sx={{ aspectRatio: "1/1", bgcolor: "#000", overflow: "hidden" }}>
          <video src={videoUrl} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </Box>
      ) : imageUrl ? (
        <Box sx={{ aspectRatio: "1/1", overflow: "hidden" }}>
          <Box component="img" src={imageUrl} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </Box>
      ) : (
        <Box sx={{ aspectRatio: "1/1", bgcolor: "#efefef" }} />
      )}

      {/* Poll sticker */}
      {pollOptions && pollOptions.length >= 2 && (
        <Box sx={{ mx: 1.25, my: 0.75, bgcolor: "#f2f2f2", borderRadius: "12px", p: 1.25 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.8125rem", color: "#262626", mb: 0.875 }}>📊 Poll</Typography>
          <Stack spacing={0.625}>
            {pollOptions.slice(0, 4).filter(Boolean).map((opt, i) => (
              <Box key={i} sx={{ height: 32, bgcolor: "#fff", borderRadius: "8px", border: "1px solid #dbdbdb", display: "flex", alignItems: "center", px: 1.25 }}>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500 }}>{opt}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Actions */}
      <Box sx={{ px: 1.25, pt: 0.75, pb: 0.25 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <HeartOutline size={24} color="#ed4956" filled />
            <CommentBubble size={24} />
            <PaperPlane size={22} />
          </Stack>
          <BookmarkOutline size={24} />
        </Stack>
      </Box>

      <Box sx={{ px: 1.25, pt: 0.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: "#262626" }}>10,547 likes</Typography>
      </Box>

      <Box sx={{ px: 1.25, pb: 0.625, pt: 0.25 }}>
        <Typography sx={{ fontSize: "0.875rem", color: "#262626", lineHeight: 1.5 }}>
          <Box component="span" sx={{ fontWeight: 700, mr: 0.5 }}>{handle}</Box>
          {displayedCaption || <span style={{ color: "#8e8e8e" }}>Your caption…</span>}
          {isLong && !expanded && (
            <Box component="span" onClick={() => setExpanded(true)} sx={{ color: "#8e8e8e", cursor: "pointer", ml: 0.5 }}>more</Box>
          )}
        </Typography>
        {tags && <Typography sx={{ fontSize: "0.875rem", color: "#00376b", mt: 0.375 }}>{tags}</Typography>}
        <Typography sx={{ fontSize: "0.8125rem", color: "#8e8e8e", mt: 0.375 }}>View all 38 comments</Typography>
        <Typography sx={{ fontSize: "0.6875rem", color: "#c7c7c7", mt: 0.25, textTransform: "uppercase", letterSpacing: "0.03em" }}>Just now</Typography>
      </Box>

      {/* ── Bottom nav ── */}
      <Box sx={{ borderTop: "1px solid #dbdbdb", display: "flex" }}>
        {[
          { icon: <HomeIcon sx={{ fontSize: 26 }} /> },
          { icon: <SearchIcon sx={{ fontSize: 26 }} /> },
          { icon: (
            <Box sx={{ width: 26, height: 26, border: "1.8px solid #262626", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Box component="span" sx={{ fontSize: "1rem", fontWeight: 300, lineHeight: 1, color: "#262626" }}>+</Box>
            </Box>
          )},
          { icon: <FilmFrame size={26} color="#262626" /> },
          { icon: <PersonOutlinedIcon sx={{ fontSize: 26 }} /> },
        ].map(({ icon }, i) => (
          <Box key={i} sx={{ flex: 1, py: 1, display: "flex", alignItems: "center", justifyContent: "center", color: i === 0 ? "#000" : "#262626" }}>
            {icon}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ─── X (Twitter) Preview ──────────────────────────────────────────────────────

function XPreview({ caption, hashtags, imageUrl, videoUrl, displayName, handle, pictureUrl, initial, pollOptions }: {
  caption: string; hashtags: string[];
  imageUrl?: string | null; videoUrl?: string | null;
  displayName: string; handle: string; pictureUrl: string | null; initial: string;
  pollOptions?: string[];
}) {
  const tags = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  const parts = caption.split(/\n\n+/).filter(Boolean);
  const isThread = parts.length > 1;

  const TweetActions = ({ small = false }: { small?: boolean }) => (
    <Stack direction="row" sx={{ justifyContent: "space-between", mt: small ? 1 : 1.5 }}>
      {[
        { icon: <ChatBubbleOutlinedIcon sx={{ fontSize: small ? 15 : 18 }} />, count: small ? "4" : "38" },
        { icon: <RepeatOutlinedIcon sx={{ fontSize: small ? 15 : 18 }} />, count: small ? "31" : "247" },
        { icon: <HeartOutline size={small ? 15 : 18} color="#536471" />, count: small ? "89" : "1.2K" },
        { icon: <BarChartOutlinedIcon sx={{ fontSize: small ? 15 : 18 }} />, count: "12K" },
      ].map(({ icon, count }, i) => (
        <Stack key={i} direction="row" spacing={0.375} sx={{ alignItems: "center", color: "#536471" }}>
          {icon}
          <Typography sx={{ fontSize: small ? "0.6875rem" : "0.8125rem", color: "#536471" }}>{count}</Typography>
        </Stack>
      ))}
      <Box sx={{ color: "#536471" }}><BookmarkOutline size={small ? 15 : 17} color="#536471" /></Box>
      <Box sx={{ color: "#536471" }}><PaperPlane size={small ? 14 : 16} color="#536471" /></Box>
    </Stack>
  );

  return (
    <Box sx={{ bgcolor: "#fff", minHeight: "100%", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* ── X header ── */}
      <Box sx={{ bgcolor: "#fff", px: 1.5, pt: 1.25, pb: 0.875, borderBottom: "1px solid #eff3f4", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 1.25 }}>
        <Avatar src={pictureUrl || undefined} sx={{ width: 30, height: 30, bgcolor: "#1d9bf0", fontSize: "0.65rem", flexShrink: 0 }}>{initial}</Avatar>
        <Box sx={{ flex: 1, height: 30, bgcolor: "#eff3f4", borderRadius: "999px", display: "flex", alignItems: "center", px: 1.25, gap: 0.75 }}>
          <SearchIcon sx={{ fontSize: 14, color: "#536471" }} />
          <Typography sx={{ fontSize: "0.8125rem", color: "#536471" }}>Search X</Typography>
        </Box>
        <Box sx={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="#000">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ display: "flex", borderBottom: "1px solid #eff3f4" }}>
        {["For you", "Following"].map((tab, i) => (
          <Box key={tab} sx={{ flex: 1, py: 0.875, textAlign: "center", borderBottom: i === 0 ? "2px solid #1d9bf0" : "2px solid transparent" }}>
            <Typography sx={{ fontSize: "0.9375rem", fontWeight: i === 0 ? 700 : 400, color: i === 0 ? "#0f1419" : "#536471" }}>{tab}</Typography>
          </Box>
        ))}
      </Box>

      {/* Thread or single */}
      {isThread ? (
        parts.map((part, idx) => (
          <Box key={idx} sx={{ display: "flex", gap: 1.25, px: 1.5, pt: 1.25, pb: idx < parts.length - 1 ? 0 : 1.25, borderBottom: idx === parts.length - 1 ? "1px solid #eff3f4" : "none" }}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Avatar src={pictureUrl || undefined} sx={{ width: 38, height: 38, bgcolor: "#1d9bf0", fontSize: "0.875rem", flexShrink: 0 }}>{initial}</Avatar>
              {idx < parts.length - 1 && <Box sx={{ width: 2, flex: 1, minHeight: 16, bgcolor: "#cfd9de", mt: 0.375, mb: 0 }} />}
            </Box>
            <Box sx={{ flex: 1, pb: idx < parts.length - 1 ? 1.5 : 0 }}>
              <Stack direction="row" spacing={0.375} sx={{ alignItems: "center", mb: 0.25 }}>
                <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f1419" }}>{displayName}</Typography>
                <Box component="span" sx={{ color: "#1d9bf0", fontSize: "0.8125rem" }}>✓</Box>
                <Typography sx={{ color: "#536471", fontSize: "0.875rem" }}>@{handle}</Typography>
              </Stack>
              <Typography sx={{ fontSize: "0.9375rem", color: "#0f1419", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {part}
                {idx === parts.length - 1 && tags && <Box component="span" sx={{ color: "#1d9bf0" }}> {tags}</Box>}
              </Typography>
              <TweetActions small />
            </Box>
          </Box>
        ))
      ) : (
        <Box sx={{ display: "flex", gap: 1.25, px: 1.5, py: 1.25, borderBottom: "1px solid #eff3f4" }}>
          <Avatar src={pictureUrl || undefined} sx={{ width: 40, height: 40, bgcolor: "#1d9bf0", fontSize: "0.9rem", flexShrink: 0 }}>{initial}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.375} sx={{ alignItems: "center", mb: 0.25 }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f1419" }}>{displayName}</Typography>
              <Box component="span" sx={{ color: "#1d9bf0", fontSize: "0.875rem" }}>✓</Box>
              <Typography sx={{ color: "#536471", fontSize: "0.875rem", flexShrink: 0 }}>@{handle} · now</Typography>
            </Stack>
            <Typography sx={{ fontSize: "0.9375rem", color: "#0f1419", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {caption || <span style={{ color: "#aaa" }}>Your post will appear here.</span>}
              {tags && <Box component="span" sx={{ color: "#1d9bf0" }}> {tags}</Box>}
            </Typography>
            {pollOptions && pollOptions.length >= 2 && (
              <Box sx={{ mt: 1.25, border: "1px solid #cfd9de", borderRadius: "12px", overflow: "hidden" }}>
                {pollOptions.slice(0, 4).filter(Boolean).map((opt, i) => (
                  <Box key={i} sx={{ px: 2, py: 1, borderBottom: i < pollOptions.length - 1 ? "1px solid #cfd9de" : "none", display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #1d9bf0", flexShrink: 0 }} />
                    <Typography sx={{ fontSize: "0.9375rem", color: "#0f1419" }}>{opt}</Typography>
                  </Box>
                ))}
                <Box sx={{ px: 2, py: 0.75, bgcolor: "#f7f9f9" }}>
                  <Typography sx={{ fontSize: "0.8125rem", color: "#536471" }}>247 votes · 2 days left</Typography>
                </Box>
              </Box>
            )}
            {(imageUrl || videoUrl) && (
              <Box sx={{ mt: 1.5, borderRadius: "12px", overflow: "hidden", border: "1px solid #eff3f4" }}>
                {videoUrl ? <video src={videoUrl} controls style={{ width: "100%", maxHeight: 180, objectFit: "cover" }} />
                  : <Box component="img" src={imageUrl!} alt="" sx={{ width: "100%", maxHeight: 180, objectFit: "cover", display: "block" }} />}
              </Box>
            )}
            <TweetActions />
          </Box>
        </Box>
      )}

      {/* Bottom nav */}
      <Box sx={{ borderTop: "1px solid #eff3f4", display: "flex", bgcolor: "#fff" }}>
        {[
          { icon: <HomeIcon sx={{ fontSize: 24 }} /> },
          { icon: <SearchIcon sx={{ fontSize: 24 }} /> },
          { icon: <NotificationsNoneOutlinedIcon sx={{ fontSize: 24 }} /> },
          { icon: <PaperPlane size={22} color="#536471" /> },
        ].map(({ icon }, i) => (
          <Box key={i} sx={{ flex: 1, py: 0.875, display: "flex", alignItems: "center", justifyContent: "center", color: i === 0 ? "#000" : "#536471" }}>
            {icon}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ─── Facebook Preview ─────────────────────────────────────────────────────────

function ShareArrow({ size = 20, color = "#65676B" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function FacebookPreview({ caption, hashtags, imageUrl, videoUrl, displayName, handle, pictureUrl, initial, pollOptions, slides }: {
  caption: string; hashtags: string[];
  imageUrl?: string | null; videoUrl?: string | null;
  displayName: string; handle: string; pictureUrl: string | null; initial: string;
  pollOptions?: string[]; slides?: CarouselSlide[];
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const tags = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  const body = [caption, tags].filter(Boolean).join("\n\n");
  const SHORT = 180;
  const isLong = body.length > SHORT;
  const displayed = !expanded && isLong ? body.slice(0, SHORT) + "…" : body;

  return (
    <Box sx={{ bgcolor: "#F0F2F5", minHeight: "100%", fontFamily: "Helvetica,Arial,sans-serif" }}>

      {/* ── App header ── */}
      <Box sx={{ bgcolor: "#fff", px: 1.5, pt: 0.875, pb: 0, borderBottom: "1px solid #CED0D4", position: "sticky", top: 0, zIndex: 10 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.625 }}>
          <Typography sx={{ fontSize: "1.375rem", fontWeight: 900, color: "#1877F2", letterSpacing: "-0.03em", fontFamily: "Helvetica,Arial,sans-serif" }}>
            facebook
          </Typography>
          <Stack direction="row" spacing={1}>
            <Box sx={{ width: 34, height: 34, bgcolor: "#E4E6EB", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <SearchIcon sx={{ fontSize: 18, color: "#050505" }} />
            </Box>
            <Box sx={{ width: 34, height: 34, bgcolor: "#E4E6EB", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#050505">
                <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z"/>
              </svg>
            </Box>
          </Stack>
        </Box>

        {/* Nav tabs */}
        <Box sx={{ display: "flex" }}>
          {[
            { icon: <HomeIcon sx={{ fontSize: 24, color: "#1877F2" }} />, active: true },
            { icon: <GroupsOutlinedIcon sx={{ fontSize: 24, color: "#606770" }} /> },
            { icon: <SmartDisplayOutlinedIcon sx={{ fontSize: 24, color: "#606770" }} /> },
            { icon: <PersonOutlinedIcon sx={{ fontSize: 24, color: "#606770" }} /> },
            { icon: <NotificationsNoneOutlinedIcon sx={{ fontSize: 24, color: "#606770" }} /> },
            { icon: <MenuIcon sx={{ fontSize: 24, color: "#606770" }} /> },
          ].map(({ icon, active }, i) => (
            <Box key={i} sx={{
              flex: 1, py: 0.625, display: "flex", alignItems: "center", justifyContent: "center",
              borderBottom: active ? "2.5px solid #1877F2" : "2.5px solid transparent",
            }}>
              {icon}
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Post card ── */}
      <Box sx={{ bgcolor: "#fff", borderBottom: "8px solid #F0F2F5", mt: 1 }}>

        {/* Author */}
        <Stack direction="row" sx={{ px: 1.5, pt: 1.25, pb: 0.75, alignItems: "center" }} spacing={1.25}>
          <Avatar src={pictureUrl || undefined} sx={{ width: 38, height: 38, bgcolor: "#1877F2", fontSize: "0.875rem", flexShrink: 0 }}>{initial}</Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "#050505", lineHeight: 1.3 }}>{displayName}</Typography>
            <Stack direction="row" spacing={0.375} sx={{ alignItems: "center" }}>
              <Typography sx={{ fontSize: "0.6875rem", color: "#65676B" }}>1h ·</Typography>
              <PublicIcon sx={{ fontSize: 11, color: "#65676B" }} />
            </Stack>
          </Box>
          <MoreHorizIcon sx={{ fontSize: 20, color: "#65676B" }} />
        </Stack>

        {/* Body */}
        <Box sx={{ px: 1.5, pb: 0.875 }}>
          <Typography sx={{ fontSize: "0.9375rem", color: "#050505", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {displayed || <span style={{ color: "#aaa" }}>Your Facebook post will appear here…</span>}
            {isLong && !expanded && (
              <Box component="span" onClick={() => setExpanded(true)} sx={{ color: "#1877F2", cursor: "pointer", fontWeight: 500 }}> See more</Box>
            )}
          </Typography>
        </Box>

        {/* Carousel */}
        {slides && slides.length > 0 ? (
          <Box>
            <Box sx={{ position: "relative", aspectRatio: "1.91/1", overflow: "hidden", bgcolor: "#e0e0e0" }}>
              <CarouselSlideRenderer
                slide={slides[activeSlide] ?? slides[0]}
                slideNum={activeSlide + 1}
                totalSlides={slides.length}
                compact
              />
              {slides.length > 1 && (
                <Box sx={{ position: "absolute", top: 8, right: 8, bgcolor: "rgba(0,0,0,0.5)", borderRadius: "4px", px: 0.75, py: 0.25 }}>
                  <Typography sx={{ color: "#fff", fontSize: "0.6875rem", fontWeight: 600 }}>{activeSlide + 1}/{slides.length}</Typography>
                </Box>
              )}
            </Box>
            {slides.length > 1 && (
              <Stack direction="row" sx={{ justifyContent: "center", pt: 0.75 }} spacing={0.5}>
                {slides.map((_, i) => (
                  <Box key={i} onClick={() => setActiveSlide(i)} sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: i === activeSlide ? "#1877F2" : "#CED0D4", cursor: "pointer" }} />
                ))}
              </Stack>
            )}
          </Box>
        ) : videoUrl ? (
          <video src={videoUrl} controls style={{ width: "100%", display: "block" }} />
        ) : imageUrl ? (
          <Box component="img" src={imageUrl} alt="" sx={{ width: "100%", objectFit: "cover", display: "block" }} />
        ) : null}

        {/* Poll */}
        {pollOptions && pollOptions.length > 0 && (
          <Box sx={{ px: 1.5, py: 1 }}>
            <Stack spacing={0.75}>
              {pollOptions.filter(Boolean).map((opt, i) => (
                <Box key={i} sx={{ position: "relative", height: 38, borderRadius: "8px", overflow: "hidden", border: "1.5px solid #1877F2" }}>
                  <Box sx={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${[42, 28, 18, 12][i] ?? 10}%`, bgcolor: "rgba(24,119,242,0.12)" }} />
                  <Box sx={{ position: "relative", px: 1.5, height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography sx={{ fontSize: "0.875rem", color: "#1877F2", fontWeight: 600 }}>{opt}</Typography>
                    <Typography sx={{ fontSize: "0.8125rem", color: "#1877F2", fontWeight: 600 }}>{[42, 28, 18, 12][i] ?? 10}%</Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* Engagement */}
        <Box sx={{ px: 1.5, pt: 0.875, pb: 0.375 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
            <Stack direction="row" spacing={0} sx={{ alignItems: "center" }}>
              {["❤️", "😂", "👍"].map((e, i) => (
                <Box key={i} component="span" sx={{ fontSize: "0.875rem", ml: i > 0 ? "-2px" : 0 }}>{e}</Box>
              ))}
              <Typography sx={{ fontSize: "0.8125rem", color: "#65676B", ml: 0.625 }}>247</Typography>
            </Stack>
            <Typography sx={{ fontSize: "0.8125rem", color: "#65676B" }}>100 Comments · 2.8M Views</Typography>
          </Stack>
        </Box>

        <Divider sx={{ mx: 1.5 }} />

        {/* Action buttons — icon + text, no emoji */}
        <Stack direction="row" sx={{ px: 0.5, py: 0.375 }}>
          {[
            { icon: <ThumbUpOutlinedIcon sx={{ fontSize: 18 }} />, label: "Like" },
            { icon: <CommentBubble size={18} color="#65676B" />, label: "Comment" },
            { icon: <ShareArrow size={18} color="#65676B" />, label: "Share" },
          ].map(({ icon, label }) => (
            <Box key={label} sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.625, py: 0.75, borderRadius: "6px", cursor: "pointer", color: "#65676B", "&:hover": { bgcolor: "#F0F2F5" } }}>
              {icon}
              <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600, color: "#65676B" }}>{label}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function PlatformPreview({ platform, caption, hashtags, imageUrl, videoUrl, brandName = "Your Brand", account, slides, pollOptions }: PlatformPreviewProps) {
  const { displayName, handle, pictureUrl, initial } = resolveIdentity(platform, brandName, account);

  switch (platform) {
    case "linkedin":
      return <LinkedInPreview key="linkedin" caption={caption} hashtags={hashtags} imageUrl={imageUrl} videoUrl={videoUrl} displayName={displayName} handle={handle} pictureUrl={pictureUrl} initial={initial} slides={slides} pollOptions={pollOptions} />;
    case "instagram":
      return <InstagramPreview key="instagram" caption={caption} hashtags={hashtags} imageUrl={imageUrl} videoUrl={videoUrl} displayName={displayName} handle={handle} pictureUrl={pictureUrl} initial={initial} slides={slides} pollOptions={pollOptions} />;
    case "x":
      return <XPreview key="x" caption={caption} hashtags={hashtags} imageUrl={imageUrl} videoUrl={videoUrl} displayName={displayName} handle={handle} pictureUrl={pictureUrl} initial={initial} pollOptions={pollOptions} />;
    case "facebook":
    default:
      return <FacebookPreview key="facebook" caption={caption} hashtags={hashtags} imageUrl={imageUrl} videoUrl={videoUrl} displayName={displayName} handle={handle} pictureUrl={pictureUrl} initial={initial} pollOptions={pollOptions} slides={slides} />;
  }
}
