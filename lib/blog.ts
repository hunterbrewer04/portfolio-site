import fs from "fs";
import path from "path";
import { cache } from "react";
import matter from "gray-matter";
import readingTime from "reading-time";

export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  readingTime: string;
  content: string;
}

const BLOG_DIR = path.join(process.cwd(), "content/blog");

function parseMdxFile(slug: string): Post {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  const raw = fs.readFileSync(filePath, "utf-8");

  const { data, content } = matter(raw);
  const { text: readingTimeText } = readingTime(content);

  return {
    slug,
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date ?? ""),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    readingTime: readingTimeText,
    content,
  };
}

/**
 * Returns all blog posts sorted by date, newest first.
 */
export function getAllPosts(): Post[] {
  let files: string[];
  try {
    files = fs.readdirSync(BLOG_DIR);
  } catch (e: unknown) {
    if (e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }

  const slugs = files
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""));

  const posts = slugs.map(parseMdxFile);

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * Returns a single post by its slug. Memoized with React.cache
 * so generateMetadata and the page component share the same read.
 */
export const getPostBySlug = cache((slug: string): Post => {
  return parseMdxFile(slug);
});
