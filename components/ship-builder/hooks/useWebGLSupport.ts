"use client";

import { useSyncExternalStore } from "react";

let cached: boolean | undefined;

function detect(): boolean {
  if (cached === undefined) {
    try {
      const canvas = document.createElement("canvas");
      cached = Boolean(
        canvas.getContext("webgl2") ?? canvas.getContext("webgl")
      );
    } catch {
      cached = false;
    }
  }
  return cached;
}

function subscribe(): () => void {
  return () => {};
}

/** null during SSR / before hydration, then whether WebGL is available. */
export default function useWebGLSupport(): boolean | null {
  return useSyncExternalStore(subscribe, detect, () => null);
}
