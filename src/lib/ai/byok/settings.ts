// Where BYOK settings live: this browser's localStorage, nowhere else. Not
// in .vidz files (those get shared), not on any server (there is none).

import type { ProviderId } from "./providers";

export interface ByokSettings {
  provider: ProviderId;
  keys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, string>>;
}

const STORAGE_KEY = "vidzart.byok";
export const DEFAULT_BYOK: ByokSettings = { provider: "anthropic", keys: {}, models: {} };

export function loadByok(): ByokSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_BYOK, ...(JSON.parse(raw) as Partial<ByokSettings>) } : DEFAULT_BYOK;
  } catch {
    return DEFAULT_BYOK; // storage blocked (private mode) or corrupt
  }
}

export function saveByok(settings: ByokSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: the key works for this session only.
  }
}
