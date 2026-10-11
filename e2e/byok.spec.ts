import { test, expect, type Page } from "@playwright/test";
import { createProject } from "../src/lib/project/defaults";
import { writeVidz } from "../src/lib/vidz/vidzFile";

// BYOK tools against a mocked provider: page.route intercepts the request
// in the browser, so we can check exactly what would be sent (key, headers,
// transcript) without a real key or network.

async function openProjectWithCaptions(page: Page) {
  await page.goto("/editor");
  const video = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d")!;
    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: "video/webm;codecs=vp8" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((r) => (recorder.onstop = () => r()));
    const timer = setInterval(() => {
      ctx.fillStyle = `hsl(${Math.random() * 360} 70% 50%)`;
      ctx.fillRect(0, 0, 160, 90);
    }, 30);
    recorder.start(250);
    await new Promise((r) => setTimeout(r, 1500));
    recorder.stop();
    await done;
    clearInterval(timer);
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  const project = {
    ...createProject({ duration: 12_000, width: 160, height: 90, fps: 30 }),
    // 2–4 s is cut, so "Export it" (source 8 s) is at 0:06 in the output.
    segments: [{ id: "t", type: "trim" as const, start: 2000, end: 4000 }],
    captions: {
      visible: true,
      style: { size: 0.05, position: "bottom" as const },
      cues: [
        { id: "a", start: 0, end: 1500, text: "Hello world" },
        { id: "b", start: 8000, end: 9000, text: "Export it" },
      ],
    },
  };
  const vidz = await writeVidz({ project, video: new Blob([new Uint8Array(video)]), videoName: "video.webm", events: null, appVersion: "t" });
  await page.getByLabel("Choose a video file").setInputFiles({ name: "demo.vidz", mimeType: "application/zip", buffer: Buffer.from(await vidz.arrayBuffer()) });
  await expect(page.getByTestId("file-name")).toHaveText("demo.vidz");
  await page.getByRole("tab", { name: "✨ AI" }).click();
}

test("writes chapters and translates captions with the user's Anthropic key", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (r) => hosts.add(new URL(r.url()).host));
  const sent: { headers: Record<string, string>; body: { model: string; system: string; messages: { content: string }[] } }[] = [];
  await page.route("https://api.anthropic.com/v1/messages", async (route) => {
    const body = route.request().postDataJSON();
    sent.push({ headers: route.request().headers(), body });
    const prompt: string = body.messages[0].content;
    const text = prompt.includes("chapters") ? "Sure!\n0:00 Intro\n0:06 Exporting" : "1|Hola mundo\n2|Expórtalo";
    await route.fulfill({ json: { content: [{ type: "text", text }] } });
  });

  await openProjectWithCaptions(page);
  await expect(page.getByText("Stored on this device only")).toBeVisible();
  await page.getByPlaceholder("Paste your key").fill("sk-ant-test-123");

  await page.getByRole("button", { name: "Chapters" }).click();
  await expect(page.getByLabel("Chapters result")).toHaveValue("0:00 Intro\n0:06 Exporting");
  expect(sent[0]!.headers["x-api-key"]).toBe("sk-ant-test-123");
  expect(sent[0]!.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  expect(sent[0]!.body.model).toBe("claude-haiku-5-5");
  // The transcript is in OUTPUT time: the 2 s cut moves "Export it" to 0:06.
  expect(sent[0]!.body.messages[0]!.content).toContain("[0:00] Hello world\n[0:06] Export it");

  await page.getByLabel("Translate captions to").selectOption("es");
  await page.getByRole("button", { name: "Translate captions" }).click();
  await expect(page.getByLabel("Caption at 0:00.0")).toHaveValue("Hola mundo");
  await expect(page.getByLabel("Caption at 0:08.0")).toHaveValue("Expórtalo");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Caption at 0:00.0")).toHaveValue("Hello world");

  // Only our own origin and the provider were contacted.
  expect([...hosts].filter((h) => !h.startsWith("localhost"))).toEqual(["api.anthropic.com"]);

  // The key persists in this browser only, and "Remove key" deletes it.
  expect(await page.evaluate(() => localStorage.getItem("vidzart.byok"))).toContain("sk-ant-test-123");
  await page.getByRole("button", { name: "Remove key" }).click();
  expect(await page.evaluate(() => localStorage.getItem("vidzart.byok"))).not.toContain("sk-ant-test-123");
});

test("shows the provider's error for a bad key", async ({ page }) => {
  await page.route("https://api.openai.com/v1/chat/completions", (route) =>
    route.fulfill({ status: 401, json: { error: { message: "Incorrect API key provided." } } }),
  );
  await openProjectWithCaptions(page);
  await page.getByLabel("Provider").selectOption("openai");
  await page.getByPlaceholder("Paste your key").fill("sk-wrong");
  await page.getByPlaceholder("Model id").fill("some-model");
  await page.getByRole("button", { name: "Summary" }).click();
  // (Not getByRole("alert") alone: Next's route announcer is an alert too.)
  await expect(page.getByRole("alert").filter({ hasText: "rejected" })).toHaveText("OpenAI rejected the API key (401). Incorrect API key provided.");
});
