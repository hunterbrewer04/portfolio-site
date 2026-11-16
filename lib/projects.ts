import fs from "fs";
import path from "path";
import { cache } from "react";
import matter from "gray-matter";

export interface ProjectStat {
  label: string;
  value: string;
}

export interface Project {
  slug: string;
  title: string;
  description: string;
  tagline?: string; // one short line for the collapsed card; description shows on expand
  summary?: string; // longer copy; the card panel prefers highlights, then this, then description
  highlights: string[]; // 2-4 short bullets for the expanded card panel
  date: string; // "YYYY-MM-DD"
  year: number; // derived from date
  tags: string[]; // tech stack
  github?: string;
  demo?: string;
  embed?: string; // URL of a live build framed on the project page, above the Overview
  featured: boolean;
  order?: number; // optional manual position; lower sorts first, ahead of unordered projects
  color: string; // normalized 6-digit hex, default "#6366f1"
  cover?: string; // image path under /public, shown as the hero visual and in the card panel
  coverAlt?: string; // alt text for the cover; falls back to "<title> screenshot"
  status?: string; // facts row: e.g. "Live", "In daily use", "Source private"
  role?: string; // facts row: e.g. "Solo build"
  timeline?: string; // facts row: e.g. "Sep to Oct 2026"
  stats: ProjectStat[]; // facts row: 0-3 short numbers, e.g. { label: "Tests", value: "40" }
  content: string; // MDX body (the Overview)
  draft: boolean;
}

const PROJECTS_DIR = path.join(process.cwd(), "content/projects");

// 6-digit hex only — the card/tree/viewer string-concatenate alpha onto this
// value (e.g. `${color}66`), so 3-digit / rgb() / named colors must be rejected.
const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** Read `stats` as [{ label, value }], dropping malformed entries. */
function parseStats(value: unknown): ProjectStat[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({ label: String(s.label ?? ""), value: String(s.value ?? "") }))
    .filter((s) => s.label && s.value);
}

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
    tagline: data.tagline != null ? String(data.tagline) : undefined,
    summary: data.summary != null ? String(data.summary) : undefined,
    highlights: Array.isArray(data.highlights) ? data.highlights.map(String) : [],
    date,
    year: new Date(date).getFullYear(),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    github: data.github != null ? String(data.github) : undefined,
    demo: data.demo != null ? String(data.demo) : undefined,
    embed: data.embed != null ? String(data.embed) : undefined,
    featured: Boolean(data.featured),
    order: typeof data.order === "number" ? data.order : undefined,
    color: HEX6.test(colorRaw) ? colorRaw : "#6366f1",
    cover: data.cover != null ? String(data.cover) : undefined,
    coverAlt: data.coverAlt != null ? String(data.coverAlt) : undefined,
    status: data.status != null ? String(data.status) : undefined,
    role: data.role != null ? String(data.role) : undefined,
    timeline: data.timeline != null ? String(data.timeline) : undefined,
    stats: parseStats(data.stats),
    content,
    draft: Boolean(data.draft),
  };
}

/**
 * Every project directory (content/projects/<slug>/ containing an index.mdx),
 * drafts included, sorted featured-first, then by `order`, then date desc. ENOENT → [] so the
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
      (a.order ?? Infinity) - (b.order ?? Infinity) ||
      new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/** Non-draft projects, featured-first, then by `order`, then date desc. */
export function getAllProjects(): Project[] {
  return readAllProjects().filter((project) => !project.draft);
}

/** ALL slugs including drafts (feeds generateStaticParams). */
export function getAllProjectSlugs(): string[] {
  return readAllProjects().map((project) => project.slug);
}

/**
 * The published projects either side of `slug` in /work order, for the
 * previous/next links at the foot of a project page. No wraparound.
 */
export type ProjectNeighbor = Pick<Project, "slug" | "title" | "color"> & { blurb: string };

export function getAdjacentProjects(slug: string): {
  prev?: ProjectNeighbor;
  next?: ProjectNeighbor;
} {
  const list = getAllProjects();
  const i = list.findIndex((p) => p.slug === slug);
  if (i === -1) return {};
  const pick = (p?: Project): ProjectNeighbor | undefined =>
    p ? { slug: p.slug, title: p.title, color: p.color, blurb: p.tagline ?? p.description } : undefined;
  // Wrap around the ends so every page offers both directions.
  if (list.length < 2) return {};
  const at = (n: number) => list[(n + list.length) % list.length];
  if (list.length === 2) return { next: pick(at(i + 1)) };
  return { prev: pick(at(i - 1)), next: pick(at(i + 1)) };
}

/** Cached read of a single project; throws on a missing file. */
export const getProjectBySlug = cache((slug: string): Project => parseProject(slug));
