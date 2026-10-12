import { absoluteUrl, COFFEE_URL, REPO_APP, REPO_EXTENSION, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

// llms.txt (https://llmstxt.org): a short, link-rich Markdown summary of the
// site for AI assistants and crawlers. The long form is /llms-full.txt.
export const dynamic = "force-static";

export function GET() {
  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} has two parts: a web app (recording, editing, export; everything runs in the browser) and an optional Chrome extension that records a tab together with the user's clicks so the editor can zoom in on them automatically. It is free, MIT licensed, and has no accounts, servers or analytics.

## Product

- [Home](${absoluteUrl("/")}): what it does, with a live demo and install steps
- [Record](${absoluteUrl("/record")}): record a tab, window or screen in the browser
- [FAQ](${absoluteUrl("/faq")}): cost, privacy, formats, captions, AI providers
- [Privacy](${absoluteUrl("/privacy")}): what is and isn't stored or sent anywhere
- [Changelog](${absoluteUrl("/changelog")}): release notes (also as [RSS](${absoluteUrl("/rss.xml")}))

## Source

- [Web app (GitHub)](${REPO_APP}): Next.js static site, MIT
- [Chrome extension (GitHub)](${REPO_EXTENSION}): Manifest V3 recorder, MIT

## Optional

- [Full description for LLMs](${absoluteUrl("/llms-full.txt")}): features, formats and constraints in detail
- [Support the project](${COFFEE_URL}): optional donations
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
