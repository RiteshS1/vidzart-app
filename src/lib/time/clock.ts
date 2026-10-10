// A high-resolution "epoch milliseconds" clock.
//
// `performance.now()` is monotonic (never jumps when the system clock changes)
// but counts from *this* context's `performance.timeOrigin`, so values from two
// contexts (e.g. a page and an extension's offscreen document) can't be
// compared directly. Adding `timeOrigin` turns it into epoch ms that ARE
// comparable across contexts on the same machine. This is the clock the .vidz
// spec uses for `events.json.startedAt` (see CLAUDE.md → Clock sync).
export function epochNow(): number {
  return performance.timeOrigin + performance.now();
}
