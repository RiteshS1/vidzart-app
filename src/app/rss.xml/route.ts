import { absoluteUrl, CHANGELOG, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// An RSS 2.0 feed of the changelog, for people who like to follow along.
// Static export: built once at build time into /rss.xml.
export const dynamic = "force-static";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function GET() {
  const items = CHANGELOG.map((entry, i) => {
    const link = `${absoluteUrl("/changelog")}#${entry.date}-${i}`;
    return `    <item>
      <title>${escape(entry.title)}</title>
      <link>${escape(link)}</link>
      <guid isPermaLink="true">${escape(link)}</guid>
      <pubDate>${new Date(`${entry.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${escape(entry.summary)}</description>
    </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(SITE_NAME)} changelog</title>
    <link>${escape(absoluteUrl("/changelog"))}</link>
    <description>${escape(SITE_DESCRIPTION)}</description>
    <language>en</language>
    <lastBuildDate>${new Date(`${CHANGELOG[0]?.date ?? "2026-10-11"}T12:00:00Z`).toUTCString()}</lastBuildDate>
    <atom:link href="${escape(`${SITE_URL}/rss.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
