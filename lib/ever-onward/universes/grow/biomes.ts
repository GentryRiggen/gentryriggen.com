import type { ActionDef, RunState } from "../../engine/types";
import { PHASE_WORLD } from "./resources";
import { TUNING } from "./tuning";
import { worldFocus } from "./forks";
import { nurserySpread } from "./knowhow";
import { isDry, rainOutlook, waterLevel } from "./water";

/**
 * The green world's mix: one slider for each biome says how much of the
 * planet it should be, and the land moves toward the mix a little at a time,
 * so changing your mind takes a minute or so. Every biome adds green income
 * in its own way:
 *  - forest: steady green, and it asks little of the water;
 *  - jungle: the most green, but it drinks, so it needs rivers and rain;
 *  - meadow: bees and birds help every planting spread faster;
 *  - wetland: stores water and seeps it back, a little green on the side.
 * A biome's gain flattens the more of the planet it covers, so mixing beats
 * piling everything into one. And a biome that covers too much of the green
 * catches a blight: it rots and pays less until it is back under the line.
 * There is no cure but the mix. The jungle's thirst grows faster than its
 * size, so the water is a second pressure well before any blight line, and
 * the rain (which drifts) moves how much jungle the tank can carry.
 */

const T = TUNING.world;

export const BIOMES = ["forest", "jungle", "meadow", "wetland"] as const;
export type Biome = (typeof BIOMES)[number];

export const BIOME_LABELS: Readonly<Record<Biome, string>> = {
  forest: "Forest",
  jungle: "Jungle",
  meadow: "Meadow",
  wetland: "Wetland",
};

export const PERK_WORDS: Readonly<Record<Biome, string>> = {
  forest: "steady green, and easy on the water",
  jungle: "the most green, and it drinks the most water",
  meadow: "helps all the green spread faster",
  wetland: "holds water for dry spells, and a little green",
};

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, n));

const SHARE_IDS: Readonly<Record<Biome, string>> = {
  forest: "bmForest",
  jungle: "bmJungle",
  meadow: "bmMeadow",
  wetland: "bmWetland",
};
const wantId = (biome: Biome): string => `bmWant${BIOMES.indexOf(biome)}`;
const blightId = (biome: Biome): string => `bmBlight${BIOMES.indexOf(biome)}`;

export const MAX_POINTS = T.maxPoints;

export const moreActionId = (biome: Biome): string => `world-more-${biome}`;
export const lessActionId = (biome: Biome): string => `world-less-${biome}`;
export const MIX_ACTION_IDS: readonly string[] = BIOMES.flatMap((b) => [
  moreActionId(b),
  lessActionId(b),
]);

/**
 * A biome the world's fork has closed: old forest closes the wetland,
 * wetland closes the forest, for the rest of the run.
 */
export function isBiomeLocked(run: RunState, biome: Biome): boolean {
  const focus = worldFocus(run);
  return (
    (focus === "forest" && biome === "wetland") ||
    (focus === "wetland" && biome === "forest")
  );
}

/** Slider points on a biome (0 to MAX_POINTS); a closed biome holds none. */
export function pointsOf(run: RunState, biome: Biome): number {
  if (isBiomeLocked(run, biome)) return 0;
  const stored = run.resources[wantId(biome)];
  return clamp(
    Math.round(stored ?? T.startMix[BIOMES.indexOf(biome)]),
    0,
    MAX_POINTS
  );
}

const totalPoints = (run: RunState): number =>
  BIOMES.reduce((sum, b) => sum + pointsOf(run, b), 0);

/** The share of the whole mix a biome's slider asks for, 0 to 1. */
export function targetShare(run: RunState, biome: Biome): number {
  const total = totalPoints(run);
  if (total > 0) return pointsOf(run, biome) / total;
  // A choice that closed the only biome with points leaves the sliders
  // empty: the open biomes share the planet evenly until the player moves them.
  const open = BIOMES.filter((b) => !isBiomeLocked(run, b));
  return open.includes(biome) ? 1 / open.length : 0;
}

/** How much of the planet this biome covers, 0 to 1. */
export const biomeShare = (run: RunState, biome: Biome): number =>
  clamp(res(run, SHARE_IDS[biome]), 0, 1);

/** How much of the planet is green, 0 to 1. */
export const worldCover = (run: RunState): number =>
  clamp(
    BIOMES.reduce((sum, b) => sum + biomeShare(run, b), 0),
    0,
    1
  );

/** How much of the planet the green has reached so far (before the mix settles). */
export const reachedCover = (run: RunState): number =>
  clamp(Math.max(res(run, "bmCover"), worldCover(run)), 0, 1);

/** How rotten this biome is, 0 (healthy) to 1. */
export const blightOf = (run: RunState, biome: Biome): number =>
  clamp(res(run, blightId(biome)), 0, 1);

