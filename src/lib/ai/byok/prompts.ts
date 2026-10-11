// Prompts for the BYOK writing tools, and parsers for their answers.
//
// Everything is built from the captions, mapped to OUTPUT time (what the
// viewer of the exported video sees), so chapter times match the export.

import type { OutputCue } from "@/lib/captions/subtitles";

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function transcriptForPrompt(cues: readonly OutputCue[]): string {
  return cues.map((c) => `[${clock(c.start)}] ${c.text}`).join("\n");
}

export const SYSTEM =
  "You help creators publish screen-recorded product demos and tutorials. Be concise and concrete. " +
  "Use only information from the transcript. Answer in the transcript's language unless asked otherwise.";

export type WritingTask = "title" | "chapters" | "summary";

export function writingPrompt(task: WritingTask, transcript: string): string {
  const instructions: Record<WritingTask, string> = {
    title:
      "Write a clear, specific video title (max 70 characters) on the first line, then a blank line, " +
      "then a 2–3 sentence description for YouTube. No hashtags, no emojis, no quotes around the title.",
    chapters:
      "Write YouTube chapters for this video: one per line as `m:ss Title`, the first one at 0:00, " +
      "3 to 8 chapters, at least 10 seconds apart, using the transcript's timestamps. Output only the chapter lines.",
    summary: "Summarize what this video shows in 3–5 short bullet points starting with '- '. Output only the bullets.",
  };
  return `${instructions[task]}\n\nTranscript (timestamps in [m:ss]):\n${transcript}`;
}

/** Keeps only well-formed chapter lines ("m:ss Title"), sorted, starting at 0:00. */
export function parseChapters(text: string): string[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
    .map((l) => /^(\d{1,2}):([0-5]\d)\s*[-–—:]?\s*(.+)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ s: Number(m[1]) * 60 + Number(m[2]), title: m[3]!.trim() }))
    .sort((a, b) => a.s - b.s);
  if (lines.length === 0) return [];
  lines[0]!.s = 0; // YouTube requires the first chapter at 0:00
  return lines.map((l) => `${clock(l.s * 1000)} ${l.title}`);
}

// --- caption translation ------------------------------------------------------
// Captions go out as numbered lines and must come back the same way, so each
// translation lands on its original cue and keeps its timing.

export function translationPrompt(texts: readonly string[], language: string): string {
  return (
    `Translate each numbered caption line into ${language}. Keep the numbering and the "N|" prefix, ` +
    `one line per caption, same count (${texts.length}), no extra text.\n\n` +
    texts.map((t, i) => `${i + 1}|${t.replace(/\n/g, " ")}`).join("\n")
  );
}

export function parseTranslation(text: string, count: number): string[] {
  const out = new Array<string | undefined>(count);
  for (const line of text.split("\n")) {
    const m = /^\s*(\d+)\s*\|\s*(.*)$/.exec(line);
    if (!m) continue;
    const i = Number(m[1]) - 1;
    if (i >= 0 && i < count && m[2]!.trim()) out[i] = m[2]!.trim();
  }
  const missing = out.findIndex((t) => t === undefined);
  if (missing >= 0) throw new Error(`The translation is missing line ${missing + 1}. Try again or use a stronger model.`);
  return out as string[];
}
