// Feature switches.
//
// AI features (on-device captions, silence/filler removal, bring-your-own-key
// writing tools) are built and tested but locked for now: the UI shows them
// disabled with a "COMING SOON" hover. Flip AI_LAUNCHED to true to open them
// for everyone.
//
// The owner (and the test suite) can unlock them in one browser without
// shipping anything: run `localStorage.setItem("vidzart.unlockAi", "1")` in
// the console and reload. It isn't linked anywhere in the UI.

export const AI_LAUNCHED = false;

const UNLOCK_KEY = "vidzart.unlockAi";

/** True when AI tools should be usable. Client-only (reads localStorage). */
export function aiEnabled(): boolean {
  if (AI_LAUNCHED) return true;
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false; // storage blocked
  }
}
