"use client";

import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { hangarFraming } from "./hangarFraming";

const TARGET = new Vector3(0, 0.1, 0);
/** From the plane toward the camera (a front three-quarter view). */
const DIRECTION = new Vector3(3.2, 1.1, -4.2).normalize();

/**
 * Frames the turntable in the part of the screen the hangar panel leaves
 * open. Re-frames when the canvas is resized or rotated.
 */
export default function HangarCamera() {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || width <= 0 || height <= 0) {
      return;
    }
    const { distance, offsetX, offsetY } = hangarFraming(
      width,
      height,
      camera.fov
    );
    camera.position.copy(DIRECTION).multiplyScalar(distance).add(TARGET);
    camera.lookAt(TARGET);
    camera.setViewOffset(width, height, offsetX, offsetY, width, height);
    camera.updateMatrixWorld();
    return () => camera.clearViewOffset();
  }, [camera, width, height]);

  return null;
}
