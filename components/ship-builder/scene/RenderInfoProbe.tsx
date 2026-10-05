"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

export interface RenderInfo {
  /** Draw calls in the last whole frame, shadow and effect passes included. */
  calls: number;
  triangles: number;
}

declare global {
  interface Window {
    __shipBuilderRenderInfo?: () => RenderInfo;
  }
}

/**
 * Exposes the last frame's draw calls to Playwright (non-production only), so
 * the detail budget can be measured. Counts accumulate across every render
 * pass in a frame and are reset just before the next one.
 */
export default function RenderInfoProbe() {
  const get = useThree((state) => state.get);
  const last = useRef<RenderInfo>({ calls: 0, triangles: 0 });

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const { info } = get().gl;
    info.autoReset = false;
    window.__shipBuilderRenderInfo = () => ({ ...last.current });
    return () => {
      info.autoReset = true;
      delete window.__shipBuilderRenderInfo;
    };
  }, [get]);

  useFrame(({ gl }) => {
    if (process.env.NODE_ENV === "production") return;
    last.current.calls = gl.info.render.calls;
    last.current.triangles = gl.info.render.triangles;
    gl.info.reset();
  });

  return null;
}
