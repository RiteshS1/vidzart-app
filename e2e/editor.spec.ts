import { test, expect, type Page } from "@playwright/test";

// The test video is generated in the browser (an animated canvas recorded
// with MediaRecorder), so no binary fixture lives in the repo, and it's the
// same kind of file our own recorder produces.
async function makeTestVideo(page: Page, seconds: number): Promise<Buffer> {
  const base64 = await page.evaluate(async (ms) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    const start = performance.now();
    let raf = 0;
    const draw = () => {
      const t = performance.now() - start;
      ctx.fillStyle = `hsl(${(t / 10) % 360} 80% 50%)`;
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = "#fff";
      ctx.font = "48px sans-serif";
      ctx.fillText((t / 1000).toFixed(1), 260, 200);
      raf = requestAnimationFrame(draw);
    };
    draw();
    recorder.start(250);
    await new Promise((r) => setTimeout(r, ms));
    recorder.stop();
    await done;
    cancelAnimationFrame(raf);
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }, seconds * 1000);
  return Buffer.from(base64, "base64");
}

const toSeconds = (text: string | null) => {
  const [m, s] = (text ?? "").split(":");
  return Number(m) * 60 + Number(s);
};

/** Reads one pixel of the preview canvas, at fractional coordinates. */
async function pixel(page: Page, fx: number, fy: number): Promise<number[]> {
  return page.getByTestId("preview-canvas").evaluate(
    (el, [x, y]) => {
      const canvas = el as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      return [...ctx.getImageData(Math.floor(canvas.width * x!), Math.floor(canvas.height * y!), 1, 1).data];
    },
    [fx, fy],
  );
}

let video: Buffer;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/editor");
  video = await makeTestVideo(page, 3);
  await page.close();
});

async function openEditor(page: Page) {
  await page.goto("/editor");
  await page.getByLabel("Choose a video file").setInputFiles({
    name: "test.webm",
    mimeType: "video/webm",
    buffer: video,
  });
  await expect(page.getByTestId("file-name")).toHaveText("test.webm");
}

test("opens a video and renders the composed preview", async ({ page }) => {
  await openEditor(page);
  // Duration comes from Mediabunny demuxing, not the WebM header.
  const duration = toSeconds(await page.getByTestId("output-duration").textContent());
  expect(duration).toBeGreaterThan(2.5);
  expect(duration).toBeLessThan(3.5);

  // Corner = background gradient; center = the video (not background, not black).
  await expect.poll(async () => (await pixel(page, 0.5, 0.5)).slice(0, 3).join()).not.toBe("17,17,17");
  const corner = await pixel(page, 0.01, 0.01);
  const center = await pixel(page, 0.5, 0.5);
  expect(corner).not.toEqual(center);
});

test("plays and advances the time readout", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect.poll(async () => toSeconds(await page.getByTestId("current-time").textContent())).toBeGreaterThan(0.5);
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
});

test("cuts a selected range, then undo restores it", async ({ page }) => {
  await openEditor(page);
  const before = toSeconds(await page.getByTestId("output-duration").textContent());

  const lane = page.getByTestId("timeline-lane");
  const box = (await lane.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId("range-selection")).toBeVisible();

  await page.getByRole("button", { name: "Cut selection" }).click();
  await expect(page.getByTestId("trim-block")).toHaveCount(1);
  const after = toSeconds(await page.getByTestId("output-duration").textContent());
  expect(before - after).toBeGreaterThan(before * 0.25);
  expect(before - after).toBeLessThan(before * 0.35);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("trim-block")).toHaveCount(0);
  expect(toSeconds(await page.getByTestId("output-duration").textContent())).toBeCloseTo(before, 1);
});

test("restores a cut by selecting it and pressing Delete", async ({ page }) => {
  await openEditor(page);
  // Seek to ~1s and trim the start with the [ shortcut.
  const track = page.getByTestId("timeline-track");
  const box = (await track.boundingBox())!;
  await track.click({ position: { x: box.width / 3, y: box.height / 2 } });
  await page.keyboard.press("[");
  await expect(page.getByTestId("trim-block")).toHaveCount(1);

  await page.getByTestId("trim-block").click();
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("trim-block")).toHaveCount(0);
});

test("changing the background updates the canvas", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Background: White" }).click();
  await expect.poll(async () => (await pixel(page, 0.01, 0.01)).slice(0, 3)).toEqual([245, 245, 247]);
  await page.getByRole("button", { name: "Background: Graphite" }).click();
  await expect.poll(async () => (await pixel(page, 0.01, 0.01)).slice(0, 3)).toEqual([31, 31, 36]);
});

