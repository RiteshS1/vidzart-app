import { test, expect, type Locator, type Page } from "@playwright/test";

// What visitors get while the AI features are locked (src/lib/features.ts):
// everything built is visible, the AI parts are disabled with "COMING SOON",
// nothing AI is downloaded or started, and the non-AI parts still work.

/** The control is shown but can't be used: it sits inside an inert subtree and refuses clicks. */
async function expectLocked(button: Locator) {
  await expect(button).toBeVisible();
  expect(await button.evaluate((el) => el.closest("[inert]") !== null)).toBe(true);
  await expect(button.click({ timeout: 700 })).rejects.toThrow();
}

async function openEditor(page: Page) {
  await page.goto("/editor");
  const video = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 180;
    const ctx = c.getContext("2d")!;
    const r = new MediaRecorder(c.captureStream(30), { mimeType: "video/webm;codecs=vp8" });
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((res) => (r.onstop = () => res()));
    const timer = setInterval(() => {
      ctx.fillStyle = "#345";
      ctx.fillRect(0, 0, 320, 180);
    }, 33);
    r.start(250);
    await new Promise((x) => setTimeout(x, 2000));
    r.stop();
    await done;
    clearInterval(timer);
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  await page.getByLabel("Choose a video file").setInputFiles({ name: "clip.webm", mimeType: "video/webm", buffer: Buffer.from(video) });
  await expect(page.getByTestId("file-name")).toHaveText("clip.webm");
}

test("the AI tab is visible but locked, with COMING SOON on hover", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("tab", { name: "AI" }).click();
  const panel = page.getByRole("tabpanel", { name: "AI" });
  await expect(panel.getByText("Coming soon", { exact: true })).toBeVisible();
  // The hover title is on the wrapper around the (inert) tools.
  await expect(panel.locator('[title="COMING SOON"]')).toHaveCount(1);
  // Nothing inside is operable.
  await expect(panel.locator("[inert]")).toHaveCount(1);
  for (const name of ["Cut silences", "Cut filler words", "Title & description", "Chapters", "Summary", "Translate captions"]) {
    await expectLocked(panel.getByRole("button", { name }));
  }
});

test("on-device caption generation is locked, but uploading and styling captions works", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("tab", { name: "Captions" }).click();
  const panel = page.getByRole("tabpanel", { name: "Captions" });
  await expect(panel.locator('[title="COMING SOON"]')).toHaveCount(1);
  await expectLocked(panel.getByRole("button", { name: "Generate captions" }));
  // The file upload next to it is NOT locked.
  await expect(panel.getByRole("button", { name: "Upload captions…" })).toBeEnabled();

  // No speech-model download or worker was started by opening the tab.
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  const srt = "1\n00:00:00,200 --> 00:00:01,500\nHello from a file\n";
  await page.getByLabel("Choose a caption file").setInputFiles({ name: "a.srt", mimeType: "text/plain", buffer: Buffer.from(srt) });
  await expect(page.getByLabel("Caption at 0:00.2")).toHaveValue("Hello from a file");
  await page.getByRole("group", { name: "Caption look" }).getByRole("button", { name: "Bold" }).click();
  expect(requests.filter((u) => /huggingface|jsdelivr|onnx|whisper/i.test(u))).toEqual([]);
});

test("the landing page shows AI Edit with a Coming soon badge and claims nothing that doesn't work", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("section[aria-labelledby='ai-title']");
  await expect(section).toBeVisible();
  await expect(section.getByText("Coming soon", { exact: true })).toBeVisible();
  await expect(section.getByRole("link")).toHaveCount(0); // nothing to click through to yet
});
