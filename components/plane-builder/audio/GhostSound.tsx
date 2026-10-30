"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  decodeGhost,
  poseAt,
  type Ghost,
} from "@/lib/plane-builder/ghost/ghost";
import { flightLive } from "@/lib/plane-builder/state/flightLive";
import { didGhostPass } from "./flightCues";
import { planeSynth } from "./planeSynth";

/** No whoosh in the first moments, when both planes are still at the sling. */
const QUIET_START_S = 2;
/** The ghost vanishes this long after its finish (see GhostPlane). */
const LINGER_S = 1.5;

interface GhostSoundProps {
  ghost: Ghost;
}

/**
 * A soft whoosh when the ghost plane and the player swap places. It only
 * listens: it reads the live flight and the saved poses, and renders nothing.
 */
export default function GhostSound({ ghost }: GhostSoundProps) {
  const poses = useMemo(() => decodeGhost(ghost), [ghost]);
  const previousDx = useRef<number | null>(null);

  useFrame(() => {
    const live = flightLive.get();
    if (!live || poses.length === 0) return;
    if (live.time < QUIET_START_S || live.time > ghost.time + LINGER_S) return;
    const pose = poseAt(poses, live.time);
    const dx = pose.x - live.x;
    const previous = previousDx.current;
    previousDx.current = dx;
    if (previous === null) return;
    const distance = Math.hypot(
      pose.x - live.x,
      pose.y - live.y,
      pose.z - live.z
    );
    if (didGhostPass(previous, dx, distance)) planeSynth.play("ghostPass");
  });

  return null;
}
