"use client";

import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { qualitySettings } from "@/lib/plane-builder/render/quality";
import {
  useQualityLevel,
  useQualityStore,
} from "@/lib/plane-builder/render/qualityStore";
import RenderInfoProbe from "./RenderInfoProbe";

interface StageProps {
  children: ReactNode;
}

/**
 * Frame rates that count as struggling (below) and as plenty (above). Fixed:
 * the monitor's own refresh-rate guess latches on the best sample it sees.
 */
const FPS_BOUNDS = (): [number, number] => [40, 58];

/**
 * The shared 3D canvas. Its children are the scene for the current screen. A
 * performance monitor steps quality down on slow devices (see render/quality).
 */
export default function Stage({ children }: StageProps) {
  const level = useQualityLevel();
  const report = useQualityStore((s) => s.report);
  return (
    <div
      data-testid="plane-canvas"
      data-quality={level}
      role="img"
      aria-label="3D view of your plane"
      className="relative h-full w-full touch-none select-none"
    >
      <Canvas
        shadows="percentage"
        dpr={qualitySettings(level).dpr}
        camera={{ fov: 55, position: [-12, 6, 0], near: 0.1, far: 1500 }}
      >
        <PerformanceMonitor
          bounds={FPS_BOUNDS}
          onDecline={() => report("decline")}
          onIncline={() => report("incline")}
        />
        {children}
        <RenderInfoProbe />
      </Canvas>
    </div>
  );
}
