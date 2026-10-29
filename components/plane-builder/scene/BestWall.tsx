"use client";

import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  DoubleSide,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import { terrainHeight } from "@/lib/plane-builder/levels/terrain";
import type { LevelDef } from "@/lib/plane-builder/levels/types";
import { CEILING } from "@/lib/plane-builder/sim/constants";
import PropGlb from "./GlbProp";

const WALL_COLOR = "56, 189, 248";
/** Opacity at the foot of the wall; it fades to clear at the top. */
const BASE_OPACITY = 0.45;
/** How far the wall reaches above the highest ground under it, m. */
const HEADROOM = CEILING + 30;
/** Extra width past each corridor edge, m. */
const SIDE_MARGIN = 20;
/** Ground samples across the corridor, to find the wall's foot and top. */
const SAMPLES = 24;
/** The pylon glb's height, m (assets/blender/parts/prop-bestpylon.py). */
const PYLON_MODEL_HEIGHT = 130;

/** A tall strip that is strong blue at the bottom and clear at the top. */
function createFadeTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    gradient.addColorStop(0, `rgba(${WALL_COLOR}, ${BASE_OPACITY})`);
    gradient.addColorStop(1, `rgba(${WALL_COLOR}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

interface BestWallProps {
  level: LevelDef;
  /** The best distance so far, m. Nothing is drawn without one. */
  best: number;
}

/**
 * A see-through blue wall across the whole corridor at the best distance, so
 * the player can see the point to beat and fly through it.
 */
export default function BestWall({ level, best }: BestWallProps) {
  const isShown = best > 0 && best < level.finishDistance;
  const span = level.corridorHalfWidth + SIDE_MARGIN;

  // The foot sits on the lowest ground across the corridor (the ground hides
  // the rest), the top clears the highest ground by HEADROOM.
  const { foot, height } = useMemo(() => {
    let low = Infinity;
    let high = -Infinity;
    for (let i = 0; i <= SAMPLES; i += 1) {
      const z = -span + (2 * span * i) / SAMPLES;
      const h = terrainHeight(level.terrain, best, z);
      low = Math.min(low, h);
      high = Math.max(high, h);
    }
    return { foot: low - 2, height: high - low + 2 + HEADROOM };
  }, [level.terrain, best, span]);

  const geometry = useMemo(
    () => new PlaneGeometry(span * 2, height),
    [span, height]
  );
  const texture = useMemo(
    () => (isShown ? createFadeTexture() : null),
    [isShown]
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => texture?.dispose(), [texture]);

  if (!isShown || !texture) return null;
  return (
    <>
      <mesh
        geometry={geometry}
        // A plane faces +z; turn it to face the flight path along x.
        rotation={[0, Math.PI / 2, 0]}
        position={[best, foot + height / 2, 0]}
        renderOrder={1}
      >
        <meshBasicMaterial
          map={texture}
          transparent
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      {/* A pylon at each end, as tall as the wall, so its edges read. */}
      <PropGlb name="bestPylon" palette={level.palette} fallback={null}>
        {(pylon) => (
          <>
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                geometry={pylon}
                position={[best, foot, side * span]}
                scale={[1, height / PYLON_MODEL_HEIGHT, 1]}
              >
                <meshStandardMaterial vertexColors roughness={0.6} />
              </mesh>
            ))}
          </>
        )}
      </PropGlb>
    </>
  );
}
