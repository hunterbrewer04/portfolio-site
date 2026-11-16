import { ScrollFadeIn } from "@/components/motion/scroll-fade-in";
import type { ProjectStat } from "@/lib/projects";

interface ProjectFactsProps {
  year: string;
  status?: string;
  role?: string;
  timeline?: string;
  stats: ProjectStat[];
  /** 6-digit hex accent */
  color: string;
}

/**
 * The at-a-glance strip under the hero: when, what state it is in, who built
 * it, and a few numbers. Each cell only renders when its frontmatter is set,
 * so a project with nothing beyond a date shows nothing at all.
 */
export function ProjectFacts({ year, status, role, timeline, stats, color }: ProjectFactsProps) {
  const facts: ProjectStat[] = [
    { label: "Year", value: timeline ?? year },
    ...(status ? [{ label: "Status", value: status }] : []),
    ...(role ? [{ label: "Role", value: role }] : []),
    ...stats,
  ];
  // The year alone isn't worth a strip; it is already above the title.
  if (facts.length < 2) return null;

  return (
    <ScrollFadeIn direction="up" distance={16} delay={0.1} className="w-full max-w-3xl">
      {/* gap-px over a hairline-colored grid draws the dividers, whatever the column count */}
      <dl
        className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.06] sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none"
        style={{ boxShadow: `0 1px 0 ${color}26` }}
      >
        {facts.map(({ label, value }, i) => (
          <div
            key={label}
            className={`flex flex-col gap-1 bg-background px-4 py-3 text-left ${
              // An odd count on phones leaves the last cell alone on its row.
              i === facts.length - 1 && facts.length % 2 === 1 ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-neutral-500">
              {label}
            </dt>
            <dd className="text-sm font-medium text-neutral-100">{value}</dd>
          </div>
        ))}
      </dl>
    </ScrollFadeIn>
  );
}
