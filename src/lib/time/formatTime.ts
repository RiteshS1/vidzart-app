/** Formats milliseconds as m:ss.t (e.g. 83_450 → "1:23.4"). */
export function formatTime(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((safe % 1000) / 100);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
}
