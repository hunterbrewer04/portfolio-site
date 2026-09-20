"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { Starfield } from "@/components/shared/starfield";

const StarFieldGL = dynamic(
  () => import("./star-field-gl").then((m) => m.StarFieldGL),
  { ssr: false },
);

type Snapshot = { gl: boolean; reducedMotion: boolean };

// three only ever creates webgl2 contexts, so a webgl1-only device counts as no GL.
function hasWebGL2(): boolean {
  try {
    const ctx = document.createElement("canvas").getContext("webgl2");
    if (!ctx) return false;
    // release the probe context now instead of at GC; the renderer makes its own
    ctx.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// Probed once on first client render; the cached object keeps a stable identity.
let snapshot: Snapshot | null = null;

function getSnapshot(): Snapshot {
  snapshot ??= {
    gl: hasWebGL2(),
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
  return snapshot;
}

const subscribe = () => () => {};
const getServerSnapshot = () => null;

export function Background() {
  const snap = useSyncExternalStore<Snapshot | null>(subscribe, getSnapshot, getServerSnapshot);
  const [failed, setFailed] = useState(false);

  if (!snap) return null;
  if (failed || !snap.gl) return <Starfield />;
  return <StarFieldGL reducedMotion={snap.reducedMotion} onFail={() => setFailed(true)} />;
}
