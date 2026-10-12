import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { CHANGELOG, FAQ, PAGES, SITE_URL } from "../src/lib/site";

// Search, social and AI-crawler discoverability, checked against the served
// site (dev or the production build): robots, sitemap, feeds, llms.txt,
// manifest, and every public page's head. Canonical URLs are the production
// ones, so comparisons use paths, and fetches go to whatever baseURL serves.

const indexable = PAGES.filter((p) => p.indexable);
const hidden = PAGES.filter((p) => !p.indexable);
const path = (url: string) => new URL(url, SITE_URL).pathname.replace(/\/$/, "") || "/";

async function text(request: APIRequestContext, url: string) {
  const res = await request.get(url);
  expect(res.status(), url).toBe(200);
  return { body: await res.text(), type: res.headers()["content-type"] ?? "" };
}

test("robots.txt: allows the public site, hides the app shells, points at the sitemap", async ({ request }) => {
  const { body } = await text(request, "/robots.txt");
  expect(body).toMatch(/^User-Agent: \*$/im);
  expect(body).toMatch(/^Allow: \/$/m);
  for (const page of hidden) expect(body).toContain(`Disallow: ${page.path}`);
  for (const page of indexable.filter((p) => p.path !== "/")) expect(body).not.toContain(`Disallow: ${page.path}`);
  expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
});

test("sitemap.xml lists exactly the indexable pages, and each one exists", async ({ request }) => {
  const { body } = await text(request, "/sitemap.xml");
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  expect(locs.map(path).sort()).toEqual(indexable.map((p) => p.path).sort());
  for (const loc of locs) expect(loc.startsWith(SITE_URL)).toBe(true);
  for (const loc of locs) expect((await request.get(path(loc))).status(), loc).toBe(200);
});

async function head(page: Page, url: string) {
  await page.goto(url);
  return page.evaluate(() => {
    const meta = (sel: string) => document.querySelector(sel)?.getAttribute("content") ?? null;
    return {
      lang: document.documentElement.lang,
      title: document.title,
      description: meta('meta[name="description"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
      robots: meta('meta[name="robots"]'),
      ogTitle: meta('meta[property="og:title"]'),
      ogDescription: meta('meta[property="og:description"]'),
      ogImage: meta('meta[property="og:image"]'),
      ogUrl: meta('meta[property="og:url"]'),
      twitterCard: meta('meta[name="twitter:card"]'),
      themeColor: meta('meta[name="theme-color"]'),
      viewport: meta('meta[name="viewport"]'),
      h1: [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim() ?? ""),
      main: document.querySelectorAll("main#main").length,
      jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? ""),
      imagesWithoutAlt: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
    };
  });
}

for (const p of indexable) {
  test(`${p.path}: title, description, canonical, social card, one h1, landmarks`, async ({ page, request }) => {
    const h = await head(page, p.path);
    expect(h.lang).toBe("en");
    expect(h.title.length).toBeGreaterThan(8);
    expect(h.title.length).toBeLessThanOrEqual(70);
    expect(h.description!.length).toBeGreaterThanOrEqual(50);
    expect(h.description!.length).toBeLessThanOrEqual(200);
    expect(path(h.canonical!)).toBe(p.path);
    expect(h.canonical!.startsWith(SITE_URL)).toBe(true);
    expect(h.robots ?? "index").not.toMatch(/noindex/);
    expect(h.ogTitle).toBeTruthy();
    expect(h.ogDescription).toBeTruthy();
    expect(h.twitterCard).toBe("summary_large_image");
    expect(h.themeColor).toBeTruthy();
    expect(h.viewport).toContain("width=device-width");
    expect(h.h1).toHaveLength(1);
    expect(h.main).toBe(1);
    expect(h.imagesWithoutAlt).toBe(0);
    for (const json of h.jsonLd) expect(() => JSON.parse(json)).not.toThrow();

    // The social image really is an image.
    const img = await request.get(path(h.ogImage!));
    expect(img.status()).toBe(200);
    expect(img.headers()["content-type"]).toContain("image/png");
  });
}

test("the home page declares the app and its organization; the FAQ declares its questions", async ({ page }) => {
  const home = await head(page, "/");
  const types = home.jsonLd.flatMap((j) => [JSON.parse(j)].flat()).map((d: { "@type": string }) => d["@type"]);
  expect(types).toEqual(expect.arrayContaining(["SoftwareApplication", "WebSite", "Organization"]));
  const faq = await head(page, "/faq");
  const doc = JSON.parse(faq.jsonLd[0]!) as { "@type": string; mainEntity: unknown[] };
  expect(doc["@type"]).toBe("FAQPage");
  expect(doc.mainEntity).toHaveLength(FAQ.length);
});

for (const p of hidden) {
  test(`${p.path} is noindex (an app shell, not content)`, async ({ page }) => {
    const h = await head(page, p.path);
    expect(h.robots).toMatch(/noindex/);
  });
}

test("rss.xml is a valid feed of the changelog", async ({ request, page }) => {
  const { body, type } = await text(request, "/rss.xml");
  expect(type).toContain("xml");
  const parsed = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return {
      error: doc.querySelector("parsererror")?.textContent ?? null,
      root: doc.documentElement.tagName,
      version: doc.documentElement.getAttribute("version"),
      items: [...doc.querySelectorAll("item")].map((i) => ({
        title: i.querySelector("title")?.textContent,
        link: i.querySelector("link")?.textContent,
        guid: i.querySelector("guid")?.textContent,
        date: i.querySelector("pubDate")?.textContent,
      })),
    };
  }, body);
  expect(parsed.error).toBeNull();
  expect(parsed.root).toBe("rss");
  expect(parsed.version).toBe("2.0");
  expect(parsed.items).toHaveLength(CHANGELOG.length);
  expect(new Set(parsed.items.map((i) => i.guid)).size).toBe(CHANGELOG.length);
  for (const item of parsed.items) {
    expect(item.title).toBeTruthy();
    expect(item.link!.startsWith(SITE_URL)).toBe(true);
    expect(Number.isNaN(Date.parse(item.date!))).toBe(false);
  }
});

test("llms.txt follows the llms.txt format and every link resolves; llms-full.txt has the details", async ({ request }) => {
  const { body, type } = await text(request, "/llms.txt");
  expect(type).toContain("text/plain");
  const lines = body.split("\n");
  expect(lines[0]).toBe("# Vidzart");
  expect(lines.find((l) => l.startsWith("> "))).toBeTruthy();
  expect(body).toMatch(/^## /m);
  const own = [...body.matchAll(/\]\((https:\/\/vidzart\.vercel\.app[^)]*)\)/g)].map((m) => path(m[1]!));
  expect(own.length).toBeGreaterThan(4);
  for (const p of own) expect((await request.get(p)).status(), p).toBe(200);

  const full = (await text(request, "/llms-full.txt")).body;
  for (const f of FAQ) expect(full).toContain(f.question);
  expect(full).toContain("activeTab");
});

test("web manifest, icon and security.txt are served", async ({ request }) => {
  const manifest = JSON.parse((await text(request, "/manifest.webmanifest")).body) as {
    name: string;
    short_name: string;
    start_url: string;
    display: string;
    icons: { src: string }[];
  };
  expect(manifest.short_name).toBe("Vidzart");
  expect(manifest.display).toBe("standalone");
  expect((await request.get(manifest.icons[0]!.src)).status()).toBe(200);
  expect((await text(request, "/.well-known/security.txt")).body).toMatch(/^Contact: /m);
});
