// TypeScript's DOM types only list `audio` and `video` for getDisplayMedia().
// Chrome supports more options (Screen Capture spec + Chrome extensions to
// it), so we add them here. Interfaces with the same name merge, so this
// extends the built-in type instead of replacing it.
//
// Spec: https://w3c.github.io/mediacapture-screen-share/#displaymediastreamoptions
// Chrome guide: https://developer.chrome.com/docs/web-platform/screen-sharing-controls

export {};

declare global {
  interface DisplayMediaStreamOptions {
    /** Offer the current tab first in the picker. */
    preferCurrentTab?: boolean;
    /** Whether the current tab appears in the picker at all. */
    selfBrowserSurface?: "include" | "exclude";
    /** Show a "Share this tab instead" button while capturing a tab. */
    surfaceSwitching?: "include" | "exclude";
    /** Whether system audio can be shared when capturing a whole screen. */
    systemAudio?: "include" | "exclude";
    /** Whether whole screens are offered in the picker. */
    monitorTypeSurfaces?: "include" | "exclude";
  }
}
