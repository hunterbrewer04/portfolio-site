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
  title: "Escalating from cheap extraction to a real browser",
  nodes: [
    { id: "client", label: "Agent", sub: "/v1/read", kind: "client", icon: "bot" },
    { id: "cache", label: "SQLite cache", sub: "sha256-verified", kind: "store", icon: "database" },
    { id: "policy", label: "Policy checks", sub: "robots · pacing", icon: "shield" },
    { id: "raw", label: "Raw lane", sub: "SSRF-guarded", icon: "download" },
    { id: "t1", label: "T1 Trafilatura", sub: "fast extract", icon: "file" },
    { id: "t3", label: "T3 Crawl4AI", sub: "headless Chromium", icon: "browser" },
    { id: "t4", label: "T4 Camofox", sub: "real browser", icon: "globe" },
    { id: "gate", label: "Content gate", sub: "accept / reject", icon: "gauge" },
    { id: "out", label: "Budget + cite", sub: "trim · citations", icon: "list" },
  ],
  zones: [{ label: "Tier ladder", nodes: ["t1", "t3", "t4"] }],
  edges: [
    { id: "req", from: "client", to: "cache", label: "urls + mode" },
    { id: "miss", from: "cache", to: "policy", label: "miss" },
    { id: "rawe", from: "policy", to: "raw" },
    { id: "allow", from: "policy", to: "t1" },
    { id: "html", from: "raw", to: "t1" },
    { id: "e13", from: "t1", to: "t3" },
    { id: "e34", from: "t3", to: "t4" },
    { id: "g1", from: "t1", to: "gate" },
    { id: "g3", from: "t3", to: "gate" },
    { id: "g4", from: "t4", to: "gate" },
    { id: "acc", from: "gate", to: "out", label: "accepted" },
    { id: "resp", from: "out", to: "client" },
  ],
  steps: [
    {
      title: "Ask for pages, with a budget",
      caption:
        "An agent asks for URLs with a mode (lookup, research, or deep) that caps sources, characters, seconds, and tier attempts. URLs are normalized and trackers stripped, so equivalent links share one cache entry.",
      path: ["client", "cache"],
    },
    {
      title: "Check policy before fetching anything",
      caption:
        "Cached rows are served only if their SHA-256 still matches. On a miss: domain blackouts, robots.txt (a disallow is a refusal, never an escalation), per-domain politeness of 2 at a time and 1 s apart, and learned routing that skips tiers known to fail for this domain.",
      path: ["cache", "policy"],
    },
    {
      title: "A raw lane for plain text",
      caption:
        "Raw files on GitHub, gists, and CDNs get one hardened fetch: every resolved IP checked against private and Tailscale ranges, DNS pinned, redirects re-validated, a 2 MiB streaming cap. HTML goes straight to Trafilatura, so it's only downloaded once.",
      path: ["policy", "raw", "t1"],
    },
    {
      title: "Cheapest tier first",
      caption:
        "Trafilatura pulls the readable text out of the page. A content gate fitted to real measured output then decides: accept, soft-reject a thin stub, or hard-reject a JS shell, a Cloudflare wall, or a 'Loading…' page.",
      path: ["policy", "t1", "gate"],
    },
    {
      title: "Escalate only when it has to",
      caption:
        "Rejected pages climb the ladder: Crawl4AI renders them in headless Chromium, then a real Camofox browser on a second machine, whose tabs are always closed even if the client disconnects mid-request. A 404, robots block, or rate limit stops the climb instead.",
      path: ["t1", "t3", "t4", "gate"],
    },
    {
      title: "Cache it, trim it, cite it",
      caption:
        "The full body is cached, and the character budget trims only this response, so a small request can't poison the cache for a big one. Each source returns with its tier and acceptance metadata, and the domain's learned route gets credit for next time.",
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
