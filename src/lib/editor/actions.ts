// Editing commands shared by toolbar buttons and keyboard shortcuts, so both
// always do exactly the same thing.

import { addTrim, removeSegment } from "@/lib/project/segments";
import type { EditorStore } from "./store";

/** Cut out the range currently selected on the timeline. */
export function cutSelectedRange(store: EditorStore): boolean {
  const { range, project } = store.getState();
  if (!range) return false;
  store.edit((p) => ({
    ...p,
    segments: addTrim(p.segments, range.start, range.end, project.source.duration),
  }));
  store.setUi({ range: null });
  return true;
}

/** Remove everything before the playhead. */
export function trimStartTo(store: EditorStore, sourceMs: number): void {
  store.edit((p) => ({ ...p, segments: addTrim(p.segments, 0, sourceMs, p.source.duration) }));
}

/** Remove everything after the playhead. */
export function trimEndFrom(store: EditorStore, sourceMs: number): void {
  store.edit((p) => ({
    ...p,
    segments: addTrim(p.segments, sourceMs, p.source.duration, p.source.duration),
  }));
}

/** Delete the selected segment (for a trim: restores the cut footage). */
export function removeSelectedSegment(store: EditorStore): boolean {
  const { selectedSegmentId } = store.getState();
  if (!selectedSegmentId) return false;
  store.edit((p) => ({ ...p, segments: removeSegment(p.segments, selectedSegmentId) }));
  store.setUi({ selectedSegmentId: null });
  return true;
}
