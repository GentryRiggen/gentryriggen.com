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
}

export interface LevelSpec extends Omit<
  LevelDef,
  "obstacles" | "coins" | "rings" | "fuelCans"
> {
  seed: number;
  features: FeatureSpec[];
  /** A 5-coin trail every this many metres. */
  coinEvery: number;
  ringEvery: number;
}

function place(
  spec: LevelSpec,
  feature: FeatureSpec,
  rng: () => number
): Obstacle[] {
  const out: Obstacle[] = [];
  const start = Math.max(
    feature.fromX ?? 0,
    feature.hard ? LAUNCH_CLEARANCE + feature.half.x : spec.terrain.flatUntil
  );
  const end = feature.toX ?? spec.finishDistance + RUNOUT;
  const width = spec.corridorHalfWidth;
  for (
    let x = start + rng() * feature.every;
    x < end;
    x += feature.every * (0.6 + rng() * 0.8)
  ) {
    const zs =
      feature.lateral === "edges"
        ? [width * (0.85 + rng() * 0.3), -width * (0.85 + rng() * 0.3)]
        : [(rng() * 2 - 1) * width * 0.9];
    for (const z of zs) {
      const ground = Math.max(
        terrainHeight(spec.terrain, x - feature.half.x, z),
        terrainHeight(spec.terrain, x, z),
        terrainHeight(spec.terrain, x + feature.half.x, z)
      );
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

export function buildLevel(spec: LevelSpec): LevelDef {
  const rng = createRng(spec.seed);
  const obstacles = spec.features.flatMap((f) => place(spec, f, rng));
  const end = spec.finishDistance + RUNOUT;
  const coins: Vec3[] = [];
  for (let x = 120; x < end; x += spec.coinEvery) {
    const z = (rng() * 2 - 1) * spec.corridorHalfWidth * 0.7;
    const y = terrainHeight(spec.terrain, x, z) + 6 + rng() * 30;
    for (let i = 0; i < 5; i += 1) coins.push({ x: x + i * 6, y, z });
  }
  const rings: Ring[] = [];
  for (let x = 200; x < end; x += spec.ringEvery) {
    const z = (rng() * 2 - 1) * spec.corridorHalfWidth * 0.6;
    const y = terrainHeight(spec.terrain, x, z) + 15 + rng() * 25;
    rings.push({ center: { x, y, z }, radius: 6 });
  }
  const { seed, features, coinEvery, ringEvery, ...def } = spec;
  void seed;
  void features;
  void coinEvery;
  void ringEvery;
  return { ...def, obstacles, coins, rings, fuelCans: [] };
}
