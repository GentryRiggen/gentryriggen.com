"use client";

import { useEffect, useRef, type ComponentRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { gridLength } from "@/lib/ship-builder/model/grid";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import {
  CAMERA_TARGET,
  MAX_POLAR_ANGLE,
  shouldReframe,
  viewPosition,
} from "./cameraViews";

export default function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const get = useThree((state) => state.get);
  const camera = useShipBuilderStore((s) => s.camera);
  const lengthSegments = useShipBuilderStore((s) => s.ship.hull.lengthSegments);
  // What the camera was last framed for: a new preset request always
  // reframes, a hull length change only when it's big (e.g. a load).
  const framed = useRef<{
    camera: typeof camera;
    lengthSegments: number;
  } | null>(null);

  useEffect(() => {
    const last = framed.current;
    if (
      last &&
      last.camera === camera &&
      !shouldReframe(last.lengthSegments, lengthSegments)
    ) {
      return;
    }
    framed.current = { camera, lengthSegments };

    const lengthCells = gridLength(useShipBuilderStore.getState().ship);
    const orbit = controls.current;
    // With damping on, update() only applies a fraction of any leftover drag
    // momentum, so a preset would drift off its pose. Flush the momentum with
    // damping off, place the camera, then settle once more before restoring.
    if (orbit) {
      orbit.enableDamping = false;
      orbit.update();
    }
    get().camera.position.set(...viewPosition(camera.view, lengthCells));
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
      maxDistance={90}
      maxPolarAngle={MAX_POLAR_ANGLE}
    />
  );
}
