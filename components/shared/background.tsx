"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { Starfield } from "@/components/shared/starfield";

const StarFieldGL = dynamic(
  () => import("./star-field-gl").then((m) => m.StarFieldGL),
  { ssr: false },
);

type Snapshot = { caps: "gl" | "2d"; reducedMotion: boolean };

const PENDING = { caps: "pending", reducedMotion: false } as const; // server value

// Probed once on first client render; the cached object keeps a stable identity.
let snapshot: Snapshot | null = null;

function getSnapshot(): Snapshot {
  if (snapshot) return snapshot;
  let ok = false;
  try {
    const c = document.createElement("canvas");
    ok = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    ok = false;
  }
  snapshot = {
    caps: ok ? "gl" : "2d",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
  return snapshot;
}

const subscribe = () => () => {};

export function Background() {
  const snap = useSyncExternalStore<Snapshot | typeof PENDING>(
    subscribe,
    getSnapshot,
    () => PENDING,
  );
  const [failed, setFailed] = useState(false);
  const mode = failed ? "2d" : snap.caps;

  if (mode === "pending") return null;
  if (mode === "2d") return <Starfield />;
  return (
    <StarFieldGL
      reducedMotion={snap.reducedMotion}
      onFail={() => setFailed(true)}
    />
  );
}
