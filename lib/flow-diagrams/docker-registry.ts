import type { FlowDiagramDef } from "@/lib/flow-diagrams/types";

export const dockerRegistryFlow: FlowDiagramDef = {
  kicker: "Push & pull",
  title: "Rebuilding any stack on any host",
  nodes: [
    { id: "src", label: "CLI", sub: "push ./mealie", kind: "client", icon: "laptop" },
    { id: "sanitize", label: "Sanitize", sub: "blank secrets", icon: "scissors" },
    { id: "ui", label: "Web UI", sub: "diff · edit", kind: "client", icon: "browser" },
    { id: "gbrain", label: "Knowledge base", sub: "notes · read-only", kind: "external", icon: "brain" },
    { id: "api", label: "Registry API", sub: "re-sanitizes", icon: "server" },
    { id: "store", label: "Files on disk", sub: "stacks/<name>/", kind: "store", icon: "file" },
    { id: "history", label: "History", sub: "snapshot per push", kind: "store", icon: "layers" },
    { id: "newhost", label: "CLI", sub: "pull mealie", kind: "client", icon: "laptop" },
    { id: "unpack", label: "Safe unpack", sub: "validate first", icon: "shield" },
  ],
  zones: [
    { label: "Source host", nodes: ["src", "sanitize"] },
    { label: "Registry server", nodes: ["api", "store", "history"] },
    { label: "Fresh host", nodes: ["newhost", "unpack"] },
  ],
  edges: [
    { id: "cmd", from: "src", to: "sanitize", label: "compose + .env" },
    { id: "put", from: "sanitize", to: "api", label: "multipart PUT" },
    { id: "swap", from: "api", to: "store", label: "atomic swap" },
    { id: "snap", from: "store", to: "history" },
    { id: "uiapi", from: "ui", to: "api" },
    { id: "kb", from: "api", to: "gbrain" },
    { id: "nh", from: "newhost", to: "unpack" },
    { id: "pull", from: "unpack", to: "api", label: "bundle.tar" },
  ],
  steps: [
    {
      title: "Push from wherever the stack lives",
      caption:
        "docker-registry push reads the compose file, .env, and NOTES.md. The real .env never leaves memory: secret-looking values are blanked to KEY= based on key segments, credentials in URLs, entropy, JWT shape, and known token prefixes.",
      path: ["src", "sanitize"],
    },
    {
      title: "Refuse secrets hardcoded in compose",
      caption:
        "The compose file is scanned too, following YAML anchors and merge keys. A literal secret under environment: stops the push and points at the exact file and line to move into .env.",
      path: ["sanitize"],
    },
    {
      title: "Upload, then check it all again",
      caption:
        "The sanitized files go up as a multipart PUT over Tailscale. The server re-runs the same sanitizer and re-scans the compose itself. It never trusts that the client already cleaned anything.",
      path: ["sanitize", "api"],
    },
    {
      title: "A crash-safe write with full history",
      caption:
        "The new version is built in a hidden temp dir, the current one is snapshotted into history, and the directories are swapped by rename, rolling back on any error. A swap interrupted by a crash is repaired on the next startup.",
      path: ["api", "store", "history"],
    },
    {
      title: "Browse, diff, and edit in the browser",
      caption:
        "An embedded React UI shows each stack's services, ports, and volumes, diffs any two versions, edits files in place (re-sanitized on save), and pulls in linked notes from a self-hosted knowledge base.",
      path: ["ui", "api", "gbrain"],
    },
    {
      title: "Rebuild on a fresh host",
      caption:
        "pull fetches a flat tar bundle. Every entry is checked before anything touches disk: no paths, no .., regular files only. It also refuses to run at all if a .env already exists, so it can never overwrite real secrets.",
      path: ["newhost", "unpack", "api", "store"],
    },
    {
      title: "Fill in the blanks, compose up",
      caption:
        "The bundle lands with the original compose filename and the template written as .env. The CLI lists exactly which keys still need values, prints the stack's notes, and hands off with cd mealie && docker compose up -d.",
      path: ["store", "api", "unpack", "newhost"],
    },
  ],
  layouts: {
    wide: {
      cols: 4,
      rows: 3,
      at: {
        src: [0, 0],
        sanitize: [1, 0],
        ui: [2, 0],
        gbrain: [3, 0],
        api: [2, 1],
        newhost: [0, 2],
        unpack: [1, 2],
        store: [2, 2],
        history: [3, 2],
      },
      sides: {
        put: ["bottom", "left"],
        pull: ["top", "left"],
        kb: ["right", "bottom"],
      },
    },
    narrow: {
      cols: 2,
      rows: 5,
      inset: 22,
      edgeLabels: false,
      at: {
        src: [0, 0],
        sanitize: [1, 0],
        ui: [0, 1],
        api: [1, 1],
        gbrain: [0, 2],
        store: [1, 2],
        history: [1, 3],
        newhost: [0, 4],
        unpack: [1, 4],
      },
      sides: {
        pull: ["right", "right"],
      },
    },
  },
};
