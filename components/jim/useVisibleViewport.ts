"use client";

import { useEffect, useState, type RefObject } from "react";

/** The keyboard is up when it hides more than this much of the screen. */
const KEYBOARD_MIN_PX = 120;
/** Above this visual-viewport scale the page is pinch-zoomed. */
const ZOOMED = 1.01;
/** Inputs that never bring up the keyboard. */
const NO_KEYBOARD = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "radio",
  "range",
  "reset",
  "submit",
]);

/** Whether `el` is a text field (one that brings up the keyboard). */
function isTextField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && !NO_KEYBOARD.has(el.type);
}

/**
 * Keeps `el` exactly over the part of the screen you can see. iOS Safari does
 * not shrink the page for the on-screen keyboard; it pans a smaller visual
 * viewport over it instead. This mirrors that viewport into the CSS variables
 * `--jim-vh` (height) and `--jim-vt` (top offset), which the element's
 * classes read (falling back to 100dvh and 0). Returns whether the keyboard
 * is up, so the home-bar padding can go while it is.
 *
 * The keyboard is measured against the tallest viewport seen at this width
 * (one per orientation), never `innerHeight`: in an iOS home-screen app the
 * layout viewport shrinks with the keyboard too.
 */
export default function useVisibleViewport(
  el: RefObject<HTMLElement | null>
): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    const node = el.current;
    if (!vv || !node) return;
    /** The full (keyboard-down) height for each viewport width. */
    const tallest = new Map<number, number>();
    let typing = isTextField(document.activeElement);

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
      const width = Math.round(vv.width);
      const full = Math.max(tallest.get(width) ?? 0, vv.height);
      tallest.set(width, full);
      const hidden = full - vv.height;
      // A text field with focus and a smaller screen is the keyboard too.
      setKeyboardOpen(hidden > KEYBOARD_MIN_PX || (typing && hidden > 1));
    }

    // Focus can change without the viewport moving.
    function onFocusIn(event: FocusEvent) {
      typing = isTextField(event.target);
      update();
    }
    function onFocusOut(event: FocusEvent) {
      typing = isTextField(event.relatedTarget);
      update();
    }

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      node.style.removeProperty("--jim-vh");
      node.style.removeProperty("--jim-vt");
    };
  }, [el]);

  return keyboardOpen;
}
