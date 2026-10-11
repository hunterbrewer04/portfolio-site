// Contracts for the animated flow diagrams embedded in project Overviews via
// <FlowDiagram id="..." />. Definitions are plain data so MDX only ever passes
// a string id (next-mdx-remote blocks JS expressions in props).

export type NodeKind = "client" | "service" | "store" | "external";

export type FlowIcon =
  | "bot"
  | "terminal"
  | "search"
  | "globe"
  | "database"
  | "server"
  | "shield"
  | "file"
  | "film"
  | "sparkles"
  | "box"
  | "cloud"
  | "route"
  | "layers"
  | "package"
  | "laptop"
  | "brain"
  | "gauge"
  | "scissors"
  | "key"
  | "download"
  | "upload"
  | "browser"
  | "list";

export interface FlowNode {
  id: string;
  label: string;
  /** small mono line under the label, e.g. a port or module name */
  sub?: string;
  kind?: NodeKind; // default "service"
  icon?: FlowIcon;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** draw an arrowhead at both ends */
  bidirectional?: boolean;
}

/** A labeled dashed region drawn behind a set of nodes (e.g. "Docker host"). */
export interface FlowZone {
  label: string;
  nodes: string[];
}

export interface FlowStep {
  title: string;
  caption: string;
  /**
   * Node ids visited in order. Each consecutive pair must be joined by an edge
   * in either direction; a reversed edge animates backwards. A single id just
   * highlights that node.
   */
  path: string[];
}

export type Side = "top" | "right" | "bottom" | "left";

export interface FlowLayout {
  cols: number;
  rows: number;
  /** node id → [col, row]; fractional values allowed for centering */
  at: Record<string, [number, number]>;
  /** edge id → [exit side, entry side], overriding the automatic choice */
  sides?: Record<string, [Side, Side]>;
  /** horizontal padding (viewBox units) on both sides of the grid, e.g. room for a side loop */
  inset?: number;
  /** draw edge labels in this layout (default true) */
  edgeLabels?: boolean;
}

export interface FlowDiagramDef {
  title: string;
  /** short eyebrow shown above the title, e.g. "Request flow" */
  kicker?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  zones?: FlowZone[];
  steps: FlowStep[];
  /** wide: the desktop content column; narrow: phones (< 560px container) */
  layouts: { wide: FlowLayout; narrow: FlowLayout };
}
