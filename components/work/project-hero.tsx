import { ArrowUpRight, Github } from "lucide-react";
import { ScrollFadeIn } from "@/components/motion/scroll-fade-in";
import { NavPill } from "@/components/shared/nav-pill";
export interface ProjectMeta {
  title: string;
  description: string;
  tags: string[];
  github?: string;
  demo?: string;
  date: string;
}

interface ProjectHeroProps {
  meta: ProjectMeta;
  /** 6-digit hex accent */
  color: string;
}

export function ProjectHero({ meta, color }: ProjectHeroProps) {
  const year = meta.date.slice(0, 4);
  return (
    <header className="relative">
      <div className="relative flex flex-col items-center gap-8 text-center">
        <NavPill />
        <ScrollFadeIn direction="up" className="flex flex-col items-center gap-5">
          <p className="font-mono text-xs tracking-wide" style={{ color }}>
            {year}
          </p>
          {/* The title is the light source: a tight colored glow on the letters
              and a softer, wider one cast downward like a shadow. */}
          <h1
            className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl"
            style={{
              textShadow: [
                `0 0 16px ${color}40`,
                `0 8px 40px ${color}40`,
                `0 20px 72px ${color}2e`,
              ].join(", "),
            }}
          >
            {meta.title}
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-neutral-300">
            {meta.description}
          </p>
          {(meta.github || meta.demo) && (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              {meta.github && (
                <a
                  href={meta.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${meta.title} source on GitHub`}
                  className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-white/[0.04]"
                  style={{ borderColor: `${color}66`, color }}
                >
                  <Github size={16} /> View on GitHub
                </a>
              )}
              {meta.demo && (
                <a
                  href={meta.demo}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${meta.title} live demo`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2.5 text-sm font-medium text-neutral-200 transition-colors hover:border-white/25 hover:text-white"
                >
                  Live demo <ArrowUpRight size={16} />
                </a>
              )}
            </div>
          )}
        </ScrollFadeIn>
      </div>
    </header>
  );
}
