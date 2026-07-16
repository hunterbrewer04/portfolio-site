"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { HighlightedFile } from "@/lib/highlight";

interface CodeViewerProps {
  file: HighlightedFile;
  /** basename, e.g. "index.ts" */
  name: string;
  /** path relative to files/ root, e.g. "src/index.ts" */
  path: string;
  /** 6-digit hex accent */
  color: string;
}

export function CodeViewer({ file, name, path, color }: CodeViewerProps) {
  // We only receive pre-rendered shiki HTML, so copy reads the rendered text.
  const codeRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = codeRef.current?.innerText ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can reject (permissions / insecure context) — fail silently.
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.03]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 font-mono text-xs font-medium text-neutral-300">
            {name}
          </span>
          {path !== name && (
            <span className="truncate font-mono text-xs text-neutral-500">
              {path}
            </span>
          )}
        </div>
        <Badge
          variant="secondary"
          className="shrink-0 border border-white/[0.08] bg-white/[0.04] font-mono text-[10px] text-neutral-400"
        >
          {file.lang}
        </Badge>
        <span className="hidden shrink-0 font-mono text-[11px] text-neutral-500 sm:inline">
          {file.loc} LOC
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied to clipboard" : `Copy ${name} to clipboard`}
          className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[11px] text-neutral-400 transition-colors hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          {copied ? (
            <Check size={13} style={{ color }} />
          ) : (
            <Copy size={13} />
          )}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      {/* Horizontal scroll lives INSIDE the card; the page never scrolls sideways.
          Shiki ships its own <pre> background — force it transparent so the card
          surface shows through. */}
      <div
        ref={codeRef}
        className="overflow-x-auto p-4 font-mono text-sm leading-relaxed [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0"
        dangerouslySetInnerHTML={{ __html: file.html }}
      />
    </div>
  );
}
