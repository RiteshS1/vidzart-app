import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";

// Export runs real WebCodecs encoding in a worker, so these tests use a
// short video WITH audio (an oscillator tone) to cover both tracks.

async function makeVideoWithAudio(page: Page, ms: number): Promise<Buffer> {
  const base64 = await page.evaluate(async (duration) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext("2d")!;
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const destination = audio.createMediaStreamDestination();
    oscillator.connect(destination);
    oscillator.start();
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...destination.stream.getAudioTracks()]);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    const start = performance.now();
    let raf = 0;
    const draw = () => {
      ctx.fillStyle = `hsl(${((performance.now() - start) / 8) % 360} 70% 50%)`;
      ctx.fillRect(0, 0, 640, 360);
      raf = requestAnimationFrame(draw);
    };
    draw();
    recorder.start(250);
    await new Promise((r) => setTimeout(r, duration));
    recorder.stop();
    await done;
    cancelAnimationFrame(raf);
    oscillator.stop();
    await audio.close();
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }, ms);
  return Buffer.from(base64, "base64");
}

const toSeconds = (text: string | null) => {
  const [m, s] = (text ?? "").split(":");
  return Number(m) * 60 + Number(s);
};

let video: Buffer;
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/editor");
  video = await makeVideoWithAudio(page, 3_000);
  await page.close();
});

test("exports an MP4 with the edits applied", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/editor");
  await page.getByLabel("Choose a video file").setInputFiles({ name: "clip.webm", mimeType: "video/webm", buffer: video });
  await expect(page.getByTestId("file-name")).toHaveText("clip.webm");

  // Cut the middle third and add a zoom.
  const lane = page.getByTestId("timeline-track");
  const box = (await lane.boundingBox())!;
  await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + (box.width * 2) / 3, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Cut selection" }).click();
  await page.keyboard.press("Home");
  await page.keyboard.press("z");
  const expected = toSeconds(await page.getByTestId("output-duration").textContent());

  await page.getByRole("button", { name: "Export video" }).click();
  const dialog = page.getByRole("dialog", { name: "Export video" });
  await dialog.getByRole("button", { name: "720p" }).click();
  await expect(dialog.getByTestId("export-size")).toHaveText("1280×720");
  await dialog.getByRole("button", { name: "30 fps" }).click();
  await dialog.getByRole("button", { name: "Export", exact: true }).click();

  await expect(dialog.getByRole("progressbar")).toBeVisible();
  await expect(dialog.getByTestId("export-summary")).toBeVisible({ timeout: 90_000 });
  await expect(dialog.getByTestId("export-summary")).toContainText("1280×720");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("link", { name: /^Download \./ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("clip.mp4");
  const path = testInfo.outputPath("clip.mp4");
  await download.saveAs(path);

  // Inspect the file independently with Mediabunny in Node.
  const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(readFileSync(path)) });
  expect((await input.getFormat()).name).toMatch(/MP4/i);
  const videoTrack = (await input.getPrimaryVideoTrack())!;
  expect(videoTrack.codec).toBe("avc");
  expect(await videoTrack.getDisplayWidth()).toBe(1280);
  expect(await videoTrack.getDisplayHeight()).toBe(720);
  const audioTrack = await input.getPrimaryAudioTrack();
  expect(audioTrack?.codec).toMatch(/aac|opus/);
  const duration = await input.computeDuration();
  expect(Math.abs(duration - expected)).toBeLessThan(0.2);
  const stats = await videoTrack.computePacketStats();
  expect(stats.averagePacketRate).toBeGreaterThan(28);
  expect(stats.averagePacketRate).toBeLessThan(32);
});

