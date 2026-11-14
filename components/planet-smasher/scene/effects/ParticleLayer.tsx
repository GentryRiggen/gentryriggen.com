"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { getPools, stepDt } from "./particles";

/** Mounted once by the EffectLayer: draws and steps the shared pools. */
export default function ParticleLayer() {
  const p = getPools();
  useEffect(() => {
    p.glow.clear();
    p.smoke.clear();
    return () => {
      p.glow.clear();
      p.smoke.clear();
      p.glow.dispose();
      p.smoke.dispose();
    };
  }, [p]);
  useFrame((state, dt) => {
    const cam = state.camera as PerspectiveCamera;
    const scale =
      (state.size.height * state.viewport.dpr * 0.5) /
      Math.tan((cam.fov * Math.PI) / 360);
    const step = stepDt(dt);
    p.glow.update(step, scale);
    p.smoke.update(step, scale);
  });
  return (
    <>
      <primitive object={p.glow.points} />
      <primitive object={p.smoke.points} />
    </>
  );
}
