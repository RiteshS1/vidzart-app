import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import type { VidzEvents } from "../src/lib/events/types";
import type { VidzProject } from "../src/lib/project/types";
import { readVidz, writeVidz } from "../src/lib/vidz/vidzFile";

// .vidz files are built in Node with the app's own writer, the same code the
// editor uses to save, so these tests also cover the file format end to end.

async function makeTestVideo(page: Page, ms: number): Promise<Buffer> {
  const base64 = await page.evaluate(async (duration) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext("2d")!;
    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: "video/webm;codecs=vp8" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    const start = performance.now();
    let raf = 0;
    const draw = () => {
      ctx.fillStyle = `hsl(${((performance.now() - start) / 10) % 360} 70% 50%)`;
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = "#fff";
      ctx.fillRect(480, 40, 120, 60); // a "button" in the top-right corner
      raf = requestAnimationFrame(draw);
    };
    draw();
    recorder.start(250);
    await new Promise((r) => setTimeout(r, duration));
    recorder.stop();
    await done;
    cancelAnimationFrame(raf);
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }, ms);
  return Buffer.from(base64, "base64");
}

const project = (duration: number): VidzProject => ({
  version: 1,
  source: { duration, width: 640, height: 360, fps: 30 },
  settings: {
    aspectRatio: "16:9",
    background: { type: "color", color: "#1f1f24" },
    padding: 0.08,
    cornerRadius: 0.02,
    shadow: { enabled: false, blur: 0, opacity: 0, offsetY: 0 },
    cursor: { visible: true, scale: 1, smoothing: 0.5 },
    clickEffect: { type: "ripple", color: "#ffffff" },
  },
  segments: [],
});

// Two separate click bursts: top-right at ~1s, bottom-left at ~3.2s.
const events: VidzEvents = {
  version: 1,
  viewport: { width: 1280, height: 720, devicePixelRatio: 2 },
  startedAt: 1_760_000_000_000,
  events: [
    { t: 0, type: "move", x: 640, y: 360 },
    { t: 900, type: "move", x: 1080, y: 140 },
    { t: 1_000, type: "click", x: 1080, y: 140, button: 0 },
    { t: 1_300, type: "click", x: 1100, y: 150, button: 0 },
    { t: 3_000, type: "move", x: 200, y: 600 },
    { t: 3_200, type: "click", x: 200, y: 600, button: 0 },
  ],
};

let video: Buffer;
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/editor");
  video = await makeTestVideo(page, 4_000);
  await page.close();
});

async function openFile(page: Page, name: string, buffer: Buffer, mimeType: string) {
  await page.goto("/editor");
  await page.getByLabel("Choose a video file").setInputFiles({ name, mimeType, buffer });
  await expect(page.getByTestId("file-name")).toHaveText(name);
}

test("opens a .vidz with an event log and generates auto zooms", async ({ page }) => {
  const vidz = await writeVidz({
    project: project(4_000),
    video: new Blob([new Uint8Array(video)]), // copy: Blob parts need an ArrayBuffer-backed view
    videoName: "video.webm",
    events,
    appVersion: "test",
  });
  await openFile(page, "demo.vidz", Buffer.from(await vidz.arrayBuffer()), "application/zip");

  await page.getByRole("button", { name: "Auto zoom" }).click();
  await expect(page.getByRole("status")).toHaveText("Added 2 auto zooms");
  await expect(page.getByTestId("zoom-block")).toHaveCount(2);
  await expect(page.getByTestId("zoom-block").first()).toContainText("auto");

  // Running it again replaces the auto zooms instead of stacking them.
  await page.getByRole("button", { name: "Auto zoom" }).click();
  await expect(page.getByTestId("zoom-block")).toHaveCount(2);

  // With a cursor log, "Follow cursor" is available in the inspector.
  await page.getByTestId("zoom-block").first().click();
  await expect(page.getByRole("button", { name: "Follow cursor" })).toBeEnabled();
});

/** Dark-pixel count and a hash of the preview in a box around (fx, fy) (fractions of the canvas). */
async function region(page: Page, fx: number, fy: number, size = 40) {
  return page.getByTestId("preview-canvas").evaluate(
    (el, [x, y, s]) => {
      const canvas = el as HTMLCanvasElement;
      const data = canvas.getContext("2d")!.getImageData(Math.floor(canvas.width * x! - s! / 2), Math.floor(canvas.height * y! - s! / 2), s!, s!).data;
      let dark = 0;
      let white = 0;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i]! + data[i + 1]! + data[i + 2]! < 120) dark++;
        if (data[i]! > 245 && data[i + 1]! > 245 && data[i + 2]! > 245) white++;
        sum = (sum * 31 + data[i]! + data[i + 1]! * 7 + data[i + 2]! * 13) % 1_000_000_007;
      }
      return { dark, white, sum };
    },
    [fx, fy, size],
  );
}

