import type { FlowDiagramDef } from "@/lib/flow-diagrams/types";
import { dockerRegistryFlow } from "@/lib/flow-diagrams/docker-registry";
import { mediaWatchPipeline } from "@/lib/flow-diagrams/media-watch";
import { webStackRead, webStackSearch } from "@/lib/flow-diagrams/web-stack";

// Registry of diagrams addressable from project MDX: <FlowDiagram id="..." />.
const DIAGRAMS: Record<string, FlowDiagramDef> = {
  "media-watch-pipeline": mediaWatchPipeline,
  "web-stack-search": webStackSearch,
  "web-stack-read": webStackRead,
  "docker-registry-flow": dockerRegistryFlow,
};

export function getFlowDiagram(id: string): FlowDiagramDef | undefined {
  return DIAGRAMS[id];
}
