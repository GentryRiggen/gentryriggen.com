"use client";

import { useEffect, useRef, type ComponentRef } from "react";
import { useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { gridLength } from "@/lib/ship-builder/model/grid";
import {
  useShipBuilderStore,
  type CameraView,
} from "@/lib/ship-builder/state/store";
import { DECK_Y } from "./coords";

const TARGET: [number, number, number] = [0, DECK_Y + 1.5, 0];

function viewPosition(
  view: CameraView,
  lengthCells: number
): [number, number, number] {
  const distance = lengthCells * 0.9 + 12;
  switch (view) {
    case "side":
      return [0, DECK_Y + 3, distance];
    case "top":
      return [0, distance * 1.2, 0.01];
    case "three-quarter":
      return [distance * 0.65, distance * 0.45, distance * 0.65];
  }
}

export default function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const get = useThree((state) => state.get);
  const camera = useShipBuilderStore((s) => s.camera);

  useEffect(() => {
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
      orbit.target.set(...TARGET);
      orbit.update();
      orbit.enableDamping = true;
    }
  }, [camera, get]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={TARGET}
      // maxPolarAngle only keeps the camera above the target; panning moves
      // the target, which would let the camera sink below the waterline.
      enablePan={false}
      minDistance={6}
      maxDistance={90}
      maxPolarAngle={Math.PI / 2 - 0.08}
    />
  );
}
