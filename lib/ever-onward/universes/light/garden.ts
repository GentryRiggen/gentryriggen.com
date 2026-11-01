import type { RunState } from "../../engine/types";
import { TUNING } from "./tuning";

/**
 * The Memory Garden: a side machine in The Last Light. Every light you let go
 * plants a seed named after it. Seeds grow by themselves (sprout, bud, bloom);
 * watering by hand makes the thirsty ones grow faster for a while, and a
 * rain barrel does a little of that on its own. A bloom waits as long as it
 * takes. Picking it pays a little resolve (the currency letting go costs) and
 * warms the flame a touch, and the plant grows another, slower. Skipping the
 * water costs nothing: growth is only slower.
 *
 * Growth is plain arithmetic on the engine's `dt`, so the garden needs no
 * random numbers at all (and never touches the run's own stream). All state
 * lives in `run.resources` (hidden numbers), so a save without them simply
 * reads as "nothing planted yet".
 */

const G = TUNING.garden;

export const RAIN_BARREL_ID = "rain-barrel";
export const WATER_ACTION = "garden-water";
export const PICK_ACTION = "garden-pick";
export const GARDEN_ACTION_IDS: readonly string[] = [WATER_ACTION, PICK_ACTION];

/** One plot per light, in the order the lights are offered. */
export const GARDEN_PLANTS: readonly {
  id: string;
  name: string;
  /** The flower's petal colour, and its lighter heart. */
  petal: string;
  heart: string;
}[] = [
  {
    id: "letgo-porch",
    name: "Porch lights",
    petal: "#fbbf24",
    heart: "#fef3c7",
  },
  { id: "letgo-signs", name: "Shop signs", petal: "#fb7185", heart: "#ffe4e6" },
  {
    id: "letgo-stadium",
    name: "Stadium lights",
    petal: "#38bdf8",
    heart: "#e0f2fe",
  },
  {
    id: "letgo-bridges",
    name: "Bridge lights",
    petal: "#a78bfa",
    heart: "#ede9fe",
  },
  {
    id: "letgo-harbor",
    name: "Harbor lamps",
    petal: "#2dd4bf",
    heart: "#ccfbf1",
  },
  {
    id: "letgo-towers",
    name: "Tower windows",
    petal: "#fb923c",
    heart: "#ffedd5",
  },
  {
    id: "letgo-festival",
    name: "Festival lanterns",
    petal: "#f472b6",
    heart: "#fce7f3",
  },
  { id: "letgo-fire", name: "Campfires", petal: "#f87171", heart: "#fee2e2" },
  { id: "letgo-moon", name: "Moon mirror", petal: "#c4b5fd", heart: "#f5f3ff" },
  {
    id: "letgo-sun",
    name: "Sun collectors",
    petal: "#facc15",
    heart: "#fef9c3",
  },
  { id: "letgo-night", name: "Last stars", petal: "#93c5fd", heart: "#eff6ff" },
];
export const PLOT_COUNT = GARDEN_PLANTS.length;

export type PlantStage = "sprout" | "bud" | "bloom";
/** 0 none planted yet, then the stage a plot is in (for the scene's code). */
const STAGES: readonly PlantStage[] = ["sprout", "bud", "bloom"];

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;
const clamp01 = (n: number): number =>
  Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;

const progressKey = (plot: number): string => `gdP${plot}`;
const wetKey = (plot: number): string => `gdWet${plot}`;
const pickedKey = (plot: number): string => `gdPicked${plot}`;

const PLOTS: readonly number[] = GARDEN_PLANTS.map((_, i) => i);

/** The garden is there from the first let-go, in The Last Light only. */
export const isGardenOpen = (run: RunState): boolean =>
  run.phase === 3 && PLOTS.some((plot) => isPlanted(run, plot));

export const isPlanted = (run: RunState, plot: number): boolean =>
  owned(run, GARDEN_PLANTS[plot].id) > 0;

export const plantedCount = (run: RunState): number =>
  PLOTS.filter((plot) => isPlanted(run, plot)).length;

export const hasRainBarrel = (run: RunState): boolean =>
  owned(run, RAIN_BARREL_ID) > 0;

/** How grown a plot is, 0 (just planted) to 1 (in bloom). */
export const progressOf = (run: RunState, plot: number): number =>
  clamp01(res(run, progressKey(plot)));

