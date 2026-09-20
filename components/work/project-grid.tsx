"use client";

import { useState } from "react";
import { ScrollFadeIn } from "@/components/motion/scroll-fade-in";
import { ProjectCard } from "@/components/work/project-card";
import type { Project } from "@/lib/projects";

interface ProjectGridProps {
  projects: Omit<Project, "content">[];
}

const MAX_FEATURED = 3;

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
        {children}
      </h2>
      <div className="h-px flex-1 bg-white/[0.06]" aria-hidden />
    </div>
  );
}

export function ProjectGrid({ projects }: ProjectGridProps) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  if (projects.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-neutral-500">
        No projects published yet. Check back soon.
      </p>
    );
  }

  // getAllProjects() sorts featured first (then newest), so the first
  // MAX_FEATURED featured entries win; any beyond that fall into the grid.
  const featured = projects.filter((p) => p.featured).slice(0, MAX_FEATURED);
  const rest = projects.filter((p) => !featured.includes(p));
  const toggle = (slug: string) => () =>
    setOpenSlug((s) => (s === slug ? null : slug));

  // One featured project gets the full-width row; two or three share a grid.
  const featuredCols =
    featured.length === 1
      ? "grid-cols-1"
      : featured.length === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="flex flex-col gap-12">
      {featured.length > 0 && (
        <section>
          <SectionLabel>Featured</SectionLabel>
          <div className={`grid items-start gap-4 ${featuredCols}`}>
            {featured.map((p, i) => (
              <ScrollFadeIn key={p.slug} direction="up" distance={24} delay={i * 0.08}>
                <ProjectCard
                  project={p}
                  index={i + 1}
                  variant={featured.length === 1 ? "hero" : "featured"}
                  expanded={openSlug === p.slug}
                  onToggle={toggle(p.slug)}
                />
              </ScrollFadeIn>
            ))}
          </div>
        </section>
      )}
      {rest.length > 0 && (
        <section>
          {featured.length > 0 && <SectionLabel>More</SectionLabel>}
          {/* items-start = no sibling stretch on expand */}
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            {rest.map((p, i) => (
              <ScrollFadeIn
                key={p.slug}
                direction="up"
                distance={24}
                delay={(featured.length + i) * 0.08}
              >
                <ProjectCard
                  project={p}
                  index={featured.length + i + 1}
                  expanded={openSlug === p.slug}
                  onToggle={toggle(p.slug)}
                />
              </ScrollFadeIn>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