test("an export can be canceled", async ({ page }) => {
  await page.goto("/editor");
  await page.getByLabel("Choose a video file").setInputFiles({ name: "clip.webm", mimeType: "video/webm", buffer: video });
  await page.getByRole("button", { name: "Export video" }).click();
  const dialog = page.getByRole("dialog", { name: "Export video" });
  await dialog.getByRole("button", { name: "4K" }).click();
  await dialog.getByRole("button", { name: "Export", exact: true }).click();
  await expect(dialog.getByRole("progressbar")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  // Back to the setup screen, ready to try again.
  await expect(dialog.getByRole("button", { name: "Export", exact: true })).toBeVisible();
});

test("a speed-up shortens the output, in the preview and the exported MP4", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/editor");
  await page.getByLabel("Choose a video file").setInputFiles({ name: "clip.webm", mimeType: "video/webm", buffer: video });
  await expect(page.getByTestId("file-name")).toHaveText("clip.webm");
  const full = toSeconds(await page.getByTestId("output-duration").textContent());

  // Drag the first half on the speed lane: 2× by default.
  const lane = page.getByTestId("speed-lane");
  const box = (await lane.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByTestId("speed-block")).toContainText("2×");
  await expect.poll(async () => toSeconds(await page.getByTestId("output-duration").textContent())).toBeLessThan(full - 0.5);

  // 4× in the inspector shortens it further.
  await page.getByRole("group", { name: "Speed" }).getByRole("button", { name: "4×" }).click();
  await expect(page.getByTestId("speed-block")).toContainText("4×");
  const expected = toSeconds(await page.getByTestId("output-duration").textContent());
  expect(expected).toBeLessThan(full * 0.7);

  await page.getByRole("button", { name: "Export video" }).click();
  const dialog = page.getByRole("dialog", { name: "Export video" });
  await dialog.getByRole("button", { name: "720p" }).click();
  await dialog.getByRole("button", { name: "Export", exact: true }).click();
  await expect(dialog.getByTestId("export-summary")).toBeVisible({ timeout: 90_000 });
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("link", { name: /^Download \./ }).click()]);
  const path = testInfo.outputPath("fast.mp4");
  await download.saveAs(path);
  const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(readFileSync(path)) });
  expect(Math.abs((await input.computeDuration()) - expected)).toBeLessThan(0.2);
});

test("changing the recording's volume mixes its audio (with a cut) into a correct MP4", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/editor");
  await page.getByLabel("Choose a video file").setInputFiles({ name: "clip.webm", mimeType: "video/webm", buffer: video });
  await expect(page.getByTestId("file-name")).toHaveText("clip.webm");
  // A cut in the middle, so the mixer has to stitch two pieces.
  const track = page.getByTestId("timeline-track");
  const box = (await track.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Cut selection" }).click();
  await page.getByRole("tab", { name: "Audio" }).click();
  await page.getByRole("slider", { name: /^Recording volume/ }).fill("0.5");
  const expected = toSeconds(await page.getByTestId("output-duration").textContent());

  await page.getByRole("button", { name: "Export video" }).click();
  const dialog = page.getByRole("dialog", { name: "Export video" });
  await dialog.getByRole("button", { name: "720p" }).click();
  await dialog.getByRole("button", { name: "Export", exact: true }).click();
  await expect(dialog.getByTestId("export-summary")).toBeVisible({ timeout: 90_000 });
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("link", { name: /^Download \./ }).click()]);
  const path = testInfo.outputPath("mixed.mp4");
  await download.saveAs(path);
  const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(readFileSync(path)) });
  const audioTrack = await input.getPrimaryAudioTrack();
  expect(audioTrack?.codec).toMatch(/aac|opus/);
  expect(await audioTrack!.getNumberOfChannels()).toBe(2);
  expect(Math.abs((await input.computeDuration()) - expected)).toBeLessThan(0.2);
});

for (const [format, ext, mime, codecRe] of [
  ["WebM", "webm", /webm/i, /vp9|vp8|av1/],
  ["MOV", "mov", /quicktime|mov/i, /avc|hevc/],
] as const) {
  test(`exports ${format} (.${ext}) with the right container and codec`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.goto("/editor");
    await page.getByLabel("Choose a video file").setInputFiles({ name: "clip.webm", mimeType: "video/webm", buffer: video });
    await expect(page.getByTestId("file-name")).toHaveText("clip.webm");
    await page.getByRole("button", { name: "Export video" }).click();
    const dialog = page.getByRole("dialog", { name: "Export video" });
    await dialog.getByRole("group", { name: "Format" }).getByRole("button", { name: format }).click();
    await dialog.getByRole("button", { name: "720p" }).click();
    await dialog.getByRole("button", { name: "Export", exact: true }).click();
    await expect(dialog.getByTestId("export-summary")).toContainText(`${ext.toUpperCase()}`, { timeout: 90_000 });
    const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("link", { name: `Download .${ext}` }).click()]);
    expect(download.suggestedFilename()).toBe(`clip.${ext}`);
    const path = testInfo.outputPath(`clip.${ext}`);
    await download.saveAs(path);
    const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(readFileSync(path)) });
    expect((await input.getFormat()).mimeType).toMatch(mime);
    const track = (await input.getPrimaryVideoTrack())!;
    expect(track.codec).toMatch(codecRe);
    expect(await track.getDisplayWidth()).toBe(1280); // 720p
    expect(await input.getPrimaryAudioTrack()).not.toBeNull();
  });
}
