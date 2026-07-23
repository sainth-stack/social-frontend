export type AuthSlide = {
  id: string;
  title: string;
  subtitle: string;
  illustration: "integrations" | "voice" | "campaigns";
};

export const authSlides: AuthSlide[] = [
  {
    id: "generate",
    title: "Generate on-brand content in seconds.",
    subtitle: "AI writes captions, hashtags, images, and video tailored to your brand voice.",
    illustration: "voice",
  },
  {
    id: "schedule",
    title: "Plan every post on one calendar.",
    subtitle: "Queue content across Facebook, Instagram, LinkedIn, and X with a single click.",
    illustration: "campaigns",
  },
  {
    id: "grow",
    title: "Track what's actually working.",
    subtitle: "Real-time analytics on reach, engagement, and audience growth by platform.",
    illustration: "integrations",
  },
];
