"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True while `ref`'s element is scrolled out of view. `topInset` is a CSS
 * length in percent of the viewport (e.g. "36%") that something opaque
 * already covers, so an element hiding behind it counts as out of view.
 * Starts false so nothing flashes before the first reading.
 */
export function useOutOfView(
  ref: RefObject<Element | null>,
  topInset = "0%"
): boolean {
  const [isOut, setIsOut] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) setIsOut(!last.isIntersecting);
      },
      { rootMargin: `-${topInset} 0px 0px 0px` }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, topInset]);

  return isOut;
}
