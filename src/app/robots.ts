import type { MetadataRoute } from "next";
import { PAGES, SITE_URL } from "@/lib/site";

// Static export: this file is evaluated at build time and written to robots.txt.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // Everyone (search engines and AI crawlers alike) may read the public
    // pages; the app shells hold nothing to index (your projects live in
    // your browser, not on the server).
    rules: [{ userAgent: "*", allow: "/", disallow: PAGES.filter((p) => !p.indexable).map((p) => p.path) }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
