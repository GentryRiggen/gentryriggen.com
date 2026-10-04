"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
} from "three";
import Clouds from "./Clouds";
import { environmentFor } from "./environmentModel";
import {
  easeEnvironment,
  toRuntimeEnvironment,
  TRANSITION_RATE,
  type RuntimeEnvironment,
} from "./environmentRuntime";
import { MAX_FRAME_DELTA } from "./animationMath";
import type { GlowController } from "./GlowContext";
import type { SeaState } from "./seaState";
import SkyDome from "./SkyDome";
import Stars from "./Stars";
import { frozenTime } from "./testClock";
import type { TimeOfDay } from "./timeOfDay";

/** Water swallows distance faster than air, so the fog closes in. */
const UNDERWATER_FOG_NEAR = 40;
const UNDERWATER_FOG_FAR = 200;

interface EnvironmentProps {
  /** The live look, eased each frame; shared with the ocean. */
  current: RuntimeEnvironment;
  timeOfDay: TimeOfDay;
  seaState: SeaState;
  /** Seen from below, the ship sits in water rather than sky. */
  isBelow: boolean;
  /** Told the eased glow each frame, so lights fade in with the sky. */
  glow: GlowController;
}

/** Within this of its target the glow snaps there, so day is exactly dark. */
const GLOW_SNAP = 0.003;

/**
 * The sky, fog, weather and lights for a time of day and sea state. Switching
 * either eases `current` toward the new look over about a second.
 */
export default function Environment({
  current,
  timeOfDay,
  seaState,
  isBelow,
  glow,
}: EnvironmentProps) {
  const target = useMemo(
    () => toRuntimeEnvironment(environmentFor(timeOfDay, seaState)),
    [timeOfDay, seaState]
  );
  const background = useRef<Color>(null);
  const fog = useRef<Fog>(null);
  const ambient = useRef<AmbientLight>(null);
  const hemisphere = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);

  // Negative priority runs before the other frame callbacks without taking
  // over rendering, so the ocean and sky read an up-to-date `current`.
  useFrame((_, delta) => {
    const amount =
      frozenTime() === null
        ? Math.min(1, Math.min(delta, MAX_FRAME_DELTA) * TRANSITION_RATE)
        : 1;
    easeEnvironment(current, target, amount);

    const { colors, numbers, vectors } = current;
    const glowTarget = target.numbers.glow;
    glow.set(
      Math.abs(numbers.glow - glowTarget) < GLOW_SNAP
        ? glowTarget
        : numbers.glow
    );
    const water = isBelow ? colors.underwater : colors.skyHorizon;
    background.current?.copy(water);
    if (fog.current) {
      fog.current.color.copy(water);
      fog.current.near = isBelow ? UNDERWATER_FOG_NEAR : numbers.fogNear;
      fog.current.far = isBelow ? UNDERWATER_FOG_FAR : numbers.fogFar;
    }
    if (ambient.current) {
      ambient.current.color.copy(colors.ambient);
      ambient.current.intensity = numbers.ambientIntensity;
    }
    if (hemisphere.current) {
      hemisphere.current.color.copy(colors.hemiSky);
      hemisphere.current.groundColor.copy(colors.hemiGround);
      hemisphere.current.intensity = numbers.hemiIntensity;
    }
    if (sun.current) {
      sun.current.color.copy(colors.light);
      sun.current.intensity = numbers.lightIntensity;
      sun.current.position.copy(vectors.lightPosition);
    }
  }, -1);

  return (
    <>
      {/* Both themes share one scene, so the sky and the water are the same
          colours in light and dark mode. */}
      <color ref={background} attach="background" args={["#000000"]} />
      <fog ref={fog} attach="fog" args={["#000000", 80, 260]} />
      <group visible={!isBelow}>
        <SkyDome environment={current} />
        <Stars environment={current} />
        <Clouds environment={current} />
      </group>
      <ambientLight ref={ambient} />
      <hemisphereLight ref={hemisphere} />
      {/* The default ±5 shadow frustum clips anything past a few cells; this
          covers the longest hull (36 cells) from the light's angle. The sun
          and the moon share this light, so both cast the same shadows. */}
      <directionalLight
        ref={sun}
        castShadow
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-far={150}
        shadow-mapSize={[2048, 2048]}
      />
    </>
  );
}
