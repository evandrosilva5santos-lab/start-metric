"use client";

import { useReducedMotion as useFramerReducedMotion } from "framer-motion";

/**
 * Retorna variantes de animação que respeitam prefers-reduced-motion.
 * Use no lugar de valores fixos de duration/initial/animate no Framer Motion.
 */
export function useReducedMotion() {
  const prefersReduced = useFramerReducedMotion();

  const transition = prefersReduced
    ? { duration: 0 }
    : { duration: 0.6, ease: [0.23, 1, 0.32, 1] as const };

  const fadeInUp = {
    initial: prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    transition,
  };

  const fadeInContent = {
    initial: prefersReduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: prefersReduced
      ? { duration: 0 }
      : { duration: 0.8, delay: 0.2, ease: [0.23, 1, 0.32, 1] as const },
  };

  return { prefersReduced, fadeInUp, fadeInContent };
}
