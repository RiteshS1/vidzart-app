// Turns word timings from speech recognition into caption cues: short,
// readable lines that appear and disappear with the speech.
//
// Subtitle style guides (Netflix, BBC) agree on roughly: at most ~42
// characters per line, at most ~6 s on screen, break at sentence ends and at
// pauses. We build cues greedily, word by word, starting a new cue when:
//   - adding the word would exceed MAX_CHARS,
//   - there's a pause before the word (> PAUSE_MS),
//   - the cue already ends a sentence and is reasonably long,
//   - or the cue would last longer than MAX_MS.

import { newSegmentId } from "@/lib/project/segments";
import type { CaptionCue, CaptionWord } from "@/lib/project/types";

const MAX_CHARS = 42;
const MAX_MS = 6000;
const PAUSE_MS = 700;
const SENTENCE_MIN_CHARS = 16;

export function wordsToCues(words: readonly CaptionWord[], makeId: () => string = newSegmentId): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let current: CaptionWord[] = [];

  const textOf = (ws: readonly CaptionWord[]) => ws.map((w) => w.text.trim()).filter(Boolean).join(" ");
  const flush = () => {
    const text = textOf(current);
    if (text) cues.push({ id: makeId(), start: current[0]!.start, end: current.at(-1)!.end, text, words: current });
    current = [];
  };

  for (const word of words) {
    if (!word.text.trim()) continue;
    const last = current.at(-1);
    if (last) {
      const text = textOf(current);
      const tooLong = text.length + 1 + word.text.trim().length > MAX_CHARS;
      const pause = word.start - last.end > PAUSE_MS;
      const sentenceEnd = /[.!?…]["')\]]?$/.test(last.text.trim()) && text.length >= SENTENCE_MIN_CHARS;
      const tooSlow = word.end - current[0]!.start > MAX_MS;
      if (tooLong || pause || sentenceEnd || tooSlow) flush();
    }
    current.push({ start: word.start, end: word.end, text: word.text.trim() });
  }
  flush();

  // Cues must not overlap (spec): recognition timings can, slightly.
  for (let i = 1; i < cues.length; i++) {
    if (cues[i]!.start < cues[i - 1]!.end) cues[i - 1]!.end = cues[i]!.start;
  }
  return cues;
}

/** The cue showing at source time t, if any (cues sorted, non-overlapping). */
export function cueAt(cues: readonly CaptionCue[], t: number): CaptionCue | undefined {
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cue = cues[mid]!;
    if (t < cue.start) hi = mid - 1;
    else if (t >= cue.end) lo = mid + 1;
    else return cue;
  }
  return undefined;
}
