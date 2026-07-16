"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { FileTree } from "@/components/work/file-tree";
import { CodeViewer } from "@/components/work/code-viewer";
import { ProjectOverview } from "@/components/work/project-overview";
import type { FileNode } from "@/lib/projects";
import type { HighlightedFile } from "@/lib/highlight";

export interface ProjectMeta {
  title: string;
  description: string;
  tags: string[];
  github?: string;
  demo?: string;
  date: string;
}

interface ProjectExplorerProps {
  tree: FileNode[];
  /** keyed by path relative to files/ root (matches FileNode.path) */
  files: Record<string, HighlightedFile>;
  /** RSC-rendered MDX Overview body */
  overview: ReactNode;
  /** 6-digit hex accent */
  color: string;
  meta: ProjectMeta;
}

// Slightly firmer spring for the mobile panel unfold — same family as the tree.
const PANEL_SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

export function ProjectExplorer({
  tree,
  files,
  overview,
  color,
  meta,
}: ProjectExplorerProps) {
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<string>("overview");
  const [panelOpen, setPanelOpen] = useState(false);
  // The tree panel is one shared instance: collapsed-by-state on mobile, forced
  // visible on desktop via lg:!h-auto. `inert` must therefore only apply below
  // the lg breakpoint, or it would disable the always-visible desktop tree.
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Deep-link: preselect from the URL hash on mount only, so the SSR HTML stays
  // deterministic (no hydration mismatch). Static-export safe — the hash never
  // reaches the server.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    let decoded: string | null = null;
    try {
      decoded = decodeURIComponent(hash);
    } catch {
      decoded = null; // malformed hash → treat as absent
    }
    if (decoded !== null && files[decoded]) {
      setSelected(decoded);
    } else {
      // Stale/invalid hash → drop it, stay on Overview.
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = useCallback((key: string) => {
    setSelected(key);
    setPanelOpen(false); // auto-collapse the mobile panel after any selection
    if (key === "overview") {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    } else {
      window.history.replaceState(null, "", `#${encodeURIComponent(key)}`);
    }
  }, []);

  const activeFile = selected !== "overview" ? files[selected] : undefined;
  const showOverview = selected === "overview" || !activeFile;
  const currentLabel = showOverview
    ? "Overview"
    : (selected.split("/").pop() ?? selected);

  return (
    <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
      {/* Tree column */}
      <aside className="lg:sticky lg:top-8 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        {/* Mobile-only toggle */}
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          className="flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 lg:hidden"
        >
          <span className="shrink-0 text-sm font-medium text-neutral-200">
            Files
          </span>
          <span className="truncate font-mono text-xs text-neutral-500">
            {currentLabel}
          </span>
          <motion.span
            animate={{ rotate: panelOpen ? 180 : 0 }}
            transition={{ duration: reduce ? 0 : 0.3 }}
            className="ml-auto shrink-0"
          >
            <ChevronDown size={16} className="text-neutral-500" />
          </motion.span>
        </button>

        {/* Collapsible on mobile; forced open on desktop via lg:!h-auto. While
            collapsed on mobile the tree stays mounted, so `inert` keeps its
            buttons out of the tab order / accessibility tree. */}
        <motion.div
          initial={false}
          animate={{ height: panelOpen ? "auto" : 0 }}
          transition={reduce ? { duration: 0 } : PANEL_SPRING}
          inert={panelOpen || isDesktop ? undefined : true}
          className="overflow-hidden lg:!h-auto"
        >
          <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 lg:mt-0 lg:border-0 lg:bg-transparent lg:p-0">
            <FileTree
              tree={tree}
              selected={showOverview ? "overview" : selected}
              onSelect={handleSelect}
              color={color}
            />
          </div>
        </motion.div>
      </aside>

      {/* Content column */}
      <div className="mt-6 min-w-0 lg:mt-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={showOverview ? "overview" : selected}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          >
            {showOverview ? (
              <ProjectOverview meta={meta} color={color}>
                {overview}
              </ProjectOverview>
            ) : (
              <CodeViewer
                file={activeFile!}
                name={selected.split("/").pop() ?? selected}
                path={selected}
                color={color}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
