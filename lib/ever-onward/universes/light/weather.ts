import { formatNumber } from "../../engine/format";
import { nextRandom } from "../../engine/rng";
import type { RunState } from "../../engine/types";
import { TUNING } from "./tuning";

/**
 * The Weather Desk: a side machine in No More Night. A storm front forms by
 * itself, a forecast shows how likely it is to hit each of three towns, and
 * the player may shield some of them. A hit on a shielded town pays a bonus;
 * a hit on an unshielded one only flickers the lights. Nothing is ever lost,
 * nothing expires, and ignoring it costs nothing.
 *
 * All state lives in `run.resources` (hidden numbers) and one flag, so a save
 * without them simply reads as "not opened yet". Time is the engine's `dt`.
 */

const W = TUNING.weather;
/** Makes the desk's stream differ from the run's own. */
const SEED_MIX = 0x5bd1e995;

export const WEATHER_OPEN_FLAG = "weather-open";
export const STORM_CREWS_ID = "storm-crews";
export const WEATHER_VANE_ID = "weather-vane";

export const TOWNS = ["Rivertown", "Hilltop", "Harbor"] as const;
export const TOWN_COUNT = TOWNS.length;
const TOWN_INDEXES: readonly number[] = [0, 1, 2];

export const shieldActionId = (town: number): string =>
  `weather-shield-${town}`;
export const SHIELD_ACTION_IDS: readonly string[] =
  TOWN_INDEXES.map(shieldActionId);

export type WeatherStage = "closed" | "forming" | "forecast";

/** What the last front did, as stored in `wxLastKind`. */
export type StormKind = "none" | "held" | "vane" | "flicker";
const KINDS: readonly StormKind[] = ["none", "held", "vane", "flicker"];

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
/**
 * The desk draws from its own stream of the engine's generator (seeded once
 * from the run's, never consuming it), so opening the desk leaves the coast
 * and the evening rush exactly as they were.
 */
function draw(run: RunState): number {
  const stream = { rng: res(run, "wxSeed") | 0 };
  const value = nextRandom(stream);
  run.resources.wxSeed = stream.rng;
  return value;
}

const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

export const isWeatherOpen = (run: RunState): boolean =>
  run.phase === 1 && run.flags[WEATHER_OPEN_FLAG] === true;

/** Towns the player may shield at once: 1, or 2 with storm crews. */
export const shieldSlots = (run: RunState): number =>
  1 + owned(run, STORM_CREWS_ID);

export const hasWeatherVane = (run: RunState): boolean =>
  owned(run, WEATHER_VANE_ID) > 0;

export function weatherStage(run: RunState): WeatherStage {
  if (!isWeatherOpen(run)) return "closed";
  return res(run, "wxStage") === 1 ? "forecast" : "forming";
}

export const chanceOf = (run: RunState, town: number): number =>
  res(run, `wxChance${town}`);

const shieldOrder = (run: RunState, town: number): number =>
  res(run, `wxShield${town}`);

export const isShielded = (run: RunState, town: number): boolean =>
  shieldOrder(run, town) > 0;

export const shieldedCount = (run: RunState): number =>
  TOWN_INDEXES.filter((town) => isShielded(run, town)).length;

/** The likeliest town (the first, on a tie). */
export function likeliestTown(run: RunState): number {
  return TOWN_INDEXES.reduce(
    (best, town) => (chanceOf(run, town) > chanceOf(run, best) ? town : best),
    0
  );
}

/** The town the weather vane would shield if the player picks none. */
export const vanePick = likeliestTown;

/** Seconds left in the current stage, and how long the stage is. */
export const stageSecondsLeft = (run: RunState): number =>
  Math.max(0, res(run, "wxTimer"));
export const stageLength = (run: RunState): number =>
  Math.max(1, res(run, "wxStageLen"));

/** Fronts that have come and gone. */
export const frontsSoFar = (run: RunState): number => res(run, "wxFronts");

/** Seconds of income a held storm pays, before the vane's share. */
export const stormBonus = (run: RunState, income: number): number =>
  W.bonusSeconds * income;

export interface StormResult {
  kind: StormKind;
  town: number;
  payout: number;
}

export function lastStorm(run: RunState): StormResult {
  return {
    kind: KINDS[res(run, "wxLastKind")] ?? "none",
    town: res(run, "wxLastTown"),
    payout: res(run, "wxLastPayout"),
  };
}

/** The little result line under the map, or null before the first storm. */
export function stormResultLine(run: RunState): string | null {
  const { kind, town, payout } = lastStorm(run);
  if (kind === "none") return null;
  const name = TOWNS[town] ?? TOWNS[0];
  const power = `+${formatNumber(Math.floor(payout))} power`;
  if (kind === "held")
    return `Storm hit ${name}. Your sandbags held: ${power}!`;
  if (kind === "vane")
    return `Storm hit ${name}. The weather vane's sandbags held: ${power}.`;
  return `Storm hit ${name}. The lights flickered, then came back. No harm done.`;
}

/**
 * Three chances that add up to exactly 100, each at least `minChance`. The
 * draw is skewed so there is usually one clear favourite.
 */
