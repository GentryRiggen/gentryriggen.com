"use client";

import { memo, useEffect, useMemo, useRef, type Ref } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  type Group,
  type Material,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import type { LevelId, LevelPalette } from "@/lib/plane-builder/levels/types";
import type { Tiers } from "@/lib/plane-builder/plane/catalog";
import usePrefersReducedMotion from "@/components/ship-builder/hooks/usePrefersReducedMotion";
import { planeParts } from "./planeParts";

const GOLD = "#f5b82e";
const DARK = "#2f3a4a";
const FIRE = "#ff7a1a";
const FUSELAGE_RADIUS = 0.22;
const CAPSULE_LENGTH = 1 + 2 * FUSELAGE_RADIUS;
const PROPELLER_SPEED = 30;

type Vec3Tuple = [number, number, number];

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

const SHAPES = {
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

function Part({ geometry, material, position, rotation, scale }: PartProps) {
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

function Propeller({
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

interface PlaneModelProps {
  levelId: LevelId;
  tiers: Tiers;
  palette: LevelPalette;
  /** The group flight code poses; the nose points along local +x. */
  ref?: Ref<Group>;
}

/** The player's plane, built from primitives to match its upgrade tiers. */
function PlaneModel({ levelId, tiers, palette, ref }: PlaneModelProps) {
  const parts = useMemo(() => planeParts(levelId, tiers), [levelId, tiers]);
  const materials = useMemo(
    () => ({
      body: new MeshStandardMaterial({
        color: parts.isGold ? GOLD : palette.plane,
        metalness: parts.isGold ? 0.3 : 0.1,
        emissive: parts.isGold ? "#7a5200" : "#000000",
        roughness: parts.isGold ? 0.35 : 0.6,
        side: DoubleSide,
      }),
      trim: new MeshStandardMaterial({
        color: parts.isGold ? "#ffe08a" : palette.trim,
        metalness: parts.isGold ? 0.3 : 0,
        emissive: parts.isGold ? "#8a6400" : "#000000",
        roughness: parts.isGold ? 0.35 : 0.6,
      }),
      dark: new MeshStandardMaterial({ color: DARK, roughness: 0.5 }),
      fire: new MeshStandardMaterial({
        color: FIRE,
        emissive: FIRE,
        emissiveIntensity: 2.5,
      }),
    }),
    [palette.plane, palette.trim, parts.isGold]
  );

  useEffect(
    () => () => Object.values(materials).forEach((m) => m.dispose()),
    [materials]
  );

  const half = parts.wingSpan / 2;
  const tail = -parts.bodyLength / 2;
  const bodyScaleX = parts.bodyLength / CAPSULE_LENGTH;
  const wingSides = [-1, 1] as const;
  const wingLevels = parts.hasBiplane ? [0, 0.55] : [0];

  return (
    <group ref={ref}>
      {parts.isDart ? (
        <>
          <Part
            geometry={SHAPES.dart}
            material={materials.body}
            scale={[parts.bodyLength / 2, 1, half]}
          />
          {parts.hasStripes ? (
            <Part
              geometry={SHAPES.sphere}
              material={materials.trim}
              position={[parts.bodyLength / 2 - 0.1, 0, 0]}
              scale={[0.09, 0.09, 0.09]}
            />
          ) : null}
        </>
      ) : (
        <>
          <Part
            geometry={SHAPES.fuselage}
            material={materials.body}
            scale={[bodyScaleX, 1, 1]}
          />
          {parts.hasStripes
            ? [0.15, -0.25].map((at) => (
                <Part
                  key={at}
                  geometry={SHAPES.cylinderX}
                  material={materials.trim}
                  position={[at * parts.bodyLength, 0, 0]}
                  scale={[
                    0.09,
                    FUSELAGE_RADIUS + 0.015,
                    FUSELAGE_RADIUS + 0.015,
                  ]}
                />
              ))
            : null}
          <Part
            geometry={SHAPES.box}
            material={materials.body}
            position={[tail + 0.12, 0.3, 0]}
            scale={[0.4, 0.5, 0.05]}
          />
          <Part
            geometry={SHAPES.box}
            material={materials.body}
            position={[tail + 0.12, 0.05, 0]}
            scale={[0.3, 0.04, Math.max(0.8, parts.wingSpan * 0.4)]}
          />
          {wingLevels.map((y) =>
            wingSides.map((side) => (
              <group
                key={`${y}-${side}`}
                position={[0.2, y - 0.02, 0]}
                rotation={[0, -side * parts.sweep, 0]}
              >
                <Part
                  geometry={SHAPES.halfWing}
                  material={materials.body}
                  scale={[1, 1, side * half]}
                />
                <Part
                  geometry={SHAPES.box}
                  material={materials.trim}
                  position={[0.01, 0, side * half]}
                  scale={[0.7, 0.07, 0.08]}
                />
              </group>
            ))
          )}
          {parts.hasBiplane
            ? wingSides.map((side) => (
                <Part
                  key={`strut-${side}`}
                  geometry={SHAPES.box}
                  material={materials.dark}
                  position={[0.3, 0.27, side * half * 0.55]}
                  scale={[0.04, 0.55, 0.04]}
                />
              ))
            : null}
        </>
      )}

      {parts.hasTanks
        ? wingSides.map((side) => (
            <Part
              key={`tank-${side}`}
              geometry={SHAPES.capsuleX}
              material={materials.trim}
              position={[0.2, -0.2, side * half * 0.5]}
              scale={[0.1, 0.1, 0.1]}
            />
          ))
        : null}

      {parts.propellers >= 1 ? (
        <>
          <Part
            geometry={SHAPES.cone}
            material={materials.dark}
            position={[parts.bodyLength / 2 + 0.05, 0, 0]}
            scale={[0.3, 0.2, 0.2]}
          />
          <Propeller
            position={[parts.bodyLength / 2 + 0.25, 0, 0]}
            size={0.55}
            hubMaterial={materials.dark}
            bladeMaterial={materials.dark}
          />
        </>
      ) : null}
      {parts.propellers === 2 ? (
        <Propeller
          position={[tail - 0.05, 0.05, 0]}
          size={0.4}
          hubMaterial={materials.dark}
          bladeMaterial={materials.dark}
        />
      ) : null}

      {parts.hasNacelles
        ? wingSides.map((side) => (
            <group
              key={`jet-${side}`}
              position={[0.1, -0.12, side * half * 0.3]}
            >
              <Part
                geometry={SHAPES.cylinderX}
                material={materials.dark}
                scale={[0.9, 0.17, 0.17]}
              />
              <Part
                geometry={SHAPES.cone}
                material={materials.trim}
                position={[0.55, 0, 0]}
                scale={[0.2, 0.15, 0.15]}
              />
              {parts.hasAfterburner ? (
                <Part
                  geometry={SHAPES.cone}
                  material={materials.fire}
                  position={[-0.95, 0, 0]}
                  rotation={[0, Math.PI, 0]}
                  scale={[0.9, 0.13, 0.13]}
                />
              ) : null}
            </group>
          ))
        : null}
    </group>
  );
}

export default memo(PlaneModel);
