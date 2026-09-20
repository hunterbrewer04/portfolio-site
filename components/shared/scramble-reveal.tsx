"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+<>=?@";

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

interface ScrambleRevealProps {
  text: string;
  className?: string;
  /** Seconds before the first character locks in. */
  delay?: number;
  /** Seconds between characters locking in, left to right. */
  step?: number;
  /** Seconds between glyph swaps while a character is still scrambled. */
  tick?: number;
  /** Return visit: short decode, no lead-in. */
  instant?: boolean;
}

// Random glyphs resolve left to right into the real text. Each slot is sized
// by its final character (rendered invisibly) so the width never jitters.
export function ScrambleReveal({
  text,
  className,
  delay = 0.15,
  step = 0.06,
  tick = 0.04,
  instant = false,
}: ScrambleRevealProps) {
  const chars = Array.from(text);
  const [shown, setShown] = useState<string[]>(() => chars.map(() => ""));

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lead = reduced || instant ? 0 : delay;
    const gap = reduced ? 0 : instant ? step * 0.4 : step;

    let raf = 0;
    let lastLocked = -1;
    const current = chars.map(() => "");
    // Each slot swaps on its own jittered clock so the slots never strobe in
    // unison.
    const nextSwap = chars.map(() => 0);
    const start = performance.now();

    const frame = (now: number) => {
      const t = (now - start) / 1000;
      let locked = 0;
      for (let i = 0; i < chars.length; i++) {
        if (t >= lead + i * gap) locked = i + 1;
      }
      let changed = locked !== lastLocked;
      lastLocked = locked;
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === " ") current[i] = " ";
        else if (i < locked) current[i] = chars[i];
        else if (now >= nextSwap[i]) {
          current[i] = randomGlyph();
          nextSwap[i] = now + tick * 1000 * (0.7 + Math.random() * 0.6);
          changed = true;
        }
      }
      if (changed) setShown([...current]);
      if (locked < chars.length) raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // chars is derived from text; text is the dependency that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, delay, step, tick, instant]);

  return (
    <motion.h1
      className={className}
      aria-label={text}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {chars.map((ch, i) => {
        const settled = shown[i] === ch;
        return (
          <span key={i} aria-hidden className="relative inline-block">
            <span className="invisible">{ch === " " ? "\u00A0" : ch}</span>
            <span
              className={cn(
                "absolute inset-0 text-center transition-[color,filter,opacity] duration-200 ease-out",
                settled
                  ? "text-white opacity-100 blur-0"
                  : "text-neutral-500 opacity-80 blur-[2px]",
              )}
            >
              {ch === " " ? "" : shown[i]}
            </span>
          </span>
        );
      })}
    </motion.h1>
  );
}
