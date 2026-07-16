import type { Metadata } from "next";
import { getAllProjects } from "@/lib/projects";
import { ProjectGrid } from "@/components/work/project-grid";
import { ScrollFadeIn } from "@/components/motion/scroll-fade-in";
import { NavPill } from "@/components/shared/nav-pill";

export const metadata: Metadata = {
  title: "My Work",
  description: "Selected projects and things I've built.",
};

export default function WorkPage() {
  // Drop the MDX body before handing projects to the client grid.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `content` is intentionally discarded
  const projects = getAllProjects().map(({ content, ...rest }) => rest);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-16">
      <ScrollFadeIn
        direction="up"
        className="mb-12 flex flex-col items-center gap-6 sm:gap-10"
      >
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          My Work
        </h1>
        <NavPill />
      </ScrollFadeIn>
      <ProjectGrid projects={projects} />
    </div>
  );
}
