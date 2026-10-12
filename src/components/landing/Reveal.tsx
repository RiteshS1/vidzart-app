"use client";

import { motion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// Scroll reveals for the landing page: content fades up a little as it
// enters the viewport. Subtle on purpose (12 px, ~0.5 s), only once, and
// switched off for people who ask their OS for reduced motion.

export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
