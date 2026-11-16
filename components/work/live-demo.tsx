"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Hand, X } from "lucide-react";

interface LiveDemoProps {
  /** URL of the running build to frame; query params may preload state. */
  src: string;
  title: string;
  /** 6-digit hex accent */
  color: string;
}

/**
 * Frames a project's live build inside its page so a visitor can use it
 * without leaving. Rendered at the outer container width (not the prose
 * column) because interactive apps want the room. The frame is lazy so the
 * hero paints first.
 *
 * On touch screens a tall interactive frame swallows the swipe that should
 * scroll the page, so there the frame starts behind a "tap to use" cover and
 * a Done button under it hands scrolling back.
 */
export function LiveDemo({ src, title, color }: LiveDemoProps) {
  const [touch, setTouch] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setTouch(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <figure>
      <div
        className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-black"
        style={{ boxShadow: `0 0 0 1px ${color}1a, 0 24px 80px -32px ${color}59` }}
      >
        <iframe
          src={src}
          title={`${title}, running live`}
          loading="lazy"
          className="block h-[70svh] max-h-[820px] min-h-[480px] w-full"
        />
        {touch && !active && (
          <button
            type="button"
            onClick={() => setActive(true)}
            className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/70 via-black/10 to-transparent pb-8"
          >
            <span
              className="inline-flex items-center gap-2 rounded-full border bg-black/70 px-4 py-2 text-sm font-medium backdrop-blur"
              style={{ borderColor: `${color}66`, color }}
            >
              <Hand size={16} /> Tap to use the demo
            </span>
          </button>
        )}
      </div>
      <figcaption className="mt-3 flex items-center justify-between gap-4 font-mono text-xs text-neutral-500">
        {touch && active ? (
          <button
            type="button"
            onClick={() => setActive(false)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-neutral-200"
          >
            <X size={12} /> Done, back to scrolling
          </button>
        ) : (
          <span>Live build, running in the page.</span>
        )}
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${title} full screen`}
          className="inline-flex shrink-0 items-center gap-1 text-neutral-400 transition-colors hover:text-white"
        >
          Open full screen <ArrowUpRight size={14} />
        </a>
      </figcaption>
    </figure>
  );
}
