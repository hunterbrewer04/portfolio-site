import type { FlowDiagramDef } from "@/lib/flow-diagrams/types";

export const webStackSearch: FlowDiagramDef = {
  kicker: "Search",
  title: "Searching the web, privately first",
  nodes: [
    { id: "agents", label: "My agents", sub: "ask a question", kind: "client", icon: "bot" },
    { id: "tools", label: "Coding tools", sub: "same search tools", kind: "client", icon: "terminal" },
    { id: "router", label: "Web Stack", sub: "one front door", icon: "route" },
    { id: "private", label: "Private search", sub: "self-hosted", icon: "search" },
    { id: "paid", label: "Paid search", sub: "backup only", kind: "external", icon: "cloud" },
  ],
  edges: [
    { id: "a", from: "agents", to: "router" },
    { id: "t", from: "tools", to: "router" },
    { id: "p", from: "router", to: "private", label: "first" },
    { id: "b", from: "router", to: "paid", label: "if empty" },
  ],
  steps: [
    {
      title: "One front door",
      caption: "My agents send every web search through Web Stack, so they all search the same way.",
      path: ["agents", "router"],
    },
    {
      title: "Same tools everywhere",
      caption: "My coding tools get the exact same search tools, so results match wherever I'm working.",
      path: ["tools", "router"],
    },
    {
      title: "Private search first",
      caption:
        "Searches go to a search engine I host myself. It asks many engines at once, and nobody builds a profile of what my agents look up.",
      path: ["router", "private"],
    },
    {
      title: "Paid search as a backup",
      caption: "Only when private search comes back empty does it ask a paid service, and it paces those calls carefully.",
      path: ["router", "paid"],
    },
    {
      title: "Answer, without keeping the question",
      caption: "Results go back to the agent. Web Stack counts how it's used, but never saves what was searched.",
      path: ["router", "agents"],
    },
  ],
  layouts: {
    wide: {
      cols: 3,
      rows: 2,
      at: {
        agents: [0, 0],
        tools: [0, 1],
        router: [1, 0.5],
        private: [2, 0],
        paid: [2, 1],
      },
      sides: {
        a: ["right", "left"],
        t: ["right", "left"],
        p: ["right", "left"],
        b: ["right", "left"],
      },
    },
    narrow: {
      cols: 2,
      rows: 3,
      edgeLabels: false,
      at: {
        agents: [0, 0],
        tools: [1, 0],
        router: [0.5, 1],
        private: [0, 2],
        paid: [1, 2],
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
    { id: "t1", label: "Fast reader", sub: "text only", icon: "file" },
    { id: "t3", label: "Browser", sub: "modern sites", icon: "browser" },
    { id: "t4", label: "Full browser", sub: "toughest sites", icon: "globe" },
    { id: "gate", label: "Quality check", sub: "real content?", icon: "gauge" },
    { id: "out", label: "Answer", sub: "with sources", icon: "list" },
  ],
  zones: [{ label: "Step up if needed", nodes: ["t1", "t3", "t4"] }],
  edges: [
    { id: "req", from: "client", to: "cache" },
    { id: "miss", from: "cache", to: "policy" },
    { id: "allow", from: "policy", to: "t1" },
    { id: "e13", from: "t1", to: "t3" },
    { id: "e34", from: "t3", to: "t4" },
    { id: "g1", from: "t1", to: "gate" },
    { id: "g3", from: "t3", to: "gate" },
    { id: "g4", from: "t4", to: "gate" },
    { id: "acc", from: "gate", to: "out" },
    { id: "resp", from: "out", to: "client" },
  ],
  steps: [
    {
      title: "Ask for a page",
      caption: "An agent asks for a link. If that page was read recently, the saved copy comes straight back.",
      path: ["client", "cache"],
    },
    {
      title: "Follow the house rules",
      caption: "Before fetching anything new, it checks the site allows it and paces its requests.",
      path: ["cache", "policy"],
    },
    {
      title: "Try the fast way first",
      caption: "Most pages are read in a fraction of a second by pulling out just the text, then checked for real content.",
      path: ["policy", "t1", "gate"],
    },
    {
      title: "Step up only when needed",
      caption: "If the fast way comes up empty, the page opens in a browser, and for the toughest sites, a full browser.",
      path: ["t1", "t3", "t4", "gate"],
    },
    {
      title: "Hand back the answer",
      caption: "The agent gets the page text with its source, and it's saved so the next request is instant.",
      path: ["gate", "out", "client"],
    },
  ],
  layouts: {
    // One loop with no crossings: up to the cache, across to the rules, down
    // into the reading ladder, into the quality check, and back to the agent.
    wide: {
      cols: 4,
      rows: 3,
      at: {
        cache: [0, 0],
        policy: [1, 0],
        client: [0, 1],
        t1: [1, 1],
        t3: [2, 1],
        t4: [3, 1],
        out: [0, 2],
        gate: [2, 2],
      },
    },
    narrow: {
      cols: 2,
      rows: 5,
      inset: 20,
      edgeLabels: false,
      at: {
        client: [0, 0],
        cache: [1, 0],
        policy: [1, 1],
        out: [0, 1.5],
        t1: [1, 2],
        gate: [0, 3],
        t3: [1, 3],
        t4: [1, 4],
      },
      sides: {
        // three separate ways into the quality check: from above, beside, below
        g1: ["left", "top"],
        g3: ["left", "right"],
        g4: ["left", "bottom"],
        acc: ["left", "left"],
        resp: ["top", "bottom"],
      },
    },
  },
};
