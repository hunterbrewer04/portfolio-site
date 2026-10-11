"use client";

import { createContext, useContext, type ReactNode } from "react";

// The active project's 6-digit hex accent, provided by the project page so MDX
// embeds (e.g. FlowDiagram) match the project without a color prop.
const ProjectAccentContext = createContext("#6366f1");

/** Client boundary for the accent: a server component can't render a context object directly. */
export function ProjectAccent({ color, children }: { color: string; children: ReactNode }) {
  return <ProjectAccentContext value={color}>{children}</ProjectAccentContext>;
}

export function useProjectAccent(): string {
  return useContext(ProjectAccentContext);
}
