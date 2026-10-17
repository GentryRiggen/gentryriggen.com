// lib/plane-builder/levels/generate.ts
import { createRng } from "./rng";
import { terrainHeight } from "./terrain";
import type { LevelDef, Obstacle, ObstacleKind, Ring, Vec3 } from "./types";

/** Hard obstacles never start before this x. */
export const LAUNCH_CLEARANCE = 100;
/** Content continues this far past the finish. */
export const RUNOUT = 300;

export interface FeatureSpec {
  kind: ObstacleKind;
  hard: boolean;
  /** Average spacing along x, m. */
  every: number;
  half: Vec3;
  /** "anywhere" across the corridor, or hugging the two "edges". */
  lateral: "anywhere" | "edges";
  /** Extra height of the bottom above the ground (floating things). */
  float?: number;
  /** Only between these x (defaults: clearance → finish + runout). */
  fromX?: number;
  toX?: number;
  /** Spacing widens early and tightens toward the finish. Default: `hard`. */
  ramp?: boolean;
}

export interface SetPieceObstacle {
  kind: ObstacleKind;
  hard: boolean;
  x: number;
  z: number;
  half: Vec3;
  float?: number;
}

/** Heights (h) are above the terrain at (x, z). */
export interface SetPiecePoint {
  x: number;
  z: number;
  h: number;
}

export interface SetPiece {
  name: string;
  /** No generated hard obstacles in fromX..toX. */
  fromX: number;
  toX: number;
  obstacles?: SetPieceObstacle[];
  rings?: SetPiecePoint[];
  fuelCans?: SetPiecePoint[];
}

/** Rings in a chain are this far apart along x, m. */
export const RING_CHAIN_GAP = 40;

export interface LevelSpec extends Omit<
  LevelDef,
  "obstacles" | "coins" | "rings" | "fuelCans"
