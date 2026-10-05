"use client";

import { useMemo } from "react";
import { Color, Fog } from "three";
import { useFrame } from "@react-three/fiber";
import { underwaterBlend } from "./descentEffects";

const DEEP_BLUE = "#031a30";
/** At the sea floor the water closes in to this range. */
const DEEP_FOG_NEAR = 4;
const DEEP_FOG_FAR = 70;

/**
 * Closes the water in around the camera as it dips below the surface, down to
 * a dark blue murk at the sea floor. Environment rewrites the background and
 * fog from its eased look every frame (at a lower frame priority), so this
 * runs after it and only adds to what it just wrote; coming back above the
 * surface needs no restore because the next frame starts from Environment's
 * values again.
 */
export default function UnderwaterFog() {
  const deep = useMemo(() => new Color(DEEP_BLUE), []);

  useFrame((state) => {
    const blend = underwaterBlend(state.camera.position.y);
    if (blend === 0) return;
    const { background, fog } = state.scene;
    if (background instanceof Color) background.lerp(deep, blend);
    if (fog instanceof Fog) {
      fog.color.lerp(deep, blend);
      fog.near += (DEEP_FOG_NEAR - fog.near) * blend;
      fog.far += (DEEP_FOG_FAR - fog.far) * blend;
    }
  });

  return null;
}
