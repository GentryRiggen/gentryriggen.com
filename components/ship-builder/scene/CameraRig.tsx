"use client";

import { useCallback, useEffect, useRef, type ComponentRef } from "react";
import { MOUSE, TOUCH } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { bowLength, sternLength } from "@/lib/ship-builder/model/hullEnds";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { MAX_FRAME_DELTA } from "./animationMath";
import { cameraFollow } from "./cameraFollow";
import {
  clampTarget,
  MAX_VIEW_DISTANCE,
  maxPolarAngleFor,
  panBounds,
  shipBeam,
  shouldFrame,
  type FrameRequest,
  viewPosition,
  viewTarget,
} from "./cameraViews";
import { trialPlayback } from "./trialPlayback";

// Left orbits (Shift/Ctrl/Meta + left pans, built into OrbitControls), the
// wheel zooms and right pans. One finger orbits; two pinch and pan.
const MOUSE_BUTTONS = {
  LEFT: MOUSE.ROTATE,
  MIDDLE: MOUSE.DOLLY,
  RIGHT: MOUSE.PAN,
};
const TOUCHES = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

/** How fast the follow closes on its goal, per second (about 0.3 s to settle). */
const FOLLOW_RATE = 3;
/** The slow-mo side-on view: camera height as a share of its distance. */
const SIDE_ON_HEIGHT = 0.25;
/** The wreck framing: camera height above the target, as a share of distance. */
const WRECK_HEIGHT = 0.2;
/** Closer than this to the goal the target is simply there. */
const FOLLOW_EPSILON = 0.02;

export default function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const get = useThree((state) => state.get);
  const camera = useShipBuilderStore((s) => s.camera);
  const lengthSegments = useShipBuilderStore((s) => s.ship.hull.lengthSegments);
  const lengthCells = useShipBuilderStore((s) => gridLength(s.ship));
  const beam = useShipBuilderStore((s) => shipBeam(s.ship));
  const endLength = useShipBuilderStore((s) =>
    Math.max(bowLength(s.ship.hull.bow), sternLength(s.ship.hull.stern))
  );
  const view = camera.view;
  const reducedMotion = usePrefersReducedMotion();
  // True while the player orbits or pans, so the follow never fights a drag.
  const isDragging = useRef(false);
  // True from the first followed frame until the target is back at the view's.
  const isFollowing = useRef(false);
  // The previous request, updated on every run so that repeated single-step
  // length edits never add up to a reframe.
  const seen = useRef<FrameRequest | null>(null);

  useEffect(() => {
    const next = { camera, lengthSegments, beam };
    const shouldPlace = shouldFrame(seen.current, next);
    seen.current = next;
    if (!shouldPlace) return;

    const { ship } = useShipBuilderStore.getState();
    const lengthCells = gridLength(ship);
    const orbit = controls.current;
    // With damping on, update() only applies a fraction of any leftover drag
    // momentum, so a preset would drift off its pose. Flush the momentum with
    // damping off, place the camera, then settle once more before restoring.
    if (orbit) {
      orbit.enableDamping = false;
      orbit.update();
    }
    // Read the size here rather than subscribing to it, so a resize doesn't
    // reframe the camera.
    const { width, height } = get().size;
    const aspect = height > 0 ? width / height : 1;
    get().camera.position.set(
      ...viewPosition(camera.view, lengthCells, aspect, shipBeam(ship))
    );
    if (orbit) {
      orbit.target.set(...viewTarget(camera.view));
      orbit.update();
      orbit.enableDamping = true;
    }
  }, [camera, lengthSegments, beam, get]);

  // Keep the target near the ship after every pan (and damping step). The
  // camera moves by the same amount, so the view slides rather than turns.
  // The target's minimum height also keeps the camera above the water, since
  // maxPolarAngle only holds it above the target.
  const handleChange = useCallback(() => {
    const orbit = controls.current;
    // The follow takes the target far below the usual pan box.
    if (!orbit || isFollowing.current) return;
    const { target, object } = orbit;
    const [x, y, z] = clampTarget(
      [target.x, target.y, target.z],
      panBounds(lengthCells, beam, view, endLength)
    );
    const dx = x - target.x;
    const dy = y - target.y;
    const dz = z - target.z;
    if (dx === 0 && dy === 0 && dz === 0) return;
    target.set(x, y, z);
    object.position.set(
      object.position.x + dx,
      object.position.y + dy,
      object.position.z + dz
    );
  }, [lengthCells, beam, view, endLength]);

  // A shorter or narrower hull shrinks the box; pull the target back into it.
  useEffect(handleChange, [handleChange]);

  // While a ship sinks the orbit target follows her, and the camera moves by
  // the same amount so the player's orbit and zoom are kept. Afterwards the
  // target eases back to the view's own. Reduced motion snaps instead.
  useFrame((_, delta) => {
    const orbit = controls.current;
    if (!orbit) return;
    const { phase, sink, halves, breakup, speed } = trialPlayback;
    const follow = cameraFollow(
      { phase, sink, halves, breakup, speed },
      lengthCells
    );
    if (!follow && !isFollowing.current) return;
    isFollowing.current = true;

    const goal = follow ? follow.target : viewTarget(view);
    const amount = reducedMotion
      ? 1
      : Math.min(1, Math.min(delta, MAX_FRAME_DELTA) * FOLLOW_RATE);
    const { target, object } = orbit;
    const dx = (goal[0] - target.x) * amount;
    const dy = (goal[1] - target.y) * amount;
    const dz = (goal[2] - target.z) * amount;
    target.x += dx;
    target.y += dy;
    target.z += dz;
    object.position.x += dx;
    object.position.y += dy;
    object.position.z += dz;

    if (follow && !isDragging.current) {
      const offset = object.position.clone().sub(target);
      if (follow.isSideOn) {
        // Swing round to whichever side she is nearer, keeping the distance.
        const side = offset.z < 0 ? -1 : 1;
        const length = offset.length() / Math.hypot(1, SIDE_ON_HEIGHT);
        offset.x -= offset.x * amount;
        offset.z += (side * length - offset.z) * amount;
        offset.y += (length * SIDE_ON_HEIGHT - offset.y) * amount;
      } else if (follow.isLow) {
        // Only ever lower the camera; a player who went lower stays there.
        const limit = Math.hypot(offset.x, offset.z) * WRECK_HEIGHT;
        if (offset.y > limit) offset.y += (limit - offset.y) * amount;
      }
      object.position.copy(target).add(offset);
    }

    const distanceToGoal =
      Math.abs(goal[0] - target.x) +
      Math.abs(goal[1] - target.y) +
      Math.abs(goal[2] - target.z);
    if (!follow && distanceToGoal < FOLLOW_EPSILON) isFollowing.current = false;
    orbit.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={viewTarget(view)}
      enablePan
      screenSpacePanning
      mouseButtons={MOUSE_BUTTONS}
      touches={TOUCHES}
      onChange={handleChange}
      onStart={() => {
        isDragging.current = true;
      }}
      onEnd={() => {
        isDragging.current = false;
      }}
      minDistance={6}
      maxDistance={MAX_VIEW_DISTANCE}
      maxPolarAngle={maxPolarAngleFor(view)}
    />
  );
}
