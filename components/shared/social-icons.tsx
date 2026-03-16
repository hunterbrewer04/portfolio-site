"use client";

import { motion } from "motion/react";
import { Github, Linkedin, Twitter } from "lucide-react";

const socials = [
  { href: "https://github.com/hunterbrewer04", icon: Github, label: "GitHub" },
  { href: "https://www.linkedin.com/in/hunter-brewer/", icon: Linkedin, label: "LinkedIn" },
  { href: "https://x.com/hunterbrewer04", icon: Twitter, label: "X" },
];

export function SocialIcons() {
  return (
    <motion.div
      className="flex items-center gap-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 2 }}
    >
      {socials.map(({ href, icon: Icon, label }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="text-neutral-400 hover:text-white transition-colors duration-200"
        >
          <Icon size={22} strokeWidth={1.5} />
        </a>
      ))}
    </motion.div>
  );
}
