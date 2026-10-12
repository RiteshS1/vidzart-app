import path from "node:path";
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { createProject } from "../src/lib/project/defaults";
import { writeVidz } from "../src/lib/vidz/vidzFile";

// The AI tools are locked for visitors (src/lib/features.ts); these specs test
// the working code, so they use the owner's unlock.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vidzart.unlockAi", "1"));
});

// AI-tab tools. Test media is generated in the browser: a canvas video with
// an oscillator soundtrack whose volume follows a script, e.g. tone 1s,
// silence 2s, tone 1s.

async function makeVideoWithAudio(page: Page, script: [ms: number, loud: boolean][]): Promise<Buffer> {
  const base64 = await page.evaluate(async (parts) => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    const audio = new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const dest = audio.createMediaStreamDestination();
    osc.connect(gain).connect(dest);
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    let raf = 0;
    const draw = () => {
      ctx.fillStyle = `hsl(${(performance.now() / 10) % 360} 70% 50%)`;
      ctx.fillRect(0, 0, 320, 180);
      raf = requestAnimationFrame(draw);
    };
    draw();
    osc.start();
    recorder.start(250);
    let t = audio.currentTime;
    for (const [ms, loud] of parts) {
      gain.gain.setValueAtTime(loud ? 0.5 : 0, t);
      t += ms / 1000;
    }
    const total = parts.reduce((s, [ms]) => s + ms, 0);
    await new Promise((r) => setTimeout(r, total));
    recorder.stop();
    await done;
    cancelAnimationFrame(raf);
    osc.stop();
    await audio.close();
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }, script);
  return Buffer.from(base64, "base64");
}

async function openVideo(page: Page, buffer: Buffer) {
  await page.goto("/editor");
  await page.getByLabel("Choose a video file").setInputFiles({ name: "talk.webm", mimeType: "video/webm", buffer });
  await expect(page.getByTestId("file-name")).toHaveText("talk.webm");
  await page.getByRole("tab", { name: "AI" }).click();
}

test("Cut silences removes the long pause, as one undo step", async ({ page }) => {
  await page.goto("/editor");
  const video = await makeVideoWithAudio(page, [
    [1200, true],
    [2500, false],
    [1200, true],
  ]);
  await openVideo(page, video);

  await page.getByRole("button", { name: "Cut silences" }).click();
  await expect(page.getByText(/^Cut 1 pause \(\d+\.\d+s\)/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("cut-seam")).toHaveCount(1);
  // ~2.5s pause minus 2×150ms padding ≈ 2.2s (MediaRecorder timing is loose).
  const seconds = Number((await page.getByText(/^Cut 1 pause/).textContent())!.match(/\((\d+\.\d+)s\)/)![1]);
  expect(seconds).toBeGreaterThan(1.6);
  expect(seconds).toBeLessThan(2.8);

  // Running again finds the same pause: nothing new to cut.
  await page.getByRole("button", { name: "Cut silences" }).click();
  await expect(page.getByText("No pauses that long to cut.")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("cut-seam")).toHaveCount(0);
});

test("Cut silences explains when a video has no audio", async ({ page }) => {
  await page.goto("/editor");
  const video = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d")!;
    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: "video/webm;codecs=vp8" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    const timer = setInterval(() => {
      ctx.fillStyle = `hsl(${Math.random() * 360} 70% 50%)`;
      ctx.fillRect(0, 0, 160, 90);
    }, 30);
    recorder.start(250);
    await new Promise((r) => setTimeout(r, 1000));
    recorder.stop();
    await done;
    clearInterval(timer);
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  });
  await openVideo(page, Buffer.from(video, "base64"));
  await page.getByRole("button", { name: "Cut silences" }).click();
  await expect(page.getByText("This video has no audio track.")).toBeVisible({ timeout: 30_000 });
});

test("Cut filler words uses caption word timings and fixes the caption text", async ({ page }) => {
  await page.goto("/editor");
  const video = await makeVideoWithAudio(page, [[3000, true]]);
  const project = {
    ...createProject({ duration: 3000, width: 320, height: 180, fps: 30 }),
    captions: {
      visible: true,
      style: { size: 0.05, position: "bottom" as const },
      cues: [
        {
          id: "c1",
          start: 200,
          end: 2000,
          text: "Um, click record.",
          words: [
            { start: 200, end: 600, text: "Um," },
            { start: 900, end: 1300, text: "click" },
            { start: 1300, end: 2000, text: "record." },
          ],
        },
      ],
    },
  };
  const vidz = await writeVidz({ project, video: new Blob([new Uint8Array(video)]), videoName: "video.webm", events: null, appVersion: "t" });
  await page.getByLabel("Choose a video file").setInputFiles({ name: "talk.vidz", mimeType: "application/zip", buffer: Buffer.from(await vidz.arrayBuffer()) });
  await expect(page.getByTestId("file-name")).toHaveText("talk.vidz");
  await page.getByRole("tab", { name: "AI" }).click();

  await expect(page.getByLabel("Caption at 0:00.2")).toHaveValue("Um, click record.");
  await page.getByRole("button", { name: "Cut filler words" }).click();
  await expect(page.getByText("Cut 1 filler word.")).toBeVisible();
  await expect(page.getByTestId("cut-seam")).toHaveCount(1);
  await expect(page.getByLabel("Caption at 0:00.2")).toHaveValue("Click record.");

  // One undo step brings back both the audio and the text.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("cut-seam")).toHaveCount(0);
  await expect(page.getByLabel("Caption at 0:00.2")).toHaveValue("Um, click record.");
});

