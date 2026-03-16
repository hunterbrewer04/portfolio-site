"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { slideUp, staggerContainer } from "@/lib/animations";

interface PostHeaderProps {
  title: string;
  date: string;
  readingTime: string;
  tags: string[];
}

export function PostHeader({ title, date, readingTime, tags }: PostHeaderProps) {
  return (
    <motion.header
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-4 pb-8 border-b border-neutral-800"
    >
      {/* Tags */}
      {tags.length > 0 && (
        <motion.div variants={slideUp} className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs bg-neutral-800 text-neutral-300 border border-neutral-700"
            >
              {tag}
            </Badge>
          ))}
        </motion.div>
      )}

      {/* Title */}
      <motion.h1
        variants={slideUp}
        className="text-3xl sm:text-4xl font-bold text-neutral-50 leading-tight tracking-tight"
      >
        {title}
      </motion.h1>

      {/* Meta */}
      <motion.div
        variants={slideUp}
        className="flex items-center gap-3 text-sm text-neutral-500"
      >
        <time dateTime={date}>{date}</time>
        <span aria-hidden="true" className="text-neutral-700">
          ·
        </span>
        <span>{readingTime}</span>
      </motion.div>
    </motion.header>
  );
}
