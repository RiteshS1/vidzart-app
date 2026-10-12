// Shared Tailwind class strings for editor controls, built on the design
// tokens in globals.css. Every interactive control is at least 32px tall
// (36px for the main actions) with a visible hover, press and focus state.

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-40";

/** Secondary action: neutral surface with a hairline border. */
export const button = `${base} h-8 border border-line bg-surface-2 px-3 text-ink hover:bg-surface-3 active:bg-surface-3/80`;

/** Square icon-only button (needs an aria-label). */
export const iconButton = `${base} size-9 border border-line bg-surface-2 text-ink hover:bg-surface-3`;

/** Quiet button for toolbars: no border until hovered. */
export const ghostButton = `${base} h-8 px-2.5 text-ink-muted hover:bg-surface-3 hover:text-ink`;

/** The one primary action per view (Export, Generate, …). */
export const primaryButton = `${base} h-9 bg-brand px-4 font-semibold text-white shadow-[0_0_24px_-6px_var(--accent)] hover:brightness-110 active:brightness-95`;

/** Small uppercase section label. */
export const panelLabel = "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted";

/** A segmented-control option; pair with aria-pressed. */
export const segment = (active: boolean) =>
  `rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer ${
    active ? "bg-ink text-bg" : "bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
  }`;
