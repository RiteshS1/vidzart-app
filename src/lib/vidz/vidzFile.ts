// Reading and writing .vidz project files (CLAUDE.md → Project file format).
//
// Reading is defensive: a .vidz may come from an older/newer app version or
// be hand-edited, so every JSON file is checked before we trust it, and the
// error says what's wrong instead of crashing somewhere in the editor later.

import type { VidzEvents } from "@/lib/events/types";
import type { VidzProject } from "@/lib/project/types";
import { readZip, writeZip, ZipError, type ZipInput } from "./zip";

export const VIDZ_FORMAT = "vidzart-project";
/** The newest version of each JSON file this app understands. */
export const CURRENT_VERSION = 1;

export interface VidzManifest {
  format: typeof VIDZ_FORMAT;
  version: number;
  createdAt: string;
  createdBy: { app: "vidzart-extension" | "vidzart-app"; version: string };
  files: { video: string; events?: string; project: string };
}

export interface VidzContents {
  manifest: VidzManifest;
  video: File;
  events: VidzEvents | null;
  project: VidzProject;
  /** Files under assets/ (e.g. background music), by their path in the zip. */
  assets: Record<string, Blob>;
}

export class VidzError extends Error {}

export async function readVidz(file: Blob): Promise<VidzContents> {
  let entries;
  try {
    entries = await readZip(file);
  } catch (error) {
    if (error instanceof ZipError) throw new VidzError("This isn't a valid .vidz file (not a zip archive).");
    throw error;
  }

  const readJson = async (name: string): Promise<unknown> => {
    const entry = entries.get(name);
    if (!entry) throw new VidzError(`The project is missing ${name}.`);
    try {
      return JSON.parse(await entry.text());
    } catch {
      throw new VidzError(`${name} isn't valid JSON.`);
    }
  };

  const manifest = await readJson("manifest.json");
  assertManifest(manifest);

  const videoEntry = entries.get(manifest.files.video);
  if (!videoEntry) throw new VidzError(`The project is missing its video (${manifest.files.video}).`);
  const videoType = manifest.files.video.endsWith(".mp4") ? "video/mp4" : "video/webm";
  // A File (not just a Blob) so the editor can show its name. Still a
  // zero-copy slice of the .vidz when the video is stored uncompressed.
  const video = new File([await videoEntry.blob()], manifest.files.video, { type: videoType });

  const project = migrateProject(await readJson(manifest.files.project));
  const events = manifest.files.events ? migrateEvents(await readJson(manifest.files.events)) : null;

  // Assets are referenced from project.json by their zip path ("assets/…").
  const assets: Record<string, Blob> = {};
  for (const [name, entry] of entries) {
    if (name.startsWith("assets/") && !name.endsWith("/")) assets[name] = await entry.blob();
  }

  return { manifest, video, events, project, assets };
}

export async function writeVidz(contents: {
  project: VidzProject;
  video: Blob;
  videoName: "video.webm" | "video.mp4";
  events: VidzEvents | null;
  appVersion: string;
  /** Extra files under assets/, by path (e.g. "assets/music.mp3"). */
  assets?: Record<string, Blob>;
}): Promise<Blob> {
  const manifest: VidzManifest = {
    format: VIDZ_FORMAT,
    version: CURRENT_VERSION,
    createdAt: new Date().toISOString(),
    createdBy: { app: "vidzart-app", version: contents.appVersion },
    files: {
      video: contents.videoName,
      ...(contents.events ? { events: "events.json" } : {}),
      project: "project.json",
    },
  };
  const json = (value: unknown) => new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const inputs: ZipInput[] = [
    { name: "manifest.json", data: json(manifest), compress: true },
    // Already-compressed video: store as-is (spec), so readers can slice it.
    { name: contents.videoName, data: contents.video },
    { name: "project.json", data: json(contents.project), compress: true },
  ];
  if (contents.events) inputs.push({ name: "events.json", data: json(contents.events), compress: true });
  // Media assets are already compressed: store them as-is, like the video.
  for (const [name, data] of Object.entries(contents.assets ?? {})) inputs.push({ name, data });
  return writeZip(inputs);
}

// --- validation & migration -----------------------------------------------

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function checkVersion(name: string, value: Json): number {
  const version = value.version;
  if (!Number.isInteger(version)) throw new VidzError(`${name} has no version.`);
  if ((version as number) > CURRENT_VERSION) {
    throw new VidzError(`This project was made with a newer Vidzart (${name} v${String(version)}). Please update Vidzart.`);
  }
  return version as number;
}

function assertManifest(value: unknown): asserts value is VidzManifest {
  if (!isObject(value) || value.format !== VIDZ_FORMAT) {
    throw new VidzError("This zip isn't a Vidzart project (manifest.json has the wrong format).");
  }
  checkVersion("manifest.json", value);
  const files = value.files;
  if (!isObject(files) || typeof files.video !== "string" || typeof files.project !== "string") {
    throw new VidzError("manifest.json doesn't list the project's files.");
  }
}

/**
 * Brings project.json up to the current version. There's only v1 so far;
 * when v2 arrives, add `if (version === 1) { value = migrateV1ToV2(value) }`
 * steps here, one per version, so any old file walks forward to today.
 */
function migrateProject(value: unknown): VidzProject {
  if (!isObject(value)) throw new VidzError("project.json is malformed.");
  checkVersion("project.json", value);
  const source = value.source;
  if (
    !isObject(source) ||
    !isNumber(source.duration) ||
    !isNumber(source.width) ||
    !isNumber(source.height) ||
    !isNumber(source.fps)
  ) {
    throw new VidzError("project.json is missing the video's size or duration.");
  }
  if (!isObject(value.settings) || !Array.isArray(value.segments)) {
    throw new VidzError("project.json is missing settings or segments.");
  }
  const segments = value.segments.filter(
    (s): s is Json => isObject(s) && typeof s.id === "string" && isNumber(s.start) && isNumber(s.end),
  );
  // Captions are optional: if they're malformed, drop them rather than
  // refusing the whole project.
  const captions = value.captions;
  const captionsOk =
    isObject(captions) &&
    isObject(captions.style) &&
    Array.isArray(captions.cues) &&
    captions.cues.every((c) => isObject(c) && isNumber(c.start) && isNumber(c.end) && typeof c.text === "string");
  const project: Json = { ...value, segments };
  if (!captionsOk) delete project.captions;
  // Unknown fields are kept (spread), so saving with this version doesn't
  // destroy data a newer version added.
  return project as unknown as VidzProject;
}

function migrateEvents(value: unknown): VidzEvents {
  if (!isObject(value)) throw new VidzError("events.json is malformed.");
  checkVersion("events.json", value);
  const viewport = value.viewport;
  if (!isObject(viewport) || !isNumber(viewport.width) || !isNumber(viewport.height) || !Array.isArray(value.events)) {
    throw new VidzError("events.json is missing the viewport or events.");
  }
  const events = value.events
    .filter((e): e is Json => isObject(e) && isNumber(e.t) && typeof e.type === "string")
    .sort((a, b) => (a.t as number) - (b.t as number));
  return { ...value, events } as unknown as VidzEvents;
}
