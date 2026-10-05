"use client";

import { Environment as ReflectionMap, Lightformer } from "@react-three/drei";
import { reflectionFor } from "./environmentModel";
import type { TimeOfDay } from "./timeOfDay";

/** Distance of the panels from the ship; only their direction matters. */
const PANEL_DISTANCE = 12;
const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;
/** Cube face size: reflections are soft, so a tiny map is plenty. */
const MAP_RESOLUTION = 64;

/** Each side panel, placed round the ship and turned to face it. */
const SIDE_ANGLES = [0, QUARTER_TURN, HALF_TURN, -QUARTER_TURN] as const;

interface ReflectionEnvironmentProps {
  timeOfDay: TimeOfDay;
}

/**
 * A reflection map generated in code (no HDR to download, so it works
 * offline): a few glowing panels baked once into a small cube map. Metal and
 * glass pick it up, and `environmentIntensity` keeps it faint enough that
 * paint colours stay true. Re-keyed per time of day, so the map is baked again
 * with that time's colours; a baked frame is cheap and the switch is rare.
 */
export default function ReflectionEnvironment({
  timeOfDay,
}: ReflectionEnvironmentProps) {
  const { top, side, bottom, intensity } = reflectionFor(timeOfDay);
  return (
    <ReflectionMap
      key={timeOfDay}
      resolution={MAP_RESOLUTION}
      frames={1}
      environmentIntensity={intensity}
    >
      <Lightformer
        form="rect"
        color={top}
        intensity={2}
        position={[0, PANEL_DISTANCE, 0]}
        rotation={[QUARTER_TURN, 0, 0]}
        scale={PANEL_DISTANCE * 2}
      />
      <Lightformer
        form="rect"
        color={bottom}
        intensity={1}
        position={[0, -PANEL_DISTANCE, 0]}
        rotation={[-QUARTER_TURN, 0, 0]}
        scale={PANEL_DISTANCE * 2}
      />
      {SIDE_ANGLES.map((angle) => (
        <Lightformer
          key={angle}
          form="rect"
          color={side}
          intensity={1.2}
          position={[
            Math.sin(angle) * PANEL_DISTANCE,
            2,
            Math.cos(angle) * PANEL_DISTANCE,
          ]}
          rotation={[0, angle + HALF_TURN, 0]}
          scale={[PANEL_DISTANCE, PANEL_DISTANCE / 2, 1]}
        />
      ))}
    </ReflectionMap>
  );
}
