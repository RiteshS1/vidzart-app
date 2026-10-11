import { test, expect, type Page } from "@playwright/test";

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
  await page.getByRole("tab", { name: "✨ AI" }).click();
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
  await expect(page.getByTestId("trim-block")).toHaveCount(1);
  // ~2.5s pause minus 2×150ms padding ≈ 2.2s (MediaRecorder timing is loose).
  const seconds = Number((await page.getByText(/^Cut 1 pause/).textContent())!.match(/\((\d+\.\d+)s\)/)![1]);
  expect(seconds).toBeGreaterThan(1.6);
  expect(seconds).toBeLessThan(2.8);

  // Running again finds the same pause: nothing new to cut.
  await page.getByRole("button", { name: "Cut silences" }).click();
  await expect(page.getByText("No pauses that long to cut.")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("trim-block")).toHaveCount(0);
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
