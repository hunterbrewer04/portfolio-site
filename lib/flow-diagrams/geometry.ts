import type { FlowDiagramDef, FlowLayout, Side } from "@/lib/flow-diagrams/types";

export type Variant = "wide" | "narrow";

// viewBox metrics per variant. `wide` renders ~1:1 in the desktop Overview
// column (~790px); `narrow` renders ~1:1 on a 390px phone, so text stays legible
// instead of being scaled down.
const METRICS = {
  wide: { width: 760, rowH: 100, maxNodeW: 172, gutterX: 40, nodeH: 50, padY: 6 },
  narrow: { width: 340, rowH: 88, maxNodeW: 154, gutterX: 14, nodeH: 48, padY: 6 },
} as const;

const ZONE_PAD = 10;
const ZONE_LABEL = 16;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export interface EdgeGeometry {
  d: string;
  mid: { x: number; y: number };
  /** label pill width, or 0 when the edge has no label or it wouldn't fit */
  labelW: number;
}

/** Approximate pill width for a 9.5px mono label. */
export const labelWidth = (label: string) => label.length * 5.5 + 10;

export interface ZoneGeometry {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DiagramGeometry {
  width: number;
  height: number;
  boxes: Record<string, Box>;
  edges: Record<string, EdgeGeometry>;
  zones: ZoneGeometry[];
  edgeLabels: boolean;
}

export interface Hop {
  edgeId: string;
  reverse: boolean;
}

type Point = { x: number; y: number };

const NORMAL: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

function anchor(box: Box, side: Side): Point {
  switch (side) {
    case "top":
      return { x: box.cx, y: box.y };
    case "bottom":
      return { x: box.cx, y: box.y + box.h };
    case "left":
      return { x: box.x, y: box.cy };
    case "right":
      return { x: box.x + box.w, y: box.cy };
  }
}

/** Same row → horizontal; otherwise leave from the bottom/top. */
function autoSides(a: Box, b: Box): [Side, Side] {
  if (Math.abs(a.cy - b.cy) < 1) {
    return a.cx <= b.cx ? ["right", "left"] : ["left", "right"];
  }
  return a.cy < b.cy ? ["bottom", "top"] : ["top", "bottom"];
}

const r = (n: number) => Math.round(n * 10) / 10;

function edgePath(a: Box, b: Box, sides: [Side, Side], label?: string): EdgeGeometry {
  const p0 = anchor(a, sides[0]);
  const p3 = anchor(b, sides[1]);
  const dist = Math.hypot(p3.x - p0.x, p3.y - p0.y);
  // Same-side loops (e.g. bottom→bottom arcs under a row) get a fixed, shallow
  // bulge (~27 units at the apex) so they stay inside the canvas.
  const c = sides[0] === sides[1] ? 36 : Math.min(80, Math.max(24, dist * 0.4));
  const n0 = NORMAL[sides[0]];
  const n3 = NORMAL[sides[1]];
  const p1 = { x: p0.x + n0.x * c, y: p0.y + n0.y * c };
  const p2 = { x: p3.x + n3.x * c, y: p3.y + n3.y * c };
  // Cubic bezier midpoint B(0.5) — lets labels sit on the curve without DOM.
  const mid = {
    x: (p0.x + 3 * p1.x + 3 * p2.x + p3.x) / 8,
    y: (p0.y + 3 * p1.y + 3 * p2.y + p3.y) / 8,
  };
  // Only label edges with room for the pill between the two boxes; short hops
  // between neighbours would otherwise paint the label over the nodes.
  const w = label ? labelWidth(label) : 0;
  const room = sides[0] === sides[1] ? Infinity : dist - 12;
  return {
    labelW: w > 0 && w <= room ? w : 0,
    d: `M${r(p0.x)} ${r(p0.y)} C${r(p1.x)} ${r(p1.y)} ${r(p2.x)} ${r(p2.y)} ${r(p3.x)} ${r(p3.y)}`,
    mid,
  };
}

export function computeGeometry(def: FlowDiagramDef, variant: Variant): DiagramGeometry {
  const m = METRICS[variant];
  const layout: FlowLayout = def.layouts[variant];
  const inset = layout.inset ?? 0;
  const cellW = (m.width - inset * 2) / layout.cols;
  const nodeW = Math.min(m.maxNodeW, cellW - m.gutterX);

  const boxes: Record<string, Box> = {};
  for (const node of def.nodes) {
    const pos = layout.at[node.id];
    if (!pos) throw new Error(`FlowDiagram "${def.title}": node "${node.id}" has no ${variant} position`);
    const cx = inset + (pos[0] + 0.5) * cellW;
    const cy = m.padY + (pos[1] + 0.5) * m.rowH;
    boxes[node.id] = { x: cx - nodeW / 2, y: cy - m.nodeH / 2, w: nodeW, h: m.nodeH, cx, cy };
  }

  const edges: Record<string, EdgeGeometry> = {};
  for (const edge of def.edges) {
    const a = boxes[edge.from];
    const b = boxes[edge.to];
    if (!a || !b) throw new Error(`FlowDiagram "${def.title}": edge "${edge.id}" references an unknown node`);
    edges[edge.id] = edgePath(a, b, layout.sides?.[edge.id] ?? autoSides(a, b), edge.label);
  }

  const zones: ZoneGeometry[] = (def.zones ?? []).map((zone) => {
    const members = zone.nodes.map((id) => boxes[id]);
    const minX = Math.min(...members.map((b) => b.x)) - ZONE_PAD;
    const maxX = Math.max(...members.map((b) => b.x + b.w)) + ZONE_PAD;
    const minY = Math.min(...members.map((b) => b.y)) - ZONE_PAD - ZONE_LABEL;
    const maxY = Math.max(...members.map((b) => b.y + b.h)) + ZONE_PAD;
    return { label: zone.label, x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  });

  const contentBottom = Math.max(
    m.padY * 2 + layout.rows * m.rowH,
    ...zones.map((z) => z.y + z.h + m.padY),
  );

  return {
    width: m.width,
    height: Math.ceil(contentBottom),
    boxes,
    edges,
    zones,
    edgeLabels: layout.edgeLabels ?? true,
  };
}

/** Resolve each step's node path to edge hops; throws at build time on a broken path. */
export function resolveHops(def: FlowDiagramDef): Hop[][] {
  return def.steps.map((step) =>
    step.path.slice(1).map((to, i) => {
      const from = step.path[i];
      const forward = def.edges.find((e) => e.from === from && e.to === to);
      if (forward) return { edgeId: forward.id, reverse: false };
      const backward = def.edges.find((e) => e.from === to && e.to === from);
      if (backward) return { edgeId: backward.id, reverse: true };
      throw new Error(`FlowDiagram "${def.title}": no edge between "${from}" and "${to}"`);
    }),
  );
}
