"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ArrowUpRight, Github, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/projects";

export interface ProjectCardProps {
  project: Omit<Project, "content">;
  /** 1-based position in the list, rendered as the index. */
  index: number;
  /** hero = full-width row; featured = emphasized tile; compact = plain tile */
  variant?: "hero" | "featured" | "compact";
  expanded: boolean;
  onToggle: () => void;
  particleCount?: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  angle: number;
  distance: number;
}

export function ProjectCard({
  project,
  index,
  variant = "compact",
  expanded,
  onToggle,
  particleCount = 16,
}: ProjectCardProps) {
  const { title, description, tagline, summary, highlights, github, demo, slug, color, year } =
    project;
  const hero = variant === "hero";
  const featured = hero || variant === "featured";
  const reduce = useReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const panelId = useId();
  const titleId = useId();
  const lit = isHovered || expanded;
  // Panel paragraph: the full description when a tagline stood in for it
  // above; otherwise only as a fallback so a project with no highlights
  // still says something when opened.
  const panelText = tagline
    ? description
    : highlights.length === 0
      ? (summary ?? description)
      : undefined;

  const burst = () => {
    if (reduce) return;
    setParticles(
      Array.from({ length: particleCount }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 2,
        angle: Math.random() * 360,
        distance: Math.random() * 60 + 20,
      })),
    );
  };

  // Pointer convenience: clicking anywhere on the card toggles, EXCEPT on real controls.
  const onCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a, button")) return;
    onToggle();
    burst();
  };

  const pill =
    "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs transition-colors";
  const outlined = cn(
    pill,
    "border border-white/10 text-neutral-300 hover:border-white/25 hover:text-white",
  );

  return (
    <motion.article
      onClick={onCardClick}
      onHoverStart={() => {
        setIsHovered(true);
        burst();
      }}
      onHoverEnd={() => {
        setIsHovered(false);
        setParticles([]);
      }}
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      data-lit={lit}
      className="card-beam group relative h-full cursor-pointer overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-colors duration-300"
      style={{
        // React drops undefined style props → the class border shows through.
        borderColor: lit ? `${color}40` : undefined,
        boxShadow: lit && !reduce ? `0 0 60px ${color}1f` : "none",
        ["--beam-color" as string]: color,
      }}
    >
      {/* corner glow in the project color; brightens when lit */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute rounded-full blur-3xl transition-opacity duration-500",
          hero ? "-top-32 -right-24 h-80 w-80" : "-top-24 -right-20 h-56 w-56",
        )}
        style={{ backgroundColor: color, opacity: lit ? 0.22 : featured ? 0.14 : 0.08 }}
      />

      {/* top accent bar (decorative) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
        style={{ backgroundColor: color, transformOrigin: "left" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: expanded ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : 0.35 }}
      />

      {/* particle burst layer */}
      <AnimatePresence>
        {particles.map((p) => {
          const rad = (p.angle * Math.PI) / 180;
          return (
            <motion.span
              key={p.id}
              aria-hidden
              className="pointer-events-none absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: color,
                left: `${p.x}%`,
                top: `${p.y}%`,
              }}
              initial={{ opacity: 0.8, scale: 1, x: 0, y: 0 }}
              animate={{
                opacity: 0,
                scale: 0,
                x: Math.cos(rad) * p.distance,
                y: Math.sin(rad) * p.distance,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          );
        })}
      </AnimatePresence>

      {/* index and arrow pin to the corners; everything else is centered */}
      <span
        aria-hidden
        className={cn(
          "absolute z-10 font-mono tabular-nums",
          hero ? "top-6 left-6 text-sm sm:top-8 sm:left-8" : "top-5 left-5 text-xs sm:top-6 sm:left-6",
        )}
        style={{ color }}
      >
        {String(index).padStart(2, "0")}
      </span>
      <motion.span
        aria-hidden
        className={cn(
          "absolute z-10 text-neutral-600 transition-colors group-hover:text-neutral-300",
          hero ? "top-6 right-6 sm:top-8 sm:right-8" : "top-5 right-5 sm:top-6 sm:right-6",
        )}
        animate={{ rotate: expanded ? 90 : 0 }}
        transition={{ duration: reduce ? 0 : 0.3 }}
      >
        <ArrowUpRight size={hero ? 22 : 18} strokeWidth={1.5} />
      </motion.span>

      <div
        className={cn(
          "relative z-10 flex flex-col items-center text-center",
          hero ? "px-10 py-8 sm:px-16 sm:py-10" : "px-8 py-6 sm:px-10 sm:py-8",
        )}
      >
        {/* semantic toggle: native button on the title */}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => {
            onToggle();
            burst();
          }}
          className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <h2
            id={titleId}
            className={cn(
              "font-semibold tracking-tight text-neutral-100 transition-colors group-hover:text-white",
              // Featured and compact share a size so every tile is the same height.
              hero ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl",
            )}
          >
            {title}
          </h2>
        </button>

        {/* The tagline is written to fit, so it is never clamped; the full
            description waits in the panel below. Tiles always reserve two
            lines here so a one-line tagline does not make a shorter card. */}
        <p
          className={cn(
            "mt-3 leading-relaxed text-neutral-400",
            hero ? "max-w-2xl text-base" : "min-h-[2lh] max-w-md text-sm",
          )}
        >
          {tagline ?? description}
        </p>

        <p className="mt-4 font-mono text-xs" style={{ color }}>
          {year}
        </p>

        {/* click-to-expand panel — stays mounted; `inert` blocks tabbing while hidden */}
        <motion.div
          id={panelId}
          aria-labelledby={titleId}
          inert={expanded ? undefined : true}
          initial={false}
          animate={
            expanded
              ? { opacity: 1, height: "auto", marginTop: 20 }
              : { opacity: 0, height: 0, marginTop: 0 }
          }
          transition={{ duration: reduce ? 0 : 0.4, ease: "easeInOut" }}
          className="w-full overflow-hidden"
        >
          <div
            className="flex flex-col items-center gap-5 border-t pt-5"
            style={{ borderColor: `${color}33` }}
          >
            {panelText && (
              <p className={cn("text-sm leading-relaxed text-neutral-300", hero ? "max-w-xl" : "max-w-md")}>
                {panelText}
              </p>
            )}
            {highlights.length > 0 && (
              <ul
                className={cn(
                  "flex w-full flex-col gap-2 text-left text-sm leading-relaxed text-neutral-300",
                  hero ? "max-w-xl" : "max-w-md",
                )}
              >
                {highlights.map((h) => (
                  <li key={h} className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href={`/work/${slug}`}
                aria-label={`View ${title} project`}
                className={cn(pill, "font-semibold text-black hover:opacity-90")}
                style={{ backgroundColor: color }}
              >
                View project <ArrowUpRight size={14} />
              </Link>
              {github && (
                <a
                  href={github}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${title} source on GitHub`}
                  className={outlined}
                >
                  <Github size={14} /> Source
                </a>
              )}
              {demo && (
                <a
                  href={demo}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${title} live demo`}
                  className={outlined}
                >
                  <ExternalLink size={14} /> Live
                </a>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.article>
  );
}
