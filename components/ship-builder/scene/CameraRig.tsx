"use client";

import { useEffect, useRef, type ComponentRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import {
  CAMERA_TARGET,
  MAX_POLAR_ANGLE,
  MAX_VIEW_DISTANCE,
  shouldFrame,
  type FrameRequest,
  viewPosition,
} from "./cameraViews";

export default function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const get = useThree((state) => state.get);
  const camera = useShipBuilderStore((s) => s.camera);
  const lengthSegments = useShipBuilderStore((s) => s.ship.hull.lengthSegments);
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

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={CAMERA_TARGET}
      // maxPolarAngle only keeps the camera above the target; panning moves
      // the target, which would let the camera sink below the waterline.
      enablePan={false}
      minDistance={6}
      maxDistance={MAX_VIEW_DISTANCE}
      maxPolarAngle={MAX_POLAR_ANGLE}
    />
  );
}
