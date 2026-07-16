/* eslint-disable @next/next/no-img-element */
import type { MDXComponents } from "mdx/types";
import type { ImgHTMLAttributes, VideoHTMLAttributes } from "react";
import { mdxComponents } from "@/components/blog/mdx-components";

// ---------------------------------------------------------------------------
// Media overrides for project Overview MDX.
// Plain <img>/<video> only — NEVER next/image (output: "export").
// ---------------------------------------------------------------------------

function Img({ alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      {...props}
      alt={alt}
      loading="lazy"
      className="my-6 h-auto max-w-full rounded-lg border border-white/[0.08]"
    />
  );
}

function Video(props: VideoHTMLAttributes<HTMLVideoElement>) {
  return (
    <video
      controls
      playsInline
      preload="metadata"
      {...props}
      className="my-6 h-auto max-w-full rounded-lg border border-white/[0.08]"
    />
  );
}

function YouTube({ id, title = "YouTube video" }: { id: string; title?: string }) {
  return (
    <div className="relative my-6 aspect-video overflow-hidden rounded-lg border border-white/[0.08]">
      <iframe
        className="absolute inset-0 h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported map — blog components + project media overrides.
// ---------------------------------------------------------------------------

export const workMdxComponents: MDXComponents = {
  ...mdxComponents,
  img: Img,
  Video,
  YouTube,
};
