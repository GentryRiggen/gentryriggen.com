"use client";

import { createContext, useContext, useLayoutEffect, useRef } from "react";

type GlowListener = (glow: number) => void;

/**
 * How strongly lit things glow right now: 0 by day, 1 at night, easing with
 * the sky in between. It is a mutable value rather than React state, so a
 * hundred cabins follow the fade without one of them re-rendering: the
 * Environment calls `set` every frame and each glowing material updates itself
 * (see `useGlowEffect`).
 */
export interface GlowController {
  readonly value: number;
  /** Notifies subscribers only when the value actually moved. */
  set: (glow: number) => void;
  subscribe: (listener: GlowListener) => () => void;
}

/** A change smaller than this is invisible, so it isn't worth an update. */
const GLOW_EPSILON = 1e-4;

export function createGlowController(initial = 0): GlowController {
  let value = initial;
  const listeners = new Set<GlowListener>();
  return {
    get value() {
      return value;
    },
    set(glow) {
      if (Math.abs(glow - value) < GLOW_EPSILON) return;
      value = glow;
      for (const listener of listeners) listener(glow);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * ShipParts provides it so lit parts follow the sky; anything rendered
 * outside it (the ghost preview) has no controller and stays unlit.
 */
export const GlowContext = createContext<GlowController | null>(null);

/**
 * Calls `apply` with the current glow after every render (so new props can't
 * leave a material out of step) and again whenever the glow changes. `apply`
 * should write straight to materials and meshes, never to React state.
 */
export function useGlowEffect(apply: (glow: number) => void): void {
  const controller = useContext(GlowContext);
  const latest = useRef(apply);
  useLayoutEffect(() => {
    latest.current = apply;
    apply(controller?.value ?? 0);
  });
  useLayoutEffect(
    () => controller?.subscribe((glow) => latest.current(glow)),
    [controller]
  );
}
