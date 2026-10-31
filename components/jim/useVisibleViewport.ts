"use client";

import { useEffect, useState, type RefObject } from "react";

/** The keyboard is up when it hides more than this much of the screen. */
const KEYBOARD_MIN_PX = 120;
/** Above this visual-viewport scale the page is pinch-zoomed. */
const ZOOMED = 1.01;

/**
 * Keeps `el` exactly over the part of the screen you can see. iOS Safari does
 * not shrink the page for the on-screen keyboard; it pans a smaller visual
 * viewport over it instead. This mirrors that viewport into the CSS variables
 * `--jim-vh` (height) and `--jim-vt` (top offset), which the element's
 * classes read (falling back to 100dvh and 0). Returns whether the keyboard
 * is up, so the home-bar padding can go while it is.
 */
export default function useVisibleViewport(
  el: RefObject<HTMLElement | null>
): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    const node = el.current;
    if (!vv || !node) return;

    function update() {
      if (!vv || !node) return;
      if (vv.scale > ZOOMED) {
        // A pinch-zoom also shrinks the visual viewport; that is not the
        // keyboard, so leave the layout at full height until zoomed back out.
        node.style.removeProperty("--jim-vh");
        node.style.removeProperty("--jim-vt");
        setKeyboardOpen(false);
        return;
      }
      node.style.setProperty("--jim-vh", `${vv.height}px`);
      node.style.setProperty("--jim-vt", `${vv.offsetTop}px`);
      setKeyboardOpen(window.innerHeight - vv.height > KEYBOARD_MIN_PX);
    }

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      node.style.removeProperty("--jim-vh");
      node.style.removeProperty("--jim-vt");
    };
  }, [el]);

  return keyboardOpen;
}
