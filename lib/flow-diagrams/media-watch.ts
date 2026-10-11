import type { FlowDiagramDef } from "@/lib/flow-diagrams/types";

export const mediaWatchPipeline: FlowDiagramDef = {
  kicker: "Pipeline",
  title: "From a link to a structured report",
  nodes: [
    { id: "agent", label: "Agent / CLI", sub: "watch_video · mw", kind: "client", icon: "bot" },
    { id: "fetch", label: "Fetch", sub: "yt-dlp ≤ 720p", icon: "download" },
    { id: "cache", label: "Item cache", sub: "items/{key}/", kind: "store", icon: "database" },
    { id: "proxy", label: "Proxy encode", sub: "ffmpeg · 480p", icon: "scissors" },
    { id: "model", label: "OpenRouter", sub: "Gemini · video in", kind: "external", icon: "sparkles" },
    { id: "fallback", label: "Fallback model", sub: "other provider", kind: "external", icon: "sparkles" },
    { id: "validate", label: "Validate", sub: "pydantic Report", icon: "shield" },
    { id: "usage", label: "Usage log", sub: "SQLite · cost", kind: "store", icon: "list" },
  ],
  edges: [
    { id: "req", from: "agent", to: "fetch", label: "URL + question" },
    { id: "src", from: "fetch", to: "cache", label: "source.mp4" },
    { id: "probe", from: "fetch", to: "proxy", label: "ffprobe" },
    { id: "proxyout", from: "proxy", to: "cache", label: "proxy.mp4" },
    { id: "call", from: "proxy", to: "model", label: "base64 video" },
    { id: "fb", from: "model", to: "fallback", label: "if it can help" },
    { id: "json", from: "model", to: "validate", label: "strict JSON" },
    { id: "fbjson", from: "fallback", to: "validate" },
    { id: "log", from: "validate", to: "usage", label: "cost + report" },
    { id: "ret", from: "usage", to: "agent", label: "report" },
  ],
  steps: [
    {
      title: "Hand it a link",
      caption:
        "An agent calls watch_video (or you run mw watch) with a URL or a local file and an optional question. Tracking parameters are stripped, so different share links to the same video hit the same cache entry.",
      path: ["agent", "fetch"],
    },
    {
      title: "Download once",
      caption:
        "yt-dlp grabs a ≤720p copy and skips livestreams and anything over the length cap before downloading a byte. Local files are fingerprinted by path, size, mtime, and head/tail bytes instead of being copied.",
      path: ["fetch", "cache"],
    },
    {
      title: "Shrink to fit one request",
      caption:
        "ffmpeg re-encodes to a 480p short side, 15 fps, and mono audio. If it's still over 14 MiB it re-encodes at a higher CRF, because 14 MiB base64-encodes to ~19 MB — just under Gemini's inline limit.",
      path: ["fetch", "proxy", "cache"],
    },
    {
      title: "Actually watch it",
      caption:
        "The whole clip goes inline as a base64 data URL in a single OpenRouter request, with a strict JSON schema that the routed provider is required to support.",
      path: ["proxy", "model"],
    },
    {
      title: "Validate the report",
      caption:
        "Pydantic checks the response: a timestamped timeline, verbatim on-screen text, speech, audio, notable moments, and a list of what the model wasn't sure about. Malformed JSON gets one retry.",
      path: ["model", "validate"],
    },
    {
      title: "Fall back only when it helps",
      caption:
        "If the primary model still fails, a different model gets one attempt — unless the error was a bad key, no credits, or a too-large file, where switching models can't help.",
      path: ["model", "fallback", "validate"],
    },
    {
      title: "Report back, log the real cost",
      caption:
        "Every paid attempt, failed ones included, is logged to SQLite with OpenRouter's exact cost. The agent gets the report back flagged as untrusted content, so it can't follow instructions hidden in a video.",
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
