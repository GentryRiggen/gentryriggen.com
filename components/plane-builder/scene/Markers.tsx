"use client";

import { useLayoutEffect, useMemo } from "react";
import { DoubleSide } from "three";
import { terrainHeight } from "@/lib/plane-builder/levels/terrain";
import type { LevelDef } from "@/lib/plane-builder/levels/types";
import { MILESTONES } from "@/lib/plane-builder/sim/constants";
import { createLabelTexture } from "./signTexture";

const EDGE_GAP = 4;
const FLAG_POLE_HEIGHT = 14;
const FLAG_WIDTH = 8;
const FLAG_HEIGHT = 4;
const SIGN_SPACING = 500;
const SIGN_POST_HEIGHT = 5;
const SIGN_WIDTH = 6;
const SIGN_HEIGHT = 1.5;
/** Distance signs this close to a milestone flag would only crowd it. */
const SIGN_MILESTONE_CLEARANCE = 50;
const POLE_RADIUS = 0.2;
const POLE_COLOR = "#e5e7eb";

interface FlagSpec {
  key: string;
  x: number;
  label: string;
}

interface SignSpec {
  key: string;
  x: number;
  label: string;
}

function flagLabel(share: number): string {
  return share === 0.5 ? "Halfway!" : `${Math.round(share * 100)}%`;
}

function buildFlags(level: LevelDef): FlagSpec[] {
  return MILESTONES.map((share) => ({
    key: `flag-${share}`,
    x: level.finishDistance * share,
    label: flagLabel(share),
  }));
}

function buildSigns(level: LevelDef, flags: FlagSpec[]): SignSpec[] {
  const signs: SignSpec[] = [];
  for (let x = SIGN_SPACING; x < level.finishDistance; x += SIGN_SPACING) {
    const nearFlag = flags.some(
      (f) => Math.abs(f.x - x) < SIGN_MILESTONE_CLEARANCE
    );
    if (!nearFlag) signs.push({ key: `sign-${x}`, x, label: `${x} m` });
  }
  return signs;
}

interface MarkersProps {
  level: LevelDef;
}

/** Milestone flags along one edge of the corridor, distance signs on the other. */
export default function Markers({ level }: MarkersProps) {
  const edgeZ = level.corridorHalfWidth + EDGE_GAP;
  const flags = useMemo(() => buildFlags(level), [level]);
  const signs = useMemo(() => buildSigns(level, flags), [level, flags]);
  const flagTextures = useMemo(
    () => flags.map((f) => createLabelTexture(f.label, "#f59e0b", "#111827")),
    [flags]
  );
  const signTextures = useMemo(
    () => signs.map((s) => createLabelTexture(s.label, "#ffffff", "#0f172a")),
    [signs]
  );

  useLayoutEffect(
    () => () => flagTextures.forEach((t) => t.dispose()),
    [flagTextures]
  );
  useLayoutEffect(
    () => () => signTextures.forEach((t) => t.dispose()),
    [signTextures]
  );

  return (
    <group>
      {flags.map((flag, i) => {
        const baseY = terrainHeight(level.terrain, flag.x, edgeZ);
        return (
          <group
            key={`${level.id}-${flag.key}`}
            position={[flag.x, baseY, edgeZ]}
          >
            <mesh position={[0, FLAG_POLE_HEIGHT / 2, 0]} castShadow>
              <cylinderGeometry
                args={[POLE_RADIUS, POLE_RADIUS, FLAG_POLE_HEIGHT, 8]}
              />
              <meshStandardMaterial color={POLE_COLOR} roughness={0.6} />
            </mesh>
            {/* Faces back toward the plane and hangs out over the corridor. */}
            <mesh
              position={[
                0,
                FLAG_POLE_HEIGHT - FLAG_HEIGHT / 2,
                -FLAG_WIDTH / 2,
              ]}
              rotation={[0, -Math.PI / 2, 0]}
            >
              <planeGeometry args={[FLAG_WIDTH, FLAG_HEIGHT]} />
              <meshBasicMaterial
                map={flagTextures[i]}
                side={DoubleSide}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
      {signs.map((sign, i) => {
        const baseY = terrainHeight(level.terrain, sign.x, -edgeZ);
        return (
          <group
            key={`${level.id}-${sign.key}`}
            position={[sign.x, baseY, -edgeZ]}
          >
            <mesh position={[0, SIGN_POST_HEIGHT / 2, 0]} castShadow>
              <cylinderGeometry
                args={[POLE_RADIUS, POLE_RADIUS, SIGN_POST_HEIGHT, 8]}
              />
              <meshStandardMaterial color={POLE_COLOR} roughness={0.6} />
            </mesh>
            <mesh
              position={[0, SIGN_POST_HEIGHT, 0]}
              rotation={[0, -Math.PI / 2, 0]}
            >
              <planeGeometry args={[SIGN_WIDTH, SIGN_HEIGHT]} />
              <meshBasicMaterial
                map={signTextures[i]}
                side={DoubleSide}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