export const stageOf = (run: RunState, plot: number): PlantStage => {
  const p = progressOf(run, plot);
  return p >= 1 ? "bloom" : p >= G.budAt ? "bud" : "sprout";
};

/**
 * True once a seed has sprouted. The garden's story line waits for this, so
 * the first goodbye and the first seed are not two beats at once.
 */
export const hasSprouted = (run: RunState): boolean =>
  run.phase === 3 &&
  PLOTS.some(
    (plot) => isPlanted(run, plot) && progressOf(run, plot) >= G.sproutAt
  );

/** Seconds of watered growth left for a plot. */
export const wetSecondsOf = (run: RunState, plot: number): number =>
  Math.max(0, res(run, wetKey(plot)));

export const isWet = (run: RunState, plot: number): boolean =>
  isPlanted(run, plot) &&
  progressOf(run, plot) < 1 &&
  wetSecondsOf(run, plot) > 0;

/** True once the plot has been picked (it grows back more slowly). */
export const hasRegrown = (run: RunState, plot: number): boolean =>
  res(run, pickedKey(plot)) > 0;

const isGrowing = (run: RunState, plot: number): boolean =>
  isPlanted(run, plot) && progressOf(run, plot) < 1;

/** Growing plants that are not watered right now. */
export const thirstyCount = (run: RunState): number =>
  PLOTS.filter((plot) => isGrowing(run, plot) && !isWet(run, plot)).length;

export const growingCount = (run: RunState): number =>
  PLOTS.filter((plot) => isGrowing(run, plot)).length;

export const bloomCount = (run: RunState): number =>
  PLOTS.filter((plot) => isPlanted(run, plot) && progressOf(run, plot) >= 1)
    .length;

/** Blooms picked so far, over the whole garden. */
export const picksSoFar = (run: RunState): number => res(run, "gdPicks");
export const wateringsSoFar = (run: RunState): number =>
  res(run, "gdWaterings");

/** Seconds until the watering can is ready again (0: ready). */
export const waterCooldownLeft = (run: RunState): number =>
  Math.max(0, res(run, "gdCool"));

export const canWaterNow = (run: RunState): boolean =>
  isGardenOpen(run) && waterCooldownLeft(run) <= 0 && growingCount(run) > 0;

/**
 * The garden for the scene: one base-4 digit a plot (0 nothing planted, 1
 * sprout, 2 bud, 3 bloom). Stages change a handful of times a minute, never
 * every tick, so the picture is not redrawn all the time.
 */
export function gardenCode(run: RunState): number {
  return PLOTS.reduce((code, plot) => {
    if (!isPlanted(run, plot)) return code;
    const digit = 1 + STAGES.indexOf(stageOf(run, plot));
    return code + digit * 4 ** plot;
  }, 0);
}

/** Decodes `gardenCode`: 0 none, 1 sprout, 2 bud, 3 bloom for a plot. */
export const plotDigit = (code: number, plot: number): number =>
  Math.floor(code / 4 ** plot) % 4;

/** Names of the flowers picked at least once, in the order of the lights. */
export const keepsakeNames = (run: RunState): string[] =>
  PLOTS.filter((plot) => isPlanted(run, plot) && hasRegrown(run, plot)).map(
    (plot) => GARDEN_PLANTS[plot].name
  );

/** Growth pace of an unwatered plant: 1 alone, more with the rain barrel. */
export const restingPace = (run: RunState): number =>
  1 + (hasRainBarrel(run) ? (G.wetBoost * G.rainWetSeconds) / G.rainEvery : 0);

/** The resolve a bloom is worth, given letting go's pace (resolve a second). */
export const bloomResolve = (resolvePerSecond: number): number =>
  Number.isFinite(resolvePerSecond)
    ? G.pickSeconds * Math.max(0, resolvePerSecond)
    : 0;

/** Resolve still flowing in from the last blooms picked. */
export const pendingResolve = (run: RunState): number => res(run, "gdPending");

export interface PickResult {
  blooms: number;
  payout: number;
}

export function lastPick(run: RunState): PickResult {
  return { blooms: res(run, "gdLastBlooms"), payout: res(run, "gdLastPayout") };
}

