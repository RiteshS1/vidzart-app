// Editing commands shared by toolbar buttons and keyboard shortcuts, so both
// always do exactly the same thing.

import { addTrim, addZoom, removeSegment } from "@/lib/project/segments";
import type { Segment } from "@/lib/project/types";
import type { EditOptions, EditorStore } from "./store";

/**
 * Applies a segments change as one undoable edit, but only if something
 * actually changed. Helpers like addZoom return a copy even when there was
 * no room, and recording that would add an empty Undo step.
 */
export function editSegments(
  store: EditorStore,
  change: (segments: readonly Segment[], duration: number) => Segment[],
  options?: EditOptions,
): boolean {
  let changed = false;
  store.edit((p) => {
    const next = change(p.segments, p.source.duration);
    changed = next.length !== p.segments.length || next.some((s, i) => s !== p.segments[i]);
    return changed ? { ...p, segments: next } : p;
  }, options);
  return changed;
}

/** Default length of a zoom added with the button or the Z key. */
export const DEFAULT_ZOOM_MS = 2_500;

/** Add a zoom starting at the playhead; returns the new zoom's id or null. */
export function addZoomAt(store: EditorStore, sourceMs: number): string | null {
  const before = new Set(store.getState().project.segments.map((s) => s.id));
  editSegments(store, (segments, duration) =>
    addZoom(segments, sourceMs, sourceMs + DEFAULT_ZOOM_MS, duration),
  );
  const added = store.getState().project.segments.find((s) => !before.has(s.id));
  if (added) store.setUi({ selectedSegmentId: added.id, range: null });
  return added?.id ?? null;
}

/** Cut out the range currently selected on the timeline. */
export function cutSelectedRange(store: EditorStore): boolean {
  const { range, project } = store.getState();
  if (!range) return false;
  editSegments(store, (segments) =>
    addTrim(segments, range.start, range.end, project.source.duration),
  );
  store.setUi({ range: null });
  return true;
}

/** Remove everything before the playhead. */
export function trimStartTo(store: EditorStore, sourceMs: number): void {
  editSegments(store, (segments, duration) => addTrim(segments, 0, sourceMs, duration));
}

/** Remove everything after the playhead. */
export function trimEndFrom(store: EditorStore, sourceMs: number): void {
  editSegments(store, (segments, duration) => addTrim(segments, sourceMs, duration, duration));
}

/** Delete the selected segment (for a trim: restores the cut footage). */
export function removeSelectedSegment(store: EditorStore): boolean {
  const { selectedSegmentId } = store.getState();
  if (!selectedSegmentId) return false;
  editSegments(store, (segments) => removeSegment(segments, selectedSegmentId));
  store.setUi({ selectedSegmentId: null });
  return true;
}
