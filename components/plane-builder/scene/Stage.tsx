"use client";

import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";

interface StageProps {
  children: ReactNode;
}

/** The shared 3D canvas. Its children are the scene for the current screen. */
export default function Stage({ children }: StageProps) {
  return (
    <div
      data-testid="plane-canvas"
      role="img"
      aria-label="3D view of your plane"
      className="relative h-full w-full touch-none select-none"
    >
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ fov: 55, position: [-12, 6, 0], near: 0.1, far: 1500 }}
      >
        {children}
      </Canvas>
    </div>
  );
}