/** The biome with the worst rot, or null while the world is healthy. */
export function blightedBiome(run: RunState): Biome | null {
  let worst: Biome | null = null;
  for (const b of BIOMES)
    if (
      blightOf(run, b) >= T.blightShows &&
      (worst === null || blightOf(run, b) > blightOf(run, worst))
    )
      worst = b;
  return worst;
}

/**
 * A biome's share of the green land (not of the whole planet), so a lopsided
 * mix starts to show as soon as there is some green to be lopsided.
 */
export const landShare = (run: RunState, biome: Biome): number =>
  biomeShare(run, biome) / Math.max(worldCover(run), T.blightMinCover);

/** The rot a biome is about to catch: its share of the land is past the line. */
export const isOverGrown = (run: RunState, biome: Biome): boolean =>
  landShare(run, biome) > T.blightAt;

/**
 * True while the mix needs a look: some biome is rotting or about to, or the
 * tank is running low or the rain has turned dry with a thirsty jungle on
 * the land.
 */
export const needsMixing = (run: RunState): boolean =>
  blightedBiome(run) !== null ||
  BIOMES.some((b) => landShare(run, b) > T.blightAt - 0.04) ||
  isDry(run) ||
  ((waterLevel(run) < T.lowTank ||
    rainOutlook(run) < TUNING.water.dryOutlook) &&
    biomeShare(run, "jungle") > T.thirstyJungle);

/** True for a few seconds after the rot first showed (the scene flashes it). */
export const justBlighted = (run: RunState): boolean =>
  res(run, "bmBlightAt") > 0 &&
  run.time - res(run, "bmBlightAt") < T.healShowSeconds;

/** True for a few seconds after the world healed (the scene's green wave). */
export const justHealed = (run: RunState): boolean =>
  res(run, "bmHealedAt") > 0 &&
  run.time - res(run, "bmHealedAt") < T.healShowSeconds;

/** Times a blight has started, and times the world has healed. */
export const blightsSoFar = (run: RunState): number => res(run, "bmBlights");
export const healsSoFar = (run: RunState): number => res(run, "bmHealed");

/** What the log counts: blights that started plus times the world healed. */
export const mixEvents = (run: RunState): number =>
  blightsSoFar(run) + healsSoFar(run);

/** The log line for the latest blight or healing, or null before the first. */
export function mixResultLine(run: RunState): string | null {
  if (mixEvents(run) <= 0) return null;
  const healedLast =
    healsSoFar(run) > 0 && res(run, "bmHealedAt") >= res(run, "bmBlightAt");
  const name = (id: string) =>
    BIOME_LABELS[BIOMES[clamp(Math.round(res(run, id)), 0, 3)]].toLowerCase();
  return healedLast
    ? `The blight in the ${name("bmHealedWho")} is gone. The land is healthy again.`
    : `A blight started in the ${name("bmBlightWho")}. It rots and pays much less.`;
}

/** Times a slider has been moved. */
export const switchesSoFar = (run: RunState): number => res(run, "bmSwitches");

/** What a fully grown biome adds to green income, with the fork's focus. */
export function greenPerOf(run: RunState, biome: Biome): number {
  const focus = worldFocus(run);
  const f = TUNING.forks.world;
  const boost =
    focus === "forest" && biome === "forest"
      ? f.forestGreen
      : focus === "wetland" && biome === "wetland"
        ? f.wetlandGreen
        : 1;
  return T.greenPer[biome] * boost;
}

/** A biome's gain at a share: fast at first, flattening toward 1. */
export const curve = (share: number): number => share * (2 - share);

/** A biome's gain with its rot taken off. */
export const healthyGain = (run: RunState, biome: Biome): number =>
  curve(biomeShare(run, biome)) * (1 - T.blightCut * blightOf(run, biome));

/**
 * A biome's own perk right now, in its own kind of number: forest and jungle
 * give a fraction of extra green income, meadow a fraction of extra spread
 * speed, wetland the units of water it adds to the tank.
 */
export function biomePerk(run: RunState, biome: Biome): number {
  const gain = healthyGain(run, biome);
  if (biome === "meadow") return T.meadowSpread * gain;
  if (biome === "wetland") return T.water.wetlandCapacity * gain;
  return greenPerOf(run, biome) * gain;
}

/** The green income multiplier from all the biomes together. */
export const greenMult = (run: RunState): number =>
  1 +
  BIOMES.reduce((sum, b) => sum + greenPerOf(run, b) * healthyGain(run, b), 0);

/** Moves a biome's slider by one point (a closed biome cannot be moved). */
export function nudgeBiome(run: RunState, biome: Biome, by: 1 | -1): void {
  if (!canNudge(run, biome, by)) return;
  // Write every slider, so an old save without them takes the start mix.
  for (const b of BIOMES) run.resources[wantId(b)] = pointsOf(run, b);
  run.resources[wantId(biome)] = pointsOf(run, biome) + by;
  run.resources.bmSwitches = res(run, "bmSwitches") + 1;
}