test("draws the recorded cursor and click effects, with settings to change them", async ({ page }) => {
  const vidz = await writeVidz({
    project: project(4_000),
    video: new Blob([new Uint8Array(video)]),
    videoName: "video.webm",
    events,
    appVersion: "test",
  });
  await openFile(page, "demo.vidz", Buffer.from(await vidz.arrayBuffer()), "application/zip");

  // At t=0 the cursor is at (640, 360) of a 1280×720 viewport: the middle
  // of the video, which is also the middle of the 16:9 canvas. The test
  // video is brightly colored there, so dark pixels can only be the arrow.
  // (At scale 1 in a ~600px preview the arrow is only ~8px tall.)
  await expect.poll(async () => (await region(page, 0.5, 0.5)).dark).toBeGreaterThan(0);
  await page.getByLabel("Show cursor").uncheck();
  await expect.poll(async () => (await region(page, 0.5, 0.5)).dark).toBe(0);
  await page.getByLabel("Show cursor").check();

  // Bigger cursor → more arrow pixels.
  await expect.poll(async () => (await region(page, 0.5, 0.5, 80)).dark).toBeGreaterThan(0);
  const before = (await region(page, 0.5, 0.5, 80)).dark;
  await page.getByLabel("Cursor size").fill("3");
  await expect.poll(async () => (await region(page, 0.5, 0.5, 80)).dark).toBeGreaterThan(before * 2);

  // Click effects: at ~1.15s the ripple of the click at t=1000 is on screen
  // around (1080, 140) of the viewport. Compare Ripple vs None there.
  await page.getByLabel("Show cursor").uncheck();
  const track = page.getByTestId("timeline-track");
  const box = (await track.boundingBox())!;
  await track.click({ position: { x: box.width * (1150 / 4000), y: box.height / 2 } });
  // Video rect: a 16:9 source in a 16:9 canvas, padded by 8% of the height.
  const padX = 0.08 * (9 / 16);
  const clickX = padX + (1080 / 1280) * (1 - 2 * padX);
  const clickY = 0.08 + (140 / 720) * (1 - 0.16);
  await page.waitForTimeout(300); // let the seek land
  const withRipple = await region(page, clickX, clickY, 60);
  await page.getByRole("button", { name: "None", exact: true }).click();
  await expect.poll(async () => (await region(page, clickX, clickY, 60)).sum).not.toBe(withRipple.sum);
  await expect(page.getByRole("group", { name: "Click effect color" })).toHaveCount(0);
});

test("a blur box hides part of the frame and can be redrawn", async ({ page }) => {
  await openFile(page, "plain.webm", video, "video/webm");
  // The test video has a white "button" at (480–600, 40–100) of 640×360:
  // the only detail in the frame. Blurring its edge turns pure-white pixels
  // into a white/red mix, so we count pure-white pixels around the corner.
  const padX = 0.08 * (9 / 16);
  const [bx, by] = [padX + (480 / 640) * (1 - 2 * padX), 0.08 + (40 / 360) * 0.84];

  const lane = page.getByTestId("blur-lane");
  const box = (await lane.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId("blur-block")).toHaveCount(1);
  // Clicking the block selects it and moves the playhead into it.
  await page.getByTestId("blur-block").click();
  await expect(page.getByRole("region", { name: "Blur" })).toBeVisible();
  // Default box is in the middle: the corner is still sharp. (Read the
  // baseline inside the poll: right after a seek the canvas can briefly
  // show no frame.)
  let sharp = 0;
  await expect
    .poll(async () => {
      sharp = (await region(page, bx, by, 30)).white;
      return sharp;
    })
    .toBeGreaterThan(100);

  // Draw the box over the white rectangle's corner in the inspector.
  const picker = page.getByTestId("blur-rect-picker");
  const p = (await picker.boundingBox())!;
  await page.mouse.move(p.x + p.width * 0.65, p.y + p.height * 0.02);
  await page.mouse.down();
  await page.mouse.move(p.x + p.width * 0.85, p.y + p.height * 0.25, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await region(page, bx, by, 30)).white).toBeLessThan(sharp / 2);

  // Deleting the blur makes it sharp again.
  await page.getByRole("region", { name: "Blur" }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("blur-block")).toHaveCount(0);
  await expect.poll(async () => (await region(page, bx, by, 30)).white).toBe(sharp);
});

test("plain videos have no auto zoom and no cursor follow", async ({ page }) => {
  await openFile(page, "plain.webm", video, "video/webm");
  await expect(page.getByRole("button", { name: "Auto zoom" })).toHaveCount(0);
  await expect(page.getByLabel("Show cursor")).toHaveCount(0); // nothing to draw
  await page.keyboard.press("z");
  await expect(page.getByRole("button", { name: "Follow cursor" })).toBeDisabled();
});

test("saves a project and opens it again with all edits", async ({ page }, testInfo) => {
  await openFile(page, "plain.webm", video, "video/webm");
  await page.keyboard.press("z"); // a zoom at 0s
  const track = page.getByTestId("timeline-track");
  const box = (await track.boundingBox())!;
  await track.click({ position: { x: box.width * 0.8, y: box.height / 2 } });
  await page.keyboard.press("]"); // trim the last 20%
  await page.getByRole("button", { name: "Background: Ocean" }).click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save project" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("plain.vidz");
  const path = testInfo.outputPath("plain.vidz");
  await download.saveAs(path);

  // Read it back with the same code the app uses.
  const saved = readFileSync(path);
  const contents = await readVidz(new Blob([new Uint8Array(saved)]));
  expect(contents.manifest.createdBy.app).toBe("vidzart-app");
  expect(contents.project.segments.map((s) => s.type).sort()).toEqual(["trim", "zoom"]);
  expect(contents.project.settings.background).toMatchObject({ type: "gradient", from: "#2193b0" });
  expect(contents.video.size).toBe(video.length);

  // And reopen it in the editor.
  await openFile(page, "plain.vidz", saved, "application/zip");
  await expect(page.getByTestId("zoom-block")).toHaveCount(1);
  await expect(page.getByTestId("trim-block")).toHaveCount(1);
});

test("shows a clear error for a broken .vidz", async ({ page }) => {
  await page.goto("/editor");
  await page.getByLabel("Choose a video file").setInputFiles({
    name: "broken.vidz",
    mimeType: "application/zip",
    buffer: Buffer.from("this is not a zip"),
  });
  // (Not getByRole("alert"): Next's route announcer is also an alert.)
  await expect(page.getByText("This isn't a valid .vidz file")).toBeVisible();
});
