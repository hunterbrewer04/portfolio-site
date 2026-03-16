"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border/60 py-6">
      <p className="text-center text-sm text-muted-foreground">
        &copy; {year} Hunter Brewer. All rights reserved.
      </p>
    </footer>
  );
}
