// ---------------------------------------------------------------------------
// CONTRACT — build-time syntax highlighting for My Work detail pages.
// Interface is final; the function body is a stub pending the shiki pipeline.
// ---------------------------------------------------------------------------

export interface HighlightedFile {
  html: string; // shiki-rendered HTML for the file body
  lang: string; // resolved shiki language id (display + Badge)
  loc: number; // line count
}

/**
 * Pre-highlights every curated file under content/projects/<slug>/files/ at
 * build time. Keys are paths relative to the files/ root (match FileNode.path).
 */
export async function highlightProjectFiles(
  slug: string,
): Promise<Record<string, HighlightedFile>> {
  void slug;
  return {};
}
