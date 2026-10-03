"use client";
import { useEffect, useState } from "react";

// Wait for the selected field to mount; never open the phone keyboard just to scroll.
export function useRevealedInput() {
  const [target, setTarget] = useState<{ id: string } | null>(null);
  useEffect(() => {
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      const field = document.getElementById(target.id);
      if (!field || !field.getClientRects().length) return;
      const header = document.querySelector(".site-header")?.getBoundingClientRect().bottom || 0;
      const top = window.scrollY + field.getBoundingClientRect().top - Math.max(header + 100, 160);
      window.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return (id: string | null) => setTarget(id ? { id } : null);
}
