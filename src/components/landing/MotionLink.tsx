"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";

// Links with a small physical response (Motion): they lift a touch on hover
// and press in on tap, like a real button. Springs, so it feels immediate.

const MotionNextLink = motion.create(Link);
const interaction = {
  whileHover: { y: -2 },
  whileTap: { scale: 0.97, y: 0 },
  transition: { type: "spring" as const, stiffness: 500, damping: 30 },
};

export function MotionLink({
  href,
  className,
  external,
  children,
}: {
  href: string;
  className?: string;
  /** Opens in a new tab (outside links like Buy me a coffee). */
  external?: boolean;
  children: ReactNode;
}) {
  if (external || href.startsWith("http")) {
    return (
      <motion.a href={href} target="_blank" rel="noreferrer" className={className} {...interaction}>
        {children}
      </motion.a>
    );
  }
  return (
    <MotionNextLink href={href} className={className} {...interaction}>
      {children}
    </MotionNextLink>
  );
}
