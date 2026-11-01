import { formatNumber } from "../../engine/format";
import type { ActionDef, RunState } from "../../engine/types";
import { PHASE_WORLD } from "./resources";
import { TUNING } from "./tuning";
import { waterLevel } from "./water";

/**
 * The green world's choice: which biome the birds and rovers spread next.
 * Every biome adds green income, each in its own way:
 *  - forest: steady green, and it asks nothing of the water;
 *  - jungle: the most green, but it drinks, so it needs rivers and rain;
 *  - meadow: feeds the pollinators, so migrating birds carry more seeds;
 *  - wetland: stores water and seeps it back, a little green on the side.
 * A biome's gain flattens the more of the planet it covers, so mixing beats
 * piling everything into one. Nothing is ever lost by switching: the
 * newly chosen biome only takes a moment to settle.
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

const PERK_WORDS: Readonly<Record<Biome, string>> = {
  forest: "steady green, and easy on the water",
  jungle: "the most green, and the thirstiest",
  meadow: "feeds the pollinators, so migrating birds carry more seeds",
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

export const spreadActionId = (biome: Biome): string => `world-spread-${biome}`;
export const SPREAD_ACTION_IDS: readonly string[] = BIOMES.map(spreadActionId);

/** The biome that is spreading right now (a fresh world spreads forest). */
export const activeBiome = (run: RunState): Biome =>
  BIOMES[clamp(Math.round(res(run, "bmActive")), 0, BIOMES.length - 1)];

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

/** A biome's gain at a share: fast at first, flattening toward 1. */
export const curve = (share: number): number => share * (2 - share);

/**
 * A biome's own perk right now, in its own kind of number: forest and jungle
 * give a fraction of extra green income, meadow a fraction of extra
 * migration seeds, wetland the units of water it adds to the tank.
 */
export function biomePerk(run: RunState, biome: Biome): number {
  const gain = curve(biomeShare(run, biome));
  if (biome === "meadow") return T.meadowSeeds * gain;
  if (biome === "wetland") return T.water.wetlandCapacity * gain;
  return T.greenPer[biome] * gain;
}

/** The green income multiplier from all the biomes together. */
export const greenMult = (run: RunState): number =>
  1 +
  BIOMES.reduce((sum, b) => sum + T.greenPer[b] * curve(biomeShare(run, b)), 0);

/** The multiplier on seeds the migrating birds carry (1 with no meadow). */
export const migrationSeedsMult = (run: RunState): number =>
  1 + biomePerk(run, "meadow");

/**
 * What one more bit of this biome is worth to a player right now, in
 * green-income terms. The jungle is worth little while the tank is low, the
 * wetland a lot, and every biome less the more of it there already is.
 */
export function biomeValue(run: RunState, biome: Biome): number {
  const room = 1 - biomeShare(run, biome);
  const level = waterLevel(run);
  switch (biome) {
    case "forest":
      return 2 * T.greenPer.forest * room;
    case "jungle":
      return 2 * T.greenPer.jungle * room * clamp((level - 0.2) / 0.6, 0.1, 1);
    case "meadow":
      return 2 * (T.greenPer.meadow + T.meadowSeeds * T.seedsWeight) * room;
    case "wetland":
      return (
        2 *
        (T.greenPer.wetland +
          T.waterWeight * clamp((0.6 - level) / 0.5, 0, 1)) *
        room
      );
  }
}

/** The biome worth spreading most right now. */
export function bestBiome(run: RunState): Biome {
  let best: Biome = BIOMES[0];
  for (const b of BIOMES)
    if (biomeValue(run, b) > biomeValue(run, best)) best = b;
  return best;
}

/** How much better the best biome is than the one spreading (1 = no better). */
export const biomeGap = (run: RunState): number =>
  biomeValue(run, bestBiome(run)) /
  Math.max(0.0001, biomeValue(run, activeBiome(run)));

/** Chooses the biome to spread (a different one takes a moment to settle). */
export function spreadBiome(run: RunState, biome: Biome): void {
  const index = BIOMES.indexOf(biome);
  if (index < 0 || index === Math.round(res(run, "bmActive"))) return;
  run.resources.bmActive = index;
  run.resources.bmSettle = T.settleSeconds;
  run.resources.bmSwitches = res(run, "bmSwitches") + 1;
}

/** Times a different biome has been chosen. */
export const switchesSoFar = (run: RunState): number => res(run, "bmSwitches");

/** Share of the planet the spreading biome gains each second right now. */
export function spreadRate(run: RunState): number {
  const owned = (id: string) => run.owned[id] ?? 0;
  const settle = clamp(res(run, "bmSettle") / T.settleSeconds, 0, 1);
  return (
    (T.spreadBase +
      T.spreadPerRover * owned("planting-rover") +
      T.spreadPerSeeder * owned("sky-seeder")) *
    (1 - (1 - T.settleFloor) * settle)
  );
}

/** Starts the world bare, with the forest spreading. */
export function seedBiomes(run: RunState): void {
  run.resources.bmActive = 0;
  run.resources.bmSettle = 0;
  run.resources.bmSwitches = 0;
  for (const b of BIOMES) run.resources[SHARE_IDS[b]] = 0;
}

/** Spreads the chosen biome for `dt` seconds, until the map is full. */
export function tickBiomes(run: RunState, dt: number): void {
  if (run.phase !== 2) return;
  const active = activeBiome(run);
  const room = 1 - worldCover(run);
  run.resources[SHARE_IDS[active]] =
    biomeShare(run, active) + Math.min(room, spreadRate(run) * dt);
  run.resources.bmSettle = Math.max(0, res(run, "bmSettle") - dt);
}

const pct = (n: number): string => `${formatNumber(Math.round(n * 100))}%`;

export const SPREAD_ACTIONS: readonly ActionDef[] = BIOMES.map((biome) => ({
  id: spreadActionId(biome),
  phases: [PHASE_WORLD],
  describe: (run) => {
    const here = activeBiome(run) === biome;
    return {
      label: here ? `${BIOME_LABELS[biome]} is spreading` : `Spread ${biome}`,
      detail: `${BIOME_LABELS[biome]}: ${PERK_WORDS[biome]}. It covers ${pct(biomeShare(run, biome))} of the world.`,
      isBlocked: here,
      hint:
        bestBiome(run) === biome && !here
          ? { text: "worth spreading", tone: "good" as const }
          : undefined,
    };
  },
  perform: (run) => spreadBiome(run, biome),
}));
