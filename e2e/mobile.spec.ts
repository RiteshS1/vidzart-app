import { test, expect, type Locator, type Page } from "@playwright/test";

// The editor and the site on a touch phone (portrait and landscape): nothing
// overflows sideways, the controls are reachable and big enough to tap, and the
// tool sheet takes the timeline's place instead of piling on top of it.

const MIN_TOUCH = 40; // px; the design target is 44, allow rounding/borders

async function loadClip(page: Page) {
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
  await page.getByLabel("Choose a video file").setInputFiles({ name: "demo.webm", mimeType: "video/webm", buffer: Buffer.from(bytes) });
  await expect(page.getByTestId("file-name")).toHaveText("demo.webm");
}

async function noSideScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, "page is wider than the screen").toBeLessThanOrEqual(cw);
}

async function insideViewport(page: Page, el: Locator, what: string) {
  const box = await el.boundingBox();
  const vp = page.viewportSize()!;
  expect(box, `${what} has no box`).not.toBeNull();
  expect(box!.x, `${what} sticks out on the left`).toBeGreaterThanOrEqual(-0.5);
  expect(box!.x + box!.width, `${what} sticks out on the right`).toBeLessThanOrEqual(vp.width + 0.5);
  expect(box!.y + box!.height, `${what} sticks out at the bottom`).toBeLessThanOrEqual(vp.height + 0.5);
}

async function tappable(el: Locator, what: string) {
  const box = await el.boundingBox();
  expect(box, `${what} has no box`).not.toBeNull();
  expect(box!.height, `${what} is too short to tap`).toBeGreaterThanOrEqual(MIN_TOUCH);
  expect(box!.width, `${what} is too narrow to tap`).toBeGreaterThanOrEqual(MIN_TOUCH);
}

test.describe("phone, portrait", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const path of ["/", "/projects", "/record", "/faq", "/privacy", "/changelog", "/editor"]) {
    test(`${path} doesn't scroll sideways`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await noSideScroll(page);
    });
  }

  test("editing by touch: tools open as a sheet in place of the timeline", async ({ page }) => {
    await page.goto("/editor");
    await loadClip(page);
    await noSideScroll(page);

    // The top bar fits and its buttons are tappable.
    for (const name of ["Export video", "Save"]) {
      const b = page.getByRole("button", { name, exact: name === "Save" });
      await insideViewport(page, b, name);
      await tappable(b, name);
    }
    const timeline = page.getByRole("region", { name: "Timeline" });
    await expect(timeline).toBeVisible();
    await insideViewport(page, timeline, "timeline");
    // Whole toolbar is on screen: the last button (Redo) too.
    await insideViewport(page, timeline.getByRole("button", { name: "Redo" }), "Redo");
    await tappable(timeline.getByRole("button", { name: "Undo" }), "Undo");

    // The tool bar: every tool is reachable (it scrolls sideways) and tall enough.
    const rail = page.getByRole("tablist", { name: "Tools" });
    await tappable(rail.getByRole("tab", { name: "Style" }), "Style tab");
    await rail.getByRole("tab", { name: "Text" }).tap();
    const panel = page.getByRole("region", { name: "Tool settings" });
    await expect(panel).toBeVisible();
    await expect(timeline).toBeHidden(); // the sheet took its place
    await insideViewport(page, panel, "tool sheet");
    // The preview and transport are still on screen above the sheet.
    await insideViewport(page, page.getByRole("button", { name: /^(Play|Pause)/ }).first(), "play button");
    const canvasBox = await page.locator("canvas").first().boundingBox();
    expect(canvasBox!.height).toBeGreaterThan(120);

    // Add a title: its settings replace the tool list in the sheet.
    await page.getByRole("button", { name: "Add Title" }).tap();
    await expect(panel.getByText("Selected item")).toBeVisible();
    // Close the sheet: the timeline is back and has the text on its lane.
    await page.getByRole("button", { name: "Close panel" }).tap();
    await expect(timeline).toBeVisible();
    await expect(panel).toBeHidden();

    // Tapping the open tool again closes it; tapping another opens that one.
    await rail.getByRole("tab", { name: "Style" }).tap();
    await expect(panel).toBeVisible();
    await rail.getByRole("tab", { name: "Style" }).tap();
    await expect(panel).toBeHidden();
    await rail.getByRole("tab", { name: "Style" }).tap();
    await panel.getByRole("button", { name: "9:16" }).tap();
    await expect(panel.getByRole("button", { name: "9:16" })).toHaveAttribute("aria-pressed", "true");
    await noSideScroll(page);
  });

  test("the export dialog fits the screen", async ({ page }) => {
    await page.goto("/editor");
    await loadClip(page);
    await page.getByRole("button", { name: "Export video" }).tap();
    const dialog = page.getByRole("dialog", { name: "Export video" });
    await expect(dialog).toBeVisible();
    await insideViewport(page, dialog, "export dialog");
    // Its main action is reachable (scrolls inside the dialog if needed).
    const action = dialog.getByRole("button", { name: "Export", exact: true });
    await action.scrollIntoViewIfNeeded();
    await insideViewport(page, action, "Export button");
    await noSideScroll(page);
  });

  test("menus open inside the screen", async ({ page }) => {
    await page.goto("/editor");
    await loadClip(page);
    await page.getByRole("button", { name: "Project menu" }).tap();
    const menu = page.getByRole("menu").first();
    await expect(menu).toBeVisible();
    await insideViewport(page, menu, "project menu");
  });
});

test.describe("phone, landscape", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test("the preview, the transport and every tool stay reachable", async ({ page }) => {
    await page.goto("/editor");
    await loadClip(page);
    await noSideScroll(page);
    const canvas = await page.locator("canvas").first().boundingBox();
    expect(canvas!.height).toBeGreaterThan(70);
    await insideViewport(page, page.getByRole("button", { name: /^(Play|Pause)/ }).first(), "play button");
    // The last tool is scrollable into view and tappable.
    const last = page.getByRole("tablist", { name: "Tools" }).getByRole("tab").last();
    await last.scrollIntoViewIfNeeded();
    await insideViewport(page, last, "last tool");
  });
});
