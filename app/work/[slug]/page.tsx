import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAdjacentProjects, getAllProjectSlugs, getProjectBySlug } from "@/lib/projects";
import { ProjectHero } from "@/components/work/project-hero";
import { LiveDemo } from "@/components/work/live-demo";
import { workMdxComponents } from "@/components/work/mdx-components";
import { ProjectAccent } from "@/components/work/project-accent";
import { ProjectCover } from "@/components/work/project-cover";
import { ProjectPager } from "@/components/work/project-pager";
import { ScrollFadeIn } from "@/components/motion/scroll-fade-in";

export const dynamicParams = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllProjectSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const project = getProjectBySlug(slug);
    return { title: project.title, description: project.description };
  } catch {
    return { title: "Project Not Found" };
  }
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;

  let project;
  try {
    project = getProjectBySlug(slug);
  } catch {
    notFound();
  }
  if (project.draft) notFound();

  const meta = {
    title: project.title,
    description: project.description,
    tags: project.tags,
    github: project.github,
    demo: project.demo,
    date: project.date,
    status: project.status,
    role: project.role,
    timeline: project.timeline,
    stats: project.stats,
  };
  const { prev, next } = getAdjacentProjects(slug);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-16">
      <div className="mb-14 sm:mb-20">
        <ProjectHero meta={meta} color={project.color} />
      </div>
      {/* One hero visual: a live build beats a still, so the cover only shows without an embed. */}
      {project.embed ? (
        <ScrollFadeIn direction="up" distance={16} amount={0} className="mb-14 sm:mb-20">
          <LiveDemo src={project.embed} title={project.title} color={project.color} />
        </ScrollFadeIn>
      ) : (
        project.cover && (
          <ScrollFadeIn direction="up" distance={16} amount={0} className="mb-14 sm:mb-20">
            <ProjectCover
              src={project.cover}
              alt={project.coverAlt ?? `${project.title} screenshot`}
              color={project.color}
            />
          </ScrollFadeIn>
        )
      )}
      <ScrollFadeIn direction="up" distance={16} amount={0} className="mx-auto max-w-3xl">
        <ProjectAccent color={project.color}>
          <MDXRemote source={project.content} components={workMdxComponents} />
        </ProjectAccent>
      </ScrollFadeIn>
      {(prev || next) && (
        <ScrollFadeIn
          direction="up"
          distance={20}
          amount={0.2}
          className="mt-20 border-t border-white/[0.06] pt-10 sm:mt-28"
        >
          <ProjectPager prev={prev} next={next} />
        </ScrollFadeIn>
      )}
    </div>
  );
}
