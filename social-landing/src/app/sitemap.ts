import type { MetadataRoute } from "next";
import { legalMeta } from "@/content/legal";
import { SITE_URL } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}${legalMeta.privacyPath}`, changeFrequency: "yearly", priority: 0.3 },
  ];
}