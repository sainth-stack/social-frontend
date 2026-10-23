import type { ImageGenerationTemplate } from "@/types/social-media.types";

export const IMAGE_GENERATION_TEMPLATES: ImageGenerationTemplate[] = [
  {
    id: "img_social_post",
    name: "Social Post",
    category: "Marketing",
    description: "Clean square graphic for LinkedIn, Facebook, and Instagram feeds",
    thumbnailGradient: ["#1e3a5f", "#3b82f6"],
    icon: "CampaignOutlined",
    promptTemplate:
      "Professional social media post graphic for {{topic}}. Modern layout, brand-safe colors, clear focal point, no cluttered text overlays",
    style: "Corporate",
    aspectRatio: "1024x1024",
    platforms: ["linkedin", "facebook", "instagram"],
  },
  {
    id: "img_story",
    name: "Story / Reel Cover",
    category: "Marketing",
    description: "Vertical visual for Instagram Stories and Reels",
    thumbnailGradient: ["#581c87", "#a855f7"],
    icon: "StayCurrentPortraitOutlined",
    promptTemplate:
      "Eye-catching vertical story cover for {{topic}}. Bold headline area, mobile-first composition, vibrant but professional",
    style: "Vivid",
    aspectRatio: "1024x1536",
    platforms: ["instagram", "facebook"],
  },
  {
    id: "img_product_hero",
    name: "Product Hero",
    category: "Sales",
    description: "Landscape hero shot for product launches and demos",
    thumbnailGradient: ["#0f172a", "#475569"],
    icon: "Inventory2Outlined",
    promptTemplate:
      "Premium product hero visual for {{topic}}. Studio lighting, shallow depth of field, commercial photography style",
    style: "Photographic",
    aspectRatio: "1536x1024",
    platforms: ["linkedin", "facebook"],
  },
];

export const IMAGE_TEMPLATE_CATEGORIES = ["All"] as const;
