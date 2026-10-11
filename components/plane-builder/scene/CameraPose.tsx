"use client";

import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";

interface CameraPoseProps {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

/** Puts the camera at `position`, looking at `target`, when it mounts. */
export default function CameraPose({ position, target }: CameraPoseProps) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.set(...position);
    camera.lookAt(...target);
    camera.updateMatrixWorld();
  }, [camera, position, target]);
  return null;
}
