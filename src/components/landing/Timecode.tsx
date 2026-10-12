"use client";

import { useEffect, useRef } from "react";

/**
 * A running SMPTE-style timecode (HH:MM:SS:FF at 30 fps), like a camera's
 * monitor overlay. Written straight to the DOM a few times per second, not
 * through React state.
 */
export function Timecode() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const start = performance.now();
    const pad = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const ms = performance.now() - start;
      const s = Math.floor(ms / 1000);
      if (ref.current) {
        ref.current.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(Math.floor((ms % 1000) / 33.34))}`;
      }
    };
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, []);
  return (
    <span ref={ref} className="tabular-nums">
      00:00:00:00
    </span>
  );
}
