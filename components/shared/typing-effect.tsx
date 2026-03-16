"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";

interface TypingEffectProps {
  text: string;
  className?: string;
  speed?: number;
  delay?: number;
}

export function TypingEffect({ text, className, speed = 100, delay = 500 }: TypingEffectProps) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayed.length >= text.length) return;

    const timeout = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);

    return () => clearTimeout(timeout);
  }, [started, displayed, text, speed]);

  return (
    <motion.h1
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {displayed}
      <motion.span
        className="inline-block w-[3px] h-[0.9em] bg-white ml-1 align-text-bottom"
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
      />
    </motion.h1>
  );
}
