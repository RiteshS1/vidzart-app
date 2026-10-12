// Files a project uses besides its video (background music, later images),
// keyed by their path inside the .vidz ("assets/music.mp3"). Kept outside
// the project JSON (which only references them) and outside the undo
// history: undoing "add music" removes the reference, the file just stays
// around unused until the project is saved without it.

export class AssetStore {
  private files: Record<string, Blob>;
  private listeners = new Set<() => void>();

  constructor(initial: Record<string, Blob> = {}) {
    this.files = { ...initial };
  }

  get(path: string): Blob | undefined {
    return this.files[path];
  }

  set(path: string, file: Blob): void {
    this.files = { ...this.files, [path]: file };
    for (const listener of this.listeners) listener();
  }

  /** Snapshot of all files (a new object after every change). */
  all(): Record<string, Blob> {
    return this.files;
  }

  /** Only the files a project actually references, for saving. */
  referencedBy(paths: readonly (string | undefined)[]): Record<string, Blob> {
    const out: Record<string, Blob> = {};
    for (const path of paths) if (path && this.files[path]) out[path] = this.files[path]!;
    return out;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

/** Paths of the assets a project references. */
export function assetPaths(project: { audio?: { music?: { src: string } } }): string[] {
  return project.audio?.music ? [project.audio.music.src] : [];
}
