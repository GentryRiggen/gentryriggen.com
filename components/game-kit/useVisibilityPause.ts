"use client";

import { useEffect, useRef } from "react";

interface VisibilityPauseOptions {
  /** The page was hidden (tab switch, app switcher, lock): stop loops and sims. */
  onHidden?: () => void;
  /** The page is visible again (also on a back-forward-cache restore). */
  onVisible?: () => void;
  /**
   * The page may be about to go away: save now. Called on hidden and on
   * pagehide, because iOS may never run a later handler.
   */
  onPersist?: () => void;
}

/**
 * One place for the hidden/visible/pagehide wiring every game repeats: pause
 * animation loops and simulations while hidden, save when the page hides, and
 * resume (also from the back-forward cache, `pageshow`) when it returns.
 * Callbacks may change between renders without re-subscribing.
 */
export default function useVisibilityPause(
  options: VisibilityPauseOptions
): void {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        latest.current.onPersist?.();
        latest.current.onHidden?.();
      } else {
        latest.current.onVisible?.();
      }
    };
    const onPageHide = () => latest.current.onPersist?.();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) latest.current.onVisible?.();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);
}
