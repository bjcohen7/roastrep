import type { MetadataRoute } from "next";

import { getEnv } from "@/lib/env";

const siteUrl = (getEnv("NEXT_PUBLIC_SITE_URL", "https://roastreport.fun") ?? "https://roastreport.fun").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/"
    },
    sitemap: [`${siteUrl}/sitemap.xml`],
    host: siteUrl.replace(/^https?:\/\//, "")
  };
}
