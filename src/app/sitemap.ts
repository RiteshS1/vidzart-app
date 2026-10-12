import type { MetadataRoute } from "next";
import { absoluteUrl, CHANGELOG, PAGES } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const newest = new Date(CHANGELOG[0]?.date ?? Date.now());
  return PAGES.filter((p) => p.indexable).map((p) => ({
    url: absoluteUrl(p.path),
    lastModified: newest,
    changeFrequency: p.path === "/changelog" ? "weekly" : "monthly",
    priority: p.priority,
  }));
}
