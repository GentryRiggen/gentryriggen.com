"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { getWalkState } from "@/lib/ship-builder/state/walkLive";
import { walkInput } from "@/lib/ship-builder/state/walkInput";
import { MAX_FRAME_DELTA } from "./animationMath";
import { useShipAnimation } from "./ShipAnimationContext";
import { walkCamera } from "./walkCamera";

/** Head-bob: size in cells and radians a second while moving. */
const HEAD_BOB_SIZE = 0.012;
const HEAD_BOB_SPEED = 9;

const eye = new Vector3();
const look = new Vector3();

/**
 * Puts the camera at the walker's eyes. Rendered inside the ship's bobbing
 * group, so the ship's rise, fall and roll carry the view with her: the pose
 * is worked out in the ship's frame and taken to the world through the
 * group's own matrix each frame. The horizon stays level (world up).
 */
export default function WalkEyes() {
  const group = useRef<Group>(null);
  const phase = useRef(0);
  const { reducedMotion } = useShipAnimation();
  const get = useThree((state) => state.get);

  useFrame((_, delta) => {
    const holder = group.current;
    const walk = getWalkState();
    const { ship, walk: status } = useShipBuilderStore.getState();
    if (!holder || !walk || status.status !== "walking") return;
    const pose = walkCamera(walk, ship);

    const isMoving = walkInput.forward !== 0 || walkInput.strafe !== 0;
    const hasHeadBob = isMoving && !reducedMotion;
    if (hasHeadBob) {
      phase.current += Math.min(delta, MAX_FRAME_DELTA) * HEAD_BOB_SPEED;
    }
    const bob = hasHeadBob ? Math.sin(phase.current) * HEAD_BOB_SIZE : 0;

    // The parent bob group moved this frame; refresh its matrices first.
    holder.updateWorldMatrix(true, false);
    eye.set(pose.eye[0], pose.eye[1] + bob, pose.eye[2]);
    look.set(...pose.target);
    holder.localToWorld(eye);
    holder.localToWorld(look);
    const { camera } = get();
    camera.position.copy(eye);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
  });

  return <group ref={group} />;
}
