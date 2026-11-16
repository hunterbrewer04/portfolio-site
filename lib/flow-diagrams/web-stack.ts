import type { FlowDiagramDef } from "@/lib/flow-diagrams/types";

export const webStackSearch: FlowDiagramDef = {
  kicker: "Search",
  title: "Free metasearch first, paid API only as a fallback",
  nodes: [
    { id: "hermes", label: "Hermes agents", sub: "native provider", kind: "client", icon: "bot" },
    { id: "mcp", label: "MCP clients", sub: "Claude Code · /mcp", kind: "client", icon: "terminal" },
    { id: "router", label: "Router", sub: "FastAPI + MCP", icon: "route" },
    { id: "searxng", label: "SearXNG", sub: "metasearch", icon: "search" },
    { id: "valkey", label: "Valkey", sub: "SearXNG state", kind: "store", icon: "database" },
    { id: "brave", label: "Brave API", sub: "fallback only", kind: "external", icon: "cloud" },
  ],
  edges: [
    { id: "h", from: "hermes", to: "router", label: "/v1/search" },
    { id: "m", from: "mcp", to: "router", label: "web_search" },
    { id: "sx", from: "router", to: "searxng", label: "JSON" },
    { id: "vk", from: "searxng", to: "valkey" },
    { id: "br", from: "router", to: "brave", label: "only if empty" },
  ],
  steps: [
    {
      title: "One endpoint for every agent",
      caption:
        "Hermes agents call through a native provider plugin that identifies itself as hermes/<profile>. Claude Code and other MCP clients use the router's /mcp server. Both sit behind one bearer token, reachable only on the tailnet.",
      path: ["hermes", "router"],
    },
    {
      title: "MCP clients get the same tools",
      caption:
        "web_search, web_extract, web_acquire and web_health are exposed over MCP and backed by exactly the same core functions as the REST and /v1 APIs, so every client gets identical behavior.",
      path: ["mcp", "router"],
    },
    {
      title: "Metasearch first",
      caption:
        "SearXNG fans the query out across search engines and returns JSON, which the router de-duplicates and ranks. There's no per-query bill and no third party building a profile of what the agents look up.",
      path: ["router", "searxng", "valkey"],
    },
    {
      title: "A paid fallback, carefully rate-limited",
      caption:
        "Brave is called only when SearXNG comes back empty. Calls are serialized process-wide at least 1.1 s apart, and a 429 gets exactly one retry, honoring Retry-After, all bounded by the request's own deadline.",
      path: ["router", "brave"],
    },
    {
      title: "Answer without remembering the question",
      caption:
        "The /v1 envelope carries a request id, the engine used, and typed errors with real HTTP statuses. Telemetry records one row per request, but there's no column that could ever hold the query text.",
      path: ["router", "hermes"],
    },
  ],
  layouts: {
    wide: {
      cols: 4,
      rows: 2,
      at: {
        hermes: [0, 0],
        mcp: [0, 1],
        router: [1, 0.5],
        searxng: [2, 0],
        valkey: [3, 0],
        brave: [2, 1],
      },
      sides: {
        h: ["right", "left"],
        m: ["right", "left"],
        sx: ["right", "left"],
        br: ["right", "left"],
      },
    },
    narrow: {
      cols: 2,
      rows: 4,
      edgeLabels: false,
      at: {
        hermes: [0, 0],
        mcp: [1, 0],
        router: [0.5, 1],
        searxng: [0, 2],
        brave: [1, 2],
        valkey: [0, 3],
      },
    },
  },
};

export const webStackRead: FlowDiagramDef = {
  kicker: "Read",
  title: "Reading a page, cheapest method first",
  nodes: [
    { id: "client", label: "Agent", sub: "asks for a page", kind: "client", icon: "bot" },
    { id: "cache", label: "Cache", sub: "already read?", kind: "store", icon: "database" },
    { id: "policy", label: "House rules", sub: "polite by default", icon: "shield" },
    { id: "raw", label: "Plain files", sub: "quick download", icon: "download" },
    { id: "t1", label: "Fast reader", sub: "text only", icon: "file" },
    { id: "t3", label: "Browser", sub: "for modern sites", icon: "browser" },
    { id: "t4", label: "Full browser", sub: "for the toughest", icon: "globe" },
    { id: "gate", label: "Quality check", sub: "real content?", icon: "gauge" },
    { id: "out", label: "Answer", sub: "with sources", icon: "list" },
  ],
  zones: [{ label: "Step up only if needed", nodes: ["t1", "t3", "t4"] }],
  edges: [
    { id: "req", from: "client", to: "cache", label: "links" },
    { id: "miss", from: "cache", to: "policy", label: "new" },
    { id: "rawe", from: "policy", to: "raw" },
    { id: "allow", from: "policy", to: "t1" },
    { id: "html", from: "raw", to: "t1" },
    { id: "e13", from: "t1", to: "t3" },
    { id: "e34", from: "t3", to: "t4" },
    { id: "g1", from: "t1", to: "gate" },
    { id: "g3", from: "t3", to: "gate" },
    { id: "g4", from: "t4", to: "gate" },
    { id: "acc", from: "gate", to: "out", label: "looks good" },
    { id: "resp", from: "out", to: "client" },
  ],
  steps: [
    {
      title: "Ask for a page",
      caption:
        "An agent asks for one or more links. If a page was read recently, the saved copy comes straight back.",
      path: ["client", "cache"],
    },
    {
      title: "Follow the house rules",
      caption:
        "Before fetching anything new, it checks that the site allows it and paces its requests, so it never hammers anyone's site.",
      path: ["cache", "policy"],
    },
    {
      title: "Plain files take a shortcut",
      caption:
        "Simple text files are downloaded directly, without any page reading at all.",
      path: ["policy", "raw", "t1"],
    },
    {
      title: "Try the fast way first",
      caption:
        "Most pages are read in a fraction of a second by pulling out just the text. A quality check makes sure real content came back, not a loading screen.",
      path: ["policy", "t1", "gate"],
    },
    {
      title: "Step up only when needed",
      caption:
        "If the fast way comes up empty, the page is opened in a browser, and for the toughest sites, a full real browser on another machine.",
      path: ["t1", "t3", "t4", "gate"],
    },
    {
      title: "Hand back the answer",
      caption:
        "The agent gets the page text with its source, and the result is saved so the next request for it is instant.",
      path: ["gate", "out", "client"],
    },
  ],
  layouts: {
    wide: {
      cols: 4,
      rows: 3,
      inset: 14,
      at: {
        client: [0, 0],
        cache: [1, 0],
        policy: [2, 0],
        raw: [0, 1],
        t1: [1, 1],
        t3: [2, 1],
        t4: [3, 1],
        out: [0, 2],
        gate: [2, 2],
      },
      sides: {
        resp: ["left", "left"],
      },
    },
    narrow: {
      cols: 2,
      rows: 5,
      inset: 22,
      edgeLabels: false,
      at: {
        client: [0, 0],
        cache: [1, 0],
        raw: [0, 1],
        policy: [1, 1],
        out: [0, 2],
        t1: [1, 2],
        gate: [0, 3],
        t3: [1, 3],
        t4: [1, 4],
      },
      sides: {
        g4: ["left", "bottom"],
        acc: ["left", "left"],
        resp: ["left", "left"],
      },
    },
  },
};
