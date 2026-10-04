"use client";

import { useCallback, useEffect, useRef, type ComponentRef } from "react";
import { MOUSE, TOUCH } from "three";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { bowLength, sternLength } from "@/lib/ship-builder/model/hullEnds";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
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

// Left orbits (Shift/Ctrl/Meta + left pans, built into OrbitControls), the
// wheel zooms and right pans. One finger orbits; two pinch and pan.
const MOUSE_BUTTONS = {
  LEFT: MOUSE.ROTATE,
  MIDDLE: MOUSE.DOLLY,
  RIGHT: MOUSE.PAN,
};
const TOUCHES = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

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
    if (!orbit) return;
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
      minDistance={6}
      maxDistance={MAX_VIEW_DISTANCE}
      maxPolarAngle={maxPolarAngleFor(view)}
    />
  );
}
