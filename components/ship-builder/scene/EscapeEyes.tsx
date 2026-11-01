"use client";

import { useFrame } from "@react-three/fiber";
import { getEscape } from "@/lib/ship-builder/state/escapeLive";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { getWalkState } from "@/lib/ship-builder/state/walkLive";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { escapeCamera } from "./escapeCamera";
import { sceneTime } from "./testClock";
import { activeEvacuation } from "./trialTimeline";
import { trialPlayback } from "./trialPlayback";

/**
 * The camera once the walker has left the deck: low in the water and bobbing
 * while they swim (or once the cold wins), leaping into a raft, or seated in
 * a boat as it lowers, rows out and bobs (see `escapeCamera`). It works in
 * the world frame, so it sits outside the ship's groups; aboard, `WalkEyes`
 * has the camera instead.
 */
export default function EscapeEyes() {
  const reducedMotion = usePrefersReducedMotion();

  useFrame((state) => {
    if (useShipBuilderStore.getState().walk.status !== "walking") return;
    const { phase } = getEscape();
    if (phase.kind === "aboard") return;
    const pose = escapeCamera(phase, {
      plan: activeEvacuation(),
      t: trialPlayback.time,
      yaw: getWalkState()?.yaw ?? 0,
      bobTime: sceneTime(state.clock.elapsedTime),
      reducedMotion,
    });
    if (!pose) return;
    const { camera } = state;
    camera.position.set(...pose.eye);
    camera.up.set(0, 1, 0);
    camera.lookAt(...pose.target);
  });

  return null;
}
