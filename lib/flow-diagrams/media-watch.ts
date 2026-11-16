import type { FlowDiagramDef } from "@/lib/flow-diagrams/types";

export const mediaWatchPipeline: FlowDiagramDef = {
  kicker: "Pipeline",
  title: "From a link to a report",
  nodes: [
    { id: "agent", label: "Agent", sub: "link + question", kind: "client", icon: "bot" },
    { id: "fetch", label: "Download", sub: "once", icon: "download" },
    { id: "cache", label: "Saved copy", sub: "reused later", kind: "store", icon: "database" },
    { id: "proxy", label: "Shrink", sub: "fits one request", icon: "scissors" },
    { id: "model", label: "AI model", sub: "watches the video", kind: "external", icon: "sparkles" },
    { id: "fallback", label: "Backup model", sub: "if needed", kind: "external", icon: "sparkles" },
    { id: "validate", label: "Check", sub: "well-formed report", icon: "shield" },
    { id: "usage", label: "Cost log", sub: "every call", kind: "store", icon: "list" },
  ],
  edges: [
    { id: "req", from: "agent", to: "fetch", label: "link" },
    { id: "src", from: "fetch", to: "cache", label: "video" },
    { id: "probe", from: "fetch", to: "proxy" },
    { id: "proxyout", from: "proxy", to: "cache", label: "smaller copy" },
    { id: "call", from: "proxy", to: "model", label: "whole clip" },
    { id: "fb", from: "model", to: "fallback", label: "if needed" },
    { id: "json", from: "model", to: "validate", label: "report" },
    { id: "fbjson", from: "fallback", to: "validate" },
    { id: "log", from: "validate", to: "usage", label: "cost" },
    { id: "ret", from: "usage", to: "agent", label: "report" },
  ],
  steps: [
    {
      title: "Hand it a link",
      caption:
        "An agent passes along a video link, or a file, and an optional question like \"what's the recipe?\"",
      path: ["agent", "fetch"],
    },
    {
      title: "Download once",
      caption:
        "The video is downloaded and saved, so asking about it again later doesn't download it twice.",
      path: ["fetch", "cache"],
    },
    {
      title: "Shrink it to fit",
      caption:
        "The clip is made just small enough to send to the AI in a single request, without losing what matters.",
      path: ["fetch", "proxy", "cache"],
    },
    {
      title: "Actually watch it",
      caption:
        "A video-capable AI model watches the whole clip, sound included, not just a few still frames.",
      path: ["proxy", "model"],
    },
    {
      title: "Check the report",
      caption:
        "The answer comes back as a timestamped report of what was seen, said, and heard, and it's checked before it's used.",
      path: ["model", "validate"],
    },
    {
      title: "A backup when it helps",
      caption:
        "If the first model fails, a different one gets a try, but only when switching could actually fix the problem.",
      path: ["model", "fallback", "validate"],
    },
    {
      title: "Report back",
      caption:
        "The agent gets its report, and the exact cost of the call is logged so spending is never a surprise.",
      path: ["validate", "usage", "agent"],
    },
  ],
  layouts: {
    wide: {
      cols: 4,
      rows: 2.35,
      at: {
        agent: [0, 0],
        fetch: [1, 0],
        proxy: [2, 0],
        model: [3, 0],
        usage: [0, 1],
        cache: [1, 1],
        fallback: [2, 1],
        validate: [3, 1],
      },
      sides: { log: ["bottom", "bottom"] },
    },
    narrow: {
      cols: 2,
      rows: 4,
      inset: 22,
      edgeLabels: false,
      at: {
        agent: [0, 0],
        fetch: [1, 0],
        cache: [0, 1],
        proxy: [1, 1],
        fallback: [0, 2],
        model: [1, 2],
        usage: [0, 3],
        validate: [1, 3],
      },
      sides: { ret: ["left", "left"] },
    },
  },
};
