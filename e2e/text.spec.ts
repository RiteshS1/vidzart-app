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

/** Average brightness (0–255) in a box around (fx, fy) of the preview canvas. */
async function brightness(page: Page, fx: number, fy: number, size = 30) {
  return page.getByTestId("preview-canvas").evaluate(
    (el, [x, y, s]) => {
      const c = el as HTMLCanvasElement;
      const data = c.getContext("2d")!.getImageData(Math.floor(c.width * x! - s! / 2), Math.floor(c.height * y! - s! / 2), s!, s!).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
      return sum / (data.length / 4);
    },
    [fx, fy, size],
  );
}

test("a spotlight dims everything but its area; a box outline draws itself", async ({ page }) => {
  await page.goto("/editor");
  await page.getByLabel("Choose a video file").setInputFiles({ name: "clip.webm", mimeType: "video/webm", buffer: video });
  await expect(page.getByTestId("file-name")).toHaveText("clip.webm");
  // Inside the video, away from the default spotlight hole (center).
  const corner: [number, number] = [0.15, 0.2];
  let before = 0;
  await expect.poll(async () => (before = await brightness(page, ...corner))).toBeGreaterThan(20);
  let center = 0;
  await expect.poll(async () => (center = await brightness(page, 0.5, 0.5))).toBeGreaterThan(20);

  await page.getByRole("tab", { name: "Shapes" }).click();
  await page.getByRole("button", { name: "Add Spotlight" }).click();
  await expect(page.getByTestId("shape-block")).toHaveCount(1);
  await page.keyboard.press("ArrowRight"); // past the fade-in
  await expect.poll(() => brightness(page, ...corner)).toBeLessThan(before * 0.6);
  // The hole in the middle stays as bright as before.
  await expect.poll(async () => Math.abs((await brightness(page, 0.5, 0.5)) - center)).toBeLessThan(3);

  // Turn it into a yellow box: its outline appears around the area.
  await page.getByRole("group", { name: "Shape" }).getByRole("button", { name: "Box" }).click();
  await expect.poll(() => brightness(page, ...corner)).toBeGreaterThan(before * 0.9);
  const yellow = await page.getByTestId("preview-canvas").evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i]! > 200 && d[i + 1]! > 170 && d[i + 2]! < 90) n++;
    return n;
  });
  expect(yellow).toBeGreaterThan(200);
});

async function rgbAt(page: Page, fx: number, fy: number) {
  return page.getByTestId("preview-canvas").evaluate(
    (el, [x, y]) => {
      const c = el as HTMLCanvasElement;
      return [...c.getContext("2d")!.getImageData(Math.floor(c.width * x!), Math.floor(c.height * y!), 1, 1).data].slice(0, 3);
    },
    [fx, fy],
  );
}

test("effects: mono filter, fade in from black, dip to black at a cut", async ({ page }) => {
  await page.goto("/editor");
  await page.getByLabel("Choose a video file").setInputFiles({ name: "clip.webm", mimeType: "video/webm", buffer: video });
  await expect(page.getByTestId("file-name")).toHaveText("clip.webm");
  await page.keyboard.press("ArrowRight"); // 1 s in
  // The test video is a blue-ish gray (#202a44): blue is clearly above red.
  await expect.poll(async () => { const [r, , b] = await rgbAt(page, 0.5, 0.5); return b! - r!; }).toBeGreaterThan(20);

  await page.getByRole("tab", { name: "Effects" }).click();
  await page.getByRole("group", { name: "Filter" }).getByRole("button", { name: "Mono" }).click();
  await page.getByRole("slider", { name: /^Strength/ }).fill("1");
  await expect.poll(async () => { const [r, , b] = await rgbAt(page, 0.5, 0.5); return Math.abs(b! - r!); }).toBeLessThan(6);

  // Fade in over 2 s: at the very start the frame is black, later it isn't.
  await page.getByRole("slider", { name: /^Fade in/ }).fill("2000");
  await page.keyboard.press("Home");
  await expect.poll(async () => Math.max(...(await rgbAt(page, 0.5, 0.5)))).toBeLessThan(5);
  await page.getByRole("button", { name: "Go to end" }).click();
  await expect.poll(async () => Math.max(...(await rgbAt(page, 0.5, 0.5)))).toBeGreaterThan(20);

  // Cut 30%–50%, then "Dip": exactly at the cut the picture is black.
  const track = page.getByTestId("timeline-track");
  const box = (await track.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Cut selection" }).click();
  await page.getByRole("group", { name: "Transition" }).getByRole("button", { name: "Dip" }).click();
  const seam = (await page.getByTestId("cut-seam").boundingBox())!;
  // Click the ruler at the seam's x to put the playhead on the cut.
  const ruler = (await page.getByTestId("timeline-ruler").boundingBox())!;
  await page.mouse.click(seam.x + seam.width / 2, ruler.y + ruler.height / 2);
  await expect.poll(async () => Math.max(...(await rgbAt(page, 0.5, 0.5)))).toBeLessThan(12);
});
