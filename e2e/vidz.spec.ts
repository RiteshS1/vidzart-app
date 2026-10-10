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

test("plain videos have no auto zoom and no cursor follow", async ({ page }) => {
  await openFile(page, "plain.webm", video, "video/webm");
  await expect(page.getByRole("button", { name: "Auto zoom" })).toHaveCount(0);
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
