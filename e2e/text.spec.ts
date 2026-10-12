import { test, expect, type Page } from "@playwright/test";

// Text overlays: add from a preset, see it drawn on the preview canvas, move
// it by dragging on the preview, edit it in the inspector.

let video: Buffer;
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/editor");
  const bytes = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 360;
    const ctx = c.getContext("2d")!;
    const r = new MediaRecorder(c.captureStream(30), { mimeType: "video/webm;codecs=vp8" });
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((res) => (r.onstop = () => res()));
    // A dark, flat frame: white text pixels can only come from the overlay.
    const timer = setInterval(() => {
      ctx.fillStyle = "#202a44";
      ctx.fillRect(0, 0, 640, 360);
    }, 33);
    r.start(250);
    await new Promise((x) => setTimeout(x, 5000));
    r.stop();
    await done;
    clearInterval(timer);
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  video = Buffer.from(bytes);
  await page.close();
});

/** How many near-white pixels are in a box around (fx, fy) of the preview canvas. */
async function whiteAround(page: Page, fx: number, fy: number, size = 60) {
  return page.getByTestId("preview-canvas").evaluate(
    (el, [x, y, s]) => {
      const c = el as HTMLCanvasElement;
      const data = c.getContext("2d")!.getImageData(Math.floor(c.width * x! - s! / 2), Math.floor(c.height * y! - s! / 2), s!, s!).data;
      let white = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i]! > 235 && data[i + 1]! > 235 && data[i + 2]! > 235) white++;
      return white;
    },
    [fx, fy, size],
  );
}

test("adds a text from a preset, draws it, drags it and edits it", async ({ page }) => {
  await page.goto("/editor");
  await page.getByLabel("Choose a video file").setInputFiles({ name: "clip.webm", mimeType: "video/webm", buffer: video });
  await expect(page.getByTestId("file-name")).toHaveText("clip.webm");

  // Nothing white near the top yet.
  await expect.poll(() => whiteAround(page, 0.5, 0.2)).toBe(0);

  await page.getByRole("tab", { name: "Text" }).click();
  await page.getByRole("button", { name: "Add Callout" }).click();
  await expect(page.getByTestId("text-block")).toHaveCount(1);
  await expect(page.getByRole("complementary", { name: "Inspector" })).toBeVisible();

  // The callout (white box at 50%, 20%) is drawn once its pop-in finishes.
  await page.keyboard.press("ArrowRight"); // +1 s, past the in-animation
  await expect.poll(() => whiteAround(page, 0.5, 0.2)).toBeGreaterThan(500);

  // Drag the dashed handle down by a quarter of the canvas.
  const canvas = (await page.getByTestId("preview-canvas").boundingBox())!;
  const handle = (await page.getByTestId("text-handle").boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + canvas.height * 0.25, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => whiteAround(page, 0.5, 0.45)).toBeGreaterThan(500);
  await expect.poll(() => whiteAround(page, 0.5, 0.2)).toBe(0);
  await expect(page.getByLabel("Top ↕ bottom")).toHaveValue(/^0\.4[0-9]*$/);

  // Edit the text; the timeline block shows it.
  await page.getByRole("textbox", { name: "Text", exact: true }).fill("Press record");
  await expect(page.getByTestId("text-block")).toContainText("Press record");

  // After the text's end it's no longer drawn. (A button, not the End key:
  // focus is still in the text box, where shortcuts are ignored on purpose.)
  await page.getByRole("button", { name: "Go to end" }).click();
  await expect.poll(() => whiteAround(page, 0.5, 0.45)).toBe(0);
});
