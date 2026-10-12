import { test, expect, type Page } from "@playwright/test";

// Is everything connected to what it claims? Every link on every public page
// resolves (and anchors exist), and one full journey works end to end:
// landing → editor → edit → save → projects → reopen → export → delete.

const PAGES = ["/", "/projects", "/record", "/faq", "/privacy", "/changelog", "/editor"];

test("every internal link and anchor on every page resolves", async ({ page, request, baseURL }) => {
  const checked = new Set<string>();
  const problems: string[] = [];
  const externals = new Set<string>();

  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const links = await page.$$eval("a[href]", (as) =>
      as.map((a) => ({ href: a.getAttribute("href")!, target: a.getAttribute("target"), rel: a.getAttribute("rel") ?? "", text: (a.textContent ?? "").trim() })),
    );
    expect(links.length, `${path} has no links at all`).toBeGreaterThan(0);

    for (const link of links) {
      const { href } = link;
      if (/^(mailto:|tel:)/.test(href)) continue;
      if (/^https?:\/\//.test(href) && !href.startsWith(baseURL!)) {
        externals.add(href);
        if (link.target === "_blank" && !/noopener|noreferrer/.test(link.rel)) problems.push(`${path}: external link ${href} opens a tab without rel=noopener/noreferrer`);
        continue;
      }
      const url = new URL(href, `${baseURL}${path}`);
      const key = url.pathname + url.search + url.hash;
      if (checked.has(key)) continue;
      checked.add(key);
      const res = await request.get(url.pathname + url.search);
      if (res.status() !== 200) problems.push(`${path}: ${href} → HTTP ${res.status()}`);
      if (url.hash.length > 1) {
        const id = decodeURIComponent(url.hash.slice(1));
        // An anchor on the page we're on is checked in the live DOM (the editor
        // renders on the client, so its raw HTML has no elements yet); one on
        // another page is checked in that page's HTML.
        const found =
          url.pathname === path
            ? (await page.locator(`[id="${id}"]`).count()) > 0
            : new RegExp(`id=["']${id}["']`).test(await (await request.get(url.pathname)).text());
        if (!found) problems.push(`${path}: ${href} → no element with id "${id}"`);
      }
    }
  }
  // The external destinations are ours to name; make sure none is a placeholder.
  for (const url of externals) expect(url, "placeholder external link").not.toMatch(/example\.com|localhost|#$/);
  expect(problems).toEqual([]);
});

async function clip(page: Page) {
  const bytes = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext("2d")!;
    const r = new MediaRecorder(c.captureStream(30), { mimeType: "video/webm;codecs=vp8" });
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((res) => (r.onstop = () => res()));
    const timer = setInterval(() => {
      ctx.fillStyle = `hsl(${(performance.now() / 10) % 360} 60% 40%)`;
      ctx.fillRect(0, 0, 320, 180);
    }, 33);
    r.start(250);
    await new Promise((x) => setTimeout(x, 2500));
    r.stop();
    await done;
    clearInterval(timer);
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  return Buffer.from(bytes);
}

test("journey: landing → edit → save → projects → reopen → export → delete", async ({ page }) => {
  test.setTimeout(150_000);

  // Landing → editor, with the other ways in offered on the start screen.
  await page.goto("/");
  await page.getByRole("link", { name: "Open the editor" }).first().click();
  await expect(page).toHaveURL(/\/editor/);
  const other = page.getByRole("navigation", { name: "Other ways to start" });
  await expect(other.getByRole("link", { name: /Record your screen/ })).toHaveAttribute("href", "/record");
  await expect(other.getByRole("link", { name: /Record with the extension/ })).toHaveAttribute("href", "/#install");

  // Open a video, make an edit (a title), save it in the browser.
  await page.getByLabel("Choose a video file").setInputFiles({ name: "journey.webm", mimeType: "video/webm", buffer: await clip(page) });
  await expect(page.getByTestId("file-name")).toHaveText("journey.webm");
  await page.getByRole("tab", { name: "Text" }).click();
  await page.getByRole("button", { name: "Add Title" }).click();
  await expect(page.getByRole("complementary", { name: "Inspector" }).locator("textarea")).toHaveValue("Your title"); // its inspector is open
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("menuitem", { name: /Save in this browser/ }).click();
  await expect(page.getByRole("status")).toContainText("Saved in this browser");
  await page.waitForTimeout(1200); // let the debounced autosave finish too

  // It's listed on the dashboard and reopens with the edit intact.
  await page.goto("/projects");
  const card = page.getByRole("link", { name: "Open journey.webm" });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByTestId("file-name")).toHaveText("journey.webm");
  await expect(page.getByTestId("text-block")).toHaveCount(1);

  // Export in each format the dialog offers: the file extension matches.
  for (const [format, ext] of [["MP4", "mp4"], ["WebM", "webm"]] as const) {
    await page.getByRole("button", { name: "Export video" }).click();
    const dialog = page.getByRole("dialog", { name: "Export video" });
    await dialog.getByRole("button", { name: "720p" }).click();
    await dialog.getByRole("button", { name: format, exact: true }).click();
    await dialog.getByRole("button", { name: "Export", exact: true }).click();
    const link = dialog.getByRole("link", { name: new RegExp(`^Download \\.${ext}$`) });
    await expect(link).toBeVisible({ timeout: 90_000 });
    const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${ext}$`));
    await dialog.getByRole("button", { name: "Close" }).click();
  }

  // Delete from inside the editor: confirm, land on the dashboard, project gone.
  await page.getByRole("button", { name: "Project menu" }).click();
  await page.getByRole("menuitem", { name: /Delete project/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete project" }).click();
  await expect(page).toHaveURL(/\/projects/);
  await expect(page.getByRole("link", { name: "Open journey.webm" })).toHaveCount(0);
});

test("back and forward never leave a blank screen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open the editor" }).first().click();
  await expect(page.getByLabel("Choose a video file")).toBeAttached();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goForward();
  await expect(page.getByLabel("Choose a video file")).toBeAttached();
  await page.reload();
  await expect(page.getByLabel("Choose a video file")).toBeAttached();
});
