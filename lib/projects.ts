import fs from "fs";
import path from "path";
import { cache } from "react";
import matter from "gray-matter";

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

const PROJECTS_DIR = path.join(process.cwd(), "content/projects");

// 6-digit hex only — the card/tree/viewer string-concatenate alpha onto this
// value (e.g. `${color}66`), so 3-digit / rgb() / named colors must be rejected.
const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** Normalize a frontmatter date (Date | string) to "YYYY-MM-DD", mirroring lib/blog.ts. */
function normalizeDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "");
}

/** Parse content/projects/<slug>/index.mdx into a Project. Throws (ENOENT) on a missing file. */
function parseProject(slug: string): Project {
  const filePath = path.join(PROJECTS_DIR, slug, "index.mdx");
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  const date = normalizeDate(data.date);
  const colorRaw = String(data.color ?? "");

  return {
    slug,
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    summary: data.summary != null ? String(data.summary) : undefined,
    date,
    year: new Date(date).getFullYear(),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    github: data.github != null ? String(data.github) : undefined,
    demo: data.demo != null ? String(data.demo) : undefined,
    featured: Boolean(data.featured),
    color: HEX6.test(colorRaw) ? colorRaw : "#6366f1",
    cover: data.cover != null ? String(data.cover) : undefined,
    content,
    draft: Boolean(data.draft),
  };
}

/**
 * Every project directory (content/projects/<slug>/ containing an index.mdx),
 * drafts included, sorted featured-first then date desc. ENOENT → [] so the
 * static export builds before any content exists (mirrors lib/blog.ts).
 */
function readAllProjects(): Project[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  } catch (e: unknown) {
    if (e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw e;
  }

  const slugs = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(PROJECTS_DIR, entry.name, "index.mdx")),
    )
    .map((entry) => entry.name);

  const projects = slugs.map(parseProject);
  return projects.sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/** Non-draft projects, featured-first then date desc. */
export function getAllProjects(): Project[] {
  return readAllProjects().filter((project) => !project.draft);
}

/** ALL slugs including drafts (feeds generateStaticParams). */
export function getAllProjectSlugs(): string[] {
  return readAllProjects().map((project) => project.slug);
}

/** Cached read of a single project; throws on a missing file. */
export const getProjectBySlug = cache((slug: string): Project => parseProject(slug));

/** Recursive walk of an absolute dir, returning FileNodes. ENOENT → [] (graceful). */
function walkFileTree(absDir: string, relPrefix: string): FileNode[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch (e: unknown) {
    if (e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw e;
  }

  const nodes: FileNode[] = entries.map((entry) => {
    const isDir = entry.isDirectory();
    const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    const node: FileNode = {
      name: entry.name,
      path: relPath, // forward slashes; relPrefix is already "/"-joined
      type: isDir ? "dir" : "file",
    };
    if (isDir) {
      node.children = walkFileTree(path.join(absDir, entry.name), relPath);
    }
    return node;
  });

  // Dirs first, then files; both alphabetical (case-insensitive).
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

/**
 * File tree for content/projects/<slug>/files/. Dirs first, then files, both
 * alphabetical. FileNode.path is relative to the files/ root with forward
 * slashes (e.g. "src/index.ts"). Missing files/ dir → [] (graceful).
 */
export function getProjectFileTree(slug: string): FileNode[] {
  return walkFileTree(path.join(PROJECTS_DIR, slug, "files"), "");
}
