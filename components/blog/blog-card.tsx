"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { slideUp } from "@/lib/animations";
import { ArrowUpRight } from "lucide-react";
import type { Post } from "@/lib/blog";

type BlogCardProps = Omit<Post, "content">;

export function BlogCard({
  title,
  description,
  date,
  slug,
  readingTime,
  tags,
}: BlogCardProps) {
  return (
    <motion.div
      variants={slideUp}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <Link href={`/blog/${slug}`} className="group block">
        <article className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 sm:p-5 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.05]">
          {/* Meta row */}
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-3">
            <time dateTime={date}>{date}</time>
            <span aria-hidden="true">&middot;</span>
            <span>{readingTime}</span>
          </div>

          {/* Title with arrow */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="text-base font-medium text-neutral-200 leading-snug group-hover:text-white transition-colors duration-200">
              {title}
            </h2>
            <ArrowUpRight
              size={16}
              className="mt-0.5 shrink-0 text-neutral-600 transition-all duration-200 group-hover:text-neutral-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </div>

          {/* Description */}
          <p className="text-sm text-neutral-500 leading-relaxed line-clamp-2 mb-3">
            {description}
          </p>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[11px] px-2 py-0.5 bg-white/[0.04] text-neutral-400 border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </article>
      </Link>
    </motion.div>
  );
}
