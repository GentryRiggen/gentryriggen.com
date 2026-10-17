"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  type Group,
  type Material,
  type MeshStandardMaterial,
  SphereGeometry,
} from "three";
import usePrefersReducedMotion from "@/components/ship-builder/hooks/usePrefersReducedMotion";

export const FUSELAGE_RADIUS = 0.22;
export const CAPSULE_LENGTH = 1 + 2 * FUSELAGE_RADIUS;
const PROPELLER_SPEED = 30;

export type Vec3Tuple = [number, number, number];

export interface PlaneMaterials {
  body: MeshStandardMaterial;
  trim: MeshStandardMaterial;
  dark: MeshStandardMaterial;
  fire: MeshStandardMaterial;
  glow: MeshStandardMaterial;
}

/** Unit shapes shared by every plane; instances size them with `scale`. */
function createDartGeometry(): BufferGeometry {
  // Two triangles meeting at a keel: nose at +x, wing tips at z = +/-1.
  const geometry = new BufferGeometry();
  const vertices = [
    [1, 0, 0, -1, -0.35, 0, -1, 0.12, 1],
    [1, 0, 0, -1, 0.12, -1, -1, -0.35, 0],
  ].flat();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export const SHAPES = {
  fuselage: new CapsuleGeometry(FUSELAGE_RADIUS, 1, 4, 10).rotateZ(
    -Math.PI / 2
  ),
  dart: createDartGeometry(),
  box: new BoxGeometry(1, 1, 1),
  halfWing: new BoxGeometry(0.7, 0.06, 1).translate(0, 0, 0.5),
  cylinderX: new CylinderGeometry(1, 1, 1, 12).rotateZ(Math.PI / 2),
  cone: new ConeGeometry(1, 1, 10).rotateZ(-Math.PI / 2),
  sphere: new SphereGeometry(1, 10, 8),
  capsuleX: new CapsuleGeometry(1, 1, 4, 8).rotateZ(-Math.PI / 2),
};

interface PartProps {
  geometry: BufferGeometry;
  material: Material;
  position?: Vec3Tuple;
  rotation?: Vec3Tuple;
  scale?: Vec3Tuple;
}

export function Part({
  geometry,
  material,
  position,
  rotation,
  scale,
}: PartProps) {
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
    />
  );
}

interface PropellerProps {
  position: Vec3Tuple;
  size: number;
  hubMaterial: Material;
  bladeMaterial: Material;
}

export function Propeller({
  position,
  size,
  hubMaterial,
  bladeMaterial,
}: PropellerProps) {
  const spinner = useRef<Group>(null);
  const isReduced = usePrefersReducedMotion();
  useFrame((_, delta) => {
    if (isReduced || !spinner.current) return;
    spinner.current.rotation.x += Math.min(delta, 0.1) * PROPELLER_SPEED;
  });
  return (
    <group position={position}>
      <Part
        geometry={SHAPES.sphere}
        material={hubMaterial}
        scale={[size * 0.12, size * 0.12, size * 0.12]}
      />
      <group ref={spinner}>
        <Part
          geometry={SHAPES.box}
          material={bladeMaterial}
          scale={[0.03, size * 2, size * 0.14]}
        />
      </group>
    </group>
  );
}

/** A [y, z] point in the plane's side view (x is along the body). */
export type YZ = [number, number];

interface StrutProps {
  x: number;
  from: YZ;
  to: YZ;
  material: Material;
}

const STRUT_THICKNESS = 0.04;

/** A thin bar between two points, leaning across the plane's width. */
export function Strut({ x, from, to, material }: StrutProps) {
  const dy = to[0] - from[0];
  const dz = to[1] - from[1];
  return (
    <Part
      geometry={SHAPES.box}
      material={material}
      position={[x, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2]}
      rotation={[Math.atan2(dz, dy), 0, 0]}
      scale={[STRUT_THICKNESS, Math.hypot(dy, dz), STRUT_THICKNESS]}
    />
  );
}
