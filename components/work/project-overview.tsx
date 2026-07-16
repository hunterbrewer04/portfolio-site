import type { ReactNode } from "react";
import { ExternalLink, Github } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ProjectMeta } from "@/components/work/project-explorer";

interface ProjectOverviewProps {
  meta: ProjectMeta;
  /** 6-digit hex accent */
  color: string;
  /** RSC-rendered MDX Overview body */
  children: ReactNode;
}

export function ProjectOverview({ meta, color, children }: ProjectOverviewProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.03]">
      <div className="h-1 w-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <div className="p-5 sm:p-7">
        <header className="flex flex-col gap-3 border-b border-white/[0.06] pb-5">
          <time dateTime={meta.date} className="text-xs text-neutral-500">
            {meta.date}
          </time>
          <p className="text-sm leading-relaxed text-neutral-400">
            {meta.description}
          </p>
          {meta.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {meta.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] text-neutral-400"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          {(meta.github || meta.demo) && (
            <div className="flex flex-wrap items-center gap-4 pt-1">
              {meta.github && (
                <a
                  href={meta.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${meta.title} source on GitHub`}
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-400 transition-colors hover:text-neutral-200"
                >
                  <Github size={14} /> Source
                </a>
              )}
              {meta.demo && (
                <a
                  href={meta.demo}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${meta.title} live demo`}
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-400 transition-colors hover:text-neutral-200"
                >
                  <ExternalLink size={14} /> Live
                </a>
              )}
            </div>
          )}
        </header>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
