"use client";
import React from "react";
import { motion, useReducedMotion } from "motion/react";

export interface ScrollFadeInProps {
  children: React.ReactNode;
  direction?: "up" | "down" | "left" | "right" | "none"; // default "up"
  distance?: number; // px, default 40
  duration?: number; // s, default 0.6
  delay?: number; // s, default 0
  once?: boolean; // default true
  amount?: number; // viewport threshold 0–1, default 0.3
  className?: string;
}

export const ScrollFadeIn: React.FC<ScrollFadeInProps> = ({
  children,
  direction = "up",
  distance = 40,
  duration = 0.6,
  delay = 0,
  once = true,
  amount = 0.3,
  className = "",
}) => {
  const reduce = useReducedMotion();
  const offset = reduce
    ? {}
    : direction === "up"
      ? { y: distance }
      : direction === "down"
        ? { y: -distance }
        : direction === "left"
          ? { x: distance }
          : direction === "right"
            ? { x: -distance }
            : {};
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration: reduce ? 0 : duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};
