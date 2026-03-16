import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllSlugs, getPostBySlug } from "@/lib/blog";
import { PostHeader } from "@/components/blog/post-header";
import { mdxComponents } from "@/components/blog/mdx-components";

export const dynamicParams = false;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = getPostBySlug(slug);
    return {
      title: post.title,
      description: post.description,
    };
  } catch {
    return { title: "Post Not Found" };
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;

  let post;
  try {
    post = getPostBySlug(slug);
  } catch {
    notFound();
  }

  if (post.draft) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <PostHeader
        title={post.title}
        date={post.date}
        readingTime={post.readingTime}
        tags={post.tags}
      />
      <article className="mt-10">
        <MDXRemote source={post.content} components={mdxComponents} />
      </article>
    </div>
  );
}