test("aspect ratio changes the canvas shape", async ({ page }) => {
  await openEditor(page);
  const canvas = page.getByTestId("preview-canvas");
  await page.getByRole("button", { name: "1:1" }).click();
  await expect.poll(async () => {
    const b = (await canvas.boundingBox())!;
    return Math.round((b.width / b.height) * 100) / 100;
  }).toBe(1);
});

test("playback stops at the trimmed end instead of playing the cut footage", async ({ page }) => {
  await openEditor(page);
  const track = page.getByTestId("timeline-track");
  const box = (await track.boundingBox())!;
  await track.click({ position: { x: box.width * 0.5, y: box.height / 2 } });
  await page.getByRole("button", { name: "Trim end" }).click();
  const outputDuration = toSeconds(await page.getByTestId("output-duration").textContent());

  await page.keyboard.press("Home");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  // It should stop on its own at the new end.
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 6_000 });
  const stoppedAt = toSeconds(await page.getByTestId("current-time").textContent());
  expect(Math.abs(stoppedAt - outputDuration)).toBeLessThan(0.15);
});

/** A cheap fingerprint of the preview: sampled pixel values. */
async function canvasFingerprint(page: Page): Promise<string> {
  return page.getByTestId("preview-canvas").evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    const samples: number[] = [];
    for (let i = 0; i < data.length; i += 4 * 997) samples.push(data[i]!, data[i + 1]!, data[i + 2]!);
    return samples.join(",");
  });
}

test.describe("zooms", () => {
  test("adding and selecting a zoom zooms the preview; deleting restores it", async ({ page }) => {
    await openEditor(page);
    await page.keyboard.press("z");
    await expect(page.getByTestId("zoom-block")).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Zoom" })).toBeVisible();

    // Clicking the block seeks to its fully zoomed-in moment.
    await page.getByTestId("zoom-block").click();
    await page.waitForTimeout(300);
    const zoomed = await canvasFingerprint(page);

    await page.keyboard.press("Delete");
    await expect(page.getByTestId("zoom-block")).toHaveCount(0);
    await expect.poll(() => canvasFingerprint(page)).not.toBe(zoomed);
  });

  test("drag on the zoom lane creates a zoom; drag moves and resizes it", async ({ page }) => {
    await openEditor(page);
    const lane = page.getByTestId("zoom-lane");
    const box = (await lane.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.1, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, y, { steps: 5 });
    await page.mouse.up();

    const block = page.getByTestId("zoom-block");
    await expect(block).toHaveCount(1);
    const created = (await block.boundingBox())!;
    expect(created.x - box.x).toBeCloseTo(box.width * 0.1, -1);
    expect(created.width).toBeCloseTo(box.width * 0.3, -1);

    // Move right by 20% of the lane.
    await page.mouse.move(created.x + created.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(created.x + created.width / 2 + box.width * 0.2, y, { steps: 5 });
    await page.mouse.up();
    const moved = (await block.boundingBox())!;
    expect(moved.x - created.x).toBeCloseTo(box.width * 0.2, -1);
    expect(moved.width).toBeCloseTo(created.width, 0);

    // Resize the end handle outward by 10%.
    const handle = (await page.getByTestId("zoom-handle-end").boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + box.width * 0.1, y, { steps: 5 });
    await page.mouse.up();
    const resized = (await block.boundingBox())!;
    expect(resized.width - moved.width).toBeCloseTo(box.width * 0.1, -1);

    // The whole move was one undo step: one undo puts it back.
    await page.getByRole("button", { name: "Undo" }).click();
    expect((await block.boundingBox())!.width).toBeCloseTo(moved.width, 0);
  });

  test("zooms never overlap", async ({ page }) => {
    await openEditor(page);
    await page.keyboard.press("Home");
    await page.keyboard.press("z"); // 0 → 2.5s
    await page.keyboard.press("z"); // playhead still at 0, inside the first zoom: refused
    await expect(page.getByTestId("zoom-block")).toHaveCount(1);
  });

  test("the target picker changes what the zoom shows", async ({ page }) => {
    await openEditor(page);
    await page.keyboard.press("z");
    await page.getByTestId("zoom-block").click();
    await page.waitForTimeout(300);
    const centered = await canvasFingerprint(page);
    const picker = page.getByTestId("zoom-target-picker");
    const box = (await picker.boundingBox())!;
    await picker.click({ position: { x: box.width * 0.05, y: box.height * 0.05 } });
    await expect.poll(() => canvasFingerprint(page)).not.toBe(centered);
  });
});
