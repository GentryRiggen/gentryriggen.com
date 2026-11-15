"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { prefersReducedMotion } from "@/components/game-audio/channels";
import { setTimeScale } from "@/lib/planet-smasher/fxClock";
import { createSlowMo } from "./slowMoClock";

export { slowMoScale } from "./slowMoClock";

/** The longest real step counted (a hidden tab must not skip the beat). */
const MAX_REAL_STEP = 0.25;

/**
 * Mounted while an ending plays: slows every effect for the first beat and
 * pushes the camera in. Unmounting (the ending over, New planet, a planet
 * switch) always puts time and the camera back.
 */
export default function SlowMo() {
  const camera = useThree((s) => s.camera);
  const ctl = useMemo(
    () =>
      createSlowMo({
        setTimeScale,
        scaleCamera: (k) => camera.position.multiplyScalar(k),
        reducedMotion: prefersReducedMotion(),
      }),
    [camera]
  );
  useEffect(() => () => ctl.dispose(), [ctl]);
  // Real time, not stepDt: the slow motion must not slow itself down.
  useFrame((_, rawDt) => ctl.update(Math.min(rawDt, MAX_REAL_STEP)), -2);
  return null;
}
