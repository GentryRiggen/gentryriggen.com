"use client";

import { memo, useEffect, useMemo, type Ref } from "react";
import { DoubleSide, type Group, MeshStandardMaterial } from "three";
import type { LevelId, LevelPalette } from "@/lib/plane-builder/levels/types";
import type { Tiers } from "@/lib/plane-builder/plane/catalog";
import {
  Cabin,
  EnginePods,
  JetTail,
  LandingGear,
  POD_SHARE,
  PointedNose,
  PusherPropeller,
  TwinBooms,
  WingStruts,
} from "./planeLookParts";
import { planeParts } from "./planeParts";
import {
  CAPSULE_LENGTH,
  FUSELAGE_RADIUS,
  Part,
  Propeller,
  SHAPES,
  type PlaneMaterials,
} from "./planePrimitives";

const GOLD = "#f5b82e";
const DARK = "#2f3a4a";
const FIRE = "#ff7a1a";
const GLOW_TRIM_INTENSITY = 0.5;
const GLOW_INTENSITY = 2;

function trimEmissive(
  isGold: boolean,
  isGlowTrim: boolean,
  trimColor: string
): string {
  if (isGold) return "#8a6400";
  return isGlowTrim ? trimColor : "#000000";
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
  const isGlowTrim = parts.hasGlowTrim && !parts.isGold;
  const materials = useMemo<PlaneMaterials>(
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
        emissive: trimEmissive(parts.isGold, isGlowTrim, palette.trim),
        emissiveIntensity: isGlowTrim ? GLOW_TRIM_INTENSITY : 1,
        roughness: parts.isGold ? 0.35 : 0.6,
      }),
      dark: new MeshStandardMaterial({ color: DARK, roughness: 0.5 }),
      fire: new MeshStandardMaterial({
        color: FIRE,
        emissive: FIRE,
        emissiveIntensity: 2.5,
      }),
      glow: new MeshStandardMaterial({
        color: palette.trim,
        emissive: palette.trim,
        emissiveIntensity: GLOW_INTENSITY,
      }),
    }),
    [palette.plane, palette.trim, parts.isGold, isGlowTrim]
  );

  useEffect(
    () => () => Object.values(materials).forEach((m) => m.dispose()),
    [materials]
  );

  const half = parts.wingSpan / 2;
  const tail = -parts.bodyLength / 2;
  const fuselageLength = parts.hasTwinBooms
    ? parts.bodyLength * POD_SHARE
    : parts.bodyLength;
  const fuselageX = (parts.bodyLength - fuselageLength) / 2;
  const bodyScaleX = fuselageLength / CAPSULE_LENGTH;
  const stripeRadius = FUSELAGE_RADIUS * parts.girth + 0.015;
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
            position={[fuselageX, 0, 0]}
            scale={[bodyScaleX, parts.girth, parts.girth]}
          />
          {parts.hasStripes
            ? [0.15, -0.25].map((at) => (
                <Part
                  key={at}
                  geometry={SHAPES.cylinderX}
                  material={materials.trim}
                  position={[fuselageX + at * fuselageLength, 0, 0]}
                  scale={[0.09, stripeRadius, stripeRadius]}
                />
              ))
            : null}
          {parts.hasTwinBooms ? (
            <TwinBooms parts={parts} materials={materials} />
          ) : (
            <>
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
            </>
          )}
          {wingLevels.map((y) =>
            wingSides.map((side) => (
              <group
                key={`${y}-${side}`}
                position={[0.2, y + parts.wingHeight - 0.02, 0]}
                rotation={[0, -side * parts.sweep, 0]}
              >
                <Part
                  geometry={SHAPES.halfWing}
                  material={materials.body}
                  scale={[parts.wingChord, 1, side * half]}
                />
                <Part
                  geometry={SHAPES.box}
                  material={materials.trim}
                  position={[0.01, 0, side * half]}
                  scale={[0.7 * parts.wingChord, 0.07, 0.08]}
                />
                {parts.hasWinglets ? (
                  <Part
                    geometry={SHAPES.box}
                    material={materials.trim}
                    position={[0.01, 0.1, side * half]}
                    scale={[0.2, 0.22, 0.03]}
                  />
                ) : null}
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
          {parts.hasWingStruts ? (
            <WingStruts parts={parts} materials={materials} />
          ) : null}
          {parts.hasCabin ? (
            <Cabin parts={parts} materials={materials} />
          ) : null}
          {parts.hasPointedNose ? (
            <PointedNose parts={parts} materials={materials} />
          ) : null}
        </>
      )}

      <LandingGear parts={parts} materials={materials} />

      {parts.hasTanks
        ? wingSides.map((side) => (
            <Part
              key={`tank-${side}`}
              geometry={SHAPES.capsuleX}
              material={materials.trim}
              position={[
                0.2,
                parts.wingHeight - 0.2,
                side * half * parts.tankSpan,
              ]}
              scale={[0.1, 0.1, 0.1]}
            />
          ))
        : null}

      {parts.propellers >= 1 && !parts.hasTwinBooms ? (
        <>
          <Part
            geometry={SHAPES.cone}
            material={materials.dark}
            position={[parts.bodyLength / 2 + 0.05, 0, 0]}
            scale={[0.3, 0.2, 0.2]}
          />
          <Propeller
            position={[parts.bodyLength / 2 + 0.25, 0, 0]}
            size={0.55 * parts.engineScale}
            hubMaterial={materials.dark}
            bladeMaterial={materials.dark}
          />
        </>
      ) : null}
      {parts.propellers >= 1 && parts.hasTwinBooms ? (
        <PusherPropeller parts={parts} materials={materials} />
      ) : null}
      {parts.propellers === 2 ? (
        <Propeller
          position={[tail - 0.05, 0.05, 0]}
          size={0.4}
          hubMaterial={materials.dark}
          bladeMaterial={materials.dark}
        />
      ) : null}

      {parts.enginePods > 0 ? (
        <EnginePods parts={parts} materials={materials} />
      ) : null}
      {parts.hasJetTail ? (
        <JetTail parts={parts} materials={materials} />
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