> {
  seed: number;
  features: FeatureSpec[];
  /** A 5-coin trail every this many metres. */
  coinEvery: number;
  ringEvery: number;
  /** One fuel can every this many metres. */
  fuelEvery: number;
  setPieces: SetPiece[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function groundUnder(
  spec: LevelSpec,
  x: number,
  z: number,
  halfX: number
): number {
  return Math.max(
    terrainHeight(spec.terrain, x - halfX, z),
    terrainHeight(spec.terrain, x, z),
    terrainHeight(spec.terrain, x + halfX, z)
  );
}

function place(
  spec: LevelSpec,
  feature: FeatureSpec,
  rng: () => number,
  clear: Array<[number, number]>
): Obstacle[] {
  const out: Obstacle[] = [];
  const start = Math.max(
    feature.fromX ?? 0,
    feature.hard ? LAUNCH_CLEARANCE + feature.half.x : spec.terrain.flatUntil
  );
  const end = feature.toX ?? spec.finishDistance + RUNOUT;
  const width = spec.corridorHalfWidth;
  const ramps = feature.ramp ?? feature.hard;
  const spacingScale = (x: number): number =>
    ramps ? 1.5 - 0.75 * clamp((x - start) / (end - start), 0, 1) : 1;
  for (
    let x = start + rng() * feature.every;
    x < end;
    x += feature.every * spacingScale(x) * (0.6 + rng() * 0.8)
  ) {
    const zs =
      feature.lateral === "edges"
        ? [width * (0.85 + rng() * 0.3), -width * (0.85 + rng() * 0.3)]
        : [(rng() * 2 - 1) * width * 0.9];
    const blocked =
      feature.hard &&
      clear.some(
        ([from, to]) => x + feature.half.x >= from && x - feature.half.x <= to
      );
    if (blocked) continue;
    for (const z of zs) {
      const ground = groundUnder(spec, x, z, feature.half.x);
      out.push({
        kind: feature.kind,
        hard: feature.hard,
        half: feature.half,
        center: { x, y: ground + (feature.float ?? 0) + feature.half.y, z },
      });
    }
  }
  return out;
}

/** Pickups must clear a hard box by this much to be reachable, m. */
const PICKUP_CLEARANCE = 2;

/** Whether a point sits inside (or right against) any hard obstacle. */
function insideHard(obstacles: Obstacle[], p: Vec3, margin: number): boolean {
  return obstacles.some(
    (o) =>
      o.hard &&
      Math.abs(p.x - o.center.x) <= o.half.x + margin &&
      Math.abs(p.y - o.center.y) <= o.half.y + margin &&
      Math.abs(p.z - o.center.z) <= o.half.z + margin
  );
}

const inWindow = (clear: Array<[number, number]>, x: number) =>
  clear.some(([from, to]) => x >= from && x <= to);

export function buildLevel(spec: LevelSpec): LevelDef {
  const rng = createRng(spec.seed);
  const clear = spec.setPieces.map((p): [number, number] => [p.fromX, p.toX]);
  const obstacles = spec.features.flatMap((f) => place(spec, f, rng, clear));
  const end = spec.finishDistance + RUNOUT;
  const coins: Vec3[] = [];
  for (let x = 120; x < end; x += spec.coinEvery) {
    const z = (rng() * 2 - 1) * spec.corridorHalfWidth * 0.7;
    const y = terrainHeight(spec.terrain, x, z) + 6 + rng() * 30;
    for (let i = 0; i < 5; i += 1) coins.push({ x: x + i * 6, y, z });
  }
  const rings: Ring[] = [];
  for (let x = 200; x < end; x += spec.ringEvery) {
    const count = 3 + Math.floor(rng() * 3); // 3-5
    let z = (rng() * 2 - 1) * spec.corridorHalfWidth * 0.6;
    let h = 15 + rng() * 20;
    for (let i = 0; i < count; i += 1) {
      const rx = x + i * RING_CHAIN_GAP;
      if (rx >= end) break;
      // Set pieces bring their own rings.
      if (!inWindow(clear, rx)) {
        rings.push({
          center: { x: rx, y: terrainHeight(spec.terrain, rx, z) + h, z },
          radius: 6,
        });
      }
      z = clamp(
        z + (rng() * 2 - 1) * 8,
        -spec.corridorHalfWidth * 0.8,
        spec.corridorHalfWidth * 0.8
      );
      h = clamp(h + (rng() * 2 - 1) * 8, 12, 40);
    }
  }
  const fuelCans: Vec3[] = [];
  for (let x = 300; x < end; x += spec.fuelEvery) {
    const z = (rng() * 2 - 1) * spec.corridorHalfWidth * 0.6;
    const y = terrainHeight(spec.terrain, x, z) + 15 + rng() * 25;
    fuelCans.push({ x, y, z });
  }
  for (const piece of spec.setPieces) {
    for (const o of piece.obstacles ?? []) {
      const ground = groundUnder(spec, o.x, o.z, o.half.x);
      obstacles.push({
        kind: o.kind,
        hard: o.hard,
        half: o.half,
        center: { x: o.x, y: ground + (o.float ?? 0) + o.half.y, z: o.z },
      });
    }
    for (const r of piece.rings ?? []) {
      rings.push({
        center: {
          x: r.x,
          y: terrainHeight(spec.terrain, r.x, r.z) + r.h,
          z: r.z,
        },
        radius: 6,
      });
    }
    for (const c of piece.fuelCans ?? []) {
      fuelCans.push({
        x: c.x,
        y: terrainHeight(spec.terrain, c.x, c.z) + c.h,
        z: c.z,
      });
    }
  }
  const { seed, features, coinEvery, ringEvery, fuelEvery, setPieces, ...def } =
    spec;
  void seed;
  void features;
  void coinEvery;
  void ringEvery;
  void fuelEvery;
  void setPieces;
  // Drop pickups that landed inside a hard obstacle: they could only be
  // reached by crashing.
  return {
    ...def,
    obstacles,
    coins: coins.filter((c) => !insideHard(obstacles, c, PICKUP_CLEARANCE)),
    rings: rings.filter(
      (r) => !insideHard(obstacles, r.center, r.radius * 0.5)
    ),
    fuelCans: fuelCans.filter(
      (c) => !insideHard(obstacles, c, PICKUP_CLEARANCE)
    ),
  };
}
