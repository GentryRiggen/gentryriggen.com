"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { TEST_HOOKS_ENABLED } from "@/lib/plane-builder/testHooks";

export interface PlaneRenderInfo {
  /** Draw calls in the last whole frame, shadow passes included. */
  calls: number;
  triangles: number;
}

declare global {
  interface Window {
    __planeBuilderRenderInfo?: () => PlaneRenderInfo;
  }
}

/**
 * Exposes the last frame's draw calls and triangles to Playwright
 * (non-production only), so the performance budget can be measured. Counts
 * accumulate across every render pass in a frame (the shadow map included) and
 * are reset just before the next one. Mirrors the Ship Builder probe.
 */
export default function RenderInfoProbe() {
  const get = useThree((state) => state.get);
  const last = useRef<PlaneRenderInfo>({ calls: 0, triangles: 0 });

  useEffect(() => {
    if (!TEST_HOOKS_ENABLED) return;
    const { info } = get().gl;
    info.autoReset = false;
    window.__planeBuilderRenderInfo = () => ({ ...last.current });
    return () => {
      info.autoReset = true;
      delete window.__planeBuilderRenderInfo;
    };
  }, [get]);

  useFrame(({ gl }) => {
    if (!TEST_HOOKS_ENABLED) return;
    last.current.calls = gl.info.render.calls;
    last.current.triangles = gl.info.render.triangles;
    gl.info.reset();
  });

  return null;
}
