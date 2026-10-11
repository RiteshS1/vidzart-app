import { test, expect } from "@playwright/test";

// Autosave: edits survive a reload, and the project shows up under
// "Recent projects" on the editor's start screen.

test("edits are saved in the browser and the project can be reopened after a reload", async ({ page }) => {
  await page.goto("/editor");
  const video = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: "video/webm;codecs=vp8" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((r) => (recorder.onstop = () => r()));
    const timer = setInterval(() => {
      ctx.fillStyle = `hsl(${Math.random() * 360} 70% 50%)`;
      ctx.fillRect(0, 0, 320, 180);
    }, 30);
    recorder.start(250);
    await new Promise((r) => setTimeout(r, 3000));
    recorder.stop();
    await done;
    clearInterval(timer);
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  await page.getByLabel("Choose a video file").setInputFiles({ name: "my-demo.webm", mimeType: "video/webm", buffer: Buffer.from(video) });
  await expect(page.getByTestId("file-name")).toHaveText("my-demo.webm");
  await expect(page.getByTestId("autosave")).toHaveText("Saved in this browser");

  await page.keyboard.press("z"); // add a zoom
  await page.getByRole("button", { name: "Background: Ocean" }).click();
  // Saves are debounced (800 ms after the last edit); give it time to land.
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("autosave")).toHaveText("Saved in this browser");

  await page.reload();
  const recent = page.getByRole("region", { name: "Recent projects" });
  await expect(recent.getByText("my-demo.webm")).toBeVisible();
  await recent.getByRole("button", { name: "Open" }).click();
  await expect(page.getByTestId("file-name")).toHaveText("my-demo.webm");
  await expect(page.getByTestId("zoom-block")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Background: Ocean" })).toHaveAttribute("aria-pressed", "true");

  // Delete it from the list.
  await page.getByRole("button", { name: "Open another" }).click();
  await page.getByRole("button", { name: "Delete my-demo.webm" }).click();
  await expect(page.getByRole("region", { name: "Recent projects" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "Recent projects" })).toHaveCount(0);
});
