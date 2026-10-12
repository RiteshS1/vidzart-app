import type { ReactNode } from "react";

/**
 * Shows a feature that isn't available yet: dimmed, not interactive (`inert`
 * also removes it from the keyboard tab order and from assistive-tech
 * interaction), with a "COMING SOON" tooltip on hover and a visible badge,
 * so touch screens (no hover) and screen readers get the message too.
 */
export function ComingSoon({
  children,
  className = "",
  badge = true,
}: {
  children: ReactNode;
  className?: string;
  /** Show the visible "Coming soon" pill (turn off when the surrounding text already says it). */
  badge?: boolean;
}) {
  return (
    <div title="COMING SOON" className={`relative ${className}`}>
      {badge && (
        <span className="pointer-events-none absolute -top-2 right-0 z-10 rounded-full border border-accent/50 bg-bg px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-accent uppercase">
          Coming soon
        </span>
      )}
      {/* pointer-events-none lets the hover fall through to the wrapper, which carries the title. */}
      <div inert aria-disabled="true" className="pointer-events-none opacity-45 select-none">
        {children}
      </div>
    </div>
  );
}
