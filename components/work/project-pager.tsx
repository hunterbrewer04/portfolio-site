"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectNeighbor } from "@/lib/projects";

interface ProjectPagerProps {
  prev?: ProjectNeighbor;
  next?: ProjectNeighbor;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * One neighbor as a large tile in that project's own color: a soft glow that
 * blooms on hover, an accent line that draws across the top, and an arrow that
 * leans toward where the link goes.
 */
function PagerTile({ project, dir }: { project: ProjectNeighbor; dir: "prev" | "next" }) {
  const reduce = useReducedMotion();
  const isNext = dir === "next";
  const { color } = project;

  return (
    <motion.div
      className="flex-1"
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileFocus="hover"
      whileTap={reduce ? undefined : { scale: 0.985 }}
    >
      <Link
        href={`/work/${project.slug}`}
        className={cn(
          "group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 outline-none transition-colors duration-300 hover:border-white/15 focus-visible:ring-2 focus-visible:ring-white/30 sm:p-7",
          isNext ? "items-end text-right" : "items-start text-left",
        )}
      >
        {/* color glow that blooms from the side the arrow points to */}
        <motion.span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 h-56 w-56 -translate-y-1/2 rounded-full blur-3xl",
            isNext ? "-right-16" : "-left-16",
          )}
          style={{ backgroundColor: color }}
          variants={{ rest: { opacity: 0.06, scale: 0.8 }, hover: { opacity: 0.2, scale: 1 } }}
          transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}
        />
        {/* accent line drawing in from the near edge */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ backgroundColor: color, transformOrigin: isNext ? "right" : "left" }}
          variants={{ rest: { scaleX: 0 }, hover: { scaleX: 1 } }}
          transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
        />

        <span
          className={cn(
            "relative inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500",
            isNext && "flex-row-reverse",
          )}
        >
          <motion.span
            className="inline-flex"
            style={{ color }}
            variants={{ rest: { x: 0 }, hover: { x: reduce ? 0 : isNext ? 4 : -4 } }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
          >
            {isNext ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
          </motion.span>
          {isNext ? "Next" : "Previous"}
        </span>

        <span className="relative text-xl font-semibold tracking-tight text-neutral-100 transition-colors group-hover:text-white sm:text-2xl">
          {project.title}
        </span>
        <span className="relative line-clamp-2 max-w-xs text-sm leading-relaxed text-neutral-400">
          {project.blurb}
        </span>
      </Link>
    </motion.div>
  );
}

/** Previous/next tiles at the foot of a project page, in /work order. */
export function ProjectPager({ prev, next }: ProjectPagerProps) {
  return (
    <nav aria-label="More projects" className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        {prev ? <PagerTile project={prev} dir="prev" /> : <div className="hidden flex-1 sm:block" />}
        {next ? <PagerTile project={next} dir="next" /> : <div className="hidden flex-1 sm:block" />}
      </div>
      <Link
        href="/work"
        className="inline-flex items-center gap-2 self-center rounded-full border border-white/10 px-4 py-2 font-mono text-xs text-neutral-400 transition-colors hover:border-white/25 hover:text-white"
      >
        <LayoutGrid size={13} /> All projects
      </Link>
    </nav>
  );
}
