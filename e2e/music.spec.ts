import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { readVidz } from "../src/lib/vidz/vidzFile";

// Background music end to end: add a music file to a SILENT video, hear it
// in the exported MP4, keep it in the .vidz and across a reload.

async function silentVideo(page: Page, ms: number): Promise<Buffer> {
  const bytes = await page.evaluate(async (duration) => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext("2d")!;
    const r = new MediaRecorder(c.captureStream(30), { mimeType: "video/webm;codecs=vp8" });
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((res) => (r.onstop = () => res()));
    const timer = setInterval(() => {
      ctx.fillStyle = `hsl(${(performance.now() / 10) % 360} 60% 50%)`;
      ctx.fillRect(0, 0, 320, 180);
    }, 33);
    r.start(250);
    await new Promise((x) => setTimeout(x, duration));
    r.stop();
    await done;
    clearInterval(timer);
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  }, ms);
  return Buffer.from(bytes);
}

/** A 1.5 s 440 Hz tone as a 16-bit mono WAV. */
function toneWav(): Buffer {
  const rate = 44_100;
  const n = Math.round(rate * 1.5);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12_000), 44 + i * 2);
  return buf;
}

test("music is mixed into the export, saved in the .vidz and kept across reloads", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/editor");
  const video = await silentVideo(page, 3000);
  await page.getByLabel("Choose a video file").setInputFiles({ name: "silent.webm", mimeType: "video/webm", buffer: video });
  await expect(page.getByTestId("file-name")).toHaveText("silent.webm");

  await page.getByRole("tab", { name: "Audio" }).click();
  await page.getByLabel("Choose a music file").setInputFiles({ name: "tone.wav", mimeType: "audio/wav", buffer: toneWav() });
  await expect(page.getByTestId("music-name")).toHaveText("tone.wav");
  await expect(page.getByTestId("music-lane")).toBeVisible();
  // Loud and no fades, so it's easy to measure.
  await page.getByRole("slider", { name: /^Music volume/ }).fill("1");
  await page.getByRole("slider", { name: /^Fade in/ }).fill("0");
  await page.getByRole("slider", { name: /^Fade out/ }).fill("0");

  // Export and listen: Chrome decodes the MP4's audio for us.
  await page.getByRole("button", { name: "Export MP4" }).click();
  const dialog = page.getByRole("dialog", { name: "Export MP4" });
  await dialog.getByRole("button", { name: "720p" }).click();
  await dialog.getByRole("button", { name: "Export", exact: true }).click();
  await expect(dialog.getByTestId("export-summary")).toContainText("AAC", { timeout: 90_000 });
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("link", { name: "Download MP4" }).click()]);
  const mp4 = readFileSync(await download.path());
  const levels = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const audio = await new AudioContext().decodeAudioData(bytes.buffer);
    const data = audio.getChannelData(0);
    const rms = (from: number, to: number) => {
      let sum = 0;
      const a = Math.floor(from * audio.sampleRate);
      const b = Math.floor(to * audio.sampleRate);
      for (let i = a; i < b; i++) sum += data[i]! * data[i]!;
      return Math.sqrt(sum / Math.max(1, b - a));
    };
    // The tone is 1.5 s and loops: sound throughout.
    return { early: rms(0.3, 0.8), late: rms(2.0, 2.5), duration: audio.duration };
  }, mp4.toString("base64"));
  expect(levels.early).toBeGreaterThan(0.1);
  expect(levels.late).toBeGreaterThan(0.1); // looped
  await dialog.getByRole("button", { name: "Close" }).click();

  // Save project: the music travels inside the .vidz.
  const [saved] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save project" }).click()]);
  const path = testInfo.outputPath("music.vidz");
  await saved.saveAs(path);
  const contents = await readVidz(new Blob([new Uint8Array(readFileSync(path))]));
  const src = contents.project.audio!.music!.src;
  expect(src).toMatch(/^assets\/music-[0-9a-f]{8}\.wav$/);
  expect(contents.assets[src]!.size).toBe(toneWav().length);

  // Autosave keeps the music file too: reload and reopen.
  await page.waitForTimeout(1500);
  await page.reload();
  await page.getByRole("region", { name: "Recent projects" }).getByRole("button", { name: "Open" }).click();
  await expect(page.getByTestId("music-lane")).toBeVisible();
  await page.getByRole("tab", { name: "Audio" }).click();
  await expect(page.getByTestId("music-name")).toHaveText("tone.wav");
});

/** A canvas video whose soundtrack is a steady 220 Hz tone (Opus, like real recordings). */
async function toneVideo(page: Page, ms: number): Promise<Buffer> {
  const bytes = await page.evaluate(async (duration) => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext("2d")!;
    const ac = new AudioContext();
    const osc = ac.createOscillator();
    osc.frequency.value = 220;
    const gain = ac.createGain();
    gain.gain.value = 0.3;
    const dest = ac.createMediaStreamDestination();
    osc.connect(gain).connect(dest);
    osc.start();
    const stream = new MediaStream([...c.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const r = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((res) => (r.onstop = () => res()));
    const timer = setInterval(() => {
      ctx.fillStyle = "#345";
      ctx.fillRect(0, 0, 320, 180);
    }, 33);
    r.start(250);
    await new Promise((x) => setTimeout(x, duration));
    r.stop();
    await done;
    clearInterval(timer);
    osc.stop();
    await ac.close();
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  }, ms);
  return Buffer.from(bytes);
}

test("mixing the recording's audio with music has no clicks between blocks", async ({ page }) => {
  // Regression: the mixer used to restart the Opus decoder for every 1 s
  // block, which clicked once per second.
  test.setTimeout(120_000);
  await page.goto("/editor");
  const video = await toneVideo(page, 4000);
  await page.getByLabel("Choose a video file").setInputFiles({ name: "tone.webm", mimeType: "video/webm", buffer: video });
  await expect(page.getByTestId("file-name")).toHaveText("tone.webm");
  await page.getByRole("tab", { name: "Audio" }).click();
  await page.getByLabel("Choose a music file").setInputFiles({ name: "tone.wav", mimeType: "audio/wav", buffer: toneWav() });
  // Silent music: what we inspect is the recording's tone going through the mixer.
  await page.getByRole("slider", { name: /^Music volume/ }).fill("0");

  await page.getByRole("button", { name: "Export MP4" }).click();
  const dialog = page.getByRole("dialog", { name: "Export MP4" });
  await dialog.getByRole("button", { name: "720p" }).click();
  await dialog.getByRole("button", { name: "Export", exact: true }).click();
  await expect(dialog.getByTestId("export-summary")).toBeVisible({ timeout: 90_000 });
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("link", { name: "Download MP4" }).click()]);
  const mp4 = readFileSync(await download.path());
  const clicks = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const audio = await new AudioContext({ sampleRate: 48000 }).decodeAudioData(bytes.buffer);
    const d = audio.getChannelData(0);
    // A 220 Hz sine at 0.3 changes by at most ~0.01 per sample; a click is a jump.
    const found: number[] = [];
    const end = d.length - Math.round(0.15 * audio.sampleRate); // ignore the natural cut-off at the end
    for (let i = Math.round(0.15 * audio.sampleRate); i < end; i++) {
      if (Math.abs(d[i]! - d[i - 1]!) > 0.03) found.push(i / audio.sampleRate);
    }
    return found;
  }, mp4.toString("base64"));
  expect(clicks).toEqual([]);
});
