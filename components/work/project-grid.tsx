"use client";

import { useState } from "react";
import { ScrollFadeIn } from "@/components/motion/scroll-fade-in";
import { ProjectCard } from "@/components/work/project-card";
import type { Project } from "@/lib/projects";

interface ProjectGridProps {
  projects: Omit<Project, "content">[];
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

  return (
    // items-start = no sibling stretch on expand; 3 cols on desktop (LOCKED)
    <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p, i) => (
        <ScrollFadeIn key={p.slug} direction="up" distance={24} delay={i * 0.08}>
          <ProjectCard
            project={p}
            expanded={openSlug === p.slug}
            onToggle={() =>
              setOpenSlug((s) => (s === p.slug ? null : p.slug))
            }
          />
        </ScrollFadeIn>
      ))}
    </div>
  );
}
