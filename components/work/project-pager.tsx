"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, LayoutGrid } from "lucide-react";
import type { ProjectNeighbor } from "@/lib/projects";

interface ProjectPagerProps {
  prev?: ProjectNeighbor;
  next?: ProjectNeighbor;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * One neighbor as a compact, centered card. On hover it lifts a touch, takes
 * on the project's color, draws an accent line out from the center, and its
 * arrow leans toward where the link goes.
 */
function PagerCard({ project, dir }: { project: ProjectNeighbor; dir: "prev" | "next" }) {
  const reduce = useReducedMotion();
  const isNext = dir === "next";
  const { color } = project;
  const Arrow = isNext ? ArrowRight : ArrowLeft;

  return (
    <motion.div
      className="min-w-0"
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileFocus="hover"
      whileTap={reduce ? undefined : { scale: 0.98 }}
      variants={{ rest: { y: 0 }, hover: { y: reduce ? 0 : -2 } }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <Link
        href={`/work/${project.slug}`}
        aria-label={`${isNext ? "Next" : "Previous"} project: ${project.title}`}
        className="relative flex h-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-4 text-center outline-none transition-colors duration-300 hover:border-[var(--accent)] hover:bg-[var(--tint)] focus-visible:ring-2 focus-visible:ring-white/30 sm:px-6 sm:py-5"
        style={{ "--accent": `${color}59`, "--tint": `${color}0f` } as CSSProperties}
      >
        {/* accent line growing out from the center of the top edge */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px origin-center"
          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
          variants={{ rest: { scaleX: 0, opacity: 0 }, hover: { scaleX: 1, opacity: 1 } }}
          transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
        />

        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          {!isNext && (
            <motion.span
              className="inline-flex"
              style={{ color }}
              variants={{ rest: { x: 0 }, hover: { x: reduce ? 0 : -3 } }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
            >
              <Arrow size={12} />
            </motion.span>
          )}
          {isNext ? "Next" : "Previous"}
          {isNext && (
            <motion.span
              className="inline-flex"
              style={{ color }}
              variants={{ rest: { x: 0 }, hover: { x: reduce ? 0 : 3 } }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
            >
              <Arrow size={12} />
            </motion.span>
          )}
        </span>
        <span className="line-clamp-2 text-sm font-semibold tracking-tight text-neutral-100 sm:text-base">
          {project.title}
        </span>
      </Link>
    </motion.div>
  );
}

/** Previous/next cards at the foot of a project page, in /work order. */
export function ProjectPager({ prev, next }: ProjectPagerProps) {
  return (
    <nav aria-label="More projects" className="mx-auto flex w-full max-w-xl flex-col items-center gap-5">
      <div className={`grid w-full gap-3 ${prev && next ? "grid-cols-2" : "max-w-[16rem] grid-cols-1"}`}>
        {prev && <PagerCard project={prev} dir="prev" />}
        {next && <PagerCard project={next} dir="next" />}
      </div>
      <Link
        href="/work"
        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 font-mono text-[11px] text-neutral-400 transition-colors hover:border-white/25 hover:text-white"
      >
        <LayoutGrid size={12} /> All projects
      </Link>
    </nav>
  );
}
