import type { MetadataRoute } from "next";
import { MARKETING_SITE_URL } from "@/lib/marketing/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes = ["/", "/privacy", "/terms", "/contact"];

  return routes.map((path) => ({
    url: `${MARKETING_SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
