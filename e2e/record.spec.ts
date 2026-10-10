import { test, expect, chromium } from "@playwright/test";

// getDisplayMedia normally shows a picker that only a human can answer.
// Chrome's test flags replace it:
//   --use-fake-ui-for-media-stream       auto-accept the picker / permission
//   --use-fake-device-for-media-stream   capture a synthetic 1280×720 "screen"
// (Real tab capture via --auto-select-tab-capture-source-by-title fails
// under automation with "Could not start video source", see LEARNINGS.md.)

test("records the screen and offers the file for download", async ({ baseURL }) => {
  const browser = await chromium.launch({
    channel: "chrome",
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  const page = await browser.newPage({ baseURL });
  await page.goto("/record");
  await page.getByLabel("Record tab / system audio").uncheck();
  await page.getByRole("button", { name: "Start recording" }).click();

  await expect(page.getByText("Recording", { exact: true })).toBeVisible();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Stop" }).click();

  // Done screen: a playable file with a measured duration.
  const download = page.getByRole("link", { name: "Download" });
  await expect(download).toBeVisible();
  await expect(download).toHaveAttribute("download", /^vidzart-recording\.(webm|mp4)$/);

  const durationText = await page.locator("dt:has-text('Duration') + dd").textContent();
  const [m, s] = (durationText ?? "").split(":");
  const seconds = Number(m) * 60 + Number(s);
  expect(seconds).toBeGreaterThan(1.5);
  expect(seconds).toBeLessThan(4);

  // The blob really is a video the browser can decode.
  const info = await page.locator("video").evaluate(async (el) => {
    const video = el as HTMLVideoElement;
    if (video.readyState < 1) {
      await new Promise((resolve) =>
        video.addEventListener("loadedmetadata", resolve, { once: true }),
      );
    }
    const blob = await (await fetch(video.src)).blob();
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      bytes: blob.size,
      type: blob.type,
    };
  });
  expect(info.width).toBe(1280);
  expect(info.height).toBe(720);
  expect(info.bytes).toBeGreaterThan(10_000);
  expect(info.type).toMatch(/^video\/(webm|mp4)/);

  // Hand the recording straight to the editor.
  await page.getByRole("button", { name: "Open in editor" }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByTestId("file-name")).toHaveText(/^vidzart-recording\.(webm|mp4)$/);
  await expect(page.getByTestId("preview-canvas")).toBeVisible();

  await browser.close();
});

test("shows a friendly error when sharing is cancelled", async ({ page }) => {
  // Simulate the user pressing "Cancel" in the picker: Chrome rejects with
  // a NotAllowedError DOMException.
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = () =>
      Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });
  await page.goto("/record");
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByText("Screen sharing was cancelled or blocked.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start recording" })).toBeVisible();
});
