/* eslint-disable @next/next/no-img-element -- output: "export", so no next/image */

interface ProjectCoverProps {
  src: string;
  alt: string;
  /** 6-digit hex accent */
  color: string;
}

/** The hero visual: a screenshot or GIF framed like the live-demo embed. */
export function ProjectCover({ src, alt, color }: ProjectCoverProps) {
  return (
    <figure
      className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-white/[0.08] bg-black"
      style={{ boxShadow: `0 0 0 1px ${color}1a, 0 24px 80px -32px ${color}59` }}
    >
      <img src={src} alt={alt} className="block h-auto w-full" />
    </figure>
  );
}
