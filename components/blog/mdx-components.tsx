import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes, HTMLAttributes } from "react";

// ---------------------------------------------------------------------------
// Individual renderers
// ---------------------------------------------------------------------------

function H1({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className="mt-10 mb-4 text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100 leading-tight first:mt-0"
      {...props}
    >
      {children}
    </h1>
  );
}

function H2({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className="mt-10 mb-3 text-xl sm:text-2xl font-semibold tracking-tight text-neutral-100 leading-snug border-b border-neutral-800 pb-2"
      {...props}
    >
      {children}
    </h2>
  );
}

function H3({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className="mt-8 mb-2 text-lg sm:text-xl font-semibold text-neutral-200 leading-snug"
      {...props}
    >
      {children}
    </h3>
  );
}

function P({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className="my-4 text-neutral-300 leading-7 text-base"
      {...props}
    >
      {children}
    </p>
  );
}

function A({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isExternal = href?.startsWith("http");
  return (
    <a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="text-indigo-400 underline underline-offset-4 decoration-indigo-400/40 hover:text-indigo-300 hover:decoration-indigo-300/60 transition-colors duration-150"
      {...props}
    >
      {children}
    </a>
  );
}

function Ul({ children, ...props }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className="my-4 ml-4 sm:ml-6 list-disc marker:text-neutral-500 space-y-1.5 text-neutral-300"
      {...props}
    >
      {children}
    </ul>
  );
}

function Ol({ children, ...props }: HTMLAttributes<HTMLOListElement>) {
  return (
    <ol
      className="my-4 ml-4 sm:ml-6 list-decimal marker:text-neutral-500 space-y-1.5 text-neutral-300"
      {...props}
    >
      {children}
    </ol>
  );
}

function Li({ children, ...props }: HTMLAttributes<HTMLLIElement>) {
  return (
    <li className="leading-7 text-base" {...props}>
      {children}
    </li>
  );
}

function Blockquote({
  children,
  ...props
}: HTMLAttributes<HTMLQuoteElement>) {
  return (
    <blockquote
      className="my-6 border-l-4 border-indigo-500/60 pl-5 pr-2 py-1 bg-indigo-950/20 rounded-r-md italic text-neutral-400 text-base leading-7"
      {...props}
    >
      {children}
    </blockquote>
  );
}

function Code({ children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <code
      className="rounded-md bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 text-sm font-mono text-rose-300"
      {...props}
    >
      {children}
    </code>
  );
}

function Pre({ children, ...props }: HTMLAttributes<HTMLPreElement>) {
  return (
    <pre
      className="my-6 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900 p-3.5 sm:p-5 text-[13px] sm:text-sm leading-6 shadow-lg"
      {...props}
    >
      {children}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Exported components map — compatible with MDXRemote
// ---------------------------------------------------------------------------

export const mdxComponents: MDXComponents = {
  h1: H1,
  h2: H2,
  h3: H3,
  p: P,
  a: A,
  ul: Ul,
  ol: Ol,
  li: Li,
  blockquote: Blockquote,
  // When rehype-pretty-code is active it wraps <pre> and owns the <code>
  // inside it, so we only apply our bare <code> style to inline code.
  code: Code,
  pre: Pre,
};
