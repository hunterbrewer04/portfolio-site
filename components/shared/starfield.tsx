"use client";

import { useEffect, useRef } from "react";

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let stars: { x: number; y: number; size: number; speed: number; opacity: number }[] = [];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      initStars();
    }

    function initStars() {
      const count = Math.floor((canvas!.width * canvas!.height) / 8000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        size: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.3 + 0.05,
        opacity: Math.random() * 0.7 + 0.3,
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const star of stars) {
        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx!.fill();

        star.y += star.speed;
        star.opacity += (Math.random() - 0.5) * 0.02;
        star.opacity = Math.max(0.2, Math.min(0.9, star.opacity));

        if (star.y > canvas!.height) {
          star.y = 0;
          star.x = Math.random() * canvas!.width;
        }
      }
      animationId = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
    />
  );
}
