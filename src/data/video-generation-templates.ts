import type { VideoGenerationTemplate } from "@/types/social-media.types";

export const VIDEO_GENERATION_TEMPLATES: VideoGenerationTemplate[] = [
  {
    id: "vid_product_demo",
    name: "Product Demo",
    category: "Sales",
    description: "Landscape showcase with smooth camera motion",
    thumbnailGradient: ["#1e3a5f", "#2563eb"],
    icon: "Inventory2Outlined",
    promptTemplate:
      "Smooth product showcase of {{topic}}, slow rotating camera, soft studio lighting, professional commercial feel",
    size: "1280x720",
    seconds: "12",
    cameraStyle: "Cinematic",
    platforms: ["linkedin", "facebook"],
  },
  {
    id: "vid_social_teaser",
    name: "Social Teaser",
    category: "Marketing",
    description: "Fast vertical clip for Reels and Stories",
    thumbnailGradient: ["#831843", "#db2777"],
    icon: "SmartDisplayOutlined",
    promptTemplate:
      "Fast-paced social teaser for {{topic}}, dynamic motion, energetic mood, space for text overlay",
    size: "720x1280",
    seconds: "8",
    cameraStyle: "Dynamic",
    platforms: ["instagram", "facebook"],
  },
  {
    id: "vid_brand_story",
    name: "Brand Story",
    category: "Brand",
    description: "Cinematic brand narrative for longer-form posts",
    thumbnailGradient: ["#0f172a", "#475569"],
    icon: "MovieOutlined",
    promptTemplate:
      "Cinematic brand story about {{topic}}, premium corporate motion, confident pacing, polished look",
    size: "1280x720",
    seconds: "12",
    cameraStyle: "Cinematic",
    platforms: ["linkedin", "facebook"],
  },
];

export const VIDEO_TEMPLATE_CATEGORIES = ["All"] as const;
