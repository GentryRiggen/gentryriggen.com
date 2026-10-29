"use client";

import { useLayoutEffect, useRef } from "react";
import type { BufferGeometry, InstancedMesh, Matrix4 } from "three";
import Surface, {
  type PartEmphasis,
  type PartTint,
  type SurfaceFinish,
} from "./Surface";

interface KitInstancesProps {
  /** A loaded detail-kit piece (shared: never disposed here). */
  geometry: BufferGeometry;
  /** One matrix per instance, in the parent's frame. */
  matrices: readonly Matrix4[];
  color: string;
  finish?: SurfaceFinish;
  tint: PartTint;
  emphasis: PartEmphasis;
}

/**
 * Every placement of one kit piece on a block as a single draw call. The
 * piece is painted with `Surface`, so ghosts, removal tints, emphasis and
 * rust reach it like any other part of the block, and its baked ambient
 * occlusion (vertex colours) darkens its crevices.
 */
export default function KitInstances({
  geometry,
  matrices,
  color,
  finish,
  tint,
  emphasis,
}: KitInstancesProps) {
  const ref = useRef<InstancedMesh>(null);
  const count = matrices.length;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    // Culling uses a sphere that must cover every instance.
    mesh.computeBoundingSphere();
  }, [matrices, geometry, count]);
  if (count === 0) return null;
  return (
    <instancedMesh key={count} ref={ref} args={[undefined, undefined, count]}>
      <primitive object={geometry} attach="geometry" dispose={null} />
      <Surface
        color={color}
        finish={finish}
        tint={tint}
        emphasis={emphasis}
        vertexColors={geometry.hasAttribute("color")}
      />
    </instancedMesh>
  );
}
