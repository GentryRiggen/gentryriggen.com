import type { PlanetId } from "./planets";
import { PLANETS } from "./planets";
import type { PopulationGrid } from "./population";
import { cellsWithin } from "./population";
import { uvToDir } from "./sphere";
import type { EndingFamily, EndingKind, ToolId } from "./tools";
import { TOOLS } from "./tools";

export interface PlanetState {
  planetId: PlanetId;
  /** 0..100 */
  health: number;
  population: number;
  startPopulation: number;
  /** Per-cell people. */
  remaining: Float32Array;
  /** Per-cell damage 0..1; wrecked ground takes less health damage. */
  wreck: Float32Array;
  familyDamage: Record<EndingFamily, number>;
  ended: EndingKind | null;
  /** Grid width, for cell lookups (cells are row * w + col). */
  w: number;
  h: number;
}

export interface HitResult {
  peopleLost: number;
  healthLost: number;
  /** Rounded points (ending bonus included). */
  points: number;
  /** Unrounded points, so the store can carry the fractions. */
  rawPoints: number;
  ending: EndingKind | null;
}

export const ENDING_BONUS = 100;

/**
 * Divides the health a non-finisher hit takes, so a planet lasts long enough
 * to enjoy. People lost and points are unchanged; finishers still end it.
 */
export const PLANET_TOUGHNESS = 3;

export function createPlanetState(
  planetId: PlanetId,
  grid: PopulationGrid
): PlanetState {
  const population = PLANETS[planetId].population;
  const remaining = new Float32Array(grid.weights.length);
  for (let i = 0; i < remaining.length; i++) {
    remaining[i] = grid.weights[i] * population;
  }
  return {
    planetId,
    health: 100,
    population,
    startPopulation: population,
    remaining,
    wreck: new Float32Array(grid.weights.length),
    familyDamage: { shatter: 0, molten: 0, frozen: 0, consumed: 0 },
    ended: null,
    w: grid.w,
    h: grid.h,
  };
}

/** 1% of the start population is 5 points. */
export function pointsFor(peopleLost: number, startPopulation: number): number {
  return Math.round(rawPointsFor(peopleLost, startPopulation));
}

/** The same without rounding. */
export function rawPointsFor(
  peopleLost: number,
  startPopulation: number
): number {
  if (startPopulation <= 0) return 0;
  return (peopleLost / startPopulation) * 500;
}

/** The finisher wins; otherwise the most damaged family (ties: shatter, molten, frozen, consumed). */
export function chooseEnding(
  state: PlanetState,
  finisher?: EndingKind
): EndingKind {
  if (finisher) return finisher;
  const order: EndingFamily[] = ["shatter", "molten", "frozen", "consumed"];
  let best: EndingFamily = "shatter";
  for (const f of order) {
    if (state.familyDamage[f] > state.familyDamage[best]) best = f;
  }
  return best;
}

function sumRemaining(state: PlanetState): number {
  let sum = 0;
  for (let i = 0; i < state.remaining.length; i++) sum += state.remaining[i];
  return sum;
}

/** Applies one hit with the tool's spec values. Mutates the state. */
export function applyHit(
  state: PlanetState,
  toolId: ToolId,
  u: number,
  v: number
): HitResult {
  if (state.ended) {
    return {
      peopleLost: 0,
      healthLost: 0,
      points: 0,
      rawPoints: 0,
      ending: null,
    };
  }
  const tool = TOOLS[toolId];
  const cells = cellsWithin(state, uvToDir(u, v), tool.radius);

  let wreckSum = 0;
  for (const c of cells) wreckSum += state.wreck[c];
  const w = wreckSum / cells.length;
  const power = tool.finisher ? tool.power : tool.power / PLANET_TOUGHNESS;
  const healthLost = Math.min(state.health, power * (1 - 0.7 * w));

  const before = sumRemaining(state);
  for (const c of cells) {
    state.remaining[c] -= state.remaining[c] * tool.lethality;
    state.wreck[c] = Math.min(1, state.wreck[c] + 0.5 * tool.lethality);
  }
  state.familyDamage[tool.family] += healthLost;
  state.health -= healthLost;

  let ending: EndingKind | null = null;
  if (state.health <= 1e-9 || tool.finisher) {
    ending = chooseEnding(state, tool.finisher);
    state.ended = ending;
    state.remaining.fill(0);
    state.health = 0;
  }
  const after = ending ? 0 : sumRemaining(state);
  const peopleLost = before - after;
  state.population = Math.max(0, Math.round(after));

  return {
    peopleLost,
    healthLost,
    points:
      pointsFor(peopleLost, state.startPopulation) +
      (ending ? ENDING_BONUS : 0),
    rawPoints:
      rawPointsFor(peopleLost, state.startPopulation) +
      (ending ? ENDING_BONUS : 0),
    ending,
  };
}
