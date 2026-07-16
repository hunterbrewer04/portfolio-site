"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Github, ExternalLink } from "lucide-react";
import type { Project } from "@/lib/projects";

export interface ProjectCardProps {
  project: Omit<Project, "content">;
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
  expanded,
  onToggle,
  particleCount = 16,
}: ProjectCardProps) {
  const { title, description, summary, tags, github, demo, slug, color, cover } =
    project;
  const reduce = useReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const panelId = useId();
  const titleId = useId();

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
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group relative cursor-pointer overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 transition-all duration-300 hover:bg-white/[0.05] sm:p-5"
      style={{
        // React drops undefined style props → the class border shows through.
        borderColor: isHovered ? `${color}66` : undefined,
        boxShadow: isHovered && !reduce ? `0 0 40px ${color}22` : "none",
      }}
    >
      {/* top accent bar (decorative) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
        style={{ backgroundColor: color, transformOrigin: "left" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: expanded ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : 0.35 }}
      />

      {/* particle burst layer (ParticleCard mechanics) */}
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

      <div className="relative z-10">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- static export requires a plain img, not the optimized component
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="mb-3 aspect-video w-full max-w-full rounded-md border border-white/[0.08] object-cover"
          />
        )}

        {/* semantic toggle: native button on the title row — Enter/Space for free */}
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => {
            onToggle();
            burst();
          }}
          className="mb-2 flex w-full items-start justify-between gap-3 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <h2
            id={titleId}
            className="text-base font-medium leading-snug text-neutral-200 transition-colors group-hover:text-white"
          >
            {title}
          </h2>
          <motion.span
            aria-hidden
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: reduce ? 0 : 0.3 }}
          >
            <ChevronDown
              size={16}
              className="mt-0.5 shrink-0 text-neutral-600 transition-colors group-hover:text-neutral-300"
            />
          </motion.span>
        </button>

        <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-neutral-500">
          {description}
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Badge
                key={t}
                variant="secondary"
                className="border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] text-neutral-400"
              >
                {t}
              </Badge>
            ))}
          </div>
        )}

        {/* click-to-expand reveal — panel STAYS MOUNTED (aria-controls id always
            resolves; `inert` blocks tabbing into hidden links, React 19) */}
        <motion.div
          id={panelId}
          aria-labelledby={titleId}
          inert={expanded ? undefined : true}
          initial={false}
          animate={
            expanded
              ? { opacity: 1, height: "auto", marginTop: 16 }
              : { opacity: 0, height: 0, marginTop: 0 }
          }
          transition={{ duration: reduce ? 0 : 0.4, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div
            className="border-t pt-4 text-sm leading-relaxed text-neutral-300"
            style={{ borderColor: `${color}33` }}
          >
            {summary ?? description}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={`/work/${slug}`}
              aria-label={`View ${title} project`}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              View project →
            </Link>
            {github && (
              <a
                href={github}
                target="_blank"
                rel="noreferrer"
                aria-label={`${title} source on GitHub`}
                className="inline-flex items-center gap-1 py-2 text-xs text-neutral-400 hover:text-neutral-200"
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
                className="inline-flex items-center gap-1 py-2 text-xs text-neutral-400 hover:text-neutral-200"
              >
                <ExternalLink size={14} /> Live
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </motion.article>
  );
}
