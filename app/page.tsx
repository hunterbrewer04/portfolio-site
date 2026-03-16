"use client";

import { Starfield } from "@/components/shared/starfield";
import { TypingEffect } from "@/components/shared/typing-effect";
import { SocialIcons } from "@/components/shared/social-icons";
import { NavPill } from "@/components/shared/nav-pill";

export default function Home() {
  return (
    <>
      <Starfield />
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <section className="flex flex-col items-center gap-8 text-center">
          <TypingEffect
            text="Hunter Brewer"
            className="text-4xl font-bold tracking-tight sm:text-5xl"
            speed={90}
            delay={400}
          />
          <SocialIcons />
          <NavPill delay={2.3} />
        </section>
      </div>
    </>
  );
}
