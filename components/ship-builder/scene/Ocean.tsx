"use client";

import { useEffect, useMemo } from "react";
import { Color, Float32BufferAttribute, PlaneGeometry } from "three";
import { OCEAN_SEGMENTS, OCEAN_SIZE, oceanDepthMix } from "./oceanGradient";
import { PALETTE } from "./palette";

/** A segmented plane with a per-vertex radial gradient around the origin. */
function createOceanGeometry(): PlaneGeometry {
  const geometry = new PlaneGeometry(
    OCEAN_SIZE,
    OCEAN_SIZE,
    OCEAN_SEGMENTS,
    OCEAN_SEGMENTS
  );
  const near = new Color(PALETTE.sea.near);
  const far = new Color(PALETTE.sea.far);
  const shade = new Color();
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    // The plane is still in its local XY here; it's laid flat by the mesh.
    const distance = Math.hypot(positions.getX(i), positions.getY(i));
    shade.lerpColors(near, far, oceanDepthMix(distance));
    shade.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

export default function Ocean() {
  const geometry = useMemo(() => createOceanGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.35}
        metalness={0.1}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}
