"use client";

import { useEffect, useState, type RefObject } from "react";

/** Matches Tailwind's `lg:` breakpoint, where the scene sits beside the page. */
export const WIDE_QUERY = "(min-width: 1024px)";

/**
 * True while `ref`'s element is scrolled out of view. `topInset` is a CSS
 * length in percent of the viewport (e.g. "36%") that something opaque
 * already covers on phones, so an element hiding behind it counts as out of
 * view. On wide screens (`WIDE_QUERY`) nothing covers the page column, so the
 * inset drops to zero; otherwise the readout would count as hidden while it
 * is in plain sight. Starts false so nothing flashes before the first reading.
 */
export function useOutOfView(
  ref: RefObject<Element | null>,
  topInset = "0%"
): boolean {
  const [isOut, setIsOut] = useState(false);
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia(WIDE_QUERY);
    const update = () => setIsWide(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  const inset = isWide ? "0%" : topInset;

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) setIsOut(!last.isIntersecting);
      },
      { rootMargin: `-${inset} 0px 0px 0px` }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, inset]);

  return isOut;
}
