import { ArrowUpRight } from "lucide-react";

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
 */
export function LiveDemo({ src, title, color }: LiveDemoProps) {
  return (
    <figure>
      <div
        className="overflow-hidden rounded-xl border border-white/[0.08] bg-black"
        style={{ boxShadow: `0 0 0 1px ${color}1a, 0 24px 80px -32px ${color}59` }}
      >
        <iframe
          src={src}
          title={`${title}, running live`}
          loading="lazy"
          className="block h-[70vh] max-h-[820px] min-h-[480px] w-full"
        />
      </div>
      <figcaption className="mt-3 flex items-center justify-between gap-4 font-mono text-xs text-neutral-500">
        <span>Live build, running in the page.</span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${title} full screen`}
          className="inline-flex items-center gap-1 text-neutral-400 transition-colors hover:text-white"
        >
          Open full screen <ArrowUpRight size={14} />
        </a>
      </figcaption>
    </figure>
  );
}
