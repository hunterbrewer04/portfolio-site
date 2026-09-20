import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllProjectSlugs, getProjectBySlug } from "@/lib/projects";
import { ProjectHero } from "@/components/work/project-hero";
import { workMdxComponents } from "@/components/work/mdx-components";
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
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-16">
      <div className="mb-14 sm:mb-20">
        <ProjectHero meta={meta} color={project.color} />
      </div>
      <ScrollFadeIn direction="up" distance={16} amount={0} className="mx-auto max-w-3xl">
        <MDXRemote source={project.content} components={workMdxComponents} />
      </ScrollFadeIn>
    </div>
  );
}
