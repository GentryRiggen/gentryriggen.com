"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  type InstancedMesh,
  Object3D,
  PlaneGeometry,
} from "three";
import { RUNOUT } from "@/lib/plane-builder/levels/generate";
import { terrainHeight } from "@/lib/plane-builder/levels/terrain";
import type { LevelDef } from "@/lib/plane-builder/levels/types";

const WIDTH = 400;
const CELL = 8;
const BEHIND = 100;
const BEYOND = 300;
const POLE_SPACING = 50;
const POLE_HEIGHT = 6;

function buildTerrain(level: LevelDef): PlaneGeometry {
  const length = level.finishDistance + RUNOUT + BEYOND + BEHIND;
  const geometry = new PlaneGeometry(
    length,
    WIDTH,
    Math.ceil(length / CELL),
    Math.ceil(WIDTH / CELL)
  );
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(length / 2 - BEHIND, 0, 0);

  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const ground = new Color(level.palette.ground);
  const hill = new Color(level.palette.hill);
  const mixed = new Color();
  const amplitude = Math.max(level.terrain.amplitude, 1);
  for (let i = 0; i < positions.count; i += 1) {
    const height = terrainHeight(
      level.terrain,
      positions.getX(i),
      positions.getZ(i)
    );
    positions.setY(i, height);
    mixed.copy(ground).lerp(hill, Math.min(1, height / amplitude));
    colors.set([mixed.r, mixed.g, mixed.b], i * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

interface TerrainProps {
  level: LevelDef;
}

/** The ground, shaded from flat colour to hill colour, and the corridor poles. */
export default function Terrain({ level }: TerrainProps) {
  const poles = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => buildTerrain(level), [level]);
  const poleGeometry = useMemo(
    () => new CylinderGeometry(0.25, 0.25, POLE_HEIGHT, 6),
    []
  );
  const poleCount = useMemo(
    () => (Math.floor(level.finishDistance / POLE_SPACING) + 1) * 2,
    [level.finishDistance]
  );

  useLayoutEffect(() => {
    const mesh = poles.current;
    if (!mesh) return;
    const dummy = new Object3D();
    let index = 0;
    for (let x = 0; x <= level.finishDistance; x += POLE_SPACING) {
      for (const side of [-1, 1]) {
        const z = side * level.corridorHalfWidth;
        const y = terrainHeight(level.terrain, x, z) + POLE_HEIGHT / 2;
        dummy.position.set(x, y, z);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [level]);

  useLayoutEffect(
    () => () => {
      geometry.dispose();
      poleGeometry.dispose();
    },
    [geometry, poleGeometry]
  );

  return (
    <>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <instancedMesh
        key={level.id}
        ref={poles}
        args={[poleGeometry, undefined, poleCount]}
        frustumCulled={false}
        castShadow
      >
        <meshStandardMaterial color={level.palette.trim} roughness={0.8} />
      </instancedMesh>
    </>
  );
}
