// Filler words ("um", "uh") found in the caption word timings, to cut them.
//
// Best effort by nature: Whisper was trained on cleaned-up transcripts and
// often leaves fillers out entirely, so what it does transcribe can be cut,
// but a clean transcript doesn't prove a clean recording.

import type { CaptionCue } from "@/lib/project/types";

const FILLERS = new Set(["um", "umm", "uh", "uhh", "uhm", "erm", "er", "ah", "hmm", "mm", "mhm"]);
/** A little extra around the word: recognition timings are approximate. */
const MARGIN_MS = 40;

const normalize = (word: string) => word.toLowerCase().replace(/[^\p{L}]/gu, "");
export const isFiller = (word: string) => FILLERS.has(normalize(word));

export interface FillerCut {
  start: number;
  end: number;
  word: string;
}

export function findFillers(cues: readonly CaptionCue[]): FillerCut[] {
  const words = cues.flatMap((c) => c.words ?? []);
  const cuts: FillerCut[] = [];
  words.forEach((word, i) => {
    if (!isFiller(word.text)) return;
    // Widen by the margin, but never into the neighboring words.
    const prevEnd = words[i - 1]?.end ?? -Infinity;
    const nextStart = words[i + 1]?.start ?? Infinity;
    cuts.push({
      start: Math.max(0, Math.max(prevEnd, word.start - MARGIN_MS)),
      end: Math.min(nextStart, word.end + MARGIN_MS),
      word: word.text.trim(),
    });
  });
  return cuts;
}

/** The cues without their filler words (text rebuilt from the remaining words). */
export function withoutFillers(cues: readonly CaptionCue[]): CaptionCue[] {
  return cues
    .map((cue) => {
      if (!cue.words?.some((w) => isFiller(w.text))) return cue;
      const words = cue.words.filter((w) => !isFiller(w.text));
      const text = words.map((w) => w.text.trim()).join(" ");
      // "um, so" → "so": capitalize like the original first word was.
      const fixed = /^\p{Lu}/u.test(cue.text) ? text.charAt(0).toUpperCase() + text.slice(1) : text;
      return { ...cue, words, text: fixed };
    })
    .filter((cue) => cue.text.trim());
}
