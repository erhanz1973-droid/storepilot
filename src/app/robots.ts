import type { MetadataRoute } from "next";
import { MARKETING_SITE_URL } from "@/lib/marketing/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/internal/"],
    },
    sitemap: `${MARKETING_SITE_URL}/sitemap.xml`,
    host: MARKETING_SITE_URL,
  };
}
