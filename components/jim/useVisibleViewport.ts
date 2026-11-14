"use client";

import { useEffect, useState, type RefObject } from "react";

/** The keyboard is up when it hides more than this much of the screen. */
const KEYBOARD_MIN_PX = 120;
/**
 * iOS fires its last viewport event before the keyboard has finished closing
 * (or none at all), so look again once the animation is surely over.
 */
const SETTLE_MS = [150, 400, 800];
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
 * With the keyboard down the page always sits at the top of the screen: iOS
 * can leave a stale `offsetTop` (and a scrolled page) behind after the
 * keyboard closes, which slid the whole app down, leaving an empty band up
 * top and the message box below the bottom edge.
 *
 * The keyboard is measured against the tallest viewport seen at this width
 * (one per orientation), never `innerHeight`: in an iOS home-screen app the
 * layout viewport shrinks with the keyboard too.
 */
export default function useVisibleViewport(
  el: RefObject<HTMLElement | null>,
  /** False while the element isn't drawn (the app is locked). */
  active = true
): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    const node = el.current;
    if (!active || !vv || !node) return;
    /** The full (keyboard-down) height for each viewport width. */
    const tallest = new Map<number, number>();
    let typing = isTextField(document.activeElement);
    const timers = new Set<ReturnType<typeof setTimeout>>();

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
      const width = Math.round(vv.width);
      const full = Math.max(tallest.get(width) ?? 0, vv.height);
      tallest.set(width, full);
      const hidden = full - vv.height;
      // A text field with focus and a smaller screen is the keyboard too.
      const open = hidden > KEYBOARD_MIN_PX || (typing && hidden > 1);
      node.style.setProperty("--jim-vh", `${vv.height}px`);
      // Only the keyboard pans the page; without it, the top is the top.
      node.style.setProperty("--jim-vt", `${open ? vv.offsetTop : 0}px`);
      if (!open && window.scrollY !== 0) window.scrollTo(0, 0);
      setKeyboardOpen(open);
    }

    /** Update now and again after the keyboard animation has settled. */
    function settle() {
      update();
      for (const ms of SETTLE_MS) {
        const id = setTimeout(() => {
          timers.delete(id);
          update();
        }, ms);
        timers.add(id);
      }
    }
    function onVisible() {
      if (document.visibilityState === "visible") settle();
    }

    // Focus can change without the viewport moving.
    function onFocusIn(event: FocusEvent) {
      typing = isTextField(event.target);
      update();
    }
    function onFocusOut(event: FocusEvent) {
      typing = isTextField(event.relatedTarget);
      settle();
    }

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", settle);
    window.addEventListener("orientationchange", settle);
    return () => {
      for (const id of timers) clearTimeout(id);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", settle);
      window.removeEventListener("orientationchange", settle);
      node.style.removeProperty("--jim-vh");
      node.style.removeProperty("--jim-vt");
    };
  }, [el, active]);

  return keyboardOpen;
}
