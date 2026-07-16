// ---------------------------------------------------------------------------
// CONTRACT — shared shapes for the My Work section.
// Interfaces are final; function bodies are stubs pending the data layer.
// ---------------------------------------------------------------------------

export interface Project {
  slug: string;
  title: string;
  description: string;
  summary?: string; // longer copy for the expanded card panel; falls back to description
  date: string; // "YYYY-MM-DD"
  year: number; // derived from date
  tags: string[]; // tech stack
  github?: string;
  demo?: string;
  featured: boolean;
  color: string; // normalized 6-digit hex, default "#6366f1"
  cover?: string;
  content: string; // MDX body (the Overview)
  draft: boolean;
}

export interface FileNode {
  name: string;
  path: string; // relative to the project's files/ root, e.g. "src/index.ts"
  type: "dir" | "file";
  children?: FileNode[];
}

/** All non-draft projects, featured first then date desc. */
export function getAllProjects(): Project[] {
  return [];
}

/** ALL slugs including drafts (feeds generateStaticParams). */
export function getAllProjectSlugs(): string[] {
  return [];
}

/** Cached read of a single project; throws on a missing file. */
export const getProjectBySlug = (slug: string): Project => {
  throw new Error(`Project data layer not implemented (slug: ${slug})`);
};

/** Recursive walk of content/projects/<slug>/files/ — dirs first, then files, alphabetical. */
export function getProjectFileTree(slug: string): FileNode[] {
  void slug;
  return [];
}
