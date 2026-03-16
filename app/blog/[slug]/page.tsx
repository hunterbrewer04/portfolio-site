import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { PostHeader } from "@/components/blog/post-header";
import { mdxComponents } from "@/components/blog/mdx-components";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
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