export function drawChances(run: RunState): number[] {
  const raw = TOWN_INDEXES.map(() => draw(run) ** W.skew + 0.05);
  const total = raw.reduce((sum, r) => sum + r, 0);
  const pool = 100 - W.minChance * TOWN_COUNT;
  const shares = raw.map((r) => (r / total) * pool);
  const chances = shares.map((s) => Math.floor(s));
  let left = pool - chances.reduce((sum, c) => sum + c, 0);
  const remainder = (town: number): number => shares[town] - chances[town];
  const byRemainder = [...TOWN_INDEXES].sort(
    (a, b) => remainder(b) - remainder(a)
  );
  for (const town of byRemainder) {
    if (left <= 0) break;
    chances[town] += 1;
    left -= 1;
  }
  return chances.map((c) => c + W.minChance);
}

/** Where the storm lands: a draw against the forecast's own chances. */
function drawLandfall(run: RunState): number {
  const roll = draw(run) * 100;
  let cumulative = 0;
  for (const town of TOWN_INDEXES) {
    cumulative += chanceOf(run, town);
    if (roll < cumulative) return town;
  }
  return TOWN_COUNT - 1;
}

/**
 * Shields a town, or lifts the shield when it is already up. With every
 * slot used, the oldest shield moves to the new town.
 */
export function toggleShield(run: RunState, town: number): void {
  if (weatherStage(run) !== "forecast" || !TOWN_INDEXES.includes(town)) return;
  const key = `wxShield${town}`;
  if (isShielded(run, town)) {
    run.resources[key] = 0;
    return;
  }
  if (shieldedCount(run) >= shieldSlots(run)) {
    const oldest = TOWN_INDEXES.filter((t) => isShielded(run, t)).sort(
      (a, b) => shieldOrder(run, a) - shieldOrder(run, b)
    )[0];
    run.resources[`wxShield${oldest}`] = 0;
  }
  run.resources.wxShieldSeq = res(run, "wxShieldSeq") + 1;
  run.resources[key] = run.resources.wxShieldSeq;
}

function beginForecast(run: RunState): void {
  const r = run.resources;
  drawChances(run).forEach((chance, town) => {
    r[`wxChance${town}`] = chance;
    r[`wxShield${town}`] = 0;
  });
  r.wxStage = 1;
  r.wxStageLen = W.forecastSeconds;
  r.wxTimer = W.forecastSeconds;
}

function beginForming(run: RunState, seconds: number): void {
  const r = run.resources;
  r.wxStage = 0;
  r.wxStageLen = seconds;
  r.wxTimer = seconds;
}

/** The storm lands: pays a shield that held, flickers an unshielded town. */
function landfall(run: RunState, income: number): void {
  const r = run.resources;
  const town = drawLandfall(run);
  const isHandShielded = shieldedCount(run) > 0;
  const isVaneShield = !isHandShielded && hasWeatherVane(run);
  const isShieldedTown = isHandShielded
    ? isShielded(run, town)
    : isVaneShield && town === vanePick(run);
  r.wxFronts = frontsSoFar(run) + 1;
  r.wxLastTown = town;
  for (const t of TOWN_INDEXES) r[`wxShield${t}`] = 0;
  if (!isShieldedTown) {
    r.wxLastKind = KINDS.indexOf("flicker");
    r.wxLastPayout = 0;
    r.wxFlickered = res(run, "wxFlickered") + 1;
    return;
  }
  const payout = stormBonus(run, income) * (isVaneShield ? W.vaneShare : 1);
  // The bonus flows in as a short surge, not one lump (see `flowSurge`).
  r.wxPending = res(run, "wxPending") + payout;
  r.wxSurgeRate = res(run, "wxPending") / W.surgeSeconds;
  r.wxLastKind = KINDS.indexOf(isVaneShield ? "vane" : "held");
  r.wxLastPayout = payout;
  r.wxHeld = res(run, "wxHeld") + 1;
  r.wxEarned = res(run, "wxEarned") + payout;
}

/** Moves the storm power that is still flowing in to the grid. */
function flowSurge(run: RunState, dt: number): void {
  const r = run.resources;
  const pending = res(run, "wxPending");
  if (pending <= 0) return;
  const flow = Math.min(pending, res(run, "wxSurgeRate") * dt);
  r.wxPending = pending - flow;
  r.power = res(run, "power") + flow;
}

/**
 * Opens the desk (the milestone's purchase calls this, so its story line
 * lands with the purchase itself; the tick is the fallback for old saves).
 */
export function openWeather(run: RunState): void {
  if (run.flags[WEATHER_OPEN_FLAG] === true) return;
  run.flags[WEATHER_OPEN_FLAG] = true;
  run.resources.wxSeed = run.rng ^ SEED_MIX;
  beginForming(run, W.firstFormSeconds);
}

/**
 * Runs the desk for `dt` seconds. `income` is the phase's income per second
 * (read lazily: only a landfall needs it).
 */
export function tickWeather(
  run: RunState,
  dt: number,
  income: () => number
): void {
  if (run.phase !== 1) return;
  const r = run.resources;
  if (!isWeatherOpen(run)) {
    if (owned(run, "gen2") < W.openAtSteamPlants) return;
    openWeather(run);
    return;
  }
  flowSurge(run, dt);
  r.wxTimer = res(run, "wxTimer") - dt;
  if (r.wxTimer > 0) return;
  if (r.wxStage === 1) {
    landfall(run, income());
    beginForming(run, W.formMin + draw(run) * W.formSpread);
  } else {
    beginForecast(run);
  }
}

/**
 * For the simulator's income probes: the same run, but no front ever lands
 * and no surge is pending, so a storm's bonus is not read as income.
 */
export function withoutStorms(run: RunState): RunState {
  run.resources.wxPending = 0;
  run.resources.wxTimer = Number.MAX_SAFE_INTEGER;
  return run;
}
