// Passes a just-recorded video from /record to /editor without saving it
// anywhere. Next.js <Link>/router navigation is client-side, so this module
// (and the File it holds) stays in memory across the route change. A full
// page reload clears it, which is fine: it's a one-shot handoff.

let pending: File | null = null;

export function setPendingVideo(file: File): void {
  pending = file;
}

/** Returns the pending file once, then forgets it. */
export function takePendingVideo(): File | null {
  const file = pending;
  pending = null;
  return file;
}