/** Records a canvas video whose soundtrack is the given WAV file (real time). */
async function makeVideoFromWav(page: Page, wav: Buffer): Promise<Buffer> {
  const base64 = await page.evaluate(async (wavBase64) => {
    const bytes = Uint8Array.from(atob(wavBase64), (c) => c.charCodeAt(0));
    const audio = new AudioContext();
    const buffer = await audio.decodeAudioData(bytes.buffer);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const dest = audio.createMediaStreamDestination();
    source.connect(dest);
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    const timer = setInterval(() => {
      ctx.fillStyle = `hsl(${(performance.now() / 20) % 360} 60% 45%)`;
      ctx.fillRect(0, 0, 320, 180);
    }, 33);
    recorder.start(250);
    source.start();
    await new Promise((r) => setTimeout(r, buffer.duration * 1000 + 300));
    recorder.stop();
    await done;
    clearInterval(timer);
    await audio.close();
    const out = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let binary = "";
    for (const b of out) binary += String.fromCharCode(b);
    return btoa(binary);
  }, wav.toString("base64"));
  return Buffer.from(base64, "base64");
}

test.describe("captions (downloads a ~40 MB model; opt-in)", () => {
  test.skip(!process.env.VIDZART_TEST_WHISPER, "set VIDZART_TEST_WHISPER=1 to run (needs network)");
  test.setTimeout(300_000);

  test("generates captions on-device, edits one and downloads an SRT", async ({ page }, testInfo) => {
    await page.goto("/editor");
    const video = await makeVideoFromWav(page, readFileSync(path.join(__dirname, "fixtures/speech.wav")));
    await openVideo(page, video);

    await page.getByRole("tab", { name: "Captions" }).click();
    await page.getByLabel("Speech model").selectOption("tiny");
    await page.getByLabel("Spoken language").selectOption("en");
    await page.getByRole("button", { name: "Generate captions" }).click();
    await expect(page.getByText(/^Created \d+ captions/)).toBeVisible({ timeout: 240_000 });

    const texts = await page.getByRole("list", { name: "Caption text" }).locator("textarea").evaluateAll((els) =>
      els.map((el) => (el as HTMLTextAreaElement).value),
    );
    const all = texts.join(" ").toLowerCase();
    expect(all).toContain("record");
    expect(all).toContain("editor");
    // The 2 s pause splits the two sentences into separate cues.
    expect(texts.length).toBeGreaterThanOrEqual(2);

    // Edit the first caption; it's part of the project now.
    const first = page.getByRole("list", { name: "Caption text" }).locator("textarea").first();
    await first.fill("Welcome to Vidzart!");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download .srt" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("talk.srt");
    const srt = readFileSync(await download.path());
    expect(srt.toString()).toMatch(/^1\n00:00:0\d,\d{3} --> 00:00:0\d,\d{3}\nWelcome to Vidzart!\n/);
    testInfo.attach("captions.srt", { body: srt, contentType: "text/plain" });
  });
});

test("uploaded captions autofill, can be styled and shown on the preview", async ({ page }) => {
  await page.goto("/editor");
  const video = await makeVideoWithAudio(page, [[4000, true]]);
  await openVideo(page, video);
  await page.getByRole("tab", { name: "Captions" }).click();

  // An .srt (with a BOM, as many tools write) fills the caption list.
  const srt = "﻿1\n00:00:00,500 --> 00:00:02,000\nWelcome to the demo\n\n2\n00:00:02,500 --> 00:00:03,800\nClick <b>here</b>, then export\n";
  await page.getByLabel("Choose a caption file").setInputFiles({ name: "talk.srt", mimeType: "application/x-subrip", buffer: Buffer.from(srt) });
  await expect(page.getByText("Loaded 2 captions from talk.srt")).toBeVisible();
  await expect(page.getByLabel("Caption at 0:00.5")).toHaveValue("Welcome to the demo");
  await expect(page.getByLabel("Caption at 0:02.5")).toHaveValue("Click here, then export");

  // Pixels: with captions on and a white-on-box look, the bottom of the video
  // has near-white text pixels at 1 s; hiding captions removes them.
  const track = page.getByTestId("timeline-track");
  const box = (await track.boundingBox())!;
  await track.click({ position: { x: box.width * 0.25, y: box.height / 2 } });
  const textPixels = () =>
    page.getByTestId("preview-canvas").evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const d = c.getContext("2d")!.getImageData(Math.floor(c.width * 0.2), Math.floor(c.height * 0.6), Math.floor(c.width * 0.6), Math.floor(c.height * 0.3)).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i]! > 235 && d[i + 1]! > 235 && d[i + 2]! > 235) n++;
      return n;
    });
  await expect.poll(textPixels).toBeGreaterThan(80);

  // Style: Label look = dark text on a white box → the white box adds lots of white.
  const before = await textPixels();
  await page.getByRole("group", { name: "Caption look" }).getByRole("button", { name: "Label" }).click();
  await expect.poll(textPixels).toBeGreaterThan(before * 2);
  // Position to the top: nothing near the bottom any more.
  await page.getByRole("group", { name: "Caption position" }).getByRole("button", { name: "top" }).click();
  await expect.poll(textPixels).toBeLessThan(5);

  // A broken file explains itself and keeps the existing captions.
  await page.getByLabel("Choose a caption file").setInputFiles({ name: "bad.srt", mimeType: "text/plain", buffer: Buffer.from("not subtitles") });
  await expect(page.getByText(/No captions found/)).toBeVisible();
  await expect(page.getByLabel("Caption at 0:00.5")).toHaveValue("Welcome to the demo");
});
