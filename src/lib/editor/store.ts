// The editor's state container, deliberately tiny and framework-free.
//
// Why not plain React state? The preview's render loop runs 60×/s outside
// React and needs the *latest* project without re-rendering anything. A
// store with getState() + subscribe() serves both: the loop reads
// getState() directly, and components subscribe through
// useSyncExternalStore (see useEditor.ts), re-rendering only when the slice
// they select changes.
//
// Undo/redo: every project edit pushes the previous project onto `past`.
// That's cheap because edits create new objects instead of mutating, so old
// versions share all their unchanged parts.

import type { VidzProject } from "@/lib/project/types";

export interface TimeRange {
  start: number;
  end: number;
}

export interface EditorState {
  project: VidzProject;
  /** UI-only state below: not saved, not part of undo history. */
  selectedSegmentId: string | null;
  /** A range selected on the timeline (source ms), e.g. to cut. */
  range: TimeRange | null;
  /** Mirrors the history stacks so the UI can enable/disable Undo/Redo. */
  canUndo: boolean;
  canRedo: boolean;
}

export interface EditOptions {
  /**
   * Edits with the same key within COALESCE_MS merge into one undo step,
   * so dragging a slider is one undo, not two hundred.
   */
  coalesceKey?: string;
}

const COALESCE_MS = 600;
const MAX_HISTORY = 200;

export class EditorStore {
  private state: EditorState;
  private past: VidzProject[] = [];
  private future: VidzProject[] = [];
  private listeners = new Set<() => void>();
  private lastEdit: { key: string; at: number } | null = null;

  constructor(project: VidzProject) {
    this.state = { project, selectedSegmentId: null, range: null, canUndo: false, canRedo: false };
  }

  // Arrow functions so they can be passed around unbound (useSyncExternalStore does).
  getState = (): EditorState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Applies an undoable change to the project. `recipe` must not mutate. */
  edit(recipe: (project: VidzProject) => VidzProject, options: EditOptions = {}): void {
    const before = this.state.project;
    const after = recipe(before);
    if (after === before) return;

    const now = performance.now();
    const coalesce =
      options.coalesceKey !== undefined &&
      this.lastEdit?.key === options.coalesceKey &&
      now - this.lastEdit.at < COALESCE_MS;
    if (!coalesce) {
      this.past.push(before);
      if (this.past.length > MAX_HISTORY) this.past.shift();
    }
    this.lastEdit = options.coalesceKey ? { key: options.coalesceKey, at: now } : null;
    this.future = [];
    this.set({ project: after });
  }

  /** UI state changes (selection etc.): not undoable. */
  setUi(partial: Partial<Pick<EditorState, "selectedSegmentId" | "range">>): void {
    this.set(partial);
  }

  undo(): void {
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.state.project);
    this.lastEdit = null;
    this.set({ project: previous, selectedSegmentId: null });
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.state.project);
    this.lastEdit = null;
    this.set({ project: next, selectedSegmentId: null });
  }

  private set(partial: Partial<EditorState>): void {
    this.state = {
      ...this.state,
      ...partial,
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
    };
    for (const listener of this.listeners) listener();
  }
}
