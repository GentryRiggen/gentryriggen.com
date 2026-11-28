"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";
import { useStore } from "zustand";
import usePrefersReducedMotion from "@/components/game-kit/usePrefersReducedMotion";
import { interiorFor } from "@/lib/shipwreck/interior";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { floorZ, walkMapFor, type WalkMap } from "@/lib/shipwreck/walk";
import type { SceneRuntime } from "../scene/runtime";

/**
 * The way in (1.16): a big amber arrow bobbing over the nearest open deck
 * door while walking her open decks (`runtime.walkArrow`, WalkRunner's
 * pick). Unlit, one draw (the arrow and its dark rim in one mesh), drawn
 * over everything (no depth test: a waypoint through the houses), turned
 * to face the eyes about the vertical and grown with distance so it reads
 * from anywhere on the deck. Not built at all until walking on a ship with
 * rooms; hidden inside, after the break and off her deck. Still (no bob)
 * with reduced motion.
 */

/** The arrow's tip stands this far over the deck at the door (m). */
export const ARROW_TIP_M = 3;
/** Its height at its smallest (m); the shape is 2 units tall. */
const ARROW_SIZE_M = 1.6;
/** Full size out to this distance, then grown with it (m). */
const ARROW_NEAR_M = 22;
/** Never grown more than this. */
const ARROW_MAX_SCALE = 4;
/** The bob: how far (in arrow sizes) and how often (Hz). */
const BOB = 0.18;
const BOB_HZ = 0.8;
/** After the rooms (10), their water (11, 12) and everything outside. */
const ARROW_ORDER = 20;
/** Linear colours: warm amber (a touch over 1: a little bloom at night). */
const AMBER: readonly [number, number, number] = [1.3, 0.72, 0.1];
const RIM: readonly [number, number, number] = [0.06, 0.03, 0.01];

/**
 * The arrow, pointing down, its tip at the origin, 2 units tall in x/y
 * (the plane faces +z): a dark rim behind the amber, one geometry.
 */
export function doorArrowGeometry(): BufferGeometry {
  // Counter-clockwise from the tip: head right, shaft, head left.
  const shape: readonly [number, number][] = [
    [0, 0],
    [0.95, 1.0],
    [0.38, 1.0],
    [0.38, 2.0],
    [-0.38, 2.0],
    [-0.38, 1.0],
    [-0.95, 1.0],
  ];
  // Head, then the shaft as two triangles.
  const tris = [0, 1, 6, 2, 3, 4, 2, 4, 5];
  const pos: number[] = [];
  const col: number[] = [];
  const layer = (grow: number, z: number, c: readonly number[]) => {
    // Grown about the middle of the head's base, so the rim is even-ish.
    for (const i of tris) {
      const [x, y] = shape[i];
      pos.push(x * grow, 1 + (y - 1) * grow, z);
      col.push(c[0], c[1], c[2]);
    }
  };
  layer(1.16, -0.02, RIM);
  layer(1, 0, AMBER);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

interface Built {
  mesh: Mesh;
  material: MeshBasicMaterial;
  /** Scratch: the arrow's tip and the eyes (world). */
  at: Vector3;
  eye: Vector3;
}

function buildArrow(): Built {
  const material = new MeshBasicMaterial({
    vertexColors: true,
    side: DoubleSide,
    fog: false,
    toneMapped: false,
    // A waypoint: seen through her houses and funnels (the staircase house
    // hides its door from most of the deck), drawn after everything.
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const mesh = new Mesh(doorArrowGeometry(), material);
  mesh.name = "walk-door-arrow";
  mesh.renderOrder = ARROW_ORDER;
  mesh.visible = false;
  return { mesh, material, at: new Vector3(), eye: new Vector3() };
}

interface DoorArrowProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
  spec: ShipSpec;
}

export default function DoorArrow({ store, runtime, spec }: DoorArrowProps) {
  const walking = useStore(store, (s) => s.camera === "walk");
  if (!walking || !interiorFor(spec.id)) return null;
  const map = walkMapFor(spec.id);
  if (!map) return null;
  return <ArrowScene key={spec.id} runtime={runtime} spec={spec} map={map} />;
}

interface SceneProps {
  runtime: SceneRuntime;
  spec: ShipSpec;
  map: WalkMap;
}

function ArrowScene({ runtime, spec, map }: SceneProps) {
  const scene = useThree((s) => s.scene);
  const reduced = usePrefersReducedMotion();
  /** Each stair's outside floor (ship-frame z), NaN for all but doors. */
  const doorZ = useMemo(
    () =>
      map.stairs.map((st) =>
        st.kind === "door"
          ? floorZ(map, st.from.area, st.from.at[0], spec, st.from.at[1])
          : NaN
      ),
    [map, spec]
  );
  // Built and disposed in one effect, so a double mount (strict mode)
  // disposes the first build instead of reusing a disposed one.
  const built = useRef<Built | null>(null);
  useEffect(() => {
    const b = buildArrow();
    built.current = b;
    scene.add(b.mesh);
    return () => {
      scene.remove(b.mesh);
      if (built.current === b) built.current = null;
      b.mesh.geometry.dispose();
      b.material.dispose();
    };
  }, [scene]);

  useFrame((state) => {
    const b = built.current;
    if (!b) return;
    const { mesh, at, eye } = b;
    const i = runtime.walkArrow;
    const part = runtime.part("whole");
    const z = i >= 0 ? doorZ[i] : NaN;
    if (
      i < 0 ||
      !Number.isFinite(z) ||
      !part ||
      runtime.broken ||
      runtime.walkInside ||
      !runtime.walker
    ) {
      mesh.visible = false;
      return;
    }
    const door = map.stairs[i].from.at;
    // Her part's local frame is three.js axes: ship x, z, −y.
    part.updateMatrixWorld();
    at.set(door[0], z + ARROW_TIP_M, -door[1]).applyMatrix4(part.matrixWorld);
    state.camera.getWorldPosition(eye);
    const d = Math.hypot(eye.x - at.x, eye.y - at.y, eye.z - at.z);
    const scale =
      (ARROW_SIZE_M / 2) *
      Math.min(ARROW_MAX_SCALE, Math.max(1, d / ARROW_NEAR_M));
    const bob = reduced
      ? 0
      : BOB *
        2 *
        scale *
        (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2 * Math.PI * BOB_HZ));
    mesh.position.set(at.x, at.y + bob, at.z);
    mesh.scale.setScalar(scale);
    // Upright, turned to face the eyes.
    mesh.rotation.set(0, Math.atan2(eye.x - at.x, eye.z - at.z), 0);
    mesh.visible = true;
  });

  return null;
}
