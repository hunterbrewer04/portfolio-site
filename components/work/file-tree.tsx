"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { BookOpen, File, SquareMinus, SquarePlus } from "lucide-react";
import type { FileNode } from "@/lib/projects";

// Spring tuned to the react-spring "Tree" demo feel: springy + quick, only a
// whisper of overshoot (damping ratio ~0.81 at m=1). See PR notes.
const SPRING = { type: "spring", stiffness: 300, damping: 28 } as const;

interface FileTreeProps {
  tree: FileNode[];
  /** "overview" | <filePath> */
  selected: string;
  onSelect: (key: string) => void;
  /** 6-digit hex accent, e.g. "#6366f1" */
  color: string;
}

export function FileTree({ tree, selected, onSelect, color }: FileTreeProps) {
  const overviewSelected = selected === "overview";

  return (
    <ul className="font-mono text-sm">
      <li>
        <button
          type="button"
          onClick={() => onSelect("overview")}
          aria-current={overviewSelected ? "true" : undefined}
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          style={
            overviewSelected ? { backgroundColor: `${color}1A`, color } : undefined
          }
        >
          <BookOpen
            size={15}
            className={overviewSelected ? "shrink-0" : "shrink-0 text-neutral-500"}
          />
          <span className={overviewSelected ? undefined : "text-neutral-300"}>
            Overview
          </span>
        </button>
      </li>
      {tree.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          selected={selected}
          onSelect={onSelect}
          color={color}
        />
      ))}
    </ul>
  );
}

interface TreeNodeProps {
  node: FileNode;
  selected: string;
  onSelect: (key: string) => void;
  color: string;
}

function TreeNode({ node, selected, onSelect, color }: TreeNodeProps) {
  const reduce = useReducedMotion();
  // Directories default open so structure (and any deep-linked file) is visible.
  const [open, setOpen] = useState(true);

  if (node.type === "file") {
    const isSelected = selected === node.path;
    return (
      <li>
        <button
          type="button"
          onClick={() => onSelect(node.path)}
          aria-current={isSelected ? "true" : undefined}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          style={
            isSelected ? { backgroundColor: `${color}1A`, color } : undefined
          }
        >
          <File
            size={14}
            className={isSelected ? "shrink-0" : "shrink-0 text-neutral-600"}
          />
          <span className={isSelected ? "truncate" : "truncate text-neutral-400"}>
            {node.name}
          </span>
        </button>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-neutral-300 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
      >
        {open ? (
          <SquareMinus size={14} className="shrink-0 text-neutral-500" />
        ) : (
          <SquarePlus size={14} className="shrink-0 text-neutral-500" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0 }}
        transition={reduce ? { duration: 0 } : SPRING}
        inert={open ? undefined : true}
        className="overflow-hidden"
      >
        <motion.ul
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: open ? 0 : 20 }}
          transition={reduce ? { duration: 0 } : SPRING}
          className="ml-2 border-l border-dashed border-white/15 pl-3"
        >
          {node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              selected={selected}
              onSelect={onSelect}
              color={color}
            />
          ))}
        </motion.ul>
      </motion.div>
    </li>
  );
}
