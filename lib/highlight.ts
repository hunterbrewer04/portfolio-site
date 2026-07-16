// ---------------------------------------------------------------------------
// Build-time syntax highlighting for the "My Work" detail pages.
//
// Runs in Node during `next build` only — imports `shiki` and `fs`, so it must
// never be imported from a client component. The detail page (a server
// component) calls highlightProjectFiles(slug) at build time and passes the
// resulting Record to the client explorer; zero highlighting JS ships to the
// browser.
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import { createHighlighter, type Highlighter } from "shiki";
import { getProjectFileTree, type FileNode } from "@/lib/projects";

export interface HighlightedFile {
  html: string; // shiki-rendered HTML for the file body
  lang: string; // resolved shiki language id (display + Badge)
  loc: number; // line count
}

// Pinned so Cloudflare builds are deterministic. Its background is remapped to
// `transparent` (see BG_REPLACEMENT) so the card's bg-white/[0.03] shows through.
const THEME = "github-dark-default";

// ~100 KB. Larger files still get a Record entry with a graceful fallback so the
// explorer never breaks on selection.
const MAX_FILE_BYTES = 100 * 1024;

// How much of a file to sniff for a NUL byte before deciding it is binary.
const NULL_SNIFF_BYTES = 8000;

// Extension (lowercased, no dot) → shiki canonical language id. Multiple
// extensions collapse onto one id so on-demand loading dedupes naturally.
const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  json: "json",
  jsonc: "jsonc",
  md: "markdown",
  mdx: "mdx",
  py: "python",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  css: "css",
  scss: "scss",
  html: "html",
  htm: "html",
  swift: "swift",
  rs: "rust",
  go: "go",
  sql: "sql",
  dockerfile: "docker",
};

// Filenames (lowercased) that carry no useful extension.
const FILENAME_TO_LANG: Record<string, string> = {
  dockerfile: "docker",
  makefile: "make",
  ".gitignore": "gitignore",
  ".dockerignore": "gitignore",
};

// shiki special languages that never need loadLanguage().
const SPECIAL_LANGS = new Set(["text", "plaintext", "plain", "txt", "ansi"]);
const PLAINTEXT = "text";

// Extensions we never try to highlight — highlighting them is meaningless and
// would ship binary noise. They still get a graceful placeholder entry.
const BINARY_EXTS = new Set([
  // images
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp", "tiff", "heic",
  // fonts
  "woff", "woff2", "ttf", "otf", "eot",
  // media
  "mp4", "mov", "webm", "mkv", "avi", "mp3", "wav", "flac", "ogg",
  // archives
  "zip", "gz", "tar", "tgz", "rar", "7z", "bz2", "xz",
  // docs / binaries
  "pdf", "wasm", "so", "dylib", "dll", "exe", "bin", "o", "a", "class",
  "pyc", "pyd", "node", "sqlite", "db", "dat", "ds_store",
]);

let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>(SPECIAL_LANGS);

/** Lazily-created singleton highlighter (theme preloaded, languages loaded on demand). */
function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({ themes: [THEME], langs: [] });
  }
  return highlighterPromise;
}

/** Resolve a file's shiki language id from its name/extension. */
function resolveLang(filePath: string): string {
  const base = path.basename(filePath).toLowerCase();
  if (base in FILENAME_TO_LANG) return FILENAME_TO_LANG[base];
  const ext = path.extname(base).slice(1); // drop leading "."
  return EXT_TO_LANG[ext] ?? PLAINTEXT;
}

