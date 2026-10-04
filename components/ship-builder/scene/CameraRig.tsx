"use client";

import { useCallback, useEffect, useRef, type ComponentRef } from "react";
import { MOUSE, TOUCH } from "three";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import {
  CAMERA_TARGET,
  clampTarget,
  MAX_POLAR_ANGLE,
  MAX_VIEW_DISTANCE,
  panBounds,
  shipBeam,
  shouldFrame,
  type FrameRequest,
  viewPosition,
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
  // The previous request, updated on every run so that repeated single-step
  // length edits never add up to a reframe.
  const seen = useRef<FrameRequest | null>(null);

  useEffect(() => {
    const next = { camera, lengthSegments };
    const shouldPlace = shouldFrame(seen.current, next);
    seen.current = next;
    if (!shouldPlace) return;

    const lengthCells = gridLength(useShipBuilderStore.getState().ship);
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
      ...viewPosition(camera.view, lengthCells, aspect)
    );
    if (orbit) {
      orbit.target.set(...CAMERA_TARGET);
      orbit.update();
      orbit.enableDamping = true;
    }
  }, [camera, lengthSegments, get]);

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
      panBounds(lengthCells, beam)
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
  }, [lengthCells, beam]);

  // A shorter or narrower hull shrinks the box; pull the target back into it.
  useEffect(handleChange, [handleChange]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={CAMERA_TARGET}
      enablePan
      screenSpacePanning
      mouseButtons={MOUSE_BUTTONS}
      touches={TOUCHES}
      onChange={handleChange}
      minDistance={6}
      maxDistance={MAX_VIEW_DISTANCE}
      maxPolarAngle={MAX_POLAR_ANGLE}
    />
  );
}
