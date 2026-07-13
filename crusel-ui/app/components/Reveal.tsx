"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setSeen(true), delay);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`reveal ${seen ? "seen" : ""} ${className}`}>
      {children}
    </div>
  );
}
