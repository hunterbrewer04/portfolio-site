"use client";

import { motion } from "motion/react";
import { BlogCard } from "@/components/blog/blog-card";
import { staggerContainer } from "@/lib/animations";
import type { Post } from "@/lib/blog";

interface BlogListProps {
  posts: Post[];
}

export function BlogList({ posts }: BlogListProps) {
  if (posts.length === 0) {
    return (
      <p className="text-center text-neutral-500 py-16 text-sm">
        No posts published yet. Check back soon.
      </p>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={`grid gap-5 ${posts.length === 1 ? "grid-cols-1 max-w-md mx-auto" : "grid-cols-1 md:grid-cols-2"}`}
    >
      {posts.map((post) => (
        <BlogCard key={post.slug} {...post} />
      ))}
    </motion.div>
  );
}
