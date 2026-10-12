// Projects saved in this browser, so closing the tab or reloading doesn't
// lose your edits. Lives in IndexedDB: it stores Blobs (the video) natively
// and on disk, and there's no server to save to.
//
// The video is written once when a project is created; every later save is
// just the small project JSON (edits), debounced by the editor.

import type { VidzEvents } from "@/lib/events/types";
import type { VidzProject } from "@/lib/project/types";

export interface StoredProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  video: File;
  events: VidzEvents | null;
  project: VidzProject;
  /** Files the project uses besides the video (e.g. music), by .vidz path. */
  assets?: Record<string, Blob>;
}

/** What the "Recent projects" list needs, without touching the video. */
export type ProjectSummary = Pick<StoredProject, "id" | "name" | "updatedAt"> & { durationMs: number; sizeBytes: number };

const DB_NAME = "vidzart";
const STORE = "projects";
const META = "projectMeta"; // summaries, so listing never loads Blob records

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
      request.result.createObjectStore(META, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx<T>(
  stores: string[],
  mode: IDBTransactionMode,
  fn: (t: IDBTransaction) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const t = db.transaction(stores, mode);
      const request = fn(t);
      // Resolve when the transaction commits: only then is the write durable.
      t.oncomplete = () => resolve(request ? request.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error ?? new Error("Saving was aborted (is the disk full?)."));
    });
  } finally {
    db.close();
  }
}

const summaryOf = (p: StoredProject): ProjectSummary => ({
  id: p.id,
  name: p.name,
  updatedAt: p.updatedAt,
  durationMs: p.project.source.duration,
  sizeBytes: p.video.size,
});

export async function createStoredProject(input: Omit<StoredProject, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const now = Date.now();
  const record: StoredProject = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  // Ask the browser not to evict our data under storage pressure. Chrome
  // decides silently (no prompt); it's fine if it says no.
  void navigator.storage?.persist?.().catch(() => false);
  await tx([STORE, META], "readwrite", (t) => {
    t.objectStore(STORE).put(record);
    t.objectStore(META).put(summaryOf(record));
  });
  return record.id;
}

/**
 * Read-modify-write of one record inside ONE readwrite transaction, so two
 * saves (edits and assets) can't overwrite each other's changes.
 */
async function updateRecord(id: string, change: (record: StoredProject) => StoredProject): Promise<void> {
  await tx([STORE, META], "readwrite", (t) => {
    const request = t.objectStore(STORE).get(id) as IDBRequest<StoredProject | undefined>;
    request.onsuccess = () => {
      if (!request.result) return; // deleted meanwhile
      const next = { ...change(request.result), updatedAt: Date.now() };
      t.objectStore(STORE).put(next);
      t.objectStore(META).put(summaryOf(next));
    };
  });
}

/** Saves new edits (project JSON only; the video never changes). */
export async function saveProjectEdits(id: string, project: VidzProject): Promise<void> {
  await updateRecord(id, (record) => ({ ...record, project }));
}

/** Saves the project's asset files (music…), replacing the previous set. */
export async function saveProjectAssets(id: string, assets: Record<string, Blob>): Promise<void> {
  await updateRecord(id, (record) => ({ ...record, assets }));
}

export async function getStoredProject(id: string): Promise<StoredProject | undefined> {
  return tx<StoredProject>([STORE], "readonly", (t) => t.objectStore(STORE).get(id));
}

/** Newest first. */
export async function listStoredProjects(): Promise<ProjectSummary[]> {
  const all = (await tx<ProjectSummary[]>([META], "readonly", (t) => t.objectStore(META).getAll())) ?? [];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteStoredProject(id: string): Promise<void> {
  await tx([STORE, META], "readwrite", (t) => {
    t.objectStore(STORE).delete(id);
    t.objectStore(META).delete(id);
  });
}
