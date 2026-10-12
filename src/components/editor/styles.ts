// Shared Tailwind class strings for editor controls, built on the design
// tokens in globals.css. Every interactive control is at least 44px tall on
// a phone (touch) and 32px (36px for the main actions) from md up, with a visible hover, press and focus state.

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-40";

/** Secondary action: neutral surface with a hairline border. */
export const button = `${base} h-11 border border-line bg-surface-2 px-3 text-ink md:h-8 hover:bg-surface-3 active:bg-surface-3/80`;

/** Square icon-only button (needs an aria-label). */
export const iconButton = `${base} size-11 border border-line bg-surface-2 text-ink md:size-9 hover:bg-surface-3`;

/** Quiet button for toolbars: no border until hovered. */
export const ghostButton = `${base} h-11 px-2.5 md:h-8 text-ink-muted hover:bg-surface-3 hover:text-ink`;

/** The one primary action per view (Export, Generate, …). */
export const primaryButton = `${base} h-11 md:h-9 bg-ink px-4 font-semibold text-bg hover:bg-white active:bg-ink/90`;

/** Small uppercase section label. */
export const panelLabel = "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted";

/** A segmented-control option; pair with aria-pressed. */
export const segment = (active: boolean) =>
  `rounded-md px-2 py-2.5 text-xs md:py-1.5 font-medium transition-colors duration-150 cursor-pointer ${
    active ? "bg-ink text-bg" : "bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
  }`;
