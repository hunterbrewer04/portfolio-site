import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import {
  getAllProjectSlugs,
  getProjectBySlug,
  getProjectFileTree,
} from "@/lib/projects";
import { highlightProjectFiles } from "@/lib/highlight";
import { ProjectExplorer } from "@/components/work/project-explorer";
import { workMdxComponents } from "@/components/work/mdx-components";
import { ScrollFadeIn } from "@/components/motion/scroll-fade-in";
import { NavPill } from "@/components/shared/nav-pill";

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

  const tree = getProjectFileTree(slug);
  const files = await highlightProjectFiles(slug);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-16">
      <div className="mb-12 flex flex-col items-center gap-6 sm:gap-10">
        <ScrollFadeIn direction="up">
          <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
            {project.title}
          </h1>
        </ScrollFadeIn>
        <NavPill />
      </div>
      <ProjectExplorer
        tree={tree}
        files={files}
        overview={
          <MDXRemote source={project.content} components={workMdxComponents} />
        }
        color={project.color}
        meta={{
          title: project.title,
          description: project.description,
          tags: project.tags,
          github: project.github,
          demo: project.demo,
          date: project.date,
        }}
      />
    </div>
  );
}
