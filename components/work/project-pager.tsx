import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Project } from "@/lib/projects";

type Neighbor = Pick<Project, "slug" | "title" | "color">;

interface ProjectPagerProps {
  prev?: Neighbor;
  next?: Neighbor;
}

function PagerLink({ project, dir }: { project: Neighbor; dir: "prev" | "next" }) {
  const isNext = dir === "next";
  return (
    <Link
      href={`/work/${project.slug}`}
      className={`group flex flex-1 flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 transition-colors hover:border-white/15 ${
        isNext ? "items-end text-right" : "items-start text-left"
      }`}
    >
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-neutral-500">
        {!isNext && <ArrowLeft size={12} />}
        {isNext ? "Next project" : "Previous project"}
        {isNext && <ArrowRight size={12} />}
      </span>
      <span
        className="text-base font-semibold text-neutral-200 transition-colors group-hover:text-white"
        style={{ textDecorationColor: project.color }}
      >
        {project.title}
      </span>
    </Link>
  );
}

/** Previous/next links at the foot of a project page, in /work order. */
export function ProjectPager({ prev, next }: ProjectPagerProps) {
  return (
    <nav aria-label="More projects" className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        {prev ? <PagerLink project={prev} dir="prev" /> : <div className="hidden flex-1 sm:block" />}
        {next ? <PagerLink project={next} dir="next" /> : <div className="hidden flex-1 sm:block" />}
      </div>
      <Link
        href="/work"
        className="self-center font-mono text-xs text-neutral-500 transition-colors hover:text-neutral-200"
      >
        All projects
      </Link>
    </nav>
  );
}
