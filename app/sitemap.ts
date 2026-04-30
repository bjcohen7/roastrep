import type { MetadataRoute } from "next";

import { getEnv } from "@/lib/env";

const siteUrl = (getEnv("NEXT_PUBLIC_SITE_URL", "https://roastreport.fun") ?? "https://roastreport.fun").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1
    }
  ];
}
