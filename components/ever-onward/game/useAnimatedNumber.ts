"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True when the player asked their device for less motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
}

const easeOutCubic = (p: number): number => 1 - (1 - p) ** 3;

/**
 * Eases toward `target` over `durationMs` instead of jumping. Retargeting
 * mid-flight continues from where the number is now. Use it in a small leaf
 * component: it re-renders on every animation frame while moving.
 */
export function useAnimatedNumber(target: number, durationMs = 250): number {
  const isReduced = useReducedMotion();
  const [display, setDisplay] = useState(target);
  const shown = useRef(target);

  useEffect(() => {
    if (isReduced || !Number.isFinite(target)) {
      shown.current = target;
      return;
    }
    const from = shown.current;
    if (from === target) return;
    // Timed from the first frame, so it only uses the frame clock.
    let startedAt: number | null = null;
    let frame = 0;
    const step = (now: number) => {
      startedAt ??= now;
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const value =
        progress >= 1
          ? target
          : from + (target - from) * easeOutCubic(progress);
      shown.current = value;
      setDisplay(value);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, isReduced, durationMs]);

  return isReduced || !Number.isFinite(target) ? target : display;
}