/** The little line under the buttons, or null before the first tap. */
export function gardenResultLine(run: RunState): string | null {
  const kind = res(run, "gdLastKind");
  if (kind === 1)
    return "The garden drinks it up. Everything grows a little quicker.";
  if (kind === 2) {
    const { blooms, payout } = lastPick(run);
    const what = blooms === 1 ? "a memory flower" : `${blooms} memory flowers`;
    return `You picked ${what}. Warm light fills the lantern: +${Math.max(1, Math.round(payout))} resolve.`;
  }
  return null;
}

/** Waters every plant that is still growing, then the can needs a rest. */
export function waterGarden(run: RunState): void {
  if (!canWaterNow(run)) return;
  const r = run.resources;
  for (const plot of PLOTS)
    if (isGrowing(run, plot)) r[wetKey(plot)] = G.wetSeconds;
  r.gdCool = G.waterCooldown;
  r.gdWaterings = wateringsSoFar(run) + 1;
  r.gdLastKind = 1;
}

/**
 * Picks every bloom. The plant starts again from a bud, but grows back more
 * slowly. `resolveRate` is letting go's pace right now; the payout flows in
 * over a few seconds like a warm glow, and the flame brightens a little.
 */
export function pickBlooms(run: RunState, resolveRate: number): void {
  if (!isGardenOpen(run)) return;
  const r = run.resources;
  let blooms = 0;
  for (const plot of PLOTS) {
    if (!isPlanted(run, plot) || progressOf(run, plot) < 1) continue;
    r[progressKey(plot)] = G.regrowTo;
    r[pickedKey(plot)] = res(run, pickedKey(plot)) + 1;
    blooms += 1;
  }
  if (blooms <= 0) return;
  const payout = blooms * bloomResolve(resolveRate);
  r.gdPicks = picksSoFar(run) + blooms;
  r.gdLastKind = 2;
  r.gdLastBlooms = blooms;
  r.gdLastPayout = payout;
  r.gdEarned = res(run, "gdEarned") + payout;
  r.gdPending = pendingResolve(run) + payout;
  r.gdSurgeRate = r.gdPending / G.surgeSeconds;
  if (r.flame !== undefined)
    r.flame = Math.min(TUNING.last.flameFull, r.flame + blooms * G.pickFlame);
}

/** The payout flows in over a few seconds, not as one lump. */
function flowPending(run: RunState, dt: number): void {
  const r = run.resources;
  const pending = pendingResolve(run);
  if (pending <= 0) return;
  const flow = Math.min(pending, res(run, "gdSurgeRate") * dt);
  r.gdPending = pending - flow;
  r.resolve = res(run, "resolve") + flow;
}

/** Called when the barrel is bought, so its first rain is a while off. */
export function startRain(run: RunState): void {
  run.resources.gdRain = G.rainEvery;
}

/** The barrel waters every thirsty plant for a short spell, now and then. */
function rainOn(run: RunState, dt: number): void {
  if (!hasRainBarrel(run)) return;
  const r = run.resources;
  const left = res(run, "gdRain") - dt;
  if (left > 0) {
    r.gdRain = left;
    return;
  }
  r.gdRain = left + G.rainEvery;
  for (const plot of PLOTS)
    if (isGrowing(run, plot))
      r[wetKey(plot)] = Math.max(wetSecondsOf(run, plot), G.rainWetSeconds);
}

/** Runs the garden for `dt` seconds. */
export function tickGarden(run: RunState, dt: number): void {
  flowPending(run, dt);
  if (run.phase !== 3 || run.resources.gdPaused === 1) return;
  const r = run.resources;
  r.gdCool = Math.max(0, waterCooldownLeft(run) - dt);
  rainOn(run, dt);
  for (const plot of PLOTS) {
    if (!isGrowing(run, plot)) continue;
    const wet = Math.min(wetSecondsOf(run, plot), dt);
    r[wetKey(plot)] = wetSecondsOf(run, plot) - wet;
    // Watered seconds count extra, so water only ever speeds a plant up.
    const grown = dt + G.wetBoost * wet;
    const pace = hasRegrown(run, plot) ? G.regrowPace : 1;
    r[progressKey(plot)] = clamp01(
      progressOf(run, plot) + (grown * pace) / G.growSeconds
    );
  }
}

/**
 * For the simulator's income probes: the same run, but the garden stands
 * still and nothing is pending, so a picked bloom is not read as income.
 */
export function withoutGarden(run: RunState): RunState {
  run.resources.gdPending = 0;
  run.resources.gdPaused = 1;
  return run;
}
