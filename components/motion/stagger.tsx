"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface StaggerProps {
  children: ReactNode;
  className?: string;
  /** Seconds between each child starting. */
  gap?: number;
  /** Seconds before the first child starts. */
  delay?: number;
}

/**
 * Plays its <StaggerItem> children in one after another on mount, so a block
 * of related content (a hero, a row of tiles) arrives as a sequence instead of
 * all at once. Reduced motion shows everything immediately.
 */
export function Stagger({ children, className, gap = 0.07, delay = 0.05 }: StaggerProps) {
  const reduce = useReducedMotion();
  const container: Variants = {
    hidden: {},
    visible: { transition: reduce ? {} : { staggerChildren: gap, delayChildren: delay } },
  };
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  distance = 14,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const reduce = useReducedMotion();
  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : distance, filter: reduce ? "none" : "blur(4px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: reduce ? 0 : 0.6, ease: EASE },
    },
  };
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
