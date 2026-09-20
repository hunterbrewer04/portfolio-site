"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ScrambleReveal } from "@/components/shared/scramble-reveal";
import { SocialIcons } from "@/components/shared/social-icons";
import { NavPill } from "@/components/shared/nav-pill";

const INTRO_KEY = "hero-intro-played";

// Read once per mount so the value cannot flip mid-visit; reset on unmount so
// the next client-side visit re-reads it.
let snapshot: boolean | null = null;

function subscribe() {
  return () => {};
}

function getSnapshot(): boolean {
  if (snapshot === null) {
    try {
      snapshot = sessionStorage.getItem(INTRO_KEY) === "1";
    } catch {
      snapshot = false;
    }
  }
  return snapshot;
}

// The static HTML always carries the full intro; a return visit in the same
// tab re-renders with instant timing right after hydration.
function getServerSnapshot(): boolean {
  return false;
}

export default function Home() {
  const replay = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Mark the intro as seen when leaving the page. StrictMode's dev-only
  // simulated unmount fires within a few ms of mount; a real visit lasts longer.
  useEffect(() => {
    const mountedAt = performance.now();
    return () => {
      snapshot = null;
      if (performance.now() - mountedAt < 300) return;
      try {
        sessionStorage.setItem(INTRO_KEY, "1");
      } catch {}
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      {/* keyed so a post-hydration flip to replay remounts with the right timing */}
      <section key={String(replay)} className="flex flex-col items-center gap-8 text-center">
        <ScrambleReveal
          text="Hunter Brewer"
          className="text-4xl font-bold tracking-tight sm:text-5xl"
          instant={replay}
        />
        <SocialIcons delay={replay ? 0.2 : 0.85} />
        <NavPill delay={replay ? 0.3 : 1.05} />
      </section>
    </div>
  );
}
