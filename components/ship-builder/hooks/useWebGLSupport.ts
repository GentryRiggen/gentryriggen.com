"use client";

import { useSyncExternalStore } from "react";

let cached: boolean | undefined;

function detect(): boolean {
  if (cached === undefined) {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      cached = ctx !== null;
      // Release the probe context so it doesn't count against the browser's
      // limit on live WebGL contexts.
      ctx?.getExtension("WEBGL_lose_context")?.loseContext();
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
