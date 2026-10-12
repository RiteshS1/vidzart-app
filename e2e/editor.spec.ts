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

test("cutting a selected range removes it from the timeline; undo brings it back", async ({ page }) => {
  await openEditor(page);
  const before = toSeconds(await page.getByTestId("output-duration").textContent());

  // Drag on the clips to select 20%–50%.
  const track = page.getByTestId("timeline-track");
  const box = (await track.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId("range-selection")).toBeVisible();

  await page.getByRole("button", { name: "Cut selection" }).click();
  // The cut part is gone: only a seam marks where it was, and nothing is
  // selected that could be "cut" again.
  await expect(page.getByTestId("cut-seam")).toHaveCount(1);
  await expect(page.getByTestId("range-selection")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cut selection" })).toBeDisabled();
  const after = toSeconds(await page.getByTestId("output-duration").textContent());
  expect(before - after).toBeGreaterThan(before * 0.25);
  expect(before - after).toBeLessThan(before * 0.35);
  // The seam sits where the cut began (20% of the old length, now of a shorter timeline).
  const seam = (await page.getByTestId("cut-seam").boundingBox())!;
  const seamFraction = (seam.x + seam.width / 2 - box.x) / box.width;
  expect(seamFraction).toBeGreaterThan(0.24);
  expect(seamFraction).toBeLessThan(0.34);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("cut-seam")).toHaveCount(0);
  expect(toSeconds(await page.getByTestId("output-duration").textContent())).toBeCloseTo(before, 1);
});

test("clicking a cut's seam restores the footage", async ({ page }) => {
  await openEditor(page);
  // Seek to ~1s and trim the start with the [ shortcut.
  const track = page.getByTestId("timeline-track");
  const box = (await track.boundingBox())!;
  await track.click({ position: { x: box.width / 3, y: box.height / 2 } });
  await page.keyboard.press("[");
  await expect(page.getByTestId("cut-seam")).toHaveCount(1);

  await page.getByRole("button", { name: /^Restore cut/ }).click();
  await expect(page.getByTestId("cut-seam")).toHaveCount(0);
});

test("the playhead can be dragged by its handle and the ruler", async ({ page }) => {
  await openEditor(page);
  const ruler = (await page.getByTestId("timeline-ruler").boundingBox())!;
  const total = toSeconds(await page.getByTestId("output-duration").textContent());

  // Grab the handle (at 0) and drag it to ~60%.
  const handle = (await page.getByTestId("playhead-handle").boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(ruler.x + ruler.width * 0.6, handle.y + handle.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => toSeconds(await page.getByTestId("current-time").textContent())).toBeGreaterThan(total * 0.5);
  expect(toSeconds(await page.getByTestId("current-time").textContent())).toBeLessThan(total * 0.7);

  // Clicking the ruler jumps there.
  await page.mouse.click(ruler.x + ruler.width * 0.2, ruler.y + ruler.height / 2);
  await expect.poll(async () => toSeconds(await page.getByTestId("current-time").textContent())).toBeLessThan(total * 0.3);
});

test("the timeline zooms and scrolls, and shows a filmstrip", async ({ page }) => {
  await openEditor(page);
  // Thumbnails were decoded in the worker and drawn (the canvas isn't blank).
  await expect
    .poll(() =>
      page.getByTestId("filmstrip").evaluate((el) => {
        const c = el as HTMLCanvasElement;
        if (!c.width) return 0;
        const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        let painted = 0;
        for (let i = 3; i < data.length; i += 4 * 50) if (data[i]! > 0) painted++;
        return painted;
      }),
    )
    .toBeGreaterThan(10);

  const scroller = page.getByTestId("timeline-scroll");
  const fits = await scroller.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
  expect(fits).toBe(true);
  await page.getByRole("button", { name: "Zoom timeline in" }).click();
  await page.getByRole("button", { name: "Zoom timeline in" }).click();
  await expect.poll(() => scroller.evaluate((el) => el.scrollWidth / el.clientWidth)).toBeGreaterThan(2);
  await page.getByRole("button", { name: "Zoom timeline out" }).click();
  await page.getByRole("button", { name: "Zoom timeline out" }).click();
  await expect.poll(() => scroller.evaluate((el) => el.scrollWidth / el.clientWidth)).toBeLessThan(1.05);
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

test.describe("backgrounds", () => {
  test("genres of gradients and colors, plus a custom picker", async ({ page }) => {
    await openEditor(page);
    const genres = page.getByRole("group", { name: "Background genre" });
    for (const genre of ["Studio", "Aesthetic", "Pastel", "Nature", "Warm", "Cool", "Neon", "Night", "Custom"]) {
      await expect(genres.getByRole("button", { name: genre })).toBeVisible();
    }

    // An aesthetic gradient: the preview's corner turns from the default
    // studio gray into the gradient's start color (#ff9a9e).
    await genres.getByRole("button", { name: "Aesthetic" }).click();
    await page.getByRole("button", { name: "Background: Sunset Haze" }).click();
    await expect.poll(async () => (await pixel(page, 0.01, 0.01)).slice(0, 3)[0]).toBeGreaterThan(220);

    // Custom solid color through the hex field.
    await genres.getByRole("button", { name: "Custom" }).click();
    await page.getByRole("button", { name: "Solid color" }).click();
    const hex = page.getByRole("textbox", { name: "Hex color" });
    await hex.fill("#12ab34");
    await hex.blur();
    await expect.poll(async () => (await pixel(page, 0.01, 0.01)).slice(0, 3)).toEqual([0x12, 0xab, 0x34]);

    // Custom gradient: from/to colors and an angle.
    await page.getByRole("button", { name: "Gradient", exact: true }).click();
    await page.getByRole("group", { name: "Gradient color" }).getByRole("button", { name: "To" }).click();
    await page.getByRole("textbox", { name: "Hex color" }).fill("#ff0000");
    await page.getByRole("textbox", { name: "Hex color" }).blur();
    await expect.poll(async () => (await pixel(page, 0.99, 0.99)).slice(0, 3)[0]).toBeGreaterThan(200);
  });
});
