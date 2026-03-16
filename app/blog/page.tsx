import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";
import { BlogList } from "@/components/blog/blog-list";
import { NavPill } from "@/components/shared/nav-pill";

export const metadata: Metadata = {
  title: "Blog",
  description: "Thoughts on development, technology, and building things.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-col items-center gap-10 mb-12">
        <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
        <NavPill />
      </div>
      <BlogList posts={posts} />
    </div>
  );
}