/** True when the slider can move that way (the mix always keeps something). */
export function canNudge(run: RunState, biome: Biome, by: 1 | -1): boolean {
  if (isBiomeLocked(run, biome)) return false;
  const now = pointsOf(run, biome);
  if (by > 0) return now < MAX_POINTS;
  return now > 0 && totalPoints(run) > 1;
}

/** Share of the planet the green reaches each second right now. */
export function spreadRate(run: RunState): number {
  const owned = (id: string) => run.owned[id] ?? 0;
  const focus =
    worldFocus(run) === "forest" ? TUNING.forks.world.forestSpread : 1;
  return (
    (T.spreadBase +
      T.spreadPerRover * owned("planting-rover") +
      T.spreadPerSeeder * owned("sky-seeder")) *
    (1 + biomePerk(run, "meadow")) *
    focus *
    nurserySpread(run)
  );
}

/** Starts the world bare, with the start mix on the sliders. */
export function seedBiomes(run: RunState): void {
  run.resources.bmCover = 0;
  run.resources.bmSwitches = 0;
  run.resources.bmBlights = 0;
  run.resources.bmHealed = 0;
  run.resources.bmBlightAt = 0;
  run.resources.bmHealedAt = 0;
  BIOMES.forEach((b, i) => {
    run.resources[SHARE_IDS[b]] = 0;
    run.resources[wantId(b)] = T.startMix[i];
    run.resources[blightId(b)] = 0;
  });
}

/** How much a dry spell dries each biome (jungle most, wetland not at all). */
const thirstOf = (biome: Biome): number => T.dryThirst[biome];

/**
 * Moves the land for `dt` seconds: the green reaches further, each biome's
 * share moves toward its slider, a dry world sheds some, and a biome past the
 * blight line rots (and heals once it is back under).
 */
export function tickBiomes(run: RunState, dt: number): void {
  if (run.phase !== 2) return;
  const r = run.resources;
  const reached = Math.min(1, reachedCover(run) + spreadRate(run) * dt);
  r.bmCover = reached;
  const step = T.shiftPerSecond * dt;
  const dry = isDry(run);
  const next = BIOMES.map((b) => {
    const share = biomeShare(run, b);
    const goal = targetShare(run, b) * reached;
    const moved = share + clamp(goal - share, -step, step);
    return Math.max(0, moved - (dry ? T.dryErode * thirstOf(b) * dt : 0));
  });
  const total = next.reduce((sum, n) => sum + n, 0);
  const scale = total > 1 ? 1 / total : 1;
  BIOMES.forEach((b, i) => {
    r[SHARE_IDS[b]] = next[i] * scale;
  });
  tickBlight(run, dt);
}

/** The rot climbs in a biome past the line and eases once it is back under. */
function tickBlight(run: RunState, dt: number): void {
  const r = run.resources;
  for (const b of BIOMES) {
    const before = blightOf(run, b);
    const over = landShare(run, b) - T.blightAt;
    const after =
      over > 0
        ? Math.min(
            1,
            before +
              T.blightRise *
                (1 + (T.blightExtra * over) / (1 - T.blightAt)) *
                dt
          )
        : Math.max(0, before - T.blightHeal * dt);
    r[blightId(b)] = after;
    if (before < T.blightShows && after >= T.blightShows) {
      r.bmBlights = res(run, "bmBlights") + 1;
      r.bmBlightAt = run.time;
      r.bmBlightWho = BIOMES.indexOf(b);
    }
    if (before >= T.blightShows && after < T.blightShows) {
      r.bmHealed = res(run, "bmHealed") + 1;
      r.bmHealedAt = run.time;
      r.bmHealedWho = BIOMES.indexOf(b);
    }
  }
}

const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** The slider buttons: one point more or less for each biome. */
export const MIX_ACTIONS: readonly ActionDef[] = BIOMES.flatMap(
  (biome): ActionDef[] =>
    ([1, -1] as const).map((by) => ({
      id: by > 0 ? moreActionId(biome) : lessActionId(biome),
      phases: [PHASE_WORLD],
      isInline: true,
      describe: (run: RunState) => ({
        label: `${by > 0 ? "More" : "Less"} ${biome}`,
        detail: `${BIOME_LABELS[biome]}: ${PERK_WORDS[biome]}. It covers ${pct(biomeShare(run, biome))} of the world and asks for ${pct(targetShare(run, biome))}.`,
        isBlocked: !canNudge(run, biome, by),
      }),
      perform: (run: RunState) => nudgeBiome(run, biome, by),
    }))
);
