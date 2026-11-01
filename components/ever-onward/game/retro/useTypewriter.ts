"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "../useAnimatedNumber";

const STEP_MS = 24;
const CHARS_PER_STEP = 2;

interface Progress {
  text: string;
  count: number;
}

/**
 * Reveals `text` a couple of characters at a time. With reduced motion (or
 * `isEnabled` false) the whole text is there from the first render.
 */
export function useTypewriter(text: string, isEnabled = true): string {
  const isReduced = useReducedMotion();
  const [progress, setProgress] = useState<Progress>({ text, count: 0 });
  const isInstant = isReduced || !isEnabled;

  useEffect(() => {
    if (isInstant) return;
    const timer = window.setInterval(() => {
      setProgress((p) => {
        const count = p.text === text ? p.count : 0;
        if (count >= text.length) {
          window.clearInterval(timer);
          return p;
        }
        return { text, count: count + CHARS_PER_STEP };
      });
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [text, isInstant]);

  if (isInstant) return text;
  return progress.text === text ? text.slice(0, progress.count) : "";
}
