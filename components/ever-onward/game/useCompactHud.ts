"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Scrolled past this, the bar folds to one row. It waits until the scene has
 * slid up to the bar (the tallest bar is about 130px taller open than
 * folded), so folding never leaves a gap between the slim row and the scene.
 */
export const FOLD_AT = 140;
/** Back above this, it opens again (a gap so it doesn't flicker). */
export const UNFOLD_AT = 112;
/** A peek stays open until the page moves this far. */
const PEEK_SCROLL = 48;

const WIDE_QUERY = "(min-width: 1024px)";

/**
 * Phones only: once the player scrolls down to the buttons, the HUD folds to
 * one slim row and the scene gets shorter, so more of the game fits on the
 * screen. Back at the top everything opens again. A tap on the slim row peeks
 * at the full bar until the page is scrolled again. Wide screens scroll their
 * own column, so the window never moves and nothing folds there.
 */
export default function useCompactHud(isEnabled: boolean) {
  const [isFolded, setIsFolded] = useState(false);
  const [isPeeking, setIsPeeking] = useState(false);
  const peekFrom = useRef<number | null>(null);

  useEffect(() => {
    if (!isEnabled) return;
    const wide =
      typeof window.matchMedia === "function"
        ? window.matchMedia(WIDE_QUERY)
        : null;
    const update = () => {
      const y = window.scrollY;
      if (wide?.matches) {
        setIsFolded(false);
        return;
      }
      setIsFolded((folded) => (folded ? y > UNFOLD_AT : y > FOLD_AT));
      if (
        peekFrom.current !== null &&
        Math.abs(y - peekFrom.current) > PEEK_SCROLL
      ) {
        peekFrom.current = null;
        setIsPeeking(false);
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    wide?.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("scroll", update);
      wide?.removeEventListener?.("change", update);
    };
  }, [isEnabled]);

  const togglePeek = useCallback(() => {
    setIsPeeking((peeking) => {
      peekFrom.current = peeking ? null : window.scrollY;
      return !peeking;
    });
  }, []);

  const folded = isEnabled && isFolded;
  return {
    /** The HUD shows only its slim row. */
    isCompact: folded && !isPeeking,
    /** Scrolled down (the scene stays short even while peeking). */
    isFolded: folded,
    isPeeking,
    togglePeek,
  };
}
