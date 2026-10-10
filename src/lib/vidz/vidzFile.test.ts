import { describe, expect, it } from "vitest";
import type { VidzEvents } from "@/lib/events/types";
import { createProject } from "@/lib/project/defaults";
import { readVidz, VidzError, writeVidz } from "./vidzFile";
import { writeZip } from "./zip";

const project = createProject({ duration: 5_000, width: 1280, height: 720, fps: 30 });
const events: VidzEvents = {
  version: 1,
  viewport: { width: 1280, height: 720, devicePixelRatio: 2 },
  startedAt: 1_700_000_000_000,
  events: [{ t: 100, type: "click", x: 10, y: 20, button: 0 }],
};
const video = new Blob([new Uint8Array(4_096).fill(7)], { type: "video/webm" });
const json = (v: unknown) => new Blob([JSON.stringify(v)]);

describe(".vidz round trip", () => {
  it("writes and reads a full project", async () => {
    const file = await writeVidz({ project, video, videoName: "video.webm", events, appVersion: "0.1.0" });
    const read = await readVidz(file);
    expect(read.manifest.format).toBe("vidzart-project");
    expect(read.project).toEqual(project);
    expect(read.events).toEqual(events);
    expect(read.video.name).toBe("video.webm");
    expect(read.video.type).toBe("video/webm");
    expect(read.video.size).toBe(4_096);
  });

  it("works without an event log", async () => {
    const file = await writeVidz({ project, video, videoName: "video.mp4", events: null, appVersion: "0.1.0" });
    const read = await readVidz(file);
    expect(read.events).toBeNull();
    expect(read.video.type).toBe("video/mp4");
  });

  it("keeps unknown fields from newer writers", async () => {
    const file = await writeVidz({
      project: { ...project, futureField: { keep: true } } as typeof project,
      video,
      videoName: "video.webm",
      events: null,
      appVersion: "0.1.0",
    });
    const read = await readVidz(file);
    expect((read.project as unknown as { futureField: unknown }).futureField).toEqual({ keep: true });
  });
});

describe("readVidz errors", () => {
  const manifest = {
    format: "vidzart-project",
    version: 1,
    createdAt: "",
    createdBy: { app: "vidzart-app", version: "0" },
    files: { video: "video.webm", project: "project.json" },
  };

  it("rejects non-zips", async () => {
    await expect(readVidz(new Blob(["nope"]))).rejects.toThrow(/not a zip/);
  });

  it("rejects zips that aren't projects", async () => {
    const zip = await writeZip([{ name: "manifest.json", data: json({ format: "something-else" }) }]);
    await expect(readVidz(zip)).rejects.toThrow(/isn't a Vidzart project/);
  });

  it("asks to update for newer versions", async () => {
    const zip = await writeZip([
      { name: "manifest.json", data: json(manifest) },
      { name: "video.webm", data: video },
      { name: "project.json", data: json({ ...project, version: 2 }) },
    ]);
    await expect(readVidz(zip)).rejects.toThrow(/newer Vidzart/);
  });

  it("reports a missing video", async () => {
    const zip = await writeZip([
      { name: "manifest.json", data: json(manifest) },
      { name: "project.json", data: json(project) },
    ]);
    await expect(readVidz(zip)).rejects.toBeInstanceOf(VidzError);
  });
});
