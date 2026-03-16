"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Blog", href: "/blog" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <motion.header
      className="fixed top-0 z-50 w-full"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <nav
        className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4"
        aria-label="Main navigation"
      >
        {/* Initials logo */}
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-700/60 bg-neutral-900/50 text-xs font-semibold text-neutral-300 backdrop-blur-sm transition-colors hover:border-neutral-500 hover:text-white"
        >
          HB
        </Link>

        {/* Pill nav */}
        <div className="flex items-center gap-1 rounded-full border border-neutral-700/60 bg-neutral-900/50 px-1 py-1 backdrop-blur-sm">
          {navLinks.map(({ label, href }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative rounded-full px-4 py-1.5 text-sm transition-colors",
                  isActive
                    ? "text-white"
                    : "text-neutral-400 hover:text-neutral-200",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-neutral-800"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </motion.header>
  );
}