function isBinaryExt(filePath: string): boolean {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return BINARY_EXTS.has(ext);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Graceful, background-transparent fallback so the viewer never breaks. */
function fallbackHtml(message: string): string {
  return `<pre class="shiki shiki-fallback" style="background-color:transparent" tabindex="0"><code>${escapeHtml(
    message,
  )}</code></pre>`;
}

/** Count lines the way an editor would — a trailing newline terminates the last
 *  line rather than adding an empty one (so "a\nb\n" is 2 lines, not 3). */
function countLines(content: string): number {
  if (content.length === 0) return 0;
  const normalized = content.replace(/\r\n?/g, "\n");
  const body = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  return body.split("\n").length;
}

/** Flatten a FileNode tree to just its file paths (relative to files/ root). */
function collectFilePaths(nodes: FileNode[], out: string[]): string[] {
  for (const node of nodes) {
    if (node.type === "dir") {
      if (node.children) collectFilePaths(node.children, out);
    } else {
      out.push(node.path);
    }
  }
  return out;
}

/**
 * Pre-highlights every curated file under content/projects/<slug>/files/ at
 * build time. Keys of the returned Record are paths relative to the files/ root
 * and exactly match the FileNode.path values from getProjectFileTree(slug).
 */
export async function highlightProjectFiles(
  slug: string,
): Promise<Record<string, HighlightedFile>> {
  const filePaths = collectFilePaths(getProjectFileTree(slug), []);
  const filesRoot = path.join(process.cwd(), "content/projects", slug, "files");
  const out: Record<string, HighlightedFile> = {};

  if (filePaths.length === 0) return out;

  const highlighter = await getHighlighter();
  const bg = highlighter.getTheme(THEME).bg;
  // Remap the theme background to transparent so the site's card surface shows
  // through instead of the theme painting its own panel.
  const colorReplacements: Record<string, string> = { [bg]: "transparent" };

  let highlighted = 0;
  let skipped = 0;
  let htmlBytes = 0;

  for (const relPath of filePaths) {
    const abs = path.join(filesRoot, ...relPath.split("/"));

    // 1. binary by extension — never read, just placeholder.
    if (isBinaryExt(relPath)) {
      const ext = path.extname(relPath).slice(1).toLowerCase() || "binary";
      out[relPath] = { html: fallbackHtml("Binary file — not shown."), lang: ext, loc: 0 };
      skipped++;
      continue;
    }

    let size: number;
    try {
      size = fs.statSync(abs).size;
    } catch {
      out[relPath] = { html: fallbackHtml("File not found."), lang: PLAINTEXT, loc: 0 };
      skipped++;
      continue;
    }

    const buffer = fs.readFileSync(abs);

    // 2. binary by NUL-byte sniff.
    const sniffLen = Math.min(buffer.length, NULL_SNIFF_BYTES);
    if (buffer.subarray(0, sniffLen).includes(0)) {
      out[relPath] = { html: fallbackHtml("Binary file — not shown."), lang: "binary", loc: 0 };
      skipped++;
      continue;
    }

    const content = buffer.toString("utf-8");
    const loc = countLines(content);
    const lang = resolveLang(relPath);

    // 3. oversized — keep the entry (with real loc + lang) but skip highlighting.
    if (size > MAX_FILE_BYTES) {
      const kb = Math.round(size / 1024);
      out[relPath] = {
        html: fallbackHtml(`File too large to display (${kb} KB).`),
        lang,
        loc,
      };
      skipped++;
      continue;
    }

    // 4. highlight.
    try {
      if (!loadedLangs.has(lang)) {
        await highlighter.loadLanguage(lang as Parameters<Highlighter["loadLanguage"]>[0]);
        loadedLangs.add(lang);
      }
      const html = highlighter.codeToHtml(content, { lang, theme: THEME, colorReplacements });
      out[relPath] = { html, lang, loc };
      highlighted++;
      htmlBytes += html.length;
    } catch {
      // Unknown grammar or a shiki error — fall back to escaped plaintext.
      out[relPath] = {
        html: fallbackHtml(content),
        lang: PLAINTEXT,
        loc,
      };
      skipped++;
    }
  }

  const kb = (htmlBytes / 1024).toFixed(1);
  console.log(
    `[highlight] ${slug}: ${filePaths.length} files (${highlighted} highlighted, ${skipped} skipped), ~${kb} KB highlighted HTML`,
  );

  return out;
}
